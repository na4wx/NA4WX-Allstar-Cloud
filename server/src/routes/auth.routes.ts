import { Router, type Response } from "express";

import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { generateRefreshToken, hashRefreshToken, refreshTokenTTLMs, signAccessToken, signStepUpToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { generatePasswordResetToken, hashPasswordResetToken, passwordResetTokenTTLMs } from "../auth/passwordReset.js";
import { passwordResetRateLimiter } from "../middleware/rateLimiter.js";
import { PasswordResetModel } from "../models/PasswordReset.js";
import { SessionModel } from "../models/Session.js";
import { UserModel } from "../models/User.js";
import { sendPasswordResetEmail } from "../services/mailer.js";

export const authRouter = Router();

const refreshCookieName = "hvc_refresh";
const refreshCookiePath = "/api/auth";

function refreshCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: refreshCookiePath,
    maxAge: refreshTokenTTLMs,
  };
}

// issueSession creates a new refresh-token Session for userId, sets it
// as an httpOnly cookie, and returns a fresh access token -- the one
// place both register and login (and refresh) converge, so a session
// can't be issued two slightly different ways.
async function issueSession(userId: string, res: Response): Promise<string> {
  const refreshToken = generateRefreshToken();
  await SessionModel.create({
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTokenTTLMs),
  });
  res.cookie(refreshCookieName, refreshToken, refreshCookieOptions(env.isProduction));
  return signAccessToken(userId);
}

authRouter.post("/register", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "enter a valid email address" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  if (await UserModel.exists({ email })) {
    res.status(409).json({ error: "an account with that email already exists" });
    return;
  }
  const user = await UserModel.create({ email, passwordHash: await hashPassword(password) });
  const accessToken = await issueSession(String(user._id), res);
  res.status(201).json({ accessToken, email: user.email });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const user = await UserModel.findOne({ email });
  // Always run bcrypt.compare, even with no user found, against a fixed
  // dummy hash -- matches the local Go app's own internal/auth.Manager.Verify,
  // which does the same to keep a nonexistent-email response
  // indistinguishable in timing from a wrong-password one.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalid");
  if (!user || !passwordOk) {
    res.status(401).json({ error: "incorrect email or password" });
    return;
  }
  const accessToken = await issueSession(String(user._id), res);
  res.json({ accessToken, email: user.email });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[refreshCookieName];
  if (!token) {
    res.status(401).json({ error: "no refresh token" });
    return;
  }
  const tokenHash = hashRefreshToken(token);
  const session = await SessionModel.findOne({ refreshTokenHash: tokenHash });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    res.status(401).json({ error: "refresh token is invalid or expired" });
    return;
  }
  // Rotate: the old refresh token is revoked the instant it's used, so
  // a captured-and-replayed token only ever works once.
  session.revokedAt = new Date();
  await session.save();
  const accessToken = await issueSession(String(session.userId), res);
  res.json({ accessToken });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[refreshCookieName];
  if (token) {
    await SessionModel.updateOne({ refreshTokenHash: hashRefreshToken(token) }, { revokedAt: new Date() });
  }
  res.clearCookie(refreshCookieName, { path: refreshCookiePath });
  res.status(204).end();
});

const forgotPasswordGenericResponse = { ok: true, message: "If an account exists for that email, a reset link has been sent." };

// POST /api/auth/forgot-password always returns the identical response
// whether or not the email matches a real account, and never reveals
// which happened -- the same enumeration-resistance goal as login's own
// fixed-dummy-hash timing-safe compare, just applied to response
// content rather than timing (a full timing-safe version would also
// need a dummy delay on the no-user path; skipped here since this route
// is already rate-limited to 5/hour/IP, which is the dominant real
// defense against enumeration by request volume).
authRouter.post("/forgot-password", passwordResetRateLimiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (email) {
    const user = await UserModel.findOne({ email });
    if (user) {
      const token = generatePasswordResetToken();
      await PasswordResetModel.create({
        userId: user._id,
        tokenHash: hashPasswordResetToken(token),
        expiresAt: new Date(Date.now() + passwordResetTokenTTLMs),
      });
      const resetUrl = `${env.appUrl}/reset-password?token=${token}`;
      sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
        console.error("failed to send password reset email:", err);
      });
    }
  }
  res.json(forgotPasswordGenericResponse);
});

authRouter.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");
  if (!token) {
    res.status(400).json({ error: "missing reset token" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  const record = await PasswordResetModel.findOne({ tokenHash: hashPasswordResetToken(token) });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "this reset link is invalid or has expired" });
    return;
  }
  record.usedAt = new Date();
  await record.save();
  await UserModel.updateOne({ _id: record.userId }, { passwordHash: await hashPassword(password) });
  // A password reset logs out every session holding the old password --
  // the same reasoning as rotating a device API key invalidating that
  // credential everywhere it was in use.
  await SessionModel.updateMany({ userId: record.userId, revokedAt: null }, { revokedAt: new Date() });
  res.json({ ok: true });
});

// POST /api/auth/step-up re-checks the account password and, if it
// matches, issues a short-lived step-up token (see auth/jwt.ts) the
// client attaches to the one request it's for via the X-Step-Up-Token
// header -- see middleware/stepUpAuth.ts for the routes this gates.
authRouter.post("/step-up", requireAuth, async (req, res) => {
  const password = String(req.body?.password ?? "");
  const user = await UserModel.findById(req.userId);
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalid");
  if (!user || !passwordOk) {
    res.status(401).json({ error: "incorrect password" });
    return;
  }
  res.json({ stepUpToken: signStepUpToken(String(user._id)) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  res.json({ email: user.email });
});

import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

// accessTokenTTL is short on purpose -- see the Go app's plan doc's
// Security section (#10): a stolen access token should be useless
// again within minutes, unlike a single long-lived stateless JWT.
const accessTokenTTL = "15m";

// refreshTokenTTLMs backs Session.expiresAt. 30 days: long enough that
// an operator isn't asked to log back in constantly, short enough that
// an abandoned session doesn't stay valid indefinitely.
export const refreshTokenTTLMs = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string; // user id
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessTokenPayload, env.jwtSecret, { expiresIn: accessTokenTTL });
}

// verifyAccessToken returns the user id, or null for any invalid/expired
// token -- callers treat "null" and "wrong signature" identically, never
// distinguishing why a token failed (that distinction is not useful to
// leak to the client).
export function verifyAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
    return payload.sub;
  } catch {
    return null;
  }
}

// generateRefreshToken returns a fresh, high-entropy refresh token. Only
// its hash (see hashRefreshToken) is ever persisted -- the plaintext
// value returned here is what goes into the httpOnly cookie.
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

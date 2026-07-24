import crypto from "node:crypto";

// passwordResetTokenTTLMs -- 1 hour: long enough to actually receive
// and click the email, short enough that a stale reset link found in
// an old email/inbox search doesn't stay live indefinitely.
export const passwordResetTokenTTLMs = 60 * 60 * 1000;

// generatePasswordResetToken/hashPasswordResetToken mirror
// generateRefreshToken/hashRefreshToken in jwt.ts exactly -- a
// high-entropy random token, only its sha256 hash ever persisted (see
// models/PasswordReset.ts), the plaintext only ever living in the
// emailed URL, never in Mongo.
export function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

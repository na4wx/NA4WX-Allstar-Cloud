import { Schema, model, type InferSchemaType } from "mongoose";

// Session backs the refresh-token side of auth: a short-lived JWT
// access token (see src/auth/jwt.ts) is never stored anywhere, but the
// refresh token that mints new ones is tracked here (hashed, never
// plaintext) so it can be revoked server-side -- the same property
// HamVoipConfigGui's own internal/auth.Manager.DestroySession gives the
// local app, which a bare long-lived JWT alone would not.
const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  refreshTokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
});

export type Session = InferSchemaType<typeof sessionSchema> & { _id: import("mongoose").Types.ObjectId };

export const SessionModel = model("Session", sessionSchema);

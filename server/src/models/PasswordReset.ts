import { Schema, model, type InferSchemaType } from "mongoose";

// PasswordReset backs POST /api/auth/forgot-password and
// /reset-password -- mirrors Session.ts's own shape, since a reset
// token needs the same properties a refresh token does: only its hash
// ever persisted (see src/auth/passwordReset.ts), single-use, and
// time-bounded. expiresAt's `expires: 0` schema option is Mongoose's
// TTL-index shorthand -- MongoDB deletes the document itself once
// expiresAt passes, so there's no manual cleanup job to run.
const passwordResetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true, expires: 0 },
  usedAt: { type: Date, default: null },
});

export type PasswordReset = InferSchemaType<typeof passwordResetSchema> & { _id: import("mongoose").Types.ObjectId };

export const PasswordResetModel = model("PasswordReset", passwordResetSchema);

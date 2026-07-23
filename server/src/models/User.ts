import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export type User = InferSchemaType<typeof userSchema> & { _id: import("mongoose").Types.ObjectId };

export const UserModel = model("User", userSchema);

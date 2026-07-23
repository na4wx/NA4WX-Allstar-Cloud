import mongoose from "mongoose";

import { env } from "../config/env.js";

// connect opens the single shared Mongoose connection this whole
// process uses. Called once from src/index.ts before the HTTP/WS
// servers start listening, so nothing accepts a request before it can
// actually reach the database.
export async function connect(): Promise<void> {
  await mongoose.connect(env.mongoUri);
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect();
}

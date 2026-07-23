// Imported first and only for its side effect: patches Express's Router
// so an async route handler's rejected promise reaches errorHandler
// instead of hanging the request or crashing the process. Express 4
// doesn't do this on its own (Express 5 does).
import "express-async-errors";

import cookieParser from "cookie-parser";
import express, { type Express } from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import { authRateLimiter } from "./middleware/rateLimiter.js";
import { authRouter } from "./routes/auth.routes.js";
import { devicesRouter } from "./routes/devices.routes.js";
import { nodesRouter } from "./routes/nodes.routes.js";

export function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/auth", authRateLimiter, authRouter);
  app.use("/api/devices/:deviceId/nodes", nodesRouter);
  app.use("/api/devices", devicesRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use(errorHandler);
  return app;
}

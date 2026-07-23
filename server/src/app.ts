// Imported first and only for its side effect: patches Express's Router
// so an async route handler's rejected promise reaches errorHandler
// instead of hanging the request or crashing the process. Express 4
// doesn't do this on its own (Express 5 does).
import "express-async-errors";

import cookieParser from "cookie-parser";
import express, { type Express } from "express";

import { errorHandler } from "./middleware/errorHandler.js";
import { actionRateLimiter, authRateLimiter } from "./middleware/rateLimiter.js";
import { authRouter } from "./routes/auth.routes.js";
import { devicesRouter } from "./routes/devices.routes.js";
import { nodesRouter } from "./routes/nodes.routes.js";
import { rawconfigRouter } from "./routes/rawconfig.routes.js";
import { sa818Router } from "./routes/sa818.routes.js";
import { skywarnplusRouter } from "./routes/skywarnplus.routes.js";
import { soundScheduleRouter } from "./routes/soundSchedule.routes.js";
import { soundsRouter } from "./routes/sounds.routes.js";
import { systemRouter } from "./routes/system.routes.js";
import { wxtoneRouter } from "./routes/wxtone.routes.js";

export function buildApp(): Express {
  const app = express();
  // Default 100kb is too small for a base64-encoded audio upload (see
  // sounds.routes.ts) -- 10mb comfortably covers any single courtesy
  // tone/station-ID clip this app expects.
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRateLimiter, authRouter);
  // Mounted once, ahead of every /api/devices/* router below, so it
  // covers device management (create/rotate/revoke/delete) and every
  // relayed action route alike -- see actionRateLimiter's own doc
  // comment.
  app.use("/api/devices", actionRateLimiter);
  app.use("/api/devices/:deviceId/nodes", nodesRouter);
  app.use("/api/devices/:deviceId/system", systemRouter);
  app.use("/api/devices/:deviceId/sound-schedule", soundScheduleRouter);
  app.use("/api/devices/:deviceId/wxtone", wxtoneRouter);
  app.use("/api/devices/:deviceId/sa818", sa818Router);
  app.use("/api/devices/:deviceId/skywarn", skywarnplusRouter);
  app.use("/api/devices/:deviceId/sounds", soundsRouter);
  app.use("/api/devices/:deviceId/rawconfig", rawconfigRouter);
  app.use("/api/devices", devicesRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use(errorHandler);
  return app;
}

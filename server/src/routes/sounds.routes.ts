import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";

// soundsRouter is mounted at /api/devices/:deviceId/sounds. Relays to
// the device's sounds.* actions (see the Go app's
// internal/cloudagent/actions_sounds.go). Upload takes a longer relay
// timeout than the default 10s -- sox transcoding plus the base64
// round trip can run long on a slow SD card.
export const soundsRouter = Router({ mergeParams: true });
soundsRouter.use(requireAuth, authorizeDevice);

const uploadTimeoutMs = 30_000;

type Params = Request<{ deviceId: string }>;
type DeleteParams = Request<{ deviceId: string; name: string }>;

soundsRouter.get("/", async (req: Params, res) => {
  const files = await auditedSendAction(req, "sounds.listAll");
  res.json(files);
});

soundsRouter.post("/", async (req: Params, res) => {
  const result = await auditedSendAction(req, "sounds.upload", req.body, uploadTimeoutMs);
  res.json(result);
});

soundsRouter.delete("/:name", async (req: DeleteParams, res) => {
  await auditedSendAction(req, "sounds.delete", { name: req.params.name });
  res.status(204).end();
});

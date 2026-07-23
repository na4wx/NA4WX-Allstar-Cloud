import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";

// soundsRouter is mounted at /api/devices/:deviceId/sounds. Relays to
// the device's sounds.* actions (see the Go app's
// internal/cloudagent/actions_sounds.go). Upload and preview both take
// a longer relay timeout than the default 10s -- sox transcoding
// (either direction) plus the base64 round trip can run long on a slow
// SD card.
export const soundsRouter = Router({ mergeParams: true });
soundsRouter.use(requireAuth, authorizeDevice);

const soxRelayTimeoutMs = 30_000;

type Params = Request<{ deviceId: string }>;
type DeleteParams = Request<{ deviceId: string; name: string }>;
type PreviewParams = Request<{ deviceId: string; name: string }>;

soundsRouter.get("/", async (req: Params, res) => {
  const files = await auditedSendAction(req, "sounds.listAll");
  res.json(files);
});

soundsRouter.post("/", async (req: Params, res) => {
  const result = await auditedSendAction(req, "sounds.upload", req.body, soxRelayTimeoutMs);
  res.json(result);
});

soundsRouter.delete("/:name", async (req: DeleteParams, res) => {
  await auditedSendAction(req, "sounds.delete", { name: req.params.name });
  res.status(204).end();
});

// GET /:name/preview streams one of the operator's own custom sounds
// back as playable WAV audio, not JSON -- so the browser can point an
// <audio src> straight at this URL. Like the node-live SSE stream,
// <audio src> can't set an Authorization header, so this route relies
// on requireAuth's existing ?token= query-param fallback (see that
// middleware's own doc comment) rather than needing anything new here.
soundsRouter.get("/:name/preview", async (req: PreviewParams, res) => {
  const result = await auditedSendAction<{ dataBase64: string }>(req, "sounds.preview", { name: req.params.name }, soxRelayTimeoutMs);
  res.set("Content-Type", "audio/wav").send(Buffer.from(result.dataBase64, "base64"));
});

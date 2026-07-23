import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";

// wxtoneRouter is mounted at /api/devices/:deviceId/wxtone. Relays to
// the device's wxTone.* actions (see the Go app's
// internal/cloudagent/actions_wxtone.go) -- the same store instance
// that device's own local WX-tone poller reads, so a mapping created
// here takes effect on its own next poll tick without any restart.
export const wxtoneRouter = Router({ mergeParams: true });
wxtoneRouter.use(requireAuth, authorizeDevice);

type ListParams = Request<{ deviceId: string }>;
type DeleteParams = Request<{ deviceId: string; id: string }>;

wxtoneRouter.get("/", async (req: ListParams, res) => {
  const node = String(req.query.node ?? "");
  const entries = await auditedSendAction(req, "wxTone.list", { node });
  res.json(entries);
});

wxtoneRouter.post("/", async (req: ListParams, res) => {
  const saved = await auditedSendAction(req, "wxTone.save", req.body);
  res.json(saved);
});

wxtoneRouter.delete("/:id", async (req: DeleteParams, res) => {
  await auditedSendAction(req, "wxTone.delete", { id: req.params.id });
  res.status(204).end();
});

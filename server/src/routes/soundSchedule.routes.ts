import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice, requireDeviceRole } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";

// soundScheduleRouter is mounted at /api/devices/:deviceId/sound-schedule.
// Relays to the device's soundSchedule.* actions (see the Go app's
// internal/cloudagent/actions_soundschedule.go). Reads stay at
// authorizeDevice's own default (viewer and up); writes require editor.
export const soundScheduleRouter = Router({ mergeParams: true });
soundScheduleRouter.use(requireAuth, authorizeDevice);

type ListParams = Request<{ deviceId: string }>;
type DeleteParams = Request<{ deviceId: string; id: string }>;

soundScheduleRouter.get("/", async (req: ListParams, res) => {
  const node = String(req.query.node ?? "");
  const entries = await auditedSendAction(req, "soundSchedule.list", { node });
  res.json(entries);
});

soundScheduleRouter.post("/", requireDeviceRole("editor"), async (req: ListParams, res) => {
  const saved = await auditedSendAction(req, "soundSchedule.save", req.body);
  res.json(saved);
});

soundScheduleRouter.delete("/:id", requireDeviceRole("editor"), async (req: DeleteParams, res) => {
  await auditedSendAction(req, "soundSchedule.delete", { id: req.params.id });
  res.status(204).end();
});

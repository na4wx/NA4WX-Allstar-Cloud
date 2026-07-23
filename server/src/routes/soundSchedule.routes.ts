import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { sendAction } from "../services/relay.js";

// soundScheduleRouter is mounted at /api/devices/:deviceId/sound-schedule.
// Relays to the device's soundSchedule.* actions (see the Go app's
// internal/cloudagent/actions_soundschedule.go).
export const soundScheduleRouter = Router({ mergeParams: true });
soundScheduleRouter.use(requireAuth, authorizeDevice);

type ListParams = Request<{ deviceId: string }>;
type DeleteParams = Request<{ deviceId: string; id: string }>;

soundScheduleRouter.get("/", async (req: ListParams, res) => {
  const node = String(req.query.node ?? "");
  const entries = await sendAction(req.params.deviceId, "soundSchedule.list", { node });
  res.json(entries);
});

soundScheduleRouter.post("/", async (req: ListParams, res) => {
  const saved = await sendAction(req.params.deviceId, "soundSchedule.save", req.body);
  res.json(saved);
});

soundScheduleRouter.delete("/:id", async (req: DeleteParams, res) => {
  await sendAction(req.params.deviceId, "soundSchedule.delete", { id: req.params.id });
  res.status(204).end();
});

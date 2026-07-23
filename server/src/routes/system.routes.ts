import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { sendAction } from "../services/relay.js";

// systemRouter is mounted at /api/devices/:deviceId/system. Both routes
// relay to a capability-gated action on the device side (see the Go
// app's internal/cloudagent/actions_system.go) -- a device with its
// "Allow remote restart/reboot" setting off will reject these with a
// 400 explaining so, regardless of what this API allows.
export const systemRouter = Router({ mergeParams: true });
systemRouter.use(requireAuth, authorizeDevice);

type SystemParams = Request<{ deviceId: string }>;

systemRouter.post("/restart-asterisk", async (req: SystemParams, res) => {
  const result = await sendAction(req.params.deviceId, "system.restartAsterisk");
  res.json(result);
});

systemRouter.post("/reboot", async (req: SystemParams, res) => {
  const result = await sendAction(req.params.deviceId, "system.reboot");
  res.json(result);
});

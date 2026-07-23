import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";
import { requireStepUp } from "../middleware/stepUpAuth.js";

// systemRouter is mounted at /api/devices/:deviceId/system. Both routes
// relay to a capability-gated action on the device side (see the Go
// app's internal/cloudagent/actions_system.go) -- a device with its
// "Allow remote restart/reboot" setting off will reject these with a
// 400 explaining so, regardless of what this API allows. Both also
// require step-up auth (see middleware/stepUpAuth.ts) -- among the
// highest-risk actions this API exposes, per the Go app's plan doc's
// Security section (#5).
export const systemRouter = Router({ mergeParams: true });
systemRouter.use(requireAuth, authorizeDevice);

type SystemParams = Request<{ deviceId: string }>;

systemRouter.post("/restart-asterisk", requireStepUp, async (req: SystemParams, res) => {
  const result = await auditedSendAction(req, "system.restartAsterisk");
  res.json(result);
});

systemRouter.post("/reboot", requireStepUp, async (req: SystemParams, res) => {
  const result = await auditedSendAction(req, "system.reboot");
  res.json(result);
});

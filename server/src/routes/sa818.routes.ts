import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice, requireDeviceRole } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";

// sa818Router is mounted at /api/devices/:deviceId/sa818. Relays to the
// device's sa818.* actions (see the Go app's
// internal/cloudagent/actions_sa818.go) -- programs the SA818/DRA818
// radio module physically attached to that device over its serial
// connection. Reads stay at authorizeDevice's own default (viewer and
// up); the write requires editor -- it's a config write, just not
// reboot/restart/raw-config, so it's not admin-gated.
export const sa818Router = Router({ mergeParams: true });
sa818Router.use(requireAuth, authorizeDevice);

type Params = Request<{ deviceId: string }>;

// The module itself has no way to report its currently-programmed
// values back, so this is the closest thing to a "read" this feature
// offers -- whatever this device last recorded via sa818.program (or
// null if nothing's been sent from it yet, including devices whose
// cloudagent predates this action).
sa818Router.get("/last", async (req: Params, res) => {
  const last = await auditedSendAction(req, "sa818.last");
  res.json(last);
});

sa818Router.post("/program", requireDeviceRole("editor"), async (req: Params, res) => {
  const result = await auditedSendAction(req, "sa818.program", req.body);
  res.json(result);
});

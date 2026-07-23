import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";

// sa818Router is mounted at /api/devices/:deviceId/sa818. Relays to the
// device's sa818.program action (see the Go app's
// internal/cloudagent/actions_sa818.go) -- programs the SA818/DRA818
// radio module physically attached to that device over its serial
// connection.
export const sa818Router = Router({ mergeParams: true });
sa818Router.use(requireAuth, authorizeDevice);

type Params = Request<{ deviceId: string }>;

sa818Router.post("/program", async (req: Params, res) => {
  const result = await auditedSendAction(req, "sa818.program", req.body);
  res.json(result);
});

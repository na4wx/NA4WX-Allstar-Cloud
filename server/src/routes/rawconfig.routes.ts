import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice, requireDeviceRole } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";
import { requireStepUp } from "../middleware/stepUpAuth.js";

// rawconfigRouter is mounted at /api/devices/:deviceId/rawconfig.
// Relays to the device's rawconfig.* actions (see the Go app's
// internal/cloudagent/actions_rawconfig.go) -- every route but
// /files is refused by the device itself unless its own "Allow remote
// raw config editing" setting is on, regardless of what this API
// allows. The three write routes also require step-up auth (see
// middleware/stepUpAuth.ts) -- editing rpt.conf/iax.conf/etc. by hand
// is exactly the kind of action the Go app's plan doc's Security
// section (#5) calls out.
//
// The entire router is admin-tier only, including the two read routes
// -- unlike every other relay router, raw config can expose secrets
// (an IAX2 registration password sits in plain text in iax.conf), so
// even *reading* it is gated well above editor, not just writing it.
export const rawconfigRouter = Router({ mergeParams: true });
rawconfigRouter.use(requireAuth, authorizeDevice, requireDeviceRole("admin"));

type Params = Request<{ deviceId: string }>;
type FileParams = Request<{ deviceId: string; file: string }>;

rawconfigRouter.get("/files", async (req: Params, res) => {
  const files = await auditedSendAction(req, "rawconfig.listFiles");
  res.json(files);
});

rawconfigRouter.get("/:file", async (req: FileParams, res) => {
  const result = await auditedSendAction(req, "rawconfig.getFile", { file: req.params.file });
  res.json(result);
});

rawconfigRouter.post("/:file/key", requireStepUp, async (req: FileParams, res) => {
  const result = await auditedSendAction(req, "rawconfig.setKey", { file: req.params.file, ...req.body });
  res.json(result);
});

rawconfigRouter.post("/:file/add-key", requireStepUp, async (req: FileParams, res) => {
  const result = await auditedSendAction(req, "rawconfig.addKey", { file: req.params.file, ...req.body });
  res.json(result);
});

rawconfigRouter.post("/:file/add-section", requireStepUp, async (req: FileParams, res) => {
  const result = await auditedSendAction(req, "rawconfig.addSection", { file: req.params.file, ...req.body });
  res.json(result);
});

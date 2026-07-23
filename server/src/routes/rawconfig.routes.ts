import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { sendAction } from "../services/relay.js";

// rawconfigRouter is mounted at /api/devices/:deviceId/rawconfig.
// Relays to the device's rawconfig.* actions (see the Go app's
// internal/cloudagent/actions_rawconfig.go) -- every route but
// /files is refused by the device itself unless its own "Allow remote
// raw config editing" setting is on, regardless of what this API
// allows.
export const rawconfigRouter = Router({ mergeParams: true });
rawconfigRouter.use(requireAuth, authorizeDevice);

type Params = Request<{ deviceId: string }>;
type FileParams = Request<{ deviceId: string; file: string }>;

rawconfigRouter.get("/files", async (req: Params, res) => {
  const files = await sendAction(req.params.deviceId, "rawconfig.listFiles");
  res.json(files);
});

rawconfigRouter.get("/:file", async (req: FileParams, res) => {
  const result = await sendAction(req.params.deviceId, "rawconfig.getFile", { file: req.params.file });
  res.json(result);
});

rawconfigRouter.post("/:file/key", async (req: FileParams, res) => {
  const result = await sendAction(req.params.deviceId, "rawconfig.setKey", { file: req.params.file, ...req.body });
  res.json(result);
});

rawconfigRouter.post("/:file/add-key", async (req: FileParams, res) => {
  const result = await sendAction(req.params.deviceId, "rawconfig.addKey", { file: req.params.file, ...req.body });
  res.json(result);
});

rawconfigRouter.post("/:file/add-section", async (req: FileParams, res) => {
  const result = await sendAction(req.params.deviceId, "rawconfig.addSection", { file: req.params.file, ...req.body });
  res.json(result);
});

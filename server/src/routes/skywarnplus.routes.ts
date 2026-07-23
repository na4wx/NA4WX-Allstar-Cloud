import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { sendAction } from "../services/relay.js";

// skywarnplusRouter is mounted at /api/devices/:deviceId/skywarn.
// Relays to the device's skywarn.* actions (see the Go app's
// internal/cloudagent/actions_skywarnplus.go).
export const skywarnplusRouter = Router({ mergeParams: true });
skywarnplusRouter.use(requireAuth, authorizeDevice);

type Params = Request<{ deviceId: string }>;

// listCounties needs no device connection at all (it's this app's own
// bundled reference data on the Go side), but is still relayed through
// the device so the client only ever talks to one API shape -- see
// actionSkywarnListCounties's own doc comment for why it works even
// when SkywarnPlus itself isn't installed.
skywarnplusRouter.get("/counties", async (req: Params, res) => {
  const counties = await sendAction(req.params.deviceId, "skywarn.listCounties");
  res.json(counties);
});

skywarnplusRouter.get("/status", async (req: Params, res) => {
  const status = await sendAction(req.params.deviceId, "skywarn.getStatus");
  res.json(status);
});

skywarnplusRouter.post("/toggle", async (req: Params, res) => {
  const result = await sendAction(req.params.deviceId, "skywarn.setToggle", req.body);
  res.json(result);
});

skywarnplusRouter.post("/county-codes", async (req: Params, res) => {
  const result = await sendAction(req.params.deviceId, "skywarn.setCounties", req.body);
  res.json(result);
});

skywarnplusRouter.post("/nodes", async (req: Params, res) => {
  const result = await sendAction(req.params.deviceId, "skywarn.addNode", req.body);
  res.json(result);
});

skywarnplusRouter.post("/pushover", async (req: Params, res) => {
  const result = await sendAction(req.params.deviceId, "skywarn.setPushover", req.body);
  res.json(result);
});

skywarnplusRouter.post("/skydescribe", async (req: Params, res) => {
  const result = await sendAction(req.params.deviceId, "skywarn.setSkyDescribe", req.body);
  res.json(result);
});

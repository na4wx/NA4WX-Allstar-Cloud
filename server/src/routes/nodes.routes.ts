import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { sendAction } from "../services/relay.js";
import { subscribeNode } from "../ws/nodeLiveHub.js";

// nodesRouter is mounted at /api/devices/:deviceId/nodes (mergeParams:
// true so :deviceId from the parent path is visible here) -- every
// route relays straight through to the device's own config.* actions
// (see the Go app's internal/cloudagent/actions_config.go), never
// touching a local copy of node config: the device itself is always the
// source of truth.
export const nodesRouter = Router({ mergeParams: true });
nodesRouter.use(requireAuth, authorizeDevice);

// Express's own route-string type inference only sees each route's own
// pattern (e.g. ":number"), not params merged in at mount time from the
// parent router -- this alias documents that deviceId always comes from
// the parent (checked by authorizeDevice above) and needs an explicit
// cast to read here.
type NodeParams = Request<{ deviceId: string; number?: string }>;

nodesRouter.get("/", async (req: NodeParams, res) => {
  const numbers = await sendAction<string[]>(req.params.deviceId, "config.listNodes");
  res.json(numbers);
});

nodesRouter.get("/:number", async (req: NodeParams, res) => {
  const node = await sendAction(req.params.deviceId, "config.loadNode", { number: req.params.number });
  res.json(node);
});

// PUT (not POST) for both create and update -- config.saveNode on the
// device side is itself idempotent create-or-update (see that action's
// own doc comment), and the caller always knows the target node number
// up front (it's in the URL), so there's no separate "create without
// knowing the id yet" case the way there is for devices themselves.
nodesRouter.put("/:number", async (req: NodeParams, res) => {
  const node = { ...req.body, number: req.params.number };
  const saved = await sendAction(req.params.deviceId, "config.saveNode", node);
  res.json(saved);
});

nodesRouter.delete("/:number", async (req: NodeParams, res) => {
  await sendAction(req.params.deviceId, "config.deleteNode", { number: req.params.number });
  res.status(204).end();
});

// GET /:number/live streams this node's moment-to-moment repeater state
// (connected nodes, receiving) as Server-Sent Events. Subscribing here
// is what actually makes the device start polling that node at all --
// see nodeLiveHub's own doc comment for the two-tier design this
// implements (cheap always-on device heartbeat vs. this, an expensive
// per-node poll that only runs while someone is watching).
nodesRouter.get("/:number/live", (req: NodeParams, res) => {
  const { deviceId, number } = req.params as { deviceId: string; number: string };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`event: live\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const unsubscribe = subscribeNode(deviceId, number, send);
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

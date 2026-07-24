import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice, requireDeviceRole } from "../middleware/authorizeDevice.js";
import { auditedSendAction } from "../middleware/auditLogger.js";
import { subscribeNode } from "../ws/nodeLiveHub.js";

// nodesRouter is mounted at /api/devices/:deviceId/nodes (mergeParams:
// true so :deviceId from the parent path is visible here) -- every
// route relays straight through to the device's own config.* actions
// (see the Go app's internal/cloudagent/actions_config.go), never
// touching a local copy of node config: the device itself is always the
// source of truth. Every GET stays at authorizeDevice's own default
// (viewer and up); every route that writes gets requireDeviceRole("editor")
// on top -- see docs/SECURITY.md's role model.
export const nodesRouter = Router({ mergeParams: true });
nodesRouter.use(requireAuth, authorizeDevice);

// Express's own route-string type inference only sees each route's own
// pattern (e.g. ":number"), not params merged in at mount time from the
// parent router -- this alias documents that deviceId always comes from
// the parent (checked by authorizeDevice above) and needs an explicit
// cast to read here.
type NodeParams = Request<{ deviceId: string; number?: string; key?: string; macroNum?: string }>;

nodesRouter.get("/", async (req: NodeParams, res) => {
  const numbers = await auditedSendAction<string[]>(req, "config.listNodes");
  res.json(numbers);
});

nodesRouter.get("/:number", async (req: NodeParams, res) => {
  const node = await auditedSendAction(req, "config.loadNode", { number: req.params.number });
  res.json(node);
});

// PUT (not POST) for both create and update -- config.saveNode on the
// device side is itself idempotent create-or-update (see that action's
// own doc comment), and the caller always knows the target node number
// up front (it's in the URL), so there's no separate "create without
// knowing the id yet" case the way there is for devices themselves.
nodesRouter.put("/:number", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const node = { ...req.body, number: req.params.number };
  const saved = await auditedSendAction(req, "config.saveNode", node);
  res.json(saved);
});

nodesRouter.delete("/:number", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  await auditedSendAction(req, "config.deleteNode", { number: req.params.number });
  res.status(204).end();
});

nodesRouter.put("/:number/courtesy-tones", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.setCourtesyTones", { ...req.body, number: req.params.number });
  res.json(result);
});

nodesRouter.get("/:number/telemetry", async (req: NodeParams, res) => {
  const entries = await auditedSendAction(req, "config.listTelemetry", { number: req.params.number });
  res.json(entries);
});

nodesRouter.put("/:number/telemetry/:key", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.setTelemetry", { number: req.params.number, key: req.params.key, value: req.body.value });
  res.json(result);
});

nodesRouter.get("/:number/iax", async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "iax.loadRegistration", { number: req.params.number });
  res.json(result);
});

nodesRouter.put("/:number/iax", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "iax.saveRegistration", { ...req.body, number: req.params.number });
  res.json(result);
});

nodesRouter.post("/:number/dtmf", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "system.dtmf", { number: req.params.number, digits: req.body.digits });
  res.json(result);
});

// kind ("functions" | "macro") is always in the request body/query, not
// the URL -- one route family covers both the command list and saved
// macros tables, matching the Go app's own kind-enum action shape (see
// actions_functions.go's own doc comment on why it's an enum, never a
// raw section name).
nodesRouter.get("/:number/functions", async (req: NodeParams, res) => {
  const entries = await auditedSendAction(req, "config.listFunctionMacros", { number: req.params.number, kind: req.query.kind });
  res.json(entries);
});

nodesRouter.put("/:number/functions", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.saveFunctionMacro", { ...req.body, number: req.params.number });
  res.json(result);
});

nodesRouter.delete("/:number/functions", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.deleteFunctionMacro", { ...req.body, number: req.params.number });
  res.json(result);
});

// The native app_rpt connect/disconnect scheduler -- distinct from
// soundSchedule.* (sound-playback ticker, see soundschedule.routes.ts).
nodesRouter.get("/:number/schedule", async (req: NodeParams, res) => {
  const rows = await auditedSendAction(req, "schedule.list", { number: req.params.number });
  res.json(rows);
});

nodesRouter.post("/:number/schedule", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "schedule.saveConnection", { ...req.body, number: req.params.number });
  res.json(result);
});

nodesRouter.delete("/:number/schedule/:macroNum", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "schedule.deleteConnection", { number: req.params.number, macroNum: req.params.macroNum });
  res.json(result);
});

// Command/tone-set management: give a node (including one created
// before this app knew how to give a new node a working command set) a
// complete functions/macro/telemetry/morse set, either copied from
// another node or bootstrapped from known-good defaults, or repair one
// whose sections are named for a different node entirely.
nodesRouter.post("/:number/clone-config", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.cloneNodeConfig", { srcNumber: req.body.srcNumber, dstNumber: req.params.number });
  res.json(result);
});

nodesRouter.post("/:number/apply-standard-command-set", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.applyStandardCommandSet", { number: req.params.number });
  res.json(result);
});

nodesRouter.post("/:number/normalize", requireDeviceRole("editor"), async (req: NodeParams, res) => {
  const result = await auditedSendAction(req, "config.normalizeNodeConfig", { number: req.params.number });
  res.json(result);
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

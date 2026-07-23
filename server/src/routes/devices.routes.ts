import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import { DeviceModel, toDeviceSummary } from "../models/Device.js";
import { generateAPIKey } from "../utils/apiKey.js";
import { subscribe } from "../ws/browserHub.js";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

devicesRouter.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "enter a name for this device" });
    return;
  }
  const key = generateAPIKey();
  const device = await DeviceModel.create({
    owner: req.userId,
    name,
    apiKeyHash: key.hash,
    apiKeyHint: key.hint,
  });
  // apiKey is included only in this one response -- it is never
  // retrievable again after this point, matching how the local Go
  // app's own setup flow shows a value exactly once at creation.
  res.status(201).json({ ...toDeviceSummary(device), apiKey: key.plaintext });
});

devicesRouter.get("/", async (req, res) => {
  const devices = await DeviceModel.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json(devices.map(toDeviceSummary));
});

devicesRouter.get("/:id", async (req, res) => {
  const device = await DeviceModel.findOne({ _id: req.params.id, owner: req.userId });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  res.json(toDeviceSummary(device));
});

devicesRouter.delete("/:id", async (req, res) => {
  const result = await DeviceModel.deleteOne({ _id: req.params.id, owner: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  res.status(204).end();
});

// GET /api/devices/:id/live streams this device's online/offline and
// heartbeat status as Server-Sent Events -- a near-literal port of
// HamVoipConfigGui's own internal/server/live.go's liveHub pattern,
// applied to one device's connection status instead of one node's
// repeater state.
devicesRouter.get("/:id/live", async (req, res) => {
  const device = await DeviceModel.findOne({ _id: req.params.id, owner: req.userId });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send("status", toDeviceSummary(device));

  const unsubscribe = subscribe(String(device._id), (data) => send("status", data));
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

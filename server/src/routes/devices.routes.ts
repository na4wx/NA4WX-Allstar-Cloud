import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import { requireStepUp } from "../middleware/stepUpAuth.js";
import { AuditLogModel } from "../models/AuditLog.js";
import { DeviceModel, toDeviceSummary } from "../models/Device.js";
import { generateAPIKey } from "../utils/apiKey.js";
import { broadcast, subscribe } from "../ws/browserHub.js";
import { disconnectDevice } from "../ws/agentServer.js";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

// recordDeviceAudit is the device-management equivalent of
// middleware/auditLogger.ts's auditedSendAction -- these three actions
// (rotate, revoke, delete) never go over the WS relay, so they can't go
// through that wrapper, but they're exactly as security-relevant as any
// relayed action and belong in the same trail. Best-effort, same as
// auditLogger.ts: a logging failure must never fail the action itself.
function recordDeviceAudit(deviceId: string, userId: string, action: string): void {
  AuditLogModel.create({ device: deviceId, user: userId, action, ok: true }).catch((err: unknown) => {
    console.error("audit log write failed:", err);
  });
}

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

devicesRouter.delete("/:id", requireStepUp, async (req, res) => {
  const result = await DeviceModel.deleteOne({ _id: req.params.id, owner: req.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  disconnectDevice(req.params.id);
  recordDeviceAudit(req.params.id, req.userId!, "device.delete");
  res.status(204).end();
});

// POST /:id/rotate-key issues a brand new API key, invalidating the old
// one immediately (both by no longer matching apiKeyHash, and by
// disconnecting any live session still holding it -- see
// disconnectDevice's own doc comment) and re-enabling the device if it
// had been revoked. Requires step-up: an attacker who stole a session
// but not the password should not be able to silently swap in their
// own key. Returns the new plaintext key exactly once, same as device
// creation.
devicesRouter.post("/:id/rotate-key", requireStepUp, async (req, res) => {
  const device = await DeviceModel.findOne({ _id: req.params.id, owner: req.userId });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  const key = generateAPIKey();
  device.apiKeyHash = key.hash;
  device.apiKeyHint = key.hint;
  device.enabled = true;
  await device.save();
  disconnectDevice(String(device._id));
  recordDeviceAudit(String(device._id), req.userId!, "device.rotateKey");
  res.json({ ...toDeviceSummary(device), apiKey: key.plaintext });
});

// POST /:id/revoke disables the device without deleting it or its audit
// history -- useful when a key is suspected compromised and the
// operator wants to cut it off immediately but investigate before
// deciding whether to delete or rotate. Requires step-up, same
// reasoning as rotate-key and delete.
devicesRouter.post("/:id/revoke", requireStepUp, async (req, res) => {
  const device = await DeviceModel.findOne({ _id: req.params.id, owner: req.userId });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  device.enabled = false;
  await device.save();
  disconnectDevice(String(device._id));
  recordDeviceAudit(String(device._id), req.userId!, "device.revoke");
  broadcast(String(device._id), toDeviceSummary(device));
  res.json(toDeviceSummary(device));
});

// POST /:id/reactivate reverses a revoke without issuing a new key --
// the device can reconnect again with the same (still-known-good) key
// it already has. No step-up: re-enabling is the reversible, low-risk
// direction (the risky direction, revoking access, is already gated).
devicesRouter.post("/:id/reactivate", async (req, res) => {
  const device = await DeviceModel.findOne({ _id: req.params.id, owner: req.userId });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  device.enabled = true;
  await device.save();
  recordDeviceAudit(String(device._id), req.userId!, "device.reactivate");
  res.json(toDeviceSummary(device));
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

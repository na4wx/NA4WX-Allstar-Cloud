import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice, requireDeviceRole } from "../middleware/authorizeDevice.js";
import { requireStepUp } from "../middleware/stepUpAuth.js";
import { sendCollaboratorAddedEmail } from "../services/mailer.js";
import { AuditLogModel } from "../models/AuditLog.js";
import { DeviceModel, deviceRoleFor, ownerOrCollaboratorFilter, toDeviceSummary } from "../models/Device.js";
import { UserModel } from "../models/User.js";
import { generateAPIKey } from "../utils/apiKey.js";
import { broadcast, subscribe } from "../ws/browserHub.js";
import { disconnectDevice } from "../ws/agentServer.js";

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

// recordDeviceAudit is the device-management equivalent of
// middleware/auditLogger.ts's auditedSendAction -- these actions never
// go over the WS relay, so they can't go through that wrapper, but
// they're exactly as security-relevant as any relayed action (more so,
// for the collaborator ones -- they change who can act on a device at
// all) and belong in the same trail. Best-effort, same as
// auditLogger.ts: a logging failure must never fail the action itself.
function recordDeviceAudit(deviceId: string, userId: string, action: string): void {
  AuditLogModel.create({ device: deviceId, user: userId, action, ok: true }).catch((err: unknown) => {
    console.error("audit log write failed:", err);
  });
}

const assignableRoles = ["admin", "editor", "viewer"] as const;
type AssignableRole = (typeof assignableRoles)[number];

function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (assignableRoles as readonly string[]).includes(value);
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
  res.status(201).json({ ...toDeviceSummary(device), role: "owner", apiKey: key.plaintext });
});

// GET / lists every device this user can reach at all -- owned or
// shared with them as a collaborator, at any tier -- with their own
// role on each one attached so the client can decide what to show
// (see api/devices.ts's Device.role).
devicesRouter.get("/", async (req, res) => {
  const devices = await DeviceModel.find(ownerOrCollaboratorFilter(req.userId!)).sort({ createdAt: -1 });
  res.json(devices.map((d) => ({ ...toDeviceSummary(d), role: deviceRoleFor(d, req.userId!) })));
});

devicesRouter.get("/:deviceId", authorizeDevice, async (req, res) => {
  res.json({ ...toDeviceSummary(req.device!), role: req.deviceRole });
});

// Deleting, rotating, or revoking a device's key, and reactivating it,
// are all admin-tier-and-above actions -- an admin collaborator has
// full parity with the owner here (see docs/SECURITY.md's role model),
// the one thing they can never do is touch the owner's own standing.
devicesRouter.delete("/:deviceId", authorizeDevice, requireDeviceRole("admin"), requireStepUp, async (req, res) => {
  const device = req.device!;
  await DeviceModel.deleteOne({ _id: device._id });
  disconnectDevice(String(device._id));
  recordDeviceAudit(String(device._id), req.userId!, "device.delete");
  res.status(204).end();
});

// POST /:deviceId/rotate-key issues a brand new API key, invalidating the old
// one immediately (both by no longer matching apiKeyHash, and by
// disconnecting any live session still holding it -- see
// disconnectDevice's own doc comment) and re-enabling the device if it
// had been revoked. Requires step-up: an attacker who stole a session
// but not the password should not be able to silently swap in their
// own key. Returns the new plaintext key exactly once, same as device
// creation.
devicesRouter.post("/:deviceId/rotate-key", authorizeDevice, requireDeviceRole("admin"), requireStepUp, async (req, res) => {
  const device = req.device!;
  const key = generateAPIKey();
  device.apiKeyHash = key.hash;
  device.apiKeyHint = key.hint;
  device.enabled = true;
  await device.save();
  disconnectDevice(String(device._id));
  recordDeviceAudit(String(device._id), req.userId!, "device.rotateKey");
  res.json({ ...toDeviceSummary(device), role: req.deviceRole, apiKey: key.plaintext });
});

// POST /:deviceId/revoke disables the device without deleting it or its audit
// history -- useful when a key is suspected compromised and the
// operator wants to cut it off immediately but investigate before
// deciding whether to delete or rotate. Requires step-up, same
// reasoning as rotate-key and delete.
devicesRouter.post("/:deviceId/revoke", authorizeDevice, requireDeviceRole("admin"), requireStepUp, async (req, res) => {
  const device = req.device!;
  device.enabled = false;
  await device.save();
  disconnectDevice(String(device._id));
  recordDeviceAudit(String(device._id), req.userId!, "device.revoke");
  broadcast(String(device._id), toDeviceSummary(device));
  res.json({ ...toDeviceSummary(device), role: req.deviceRole });
});

// POST /:deviceId/reactivate reverses a revoke without issuing a new key --
// the device can reconnect again with the same (still-known-good) key
// it already has. No step-up: re-enabling is the reversible, low-risk
// direction (the risky direction, revoking access, is already gated).
devicesRouter.post("/:deviceId/reactivate", authorizeDevice, requireDeviceRole("admin"), async (req, res) => {
  const device = req.device!;
  device.enabled = true;
  await device.save();
  recordDeviceAudit(String(device._id), req.userId!, "device.reactivate");
  res.json({ ...toDeviceSummary(device), role: req.deviceRole });
});

// GET /api/devices/:deviceId/live streams this device's online/offline and
// heartbeat status as Server-Sent Events -- a near-literal port of
// HamVoipConfigGui's own internal/server/live.go's liveHub pattern,
// applied to one device's connection status instead of one node's
// repeater state. Viewer-tier and up (authorizeDevice's own default) --
// this is read-only either way.
//
// The pushed payload is toDeviceSummary's own base shape, deliberately
// without `role` -- see that function's own doc comment for why a
// single fan-out broadcast can't carry a per-viewer field. The client
// merges this into its cached device rather than replacing it wholesale,
// so `role` (only ever set from a REST response) survives a heartbeat.
devicesRouter.get("/:deviceId/live", authorizeDevice, async (req, res) => {
  const device = req.device!;

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

// GET /:deviceId/collaborators lists everyone with standing access to
// this device -- the owner plus every collaborator and their role.
// Viewer-tier and up: seeing who else has access to a device you can
// already see is low-risk (just email + role, no credentials), and
// matches this feature's general "full visibility, gated mutation"
// shape.
devicesRouter.get("/:deviceId/collaborators", authorizeDevice, async (req, res) => {
  const device = req.device!;
  const owner = await UserModel.findById(device.owner, "email");
  const collaboratorUsers = await UserModel.find({ _id: { $in: device.collaborators.map((c) => c.user) } }, "email");
  const emailById = new Map(collaboratorUsers.map((u) => [String(u._id), u.email]));
  res.json({
    owner: owner ? { userId: String(owner._id), email: owner.email } : null,
    collaborators: device.collaborators.map((c) => ({
      userId: String(c.user),
      email: emailById.get(String(c.user)) ?? "",
      role: c.role,
      addedAt: c.addedAt,
    })),
  });
});

// POST /:deviceId/collaborators grants (or re-grants, updating the
// role) standing access by email -- existing accounts only for now,
// see docs/SECURITY.md's role model for why. Admin-tier and step-up:
// this changes who can act on the device, exactly as sensitive as
// rotating its API key.
devicesRouter.post("/:deviceId/collaborators", authorizeDevice, requireDeviceRole("admin"), requireStepUp, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const role = req.body?.role;
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "enter a valid email address" });
    return;
  }
  if (!isAssignableRole(role)) {
    res.status(400).json({ error: "role must be admin, editor, or viewer" });
    return;
  }
  const device = req.device!;
  const targetUser = await UserModel.findOne({ email });
  if (!targetUser) {
    res.status(400).json({ error: "no account found for that email -- ask them to register first, then try again" });
    return;
  }
  if (String(device.owner) === String(targetUser._id)) {
    res.status(400).json({ error: "this user already owns the device" });
    return;
  }
  const existing = device.collaborators.find((c) => String(c.user) === String(targetUser._id));
  const addedAt = existing?.addedAt ?? new Date();
  if (existing) {
    existing.role = role;
  } else {
    device.collaborators.push({ user: targetUser._id, role, addedAt });
  }
  await device.save();
  recordDeviceAudit(String(device._id), req.userId!, existing ? "collaborator.updateRole" : "collaborator.add");
  sendCollaboratorAddedEmail(targetUser.email, device.name, role).catch((err: unknown) => {
    console.error("failed to send collaborator notification email:", err);
  });
  res.status(existing ? 200 : 201).json({ userId: String(targetUser._id), email: targetUser.email, role, addedAt });
});

// PATCH /:deviceId/collaborators/:userId changes an existing
// collaborator's role. Admin-tier and step-up, same reasoning as
// granting access in the first place.
devicesRouter.patch("/:deviceId/collaborators/:userId", authorizeDevice, requireDeviceRole("admin"), requireStepUp, async (req, res) => {
  const role = req.body?.role;
  if (!isAssignableRole(role)) {
    res.status(400).json({ error: "role must be admin, editor, or viewer" });
    return;
  }
  const device = req.device!;
  const collaborator = device.collaborators.find((c) => String(c.user) === req.params.userId);
  if (!collaborator) {
    res.status(404).json({ error: "collaborator not found" });
    return;
  }
  collaborator.role = role;
  await device.save();
  recordDeviceAudit(String(device._id), req.userId!, "collaborator.updateRole");
  res.json({ userId: req.params.userId, role });
});

// DELETE /:deviceId/collaborators/:userId removes a collaborator.
// Removing *someone else* requires admin-tier; removing *yourself*
// (leaving a device someone shared with you) is always allowed
// regardless of role -- the one asymmetric case in this feature, so
// it's a small inline check here rather than expressed as composable
// middleware. Both directions require step-up. :userId also accepts
// the literal "me" as an alias for req.userId, so the client can offer
// a "leave this device" action without needing to know its own user id
// at all.
devicesRouter.delete("/:deviceId/collaborators/:userId", authorizeDevice, requireStepUp, async (req, res) => {
  const targetUserId = req.params.userId === "me" ? req.userId! : req.params.userId;
  const isSelf = targetUserId === req.userId;
  if (!isSelf && req.deviceRole !== "admin" && req.deviceRole !== "owner") {
    res.status(403).json({ error: "your role on this device doesn't allow this action" });
    return;
  }
  const device = req.device!;
  const index = device.collaborators.findIndex((c) => String(c.user) === targetUserId);
  if (index === -1) {
    res.status(404).json({ error: "collaborator not found" });
    return;
  }
  device.collaborators.splice(index, 1);
  await device.save();
  recordDeviceAudit(String(device._id), req.userId!, isSelf ? "collaborator.leave" : "collaborator.remove");
  res.status(204).end();
});

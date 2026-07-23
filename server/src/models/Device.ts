import { Schema, model, type InferSchemaType } from "mongoose";

// NodeSummary is one AllStar node number this device's own rpt.conf
// currently reports -- a cache refreshed on every hello/status push,
// never a source of truth (the device itself is). See the Go app's
// plan doc for why this stays denormalized here rather than becoming
// its own top-level collection.
const nodeSummarySchema = new Schema(
  {
    number: { type: String, required: true },
    callsign: { type: String, default: "" },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

// heartbeatStatusSchema mirrors HamVoipConfigGui's own internal/system.Status
// JSON shape (asterisk_running/uptime/hostname/error) -- kept loose
// (Mixed) rather than a strict schema so a future field added on the Go
// side doesn't need a matching migration here before it can be stored.
const deviceSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },

  // apiKeyHash is an HMAC-SHA256 of the plaintext key (see
  // src/utils/apiKey.ts) -- the plaintext is shown to the operator
  // exactly once, at creation, and never stored. apiKeyHint is the
  // key's last 4 characters, kept only so the device list can show
  // "...ab12" without being able to reconstruct the real key from it.
  apiKeyHash: { type: String, required: true, unique: true, index: true },
  apiKeyHint: { type: String, required: true },

  // enabled gates the hello handshake independently of apiKeyHash (see
  // ws/agentServer.ts) -- "Revoke" in the device settings sets this
  // false without deleting the device or its audit history, and
  // immediately disconnects any live session; "Rotate key" flips it
  // back to true alongside issuing a new key. See the Go app's plan
  // doc's Security section (#9).
  enabled: { type: Boolean, default: true },

  status: { type: String, enum: ["online", "offline"], default: "offline" },
  lastSeenAt: { type: Date, default: null },
  lastStatus: { type: Schema.Types.Mixed, default: null },
  nodes: { type: [nodeSummarySchema], default: [] },

  createdAt: { type: Date, default: () => new Date() },
});

export type Device = InferSchemaType<typeof deviceSchema> & { _id: import("mongoose").Types.ObjectId };

export const DeviceModel = model("Device", deviceSchema);

// toDeviceSummary is the one shape a Device is ever serialized to for a
// browser -- shared by the REST list/detail routes and the SSE/agent
// broadcast path so they can't drift, and critically never includes
// apiKeyHash (see that field's own doc comment).
export function toDeviceSummary(device: InstanceType<typeof DeviceModel>) {
  return {
    id: String(device._id),
    name: device.name,
    apiKeyHint: device.apiKeyHint,
    enabled: device.enabled,
    status: device.status,
    lastSeenAt: device.lastSeenAt,
    lastStatus: device.lastStatus,
    nodes: device.nodes,
    createdAt: device.createdAt,
  };
}

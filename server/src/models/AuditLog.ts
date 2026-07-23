import { Schema, model, type InferSchemaType } from "mongoose";

// AuditLog records every relayed action -- see the Go app's plan doc's
// Security section (#8): an independent record of what was actually
// asked of a device, for later review. Not yet written to anywhere in
// Phase 1 (there are no relayed write actions yet), but defined now so
// the shape is stable before Phase 2 starts producing entries.
const auditLogSchema = new Schema({
  device: { type: Schema.Types.ObjectId, ref: "Device", required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  paramsSummary: { type: String, default: "" },
  ok: { type: Boolean, required: true },
  error: { type: String, default: "" },
  at: { type: Date, default: () => new Date() },
});

export type AuditLog = InferSchemaType<typeof auditLogSchema> & { _id: import("mongoose").Types.ObjectId };

export const AuditLogModel = model("AuditLog", auditLogSchema);

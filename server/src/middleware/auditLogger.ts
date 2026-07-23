import type { Request } from "express";

import { AuditLogModel } from "../models/AuditLog.js";
import { RelayError, sendAction } from "../services/relay.js";

// auditedSendAction relays one action exactly like relay.ts's own
// sendAction, and independently records the attempt in AuditLogModel --
// the cloud-side half of the Go app's plan doc's Security section (#8).
// See internal/cloudagent/audit.go for the device-side half: the two
// are kept deliberately independent (neither depends on the other being
// available or trustworthy) rather than one being derived from the
// other.
//
// Requires req.userId (set by requireAuth) and req.device (set by
// authorizeDevice) -- every route mounting this calls both first, so
// these are treated as always present here rather than re-checked.
//
// Deliberately never stores params: several relayed actions carry
// secrets (a SkywarnPlus Pushover API token, SA818 module settings, WX
// tone contents) that don't belong in a database record whose only job
// is answering "what was asked of this device, and did it work" -- not
// "with what exact values". Mirrors internal/cloudagent/dispatch.go's
// identical decision on the device side.
//
// Logging itself is best-effort: a failure to write the audit record
// must never fail or delay the actual relayed action, so any
// AuditLogModel.create rejection is swallowed after being reported to
// the console -- matching the Go side's same "log and continue"
// philosophy for supplementary bookkeeping.
export async function auditedSendAction<T = unknown>(req: Request, action: string, params?: unknown, timeoutMs?: number): Promise<T> {
  const deviceId = req.device!._id;
  const userId = req.userId!;

  const record = (ok: boolean, error?: string) => {
    AuditLogModel.create({ device: deviceId, user: userId, action, ok, error: error ?? "" }).catch((err: unknown) => {
      console.error("audit log write failed:", err);
    });
  };

  try {
    const result = await sendAction<T>(deviceId.toString(), action, params, timeoutMs);
    record(true);
    return result;
  } catch (err) {
    record(false, err instanceof RelayError || err instanceof Error ? err.message : "unknown error");
    throw err;
  }
}

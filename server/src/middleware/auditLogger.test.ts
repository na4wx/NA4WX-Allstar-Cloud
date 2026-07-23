import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const created: Array<Record<string, unknown>> = [];

vi.mock("../models/AuditLog.js", () => ({
  AuditLogModel: {
    create: vi.fn((doc: Record<string, unknown>) => {
      created.push(doc);
      return Promise.resolve(doc);
    }),
  },
}));

let sendActionResult: unknown;
let sendActionError: Error | undefined;

vi.mock("../services/relay.js", async () => {
  const actual = await vi.importActual<typeof import("../services/relay.js")>("../services/relay.js");
  return {
    ...actual,
    sendAction: vi.fn(() => (sendActionError ? Promise.reject(sendActionError) : Promise.resolve(sendActionResult))),
  };
});

const { auditedSendAction } = await import("./auditLogger.js");
const { RelayError } = await import("../services/relay.js");

function fakeReq(): Request {
  return { userId: "user-1", device: { _id: "device-1" } } as unknown as Request;
}

beforeEach(() => {
  created.length = 0;
  sendActionResult = undefined;
  sendActionError = undefined;
});

// auditedSendAction is the cloud-side half of the Go app's plan doc's
// Security section (#8) -- see internal/cloudagent/audit.go for the
// matching device-side record these tests mirror.
describe("auditedSendAction", () => {
  it("relays through sendAction and returns its result unchanged", async () => {
    sendActionResult = { asteriskRunning: true };
    await expect(auditedSendAction(fakeReq(), "system.status")).resolves.toEqual({ asteriskRunning: true });
  });

  it("records a successful call against the device and user from the request", async () => {
    sendActionResult = { ok: true };
    await auditedSendAction(fakeReq(), "system.status");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ device: "device-1", user: "user-1", action: "system.status", ok: true });
  });

  it("records a failed call with the relay's error message, and still rejects", async () => {
    sendActionError = new RelayError("device is not connected", 503);
    await expect(auditedSendAction(fakeReq(), "system.reboot")).rejects.toThrow("device is not connected");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ action: "system.reboot", ok: false, error: "device is not connected" });
  });

  // Mirrors internal/cloudagent/dispatch.go's identical decision: some
  // actions carry secrets (a Pushover API token here) that have no
  // business in a database record whose only job is "what was asked,
  // and did it work" -- not "with what exact values".
  it("never stores the params it was called with, even when they contain secrets", async () => {
    sendActionResult = { ok: true };
    const secret = "supersecretpushovertoken123";
    await auditedSendAction(fakeReq(), "skywarn.setPushover", { apiToken: secret });
    expect(created).toHaveLength(1);
    expect(JSON.stringify(created[0])).not.toContain(secret);
    expect(created[0]).not.toHaveProperty("params");
  });

  it("does not fail the action when the audit write itself fails", async () => {
    sendActionResult = { ok: true };
    const { AuditLogModel } = await import("../models/AuditLog.js");
    vi.mocked(AuditLogModel.create).mockImplementationOnce(() => Promise.reject(new Error("mongo unavailable")));
    await expect(auditedSendAction(fakeReq(), "system.status")).resolves.toEqual({ ok: true });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const sent: string[] = [];
const fakeConn = { send: (data: string) => sent.push(data) };
let connected = true;

vi.mock("../ws/agentServer.js", () => ({
  getConnection: (_deviceId: string) => (connected ? fakeConn : undefined),
}));

const { sendAction, resolveCall, RelayError } = await import("./relay.js");

function lastCallId(): string {
  const msg = JSON.parse(sent[sent.length - 1]);
  return msg.id;
}

beforeEach(() => {
  sent.length = 0;
  connected = true;
});

describe("sendAction", () => {
  it("rejects immediately when the device isn't connected", async () => {
    connected = false;
    await expect(sendAction("device-1", "system.status")).rejects.toThrow(RelayError);
    await expect(sendAction("device-1", "system.status")).rejects.toThrow("not connected");
  });

  it("sends a call envelope with the action and params", async () => {
    const promise = sendAction("device-1", "config.loadNode", { number: "2000" });
    const msg = JSON.parse(sent[0]);
    expect(msg.type).toBe("call");
    expect(msg.action).toBe("config.loadNode");
    expect(msg.params).toEqual({ number: "2000" });
    expect(typeof msg.id).toBe("string");

    resolveCall(msg.id, true, undefined, { number: "2000", rxChannel: "SimpleUSB/usb" });
    await expect(promise).resolves.toEqual({ number: "2000", rxChannel: "SimpleUSB/usb" });
  });

  it("resolves with the device's data on a matching ok result", async () => {
    const promise = sendAction("device-1", "config.listNodes");
    resolveCall(lastCallId(), true, undefined, ["2000", "3000"]);
    await expect(promise).resolves.toEqual(["2000", "3000"]);
  });

  it("rejects with the device's error message on a matching ok:false result", async () => {
    const promise = sendAction("device-1", "config.saveNode", { number: "abc" });
    resolveCall(lastCallId(), false, "config: node number must be numeric", undefined);
    await expect(promise).rejects.toThrow("config: node number must be numeric");
  });

  it("times out if no result ever arrives", async () => {
    await expect(sendAction("device-1", "config.listNodes", undefined, 20)).rejects.toThrow(/did not respond/);
  });

  it("ignores a resolveCall for an id nobody is waiting on", () => {
    // Must not throw -- a stray or duplicate result (e.g. after a
    // timeout already rejected the caller) is dropped silently.
    expect(() => resolveCall("no-such-id", true, undefined, {})).not.toThrow();
  });
});

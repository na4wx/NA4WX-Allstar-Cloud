import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const sent: string[] = [];
const fakeConn = { send: (data: string) => sent.push(data) };
let connected = true;

vi.mock("./agentServer.js", () => ({
  getConnection: (_deviceId: string) => (connected ? fakeConn : undefined),
}));

const { subscribeNode, broadcastNodeLive, resendWatchesForDevice } = await import("./nodeLiveHub.js");

beforeEach(() => {
  sent.length = 0;
  connected = true;
});

describe("subscribeNode", () => {
  it("sends watch to the device on the first subscriber only", () => {
    const unsub1 = subscribeNode("device-1", "2000", () => {});
    const unsub2 = subscribeNode("device-1", "2000", () => {});

    const watches = sent.filter((s) => JSON.parse(s).type === "watch");
    expect(watches).toHaveLength(1);
    expect(JSON.parse(watches[0]).node).toBe("2000");

    unsub1();
    unsub2();
  });

  it("sends unwatch only once the last subscriber leaves", () => {
    const unsub1 = subscribeNode("device-1", "3000", () => {});
    const unsub2 = subscribeNode("device-1", "3000", () => {});

    unsub1();
    expect(sent.some((s) => JSON.parse(s).type === "unwatch")).toBe(false);

    unsub2();
    const unwatches = sent.filter((s) => JSON.parse(s).type === "unwatch");
    expect(unwatches).toHaveLength(1);
    expect(JSON.parse(unwatches[0]).node).toBe("3000");
  });

  it("delivers broadcastNodeLive data to subscribers of that device+node only", () => {
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    const unsubA = subscribeNode("device-1", "2000", (data) => receivedA.push(data));
    const unsubB = subscribeNode("device-1", "3000", (data) => receivedB.push(data));

    broadcastNodeLive("device-1", "2000", { receiving: true });

    expect(receivedA).toEqual([{ receiving: true }]);
    expect(receivedB).toEqual([]);

    unsubA();
    unsubB();
  });

  it("does nothing when broadcasting to a node nobody is subscribed to", () => {
    expect(() => broadcastNodeLive("device-1", "9999", { receiving: true })).not.toThrow();
  });
});

describe("resendWatchesForDevice", () => {
  it("re-sends watch for every node the device still has subscribers for", () => {
    const unsub1 = subscribeNode("device-2", "2000", () => {});
    const unsub2 = subscribeNode("device-2", "3000", () => {});
    sent.length = 0; // clear the initial watches from subscribing

    resendWatchesForDevice("device-2");

    const nodes = sent.filter((s) => JSON.parse(s).type === "watch").map((s) => JSON.parse(s).node);
    expect(nodes.sort()).toEqual(["2000", "3000"]);

    unsub1();
    unsub2();
  });

  it("does not re-send watches belonging to a different device", () => {
    const unsub = subscribeNode("device-3", "4000", () => {});
    sent.length = 0;

    resendWatchesForDevice("device-4"); // unrelated device

    expect(sent).toHaveLength(0);
    unsub();
  });
});

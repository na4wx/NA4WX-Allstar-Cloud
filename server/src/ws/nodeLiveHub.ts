import { getConnection } from "./agentServer.js";

// nodeLiveHub fans out one node's live state (rpt stats/rpt nodes,
// polled on the device) to any number of subscribed browser SSE
// connections, and is what actually triggers the device to start/stop
// polling in the first place -- the cloud-side half of the two-tier
// live design in the Go app's own plan doc: the device only runs the
// expensive per-node poll while at least one browser, anywhere, is
// actually watching that node on this device.
type Listener = (data: unknown) => void;

function key(deviceId: string, node: string): string {
  return `${deviceId}:${node}`;
}

const subscribers = new Map<string, Set<Listener>>();

function sendWatch(deviceId: string, node: string): void {
  getConnection(deviceId)?.send(JSON.stringify({ type: "watch", node }));
}

function sendUnwatch(deviceId: string, node: string): void {
  getConnection(deviceId)?.send(JSON.stringify({ type: "unwatch", node }));
}

// subscribeNode registers listener for deviceId+node's live events,
// sending "watch" to the device on the first subscriber and returning
// an unsubscribe function that sends "unwatch" once the last one
// leaves.
export function subscribeNode(deviceId: string, node: string, listener: Listener): () => void {
  const k = key(deviceId, node);
  let set = subscribers.get(k);
  const isFirst = !set;
  if (!set) {
    set = new Set();
    subscribers.set(k, set);
  }
  set.add(listener);
  if (isFirst) {
    sendWatch(deviceId, node);
  }

  return () => {
    const current = subscribers.get(k);
    if (!current) {
      return;
    }
    current.delete(listener);
    if (current.size === 0) {
      subscribers.delete(k);
      sendUnwatch(deviceId, node);
    }
  };
}

// broadcastNodeLive delivers data to every subscriber of deviceId+node
// -- called from agentServer.ts when a "nodeLive" event envelope
// arrives.
export function broadcastNodeLive(deviceId: string, node: string, data: unknown): void {
  const set = subscribers.get(key(deviceId, node));
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener(data);
  }
}

// resendWatchesForDevice re-sends "watch" for every node deviceId
// currently has live subscribers for -- called right after a fresh
// connection's hello succeeds, since the device's own watch state (see
// the Go app's internal/cloudagent/live.go liveWatches.stopAll) is
// cleared on every reconnect, but a browser tab that's had a node's
// live view open the whole time never re-subscribes on its own.
export function resendWatchesForDevice(deviceId: string): void {
  const prefix = `${deviceId}:`;
  for (const k of subscribers.keys()) {
    if (k.startsWith(prefix)) {
      sendWatch(deviceId, k.slice(prefix.length));
    }
  }
}

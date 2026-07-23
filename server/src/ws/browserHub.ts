// browserHub fans out one device's status to any number of subscribed
// browser SSE connections -- a near-literal port of HamVoipConfigGui's
// own internal/server/live.go's liveHub, applied to device connection
// status instead of node repeater state. Unlike liveHub, there's no
// polling here: agentServer pushes a broadcast only when something
// actually changes (a device connects, disconnects, or sends a
// heartbeat), so this stays a pure fan-out with no timers of its own.
type Listener = (data: unknown) => void;

const subscribers = new Map<string, Set<Listener>>();

export function subscribe(deviceId: string, listener: Listener): () => void {
  let set = subscribers.get(deviceId);
  if (!set) {
    set = new Set();
    subscribers.set(deviceId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) {
      subscribers.delete(deviceId);
    }
  };
}

export function broadcast(deviceId: string, data: unknown): void {
  const set = subscribers.get(deviceId);
  if (!set) {
    return;
  }
  for (const listener of set) {
    listener(data);
  }
}

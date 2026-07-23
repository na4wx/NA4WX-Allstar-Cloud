import { randomUUID } from "node:crypto";

import { getConnection } from "../ws/agentServer.js";

// RelayError carries an HTTP status alongside the message, so route
// handlers (and the shared errorHandler) can respond with something
// more specific than a blanket 500 for the different ways a relayed
// action can fail. A device-returned "ok:false" result (e.g. "node
// number must be numeric") is treated as 400 -- in this action set
// those are consistently caused by bad input from the caller, not an
// unexpected device-side fault; there's no richer error classification
// coming across the wire yet to do better than that.
export class RelayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface PendingCall {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

// pending correlates an in-flight "call" envelope's id to the promise
// waiting on it -- resolved (or rejected) by resolveCall, called from
// agentServer.ts's own message handler when the matching "result"
// envelope comes back down the same WebSocket connection.
const pending = new Map<string, PendingCall>();

const defaultTimeoutMs = 10_000;

// sendAction relays one action to deviceId's live connection and
// resolves with its result data, bridging the browser's synchronous-
// feeling REST call to the asynchronous WS round trip via the id
// correlation described in the Go app's own plan doc's Architecture
// section.
export function sendAction<T = unknown>(deviceId: string, action: string, params?: unknown, timeoutMs = defaultTimeoutMs): Promise<T> {
  const conn = getConnection(deviceId);
  if (!conn) {
    return Promise.reject(new RelayError("device is not connected", 503));
  }

  const id = randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new RelayError(`device did not respond to "${action}" in time`, 504));
    }, timeoutMs);

    pending.set(id, { resolve: resolve as (data: unknown) => void, reject, timeout });
    conn.send(JSON.stringify({ type: "call", id, action, params }));
  });
}

// resolveCall settles the pending call matching id -- called by
// agentServer.ts when a "result" envelope arrives. A result with no
// matching pending entry (already timed out, or a stray/duplicate) is
// dropped silently rather than treated as an error.
export function resolveCall(id: string, ok: boolean, error: string | undefined, data: unknown): void {
  const entry = pending.get(id);
  if (!entry) {
    return;
  }
  pending.delete(id);
  clearTimeout(entry.timeout);
  if (ok) {
    entry.resolve(data);
  } else {
    entry.reject(new RelayError(error || "action failed", 400));
  }
}

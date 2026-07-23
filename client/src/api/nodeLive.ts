import { useEffect, useState } from "react";

import { getAccessToken } from "./client";

export interface ConnectedNode {
  number: string;
  callsign: string;
  detail: string;
  keyed: boolean;
}

export interface NodeLiveState {
  receiving: boolean;
  signalOnInput: string;
  connected: ConnectedNode[];
}

// useNodeLive subscribes to a node's live SSE stream for as long as the
// calling component is mounted -- unmounting (e.g. navigating away)
// closes the EventSource, which is what lets the device stop polling
// that node (see nodeLiveHub's own doc comment for the subscriber-
// counted watch/unwatch this triggers server-side).
export function useNodeLive(deviceId: string, number: string): { live: NodeLiveState | null; connected: boolean } {
  const [live, setLive] = useState<NodeLiveState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const url = `/api/devices/${deviceId}/nodes/${number}/live${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const source = new EventSource(url);

    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("error", () => setConnected(false));
    source.addEventListener("live", (event) => {
      setLive(JSON.parse((event as MessageEvent).data) as NodeLiveState);
    });

    return () => source.close();
  }, [deviceId, number]);

  return { live, connected };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

// Node mirrors HamVoipConfigGui's own internal/config.Node exactly (see
// that struct's JSON tags) -- the device is always the source of truth,
// this is never cached authoritatively here beyond React Query's own
// short-lived cache.
export interface Node {
  number: string;
  dialString: string;
  rxChannel: string;
  txChannel: string;
  duplex: string;
  telemetry: string;
  morse: string;
  functions: string;
  macro: string;
  hangTime: string;
  altHangTime: string;
  toTime: string;
  idTime: string;
  idRecording: string;
  unlinkedCT: string;
  remoteCT: string;
  linkUnkeyCT: string;
  scheduler: string;
}

export function useNodes(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes"],
    queryFn: () => apiFetch<string[]>(`/api/devices/${deviceId}/nodes`),
  });
}

export function useNode(deviceId: string, number: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes", number],
    queryFn: () => apiFetch<Node>(`/api/devices/${deviceId}/nodes/${number}`),
    enabled: !!number,
  });
}

// useSaveNode covers both create and update -- config.saveNode on the
// device side is itself idempotent create-or-update (see nodes.routes.ts's
// own doc comment).
export function useSaveNode(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (node: Partial<Node> & { number: string }) =>
      apiFetch<Node>(`/api/devices/${deviceId}/nodes/${node.number}`, { method: "PUT", body: JSON.stringify(node) }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes"] });
      queryClient.setQueryData(["devices", deviceId, "nodes", saved.number], saved);
    },
  });
}

export function useDeleteNode(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: string) => apiFetch<void>(`/api/devices/${deviceId}/nodes/${number}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes"] }),
  });
}

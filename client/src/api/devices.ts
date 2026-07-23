import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface DeviceNode {
  number: string;
  callsign: string;
  lastSeenAt: string;
}

export interface DeviceStatus {
  asterisk_running: boolean;
  uptime: string;
  hostname: string;
  error?: string;
}

export interface Device {
  id: string;
  name: string;
  apiKeyHint: string;
  enabled: boolean;
  status: "online" | "offline";
  lastSeenAt: string | null;
  lastStatus: DeviceStatus | null;
  nodes: DeviceNode[];
  createdAt: string;
}

export interface DeviceWithKey extends Device {
  apiKey: string;
}

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: () => apiFetch<Device[]>("/api/devices"),
    // A light background refetch so a device's online/offline state on
    // the list page doesn't go stale for long between visits -- the
    // detail page's SSE stream (see DeviceDetail.tsx) is what gives
    // truly live updates; this is just the list's own "close enough"
    // freshness, the same role the local Go app's own 4s /api/status
    // poll plays for its home page pill.
    refetchInterval: 15_000,
  });
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ["devices", id],
    queryFn: () => apiFetch<Device>(`/api/devices/${id}`),
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<DeviceWithKey>("/api/devices", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

// Delete, rotate, and revoke all require a step-up token (see
// api/stepUp.ts) -- among the highest-risk actions this API exposes.
export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stepUpToken }: { id: string; stepUpToken: string }) =>
      apiFetch<void>(`/api/devices/${id}`, { method: "DELETE", headers: { "X-Step-Up-Token": stepUpToken } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

// useRotateDeviceKey issues a brand new API key for a device, immediately
// invalidating the old one (including disconnecting a currently-live
// session -- see the server's disconnectDevice) -- returns the new
// plaintext key exactly once, same as device creation.
export function useRotateDeviceKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stepUpToken }: { id: string; stepUpToken: string }) =>
      apiFetch<DeviceWithKey>(`/api/devices/${id}/rotate-key`, { method: "POST", headers: { "X-Step-Up-Token": stepUpToken } }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["devices", vars.id] });
    },
  });
}

// useRevokeDevice disables a device without deleting it -- it can no
// longer connect (even with its still-known key) until reactivated or
// rotated. Useful when a key is suspected compromised and the operator
// wants to cut it off immediately, before deciding what to do next.
export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stepUpToken }: { id: string; stepUpToken: string }) =>
      apiFetch<Device>(`/api/devices/${id}/revoke`, { method: "POST", headers: { "X-Step-Up-Token": stepUpToken } }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["devices", vars.id] });
    },
  });
}

// useReactivateDevice reverses a revoke, without issuing a new key -- no
// step-up needed, since re-enabling is the reversible, low-risk
// direction (revoking is the gated one).
export function useReactivateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Device>(`/api/devices/${id}/reactivate`, { method: "POST" }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["devices", id] });
    },
  });
}

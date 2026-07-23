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

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

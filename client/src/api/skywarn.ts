import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface CountyOption {
  label: string;
  code: string;
}

// SkywarnStatus mirrors internal/skywarnplus.Status's JSON shape.
// Pushover/SkyDescribe settings aren't surfaced in this UI yet (API
// support exists server-side -- see skywarnplus.routes.ts -- but no
// client hook/form for them yet).
export interface SkywarnStatus {
  enable: boolean;
  sayAlert: boolean;
  sayAllClear: boolean;
  tailmessage: boolean;
  alertScript: boolean;
  countyCodes: string[];
  nodes: string[];
  courtesyToneSwapEnabled: boolean;
  idSwapEnabled: boolean;
  activeAlertCount: number;
}

export function useSkywarnCounties(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "skywarn", "counties"],
    queryFn: () => apiFetch<CountyOption[]>(`/api/devices/${deviceId}/skywarn/counties`),
    staleTime: Infinity, // this app's own bundled reference data -- never changes underneath us
  });
}

export function useSkywarnStatus(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "skywarn", "status"],
    queryFn: () => apiFetch<SkywarnStatus>(`/api/devices/${deviceId}/skywarn/status`),
    retry: false, // a 400 here almost always means "not installed" -- retrying won't change that
  });
}

export function useSkywarnToggle(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (toggle: { key: string; value: boolean }) =>
      apiFetch(`/api/devices/${deviceId}/skywarn/toggle`, { method: "POST", body: JSON.stringify(toggle) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "skywarn", "status"] }),
  });
}

export function useSkywarnSetCounties(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codes: string[]) => apiFetch(`/api/devices/${deviceId}/skywarn/county-codes`, { method: "POST", body: JSON.stringify({ codes }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "skywarn", "status"] }),
  });
}

export function useSkywarnAddNode(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (node: string) => apiFetch(`/api/devices/${deviceId}/skywarn/nodes`, { method: "POST", body: JSON.stringify({ node }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "skywarn", "status"] }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

// WXToneEntry mirrors HamVoipConfigGui's own internal/wxtone.Entry JSON
// shape (snake_case -- this is also that package's on-disk file format,
// not just the relay wire shape, so it stays as-is rather than being
// recased to match this app's own camelCase convention elsewhere).
export interface WXToneEntry {
  id: string;
  node: string;
  ct_key: string;
  normal_type: "tone" | "sound";
  normal_sound?: string;
  normal_tone?: string;
  wx_type: "tone" | "sound";
  wx_sound?: string;
  wx_tone?: string;
  mode: "normal" | "wx";
}

export function useWXTones(deviceId: string, node: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "wxtone", node],
    queryFn: () => apiFetch<WXToneEntry[]>(`/api/devices/${deviceId}/wxtone?node=${encodeURIComponent(node)}`),
  });
}

export function useSaveWXTone(deviceId: string, node: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: Omit<WXToneEntry, "id" | "mode">) =>
      apiFetch<WXToneEntry>(`/api/devices/${deviceId}/wxtone`, { method: "POST", body: JSON.stringify(entry) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "wxtone", node] }),
  });
}

export function useDeleteWXTone(deviceId: string, node: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/devices/${deviceId}/wxtone/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "wxtone", node] }),
  });
}

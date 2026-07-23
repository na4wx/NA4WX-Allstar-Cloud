import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

// SoundScheduleEntry mirrors internal/soundschedule.Entry's JSON shape
// (snake_case -- see wxtone.ts's own note on why this stays as the
// package's real on-disk field names).
export interface SoundScheduleEntry {
  id: string;
  node: string;
  file: string;
  reach: "local" | "network";
  minute: string;
  hour: string;
  day_of_month: string;
  month: string;
  days_of_week?: number[];
}

export function useSoundSchedule(deviceId: string, node: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "sound-schedule", node],
    queryFn: () => apiFetch<SoundScheduleEntry[]>(`/api/devices/${deviceId}/sound-schedule?node=${encodeURIComponent(node)}`),
  });
}

export function useSaveSoundSchedule(deviceId: string, node: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: Omit<SoundScheduleEntry, "id">) =>
      apiFetch<SoundScheduleEntry>(`/api/devices/${deviceId}/sound-schedule`, { method: "POST", body: JSON.stringify(entry) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "sound-schedule", node] }),
  });
}

export function useDeleteSoundSchedule(deviceId: string, node: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/devices/${deviceId}/sound-schedule/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "sound-schedule", node] }),
  });
}

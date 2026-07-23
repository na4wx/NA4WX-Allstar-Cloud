import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "./client";

export function useRestartAsterisk(deviceId: string) {
  return useMutation({
    mutationFn: () => apiFetch(`/api/devices/${deviceId}/system/restart-asterisk`, { method: "POST" }),
  });
}

export function useReboot(deviceId: string) {
  return useMutation({
    mutationFn: () => apiFetch(`/api/devices/${deviceId}/system/reboot`, { method: "POST" }),
  });
}

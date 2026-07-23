import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "./client";

// Both actions require a step-up token (see api/stepUp.ts) -- the
// server refuses them without one regardless of what's passed here.
export function useRestartAsterisk(deviceId: string) {
  return useMutation({
    mutationFn: (stepUpToken: string) =>
      apiFetch(`/api/devices/${deviceId}/system/restart-asterisk`, { method: "POST", headers: { "X-Step-Up-Token": stepUpToken } }),
  });
}

export function useReboot(deviceId: string) {
  return useMutation({
    mutationFn: (stepUpToken: string) =>
      apiFetch(`/api/devices/${deviceId}/system/reboot`, { method: "POST", headers: { "X-Step-Up-Token": stepUpToken } }),
  });
}

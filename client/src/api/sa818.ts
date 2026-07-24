import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

// SA818Settings mirrors HamVoipConfigGui's own internal/sa818.Settings
// JSON shape.
export interface SA818Settings {
  wide: boolean;
  txFreqMHz: string;
  rxFreqMHz: string;
  txCTCSS: string;
  rxCTCSS: string;
  squelch: number;
  volume: number;
  preDeEmphasis: boolean;
  highPassFilter: boolean;
  lowPassFilter: boolean;
}

export interface SA818ProgramResult {
  ok: boolean;
  output: string;
}

// SA818Last mirrors internal/sa818.LastApplied -- the module itself has
// no way to report its currently-programmed values back, so this is
// only ever what this device last recorded sending, not confirmed live
// state (same caveat the local app's own System page carries).
export interface SA818Last extends SA818Settings {
  tool: string;
  applied_at: string;
  success: boolean;
  output: string;
}

// Null on a device that's never had SA818 settings sent from it,
// including one whose cloudagent predates the sa818.last action --
// retry:false because neither case is worth retrying. `enabled` lets
// callers skip the request entirely for a role that can't see the
// SA818 card anyway (viewer).
export function useLastSA818(deviceId: string, enabled = true) {
  return useQuery({
    queryKey: ["devices", deviceId, "sa818", "last"],
    queryFn: () => apiFetch<SA818Last | null>(`/api/devices/${deviceId}/sa818/last`),
    retry: false,
    enabled,
  });
}

export function useProgramSA818(deviceId: string) {
  return useMutation({
    mutationFn: (settings: SA818Settings) =>
      apiFetch<SA818ProgramResult>(`/api/devices/${deviceId}/sa818/program`, { method: "POST", body: JSON.stringify(settings) }),
  });
}

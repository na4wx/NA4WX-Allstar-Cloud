import { useMutation } from "@tanstack/react-query";

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

export function useProgramSA818(deviceId: string) {
  return useMutation({
    mutationFn: (settings: SA818Settings) =>
      apiFetch<SA818ProgramResult>(`/api/devices/${deviceId}/sa818/program`, { method: "POST", body: JSON.stringify(settings) }),
  });
}

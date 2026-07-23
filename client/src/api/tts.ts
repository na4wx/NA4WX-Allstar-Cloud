import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface GenerateSpeechResult {
  dataBase64: string;
}

export function useTtsVoices(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "tts", "voices"],
    queryFn: () => apiFetch<string[]>(`/api/devices/${deviceId}/tts/voices`),
  });
}

// useGenerateSpeech synthesizes text to speech entirely server-side (see
// the Go app's plan doc / this repo's services/piperTts.ts) -- this
// never relays to the device at all, so nothing here invalidates the
// sounds list. Only an explicit follow-up save (useSaveGeneratedSound,
// api/sounds.ts) with the returned dataBase64 actually reaches the node.
export function useGenerateSpeech(deviceId: string) {
  return useMutation({
    mutationFn: (body: { text: string; voice: string }) =>
      apiFetch<GenerateSpeechResult>(`/api/devices/${deviceId}/tts/generate`, { method: "POST", body: JSON.stringify(body) }),
  });
}

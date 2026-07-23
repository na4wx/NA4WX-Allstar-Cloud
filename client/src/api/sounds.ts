import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface SoundFile {
  name: string;
  ref: string;
  custom: boolean;
}

export function useSounds(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "sounds"],
    queryFn: () => apiFetch<SoundFile[]>(`/api/devices/${deviceId}/sounds`),
  });
}

// fileToBase64 reads a browser File into a base64 string, stripping the
// "data:...;base64," prefix FileReader's own result includes -- the Go
// side (see actions_sounds.go) expects just the raw base64 payload.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useUploadSound(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const dataBase64 = await fileToBase64(file);
      return apiFetch(`/api/devices/${deviceId}/sounds`, { method: "POST", body: JSON.stringify({ name, dataBase64 }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "sounds"] }),
  });
}

export function useDeleteSound(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch(`/api/devices/${deviceId}/sounds/${encodeURIComponent(name)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "sounds"] }),
  });
}

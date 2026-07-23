import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface RawConfigKV {
  key: string;
  value: string;
}

export interface RawConfigSection {
  name: string;
  keys: RawConfigKV[];
}

export interface RawConfigFile {
  sections: RawConfigSection[];
}

export function useRawConfigFiles(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "rawconfig", "files"],
    queryFn: () => apiFetch<string[]>(`/api/devices/${deviceId}/rawconfig/files`),
  });
}

export function useRawConfigFile(deviceId: string, file: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "rawconfig", file],
    queryFn: () => apiFetch<RawConfigFile>(`/api/devices/${deviceId}/rawconfig/${file}`),
    enabled: !!file,
    retry: false, // a 400 almost always means AllowRawConfigEdit is off -- retrying won't change that
  });
}

// All three write mutations below require a step-up token (see
// api/stepUp.ts) -- the server refuses them without one. stepUpToken is
// pulled out of the mutation variables rather than sent in the JSON
// body, so it never ends up mixed into the relayed rawconfig params.

export function useSetRawConfigKey(deviceId: string, file: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepUpToken, ...edit }: { section: string; index: number; value: string; stepUpToken: string }) =>
      apiFetch(`/api/devices/${deviceId}/rawconfig/${file}/key`, {
        method: "POST",
        body: JSON.stringify(edit),
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "rawconfig", file] }),
  });
}

export function useAddRawConfigKey(deviceId: string, file: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepUpToken, ...entry }: { section: string; key: string; value: string; stepUpToken: string }) =>
      apiFetch(`/api/devices/${deviceId}/rawconfig/${file}/add-key`, {
        method: "POST",
        body: JSON.stringify(entry),
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "rawconfig", file] }),
  });
}

export function useAddRawConfigSection(deviceId: string, file: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ section, stepUpToken }: { section: string; stepUpToken: string }) =>
      apiFetch(`/api/devices/${deviceId}/rawconfig/${file}/add-section`, {
        method: "POST",
        body: JSON.stringify({ section }),
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "rawconfig", file] }),
  });
}

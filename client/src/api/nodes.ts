import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

// Node mirrors HamVoipConfigGui's own internal/config.Node exactly (see
// that struct's JSON tags) -- the device is always the source of truth,
// this is never cached authoritatively here beyond React Query's own
// short-lived cache.
export interface Node {
  number: string;
  dialString: string;
  rxChannel: string;
  txChannel: string;
  duplex: string;
  telemetry: string;
  morse: string;
  functions: string;
  macro: string;
  hangTime: string;
  altHangTime: string;
  toTime: string;
  idTime: string;
  idRecording: string;
  unlinkedCT: string;
  remoteCT: string;
  linkUnkeyCT: string;
  scheduler: string;
}

export function useNodes(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes"],
    queryFn: () => apiFetch<string[]>(`/api/devices/${deviceId}/nodes`),
  });
}

export function useNode(deviceId: string, number: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes", number],
    queryFn: () => apiFetch<Node>(`/api/devices/${deviceId}/nodes/${number}`),
    enabled: !!number,
  });
}

// useSaveNode covers both create and update -- config.saveNode on the
// device side is itself idempotent create-or-update (see nodes.routes.ts's
// own doc comment).
export function useSaveNode(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (node: Partial<Node> & { number: string }) =>
      apiFetch<Node>(`/api/devices/${deviceId}/nodes/${node.number}`, { method: "PUT", body: JSON.stringify(node) }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes"] });
      queryClient.setQueryData(["devices", deviceId, "nodes", saved.number], saved);
    },
  });
}

export function useDeleteNode(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (number: string) => apiFetch<void>(`/api/devices/${deviceId}/nodes/${number}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes"] }),
  });
}

export interface CourtesyTones {
  unlinkedCT: string;
  remoteCT: string;
  linkUnkeyCT: string;
}

// useSaveCourtesyTones covers the narrow unlinkedct/remotect/linkunkeyct
// write path -- config.saveNode's own field allowlist deliberately
// excludes these (see the Go app's Store.SaveNode's own doc comment),
// so they need this separate action regardless of the whole-node save.
export function useSaveCourtesyTones(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tones: CourtesyTones) => apiFetch(`/api/devices/${deviceId}/nodes/${number}/courtesy-tones`, { method: "PUT", body: JSON.stringify(tones) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number] }),
  });
}

export interface ToneSpec {
  freq1: number;
  freq2: number;
  durationMs: number;
  amplitude: number;
}

// TelemetryEntry mirrors the Go app's telemetryEntryResult -- `tone` is
// present only when `value` parses as exactly one tone-generator
// segment (see config.ParseSingleTone); otherwise treat `value` as a
// raw sound-file reference or a multi-segment tone, editable only as text.
export interface TelemetryEntry {
  key: string;
  value: string;
  tone?: ToneSpec;
}

export function useTelemetry(deviceId: string, number: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes", number, "telemetry"],
    queryFn: () => apiFetch<TelemetryEntry[]>(`/api/devices/${deviceId}/nodes/${number}/telemetry`),
    enabled: !!number,
  });
}

export function useSetTelemetry(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch(`/api/devices/${deviceId}/nodes/${number}/telemetry/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number, "telemetry"] }),
  });
}

// IAXRegistration/IAXPeer mirror the Go app's iaxRegistrationResult/
// iaxPeerResult -- either half of IAXRegistrationInfo may be absent if
// this node has never been registered with AllStarLink.
export interface IAXRegistration {
  password: string;
  host: string;
  port: string;
}

export interface IAXPeer {
  type: string;
  context: string;
  host: string;
  secret: string;
  auth: string;
}

export interface IAXRegistrationInfo {
  registration?: IAXRegistration;
  peer?: IAXPeer;
}

export function useIAXRegistration(deviceId: string, number: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes", number, "iax"],
    queryFn: () => apiFetch<IAXRegistrationInfo>(`/api/devices/${deviceId}/nodes/${number}/iax`),
    enabled: !!number,
  });
}

export interface SaveIAXRegistration {
  password: string;
  host?: string;
  port?: string;
  peerType?: string;
  peerContext?: string;
  peerHost?: string;
  peerSecret?: string;
  peerAuth?: string;
}

export function useSaveIAXRegistration(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reg: SaveIAXRegistration) => apiFetch(`/api/devices/${deviceId}/nodes/${number}/iax`, { method: "PUT", body: JSON.stringify(reg) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number, "iax"] }),
  });
}

export function useSendDTMF(deviceId: string, number: string) {
  return useMutation({
    mutationFn: (digits: string) => apiFetch<{ output: string }>(`/api/devices/${deviceId}/nodes/${number}/dtmf`, { method: "POST", body: JSON.stringify({ digits }) }),
  });
}

export type FunctionMacroKind = "functions" | "macro";

// FunctionMacro mirrors the Go app's config.FunctionMacro -- one DTMF
// digit sequence mapped to the app_rpt command it runs. `kind`
// distinguishes the "Command list" table from the "Saved macros" table
// (see actions_functions.go's own doc comment on why it's a closed
// enum rather than a raw section name).
export interface FunctionMacro {
  digits: string;
  command: string;
}

export function useFunctionMacros(deviceId: string, number: string, kind: FunctionMacroKind) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes", number, "functions", kind],
    queryFn: () => apiFetch<FunctionMacro[]>(`/api/devices/${deviceId}/nodes/${number}/functions?kind=${kind}`),
    enabled: !!number,
  });
}

export function useSaveFunctionMacro(deviceId: string, number: string, kind: FunctionMacroKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ digits, command }: { digits: string; command: string }) =>
      apiFetch(`/api/devices/${deviceId}/nodes/${number}/functions`, { method: "PUT", body: JSON.stringify({ kind, digits, command }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number, "functions", kind] }),
  });
}

export function useDeleteFunctionMacro(deviceId: string, number: string, kind: FunctionMacroKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (digits: string) =>
      apiFetch(`/api/devices/${deviceId}/nodes/${number}/functions`, { method: "DELETE", body: JSON.stringify({ kind, digits }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number, "functions", kind] }),
  });
}

// AutomationRow mirrors the Go app's automationRowResult -- one entry
// in the native app_rpt connect/disconnect scheduler, distinct from
// soundSchedule's own sound-playback ticker (see api/soundSchedule.ts).
export interface AutomationRow {
  macroNum: string;
  label: string;
  recognized: boolean;
  timeSpec: string;
}

export function useAutomationSchedule(deviceId: string, number: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "nodes", number, "schedule"],
    queryFn: () => apiFetch<AutomationRow[]>(`/api/devices/${deviceId}/nodes/${number}/schedule`),
    enabled: !!number,
  });
}

export type AutomationActionKey = "connect_stay" | "connect_listen" | "disconnect_one" | "disconnect_all";

export interface SaveAutomationConnection {
  action: AutomationActionKey;
  target?: string;
  minute: string;
  hour: string;
  dom: string;
  month: string;
  weekdays: string[];
}

export function useSaveAutomationConnection(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conn: SaveAutomationConnection) => apiFetch(`/api/devices/${deviceId}/nodes/${number}/schedule`, { method: "POST", body: JSON.stringify(conn) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number, "schedule"] }),
  });
}

export function useDeleteAutomationConnection(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (macroNum: string) => apiFetch(`/api/devices/${deviceId}/nodes/${number}/schedule/${macroNum}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number, "schedule"] }),
  });
}

// standardCommandSetSentinel mirrors the Go app's own
// standardCommandSetSentinel ("__standard__") -- picking it means
// "bootstrap from known-good defaults" rather than cloning another node.
export const standardCommandSetSentinel = "__standard__";

export function useCloneOrApplyCommandSet(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (from: string) =>
      from === standardCommandSetSentinel
        ? apiFetch(`/api/devices/${deviceId}/nodes/${number}/apply-standard-command-set`, { method: "POST" })
        : apiFetch(`/api/devices/${deviceId}/nodes/${number}/clone-config`, { method: "POST", body: JSON.stringify({ srcNumber: from }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number] }),
  });
}

export function useNormalizeNodeConfig(deviceId: string, number: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ changed: string[] }>(`/api/devices/${deviceId}/nodes/${number}/normalize`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "nodes", number] }),
  });
}

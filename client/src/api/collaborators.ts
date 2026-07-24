import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { DeviceRole } from "./devices";

export interface Collaborator {
  userId: string;
  email: string;
  role: Exclude<DeviceRole, "owner">;
  addedAt: string;
}

export interface CollaboratorsList {
  owner: { userId: string; email: string } | null;
  collaborators: Collaborator[];
}

export function useCollaborators(deviceId: string) {
  return useQuery({
    queryKey: ["devices", deviceId, "collaborators"],
    queryFn: () => apiFetch<CollaboratorsList>(`/api/devices/${deviceId}/collaborators`),
  });
}

// Add/update-role/remove all require a step-up token (see api/stepUp.ts)
// -- granting or changing access is exactly as sensitive as rotating a
// device's own API key, and self-removal ("leave") goes through this
// same remove mutation.
export function useAddCollaborator(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role, stepUpToken }: { email: string; role: Exclude<DeviceRole, "owner">; stepUpToken: string }) =>
      apiFetch<Collaborator>(`/api/devices/${deviceId}/collaborators`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "collaborators"] }),
  });
}

export function useUpdateCollaboratorRole(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role, stepUpToken }: { userId: string; role: Exclude<DeviceRole, "owner">; stepUpToken: string }) =>
      apiFetch<{ userId: string; role: DeviceRole }>(`/api/devices/${deviceId}/collaborators/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices", deviceId, "collaborators"] }),
  });
}

// Unlike the other three hooks here, this one isn't bound to one
// deviceId at creation -- it's used both from DeviceDetail's own
// Collaborators card (removing someone else, from one fixed device)
// and from DevicesList's per-row "Leave" action (removing yourself,
// from whichever device that row is), so deviceId travels with each
// call instead, matching useDeleteDevice's own shape in api/devices.ts.
// userId accepts the literal "me" as a shorthand for "remove my own
// access" -- the server resolves that to the caller's own id, so
// nothing here needs to know its own user id (this app currently only
// tracks the logged-in user's email client-side, not their Mongo id).
export function useRemoveCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, userId, stepUpToken }: { deviceId: string; userId: string; stepUpToken: string }) =>
      apiFetch<void>(`/api/devices/${deviceId}/collaborators/${userId}`, {
        method: "DELETE",
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["devices", vars.deviceId, "collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

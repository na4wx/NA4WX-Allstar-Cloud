import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { DeviceRole } from "../api/devices";

interface DeviceRoleState {
  role: DeviceRole;
  // canEdit covers everything editor-tier and up can do (node config,
  // sounds, schedules, tones, SkywarnPlus, SA818) -- the surface every
  // node-editing component in this tree renders. isAdmin is the
  // narrower admin-tier-and-up surface (Security/Restart options/Raw
  // config), gated separately at the DeviceDetail/NodeEditor level,
  // not inside the individual node-editing components themselves.
  canEdit: boolean;
  isAdmin: boolean;
}

const DeviceRoleContext = createContext<DeviceRoleState | null>(null);

export function DeviceRoleProvider({ role, children }: { role: DeviceRole; children: ReactNode }) {
  const value = useMemo<DeviceRoleState>(
    () => ({
      role,
      canEdit: role === "editor" || role === "admin" || role === "owner",
      isAdmin: role === "admin" || role === "owner",
    }),
    [role],
  );
  return <DeviceRoleContext.Provider value={value}>{children}</DeviceRoleContext.Provider>;
}

// useDeviceRole reads the current device's role, provided by
// NodeEditor/DeviceDetail from the Device they already fetched (see
// api/devices.ts's Device.role). Every node-editing component
// (CourtesyToneSection, TelemetrySection, WXToneSection, etc.) reads
// `canEdit` to disable its own Save/Add/Delete/Upload/Program
// controls for a viewer -- the real enforcement is server-side
// (every mutating route independently checks requireDeviceRole), this
// is purely UX: a viewer who somehow still submitted one would just
// get a 403 back, same as any other rejected request.
//
// Defaults to full access if read outside a DeviceRoleProvider --
// conservative would be "no access," but every current caller is
// inside NodeEditor's own tree, which always provides a real role
// once its device has loaded, so this only matters as a brief default
// during that initial load, not a real gap (again, server-side is the
// actual gate).
export function useDeviceRole(): DeviceRoleState {
  const ctx = useContext(DeviceRoleContext);
  return ctx ?? { role: "owner", canEdit: true, isAdmin: true };
}

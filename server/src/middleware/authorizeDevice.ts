import type { NextFunction, Request, Response } from "express";

import { DeviceModel, deviceRoleFor, ownerOrCollaboratorFilter, type DeviceRole } from "../models/Device.js";

declare global {
  namespace Express {
    interface Request {
      device?: InstanceType<typeof DeviceModel>;
      deviceRole?: DeviceRole;
    }
  }
}

// authorizeDevice verifies the authenticated user (req.userId, set by
// requireAuth) has *some* standing on the :deviceId route param --
// owner or any collaborator tier -- attaching the loaded Device and
// the caller's own DeviceRole for the route handler (and
// requireDeviceRole below) to use. Mounted per the Go app's plan doc's
// Security section (#5): every relayed action must check authorization
// independently of the WS-level API-key auth, since a valid JWT for
// user A must never reach into user B's device.
//
// A device that exists but this user has no standing on still 404s
// (never 403) -- deliberately indistinguishable from "device doesn't
// exist," so a stranger can't even confirm a given device ID is real.
// requireDeviceRole below is the one that 403s, for the different case
// of "you have *some* access, just not enough" -- see its own doc
// comment.
export async function authorizeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const device = await DeviceModel.findOne({ _id: req.params.deviceId, ...ownerOrCollaboratorFilter(req.userId!) });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  req.device = device;
  req.deviceRole = deviceRoleFor(device, req.userId!) ?? undefined;
  next();
}

// deviceRoleRank orders the four DeviceRole values from least to most
// privileged -- the one place that ordering is expressed, so
// requireDeviceRole never has to hardcode a comparison chain.
const deviceRoleRank: Record<DeviceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

// requireDeviceRole gates a route on top of authorizeDevice (which
// must run first) behind a minimum tier -- e.g.
// nodesRouter.put(..., requireDeviceRole("editor"), handler) for a
// config write, or router-level for an entire admin-only router like
// system.routes.ts. Composes the same way requireStepUp already does
// (requireAuth -> authorizeDevice -> requireDeviceRole/requireStepUp ->
// handler) -- no new middleware pattern introduced.
//
// 403s, not 404s: by the time this runs, authorizeDevice has already
// confirmed the device exists and this user has *some* access to it --
// this is purely "your tier isn't high enough for this one action."
export function requireDeviceRole(min: DeviceRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.deviceRole || deviceRoleRank[req.deviceRole] < deviceRoleRank[min]) {
      res.status(403).json({ error: "your role on this device doesn't allow this action" });
      return;
    }
    next();
  };
}

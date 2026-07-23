import type { NextFunction, Request, Response } from "express";

import { DeviceModel } from "../models/Device.js";

declare global {
  namespace Express {
    interface Request {
      device?: InstanceType<typeof DeviceModel>;
    }
  }
}

// authorizeDevice verifies the authenticated user (req.userId, set by
// requireAuth) owns the :deviceId route param, attaching the loaded
// Device for the route handler to use. Mounted per the Go app's plan
// doc's Security section (#5): every relayed action must check
// ownership independently of the WS-level API-key auth, since a valid
// JWT for user A must never reach into user B's device.
export async function authorizeDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const device = await DeviceModel.findOne({ _id: req.params.deviceId, owner: req.userId });
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  req.device = device;
  next();
}

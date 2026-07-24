import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const { requireDeviceRole } = await import("./authorizeDevice.js");
const { deviceRoleFor, ownerOrCollaboratorFilter } = await import("../models/Device.js");
const { Types } = await import("mongoose");

function fakeReq(deviceRole: "owner" | "admin" | "editor" | "viewer" | undefined): Request {
  return { deviceRole } as unknown as Request;
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & typeof res;
}

// fakeDevice builds just enough of a Device document for deviceRoleFor
// to read -- owner and collaborators are the only fields it looks at.
function fakeDevice(ownerId: string, collaborators: { user: string; role: "admin" | "editor" | "viewer" }[]) {
  return {
    owner: new Types.ObjectId(ownerId),
    collaborators: collaborators.map((c) => ({ user: new Types.ObjectId(c.user), role: c.role, addedAt: new Date() })),
  } as unknown as Parameters<typeof deviceRoleFor>[0];
}

describe("deviceRoleFor", () => {
  const ownerId = new Types.ObjectId().toString();
  const adminId = new Types.ObjectId().toString();
  const strangerId = new Types.ObjectId().toString();

  it("returns owner for the device's own owner", () => {
    const device = fakeDevice(ownerId, []);
    expect(deviceRoleFor(device, ownerId)).toBe("owner");
  });

  it("returns the stored role for a collaborator", () => {
    const device = fakeDevice(ownerId, [{ user: adminId, role: "admin" }]);
    expect(deviceRoleFor(device, adminId)).toBe("admin");
  });

  it("returns null for someone with no standing on the device", () => {
    const device = fakeDevice(ownerId, [{ user: adminId, role: "admin" }]);
    expect(deviceRoleFor(device, strangerId)).toBeNull();
  });
});

describe("ownerOrCollaboratorFilter", () => {
  it("matches on owner or collaborators.user", () => {
    expect(ownerOrCollaboratorFilter("user-1")).toEqual({
      $or: [{ owner: "user-1" }, { "collaborators.user": "user-1" }],
    });
  });
});

describe("requireDeviceRole", () => {
  it("calls next() when the role meets the minimum", () => {
    const next = vi.fn() as NextFunction;
    requireDeviceRole("editor")(fakeReq("admin"), fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next() when the role exactly matches the minimum", () => {
    const next = vi.fn() as NextFunction;
    requireDeviceRole("viewer")(fakeReq("viewer"), fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("responds 403 when the role is below the minimum", () => {
    const res = fakeRes();
    const next = vi.fn() as NextFunction;
    requireDeviceRole("admin")(fakeReq("editor"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("responds 403 when there's no role at all (authorizeDevice never ran, or found none)", () => {
    const res = fakeRes();
    const next = vi.fn() as NextFunction;
    requireDeviceRole("viewer")(fakeReq(undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  // The owner tier must outrank every collaborator tier, including admin.
  it("owner satisfies even the admin minimum", () => {
    const next = vi.fn() as NextFunction;
    requireDeviceRole("admin")(fakeReq("owner"), fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

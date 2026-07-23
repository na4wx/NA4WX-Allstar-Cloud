import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const { signStepUpToken, signAccessToken } = await import("../auth/jwt.js");
const { requireStepUp } = await import("./stepUpAuth.js");

function fakeReq(userId: string | undefined, headerToken: string | undefined): Request {
  return {
    userId,
    header: (name: string) => (name.toLowerCase() === "x-step-up-token" ? headerToken : undefined),
  } as unknown as Request;
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

describe("requireStepUp", () => {
  it("calls next() when the header carries a valid step-up token for this user", () => {
    const token = signStepUpToken("user-1");
    const next = vi.fn() as NextFunction;
    requireStepUp(fakeReq("user-1", token), fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("responds 403 when no header is present", () => {
    const res = fakeRes();
    const next = vi.fn() as NextFunction;
    requireStepUp(fakeReq("user-1", undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("responds 403 when the token was issued for a different user", () => {
    const token = signStepUpToken("someone-else");
    const res = fakeRes();
    const next = vi.fn() as NextFunction;
    requireStepUp(fakeReq("user-1", token), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  // The most important negative case: a normal, currently-valid access
  // token must not be usable in place of a step-up token just because
  // it's signed with the same secret.
  it("responds 403 when given a plain access token instead of a step-up token", () => {
    const accessToken = signAccessToken("user-1");
    const res = fakeRes();
    const next = vi.fn() as NextFunction;
    requireStepUp(fakeReq("user-1", accessToken), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

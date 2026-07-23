import type { NextFunction, Request, Response } from "express";

import { verifyStepUpToken } from "../auth/jwt.js";

// requireStepUp gates the highest-risk routes (reboot, restart-asterisk,
// raw config writes, API key rotation/revocation, device delete) behind
// a short-lived step-up token obtained via POST /api/auth/step-up (which
// re-checks the account password) -- see the Go app's plan doc's
// Security section (#5). Mounted after requireAuth, so req.userId is
// already set; the step-up token itself must have been issued for that
// same user.
//
// The client sends the token in a header rather than the body so it
// composes cleanly with routes that already have their own body shape
// (e.g. rawconfig's key/value payloads).
export function requireStepUp(req: Request, res: Response, next: NextFunction): void {
  const token = req.header("x-step-up-token");
  if (!token || !req.userId || !verifyStepUpToken(token, req.userId)) {
    res.status(403).json({ error: "this action requires re-entering your password", code: "STEP_UP_REQUIRED" });
    return;
  }
  next();
}

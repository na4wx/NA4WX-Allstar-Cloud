import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "./jwt.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// requireAuth reads a short-lived access token from the Authorization
// header (Bearer <token>) and attaches the resulting user id to the
// request. The client is expected to hold the access token in memory
// and re-fetch a new one via POST /api/auth/refresh (which uses the
// httpOnly refresh cookie) when a request comes back 401.
//
// Falls back to a ?token= query parameter when no header is present --
// needed only because the browser's EventSource API (used for the
// device live-status SSE stream) cannot set custom headers at all.
// This is a deliberate, narrow concession: a token in a URL can end up
// in server access logs or a Referer header, but the access token is
// short-lived (15 min) and this fallback only ever matters for the one
// GET route that can't use a header. Every state-changing route is
// still only ever called with a proper header by this app's own
// fetch-based client.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const [scheme, headerToken] = header.split(" ");
  const token = scheme === "Bearer" ? headerToken : typeof req.query.token === "string" ? req.query.token : undefined;
  if (!token) {
    res.status(401).json({ error: "missing access token" });
    return;
  }
  const userId = verifyAccessToken(token);
  if (!userId) {
    res.status(401).json({ error: "invalid or expired access token" });
    return;
  }
  req.userId = userId;
  next();
}

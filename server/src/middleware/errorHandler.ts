import type { NextFunction, Request, Response } from "express";

import { RelayError } from "../services/relay.js";

// errorHandler is Express's last-resort catch: any route that throws
// (or rejects, since Express 5-style async handlers propagate here)
// ends up with a plain JSON error instead of an HTML stack trace or a
// hung connection. Route handlers should still return their own 4xx for
// expected failures they check explicitly -- this is only for the
// unexpected ones, plus RelayError, whose whole point is carrying a
// more specific status than a blanket 500 (device not connected, relay
// timeout, or a validation error the device itself rejected).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }
  if (err instanceof RelayError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
}

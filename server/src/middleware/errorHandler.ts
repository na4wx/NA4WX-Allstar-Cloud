import type { NextFunction, Request, Response } from "express";

// errorHandler is Express's last-resort catch: any route that throws
// (or rejects, since Express 5-style async handlers propagate here)
// ends up with a plain JSON 500 instead of an HTML stack trace or a
// hung connection. Route handlers should still return their own 4xx for
// expected failures (bad input, not found, etc.) -- this is only for
// the unexpected ones.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "internal server error" });
}

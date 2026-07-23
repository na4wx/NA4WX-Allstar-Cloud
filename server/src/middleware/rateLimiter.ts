import rateLimit from "express-rate-limit";

// authRateLimiter bounds login/register/refresh attempts per IP -- the
// Go app's plan doc's Security section (#6) calls for this specifically
// on auth and action endpoints; auth is the one most exposed to
// credential-stuffing/brute-force, so it's the first one wired in.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too many attempts, try again later" },
});

// actionRateLimiter bounds every /api/devices/* call per IP -- the
// other half of Security section (#6)'s "auth and action endpoints".
// Much more permissive than authRateLimiter: legitimate use already
// polls this API repeatedly (device list refresh, node-live SSE
// reconnects, step-up-gated retries), so this exists to blunt a flood
// or a scripted enumeration attempt, not to bound normal usage.
export const actionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too many requests, slow down" },
});

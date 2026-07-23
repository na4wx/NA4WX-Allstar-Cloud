// stepUp.ts is the client half of the server's step-up auth gate (see
// server/src/middleware/stepUpAuth.ts) -- the highest-risk actions
// (reboot, restart-asterisk, raw config write, key rotation/revoke,
// device delete) need a short-lived token obtained by re-entering the
// account password, not just a valid session.
//
// tokenLifetimeMs must stay in sync with the server's own stepUpTokenTTL
// (server/src/auth/jwt.ts) -- caching a little short of the real
// expiry, rather than exactly matching it, means a cached token is
// never handed to a caller who might still be using it seconds after
// the server would already reject it.
const tokenLifetimeMs = 5 * 60 * 1000;
const safetyMarginMs = 20 * 1000;

let cachedToken: string | null = null;
let cachedExpiresAt = 0;

// handler is registered once by the root-level <StepUpPrompt> (see
// components/StepUpPrompt.tsx) -- it owns showing the password field,
// calling POST /api/auth/step-up, and resolving with the token (or
// rejecting if the operator cancels). Kept out of this module so
// stepUp.ts itself doesn't need to know anything about React.
let handler: (() => Promise<string>) | null = null;

export function registerStepUpHandler(fn: () => Promise<string>): void {
  handler = fn;
}

// ensureStepUp resolves with a currently-valid step-up token, prompting
// for the account password only if there's no cached one left with
// enough life to be worth using -- so triggering two gated actions
// within a few minutes of each other only asks once.
export async function ensureStepUp(): Promise<string> {
  if (cachedToken && Date.now() < cachedExpiresAt - safetyMarginMs) {
    return cachedToken;
  }
  if (!handler) {
    throw new Error("step-up authentication is not available");
  }
  const token = await handler();
  cachedToken = token;
  cachedExpiresAt = Date.now() + tokenLifetimeMs;
  return token;
}

// clearStepUpCache drops any cached token -- called on logout so a
// stale token from a previous session can never be reused.
export function clearStepUpCache(): void {
  cachedToken = null;
  cachedExpiresAt = 0;
}

// stepUpCancelled distinguishes "the operator closed the password
// prompt" from a real failure, so callers can treat it as a silent
// no-op rather than showing an error banner.
export class StepUpCancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

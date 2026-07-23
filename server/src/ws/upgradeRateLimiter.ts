// upgradeRateLimiter bounds /agent WebSocket upgrade attempts per IP --
// the other half of the Go app's plan doc's Security section (#6)
// ("rate limiting on the WS upgrade endpoint and action routes"); the
// action-route half lives in middleware/rateLimiter.ts's
// actionRateLimiter. express-rate-limit doesn't apply here since the
// upgrade handshake is handled directly on the raw http.Server, never
// reaching Express's own middleware chain -- see ws/agentServer.ts's
// attachAgentServer.
//
// limit is generous relative to a legitimate device's own reconnect
// cadence (internal/cloudagent's exponential backoff with full jitter,
// capped at 60s -- see that package's run.go), so normal reconnects
// after a blip never trip it; it exists to blunt a hello-brute-force or
// reconnect-storm scenario, not to bound ordinary use.
const windowMs = 60 * 1000;
const limit = 20;

const attemptsByIP = new Map<string, number[]>();

// allowUpgrade records one attempt from ip and reports whether it's
// still within the per-IP limit for the current window.
export function allowUpgrade(ip: string): boolean {
  const now = Date.now();
  const attempts = (attemptsByIP.get(ip) ?? []).filter((t) => now - t < windowMs);
  attempts.push(now);
  attemptsByIP.set(ip, attempts);
  return attempts.length <= limit;
}

// sweepStaleEntries drops IPs with no attempts left in the current
// window, so a long-running process serving many distinct home IPs
// over time (dynamic IPs, different devices) doesn't grow this map
// forever. Exported so a test can call it directly instead of waiting
// on the real interval.
export function sweepStaleEntries(): void {
  const now = Date.now();
  for (const [ip, attempts] of attemptsByIP) {
    if (!attempts.some((t) => now - t < windowMs)) {
      attemptsByIP.delete(ip);
    }
  }
}

setInterval(sweepStaleEntries, windowMs).unref();

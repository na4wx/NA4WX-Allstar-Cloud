# Security model

This service is a publicly reachable relay that can, when an operator
opts in, restart Asterisk, reboot a device, or rewrite its config
files. That's a materially different risk class than
HamVoipConfigGui's own local-only app — "reachable from the internet"
is not "already has a LAN session cookie." This document is the
current state of every mitigation the plan called for, what actually
implements it, and where the boundaries are.

If you find a vulnerability, please report it privately rather than
opening a public issue — see the repo's contact info.

## 1. API keys

- `hvc_live_<32 random bytes, base64url>` (`server/src/utils/apiKey.ts`,
  `generateAPIKey`). The prefix exists so a leaked key is recognizable
  at a glance in a log line or a scanner.
- Only an HMAC-SHA256 of the key (keyed by `API_KEY_PEPPER`, an
  environment secret held only by this service) is stored on the
  `Device` document — never the plaintext, and no need for bcrypt's
  deliberate slowness here, since the key itself is already
  high-entropy (no realistic online guessing attack to slow down).
- The plaintext is returned exactly once, at creation or rotation
  (`POST /api/devices`, `POST /api/devices/:id/rotate-key`), and never
  retrievable again.

## 2. No inbound ports, ever

The node (`internal/cloudagent`) only ever dials **out** to this
service; it never listens for or accepts an inbound connection. See
`docs/PROTOCOL.md`'s Transport section. There is no debug/metrics
endpoint on the node side at all currently; if one is added later, it
must bind to loopback only.

## 3. No free-form command passthrough

`internal/cloudagent`'s action registry (`dispatch.go`'s `actions()`)
is a fixed Go map literal, individually written out and reviewed —
never reflection, never a generic "call this method by name"
dispatcher. `internal/system.AsteriskRX`'s arbitrary-`cmd` signature is
never reachable from a relayed action; every action wraps exactly one
specific, hardcoded internal call. `TestActionsRegistryIsFixedAllowlist`
(`internal/cloudagent/dispatch_test.go`) pins the exact key set, so an
accidental switch to a dynamic dispatcher would have to change that
test too, not slip in silently.

## 4. Capability gates beyond Cloud Sync itself

Two extra, off-by-default flags live in the node's own local settings
(`internal/cloudagent/settings.go`'s `Settings.AllowRemoteReboot` /
`AllowRawConfigEdit`), each its own checkbox on the local "Cloud Sync"
card — separate from `Enabled` itself. `system.restartAsterisk` /
`system.reboot` require `AllowRemoteReboot`; every `rawconfig.*` write
(and `rawconfig.getFile`) requires `AllowRawConfigEdit`. Same
explicit-opt-in philosophy this app already uses for SkywarnPlus,
applied to capability rather than mere presence — enabling Cloud Sync
at all does not, by itself, expose either of these.

## 5. Per-action authorization + step-up auth

- Every `/api/devices/:deviceId/*` route runs `authorizeDevice`
  (`server/src/middleware/authorizeDevice.ts`), which independently
  verifies the authenticated user (`req.userId`, from `requireAuth`)
  owns that device — a valid JWT for user A can never reach into user
  B's device, regardless of what the WS-level API-key auth already
  checked.
- The highest-risk actions require **step-up auth** on top of a valid
  session: `POST /api/auth/step-up` (`routes/auth.routes.ts`)
  re-checks the account password and, on success, issues a short-lived
  (5 minute) signed token distinct from the normal access token (see
  `auth/jwt.ts`'s `signStepUpToken`/`verifyStepUpToken` — it carries a
  `stepUp: true` claim a plain access token never has, so one can never
  be used in place of the other even though both are signed with the
  same secret). The client sends it via the `X-Step-Up-Token` header;
  `middleware/stepUpAuth.ts`'s `requireStepUp` gates:
  - `POST /system/restart-asterisk`, `POST /system/reboot`
  - `POST /rawconfig/:file/key`, `/add-key`, `/add-section`
  - `POST /devices/:id/rotate-key`, `/revoke`, and `DELETE /devices/:id`
  - `rawconfig.getFile`/`listFiles` and `reactivate` stay ungated (reads,
    and reversing a revoke — the risky direction is revoking, already
    gated).
  - The client caches a step-up token for its ~5 minute life (minus a
    safety margin) so triggering several gated actions in a row only
    prompts once, and clears the cache on logout
    (`client/src/api/stepUp.ts`).

## 6. Rate limiting

- `authRateLimiter` (`middleware/rateLimiter.ts`): 20 requests / 15 min
  per IP on `/api/auth/*` — the surface most exposed to
  credential-stuffing/brute-force.
- `actionRateLimiter`: 120 requests / minute per IP across every
  `/api/devices/*` route — generous relative to legitimate polling
  (device list refresh, node-live SSE reconnects), sized to blunt a
  flood or enumeration attempt rather than bound ordinary use.
- The `/agent` WS upgrade handshake sits outside Express's own
  middleware chain (it's handled directly on the raw `http.Server`), so
  it has its own limiter: `ws/upgradeRateLimiter.ts`, 20 upgrade
  attempts / minute per IP, generous relative to a device's own
  exponential-backoff reconnect cadence (1s → 60s cap, full jitter —
  see `internal/cloudagent/run.go`).

## 7. TLS

- `internal/cloudagent` dials whatever URL the operator configures
  (`wss://` in production; `ws://` only ever used against a local dev
  server during development, as in this repo's own test harness). The
  node itself does not currently hard-refuse a plaintext `ws://` URL at
  the code level — this is a documented gap, not a claim of enforcement;
  operators should only ever be given a `wss://` URL by a real
  deployment, and a production `-cloud-url` default should always be
  `wss://`.
- This service's own TLS termination is expected to happen at a reverse
  proxy / load balancer in front of the Node process (this repo doesn't
  implement TLS itself) — standard for a Node/Express deployment.

## 8. Audit logging (both sides, independent)

- **Cloud side**: `AuditLogModel` (`server/src/models/AuditLog.ts`) —
  one document per attempt (device, user, action, ok, error, timestamp)
  for every relayed action (via `middleware/auditLogger.ts`'s
  `auditedSendAction`, used by every domain route instead of calling
  `sendAction` directly) and every device-management action
  (rotate/revoke/delete/reactivate, recorded inline in
  `devices.routes.ts`).
- **Node side**: `internal/cloudagent/audit.go`'s `auditWriter` appends
  one JSON-Lines entry per dispatched action (known or unknown, success
  or failure) to a local file (`-cloud-audit-log`, default
  `/var/log/hamvoip-gui/cloud-actions.log`), independent of whatever the
  cloud side's own database says — an empty path disables it entirely.
- **Neither log stores `params`**, deliberately: several actions carry
  secrets (a SkywarnPlus Pushover API token, SA818 module settings) that
  don't belong in a log whose only job is answering "what was asked,
  and did it work" — not "with what exact values." Both are
  independently verified never to leak a params value even on a failed
  call (`TestDispatchAuditEntryNeverIncludesParams` on the Go side;
  `auditLogger.test.ts`'s equivalent on the cloud side).
- Logging itself is best-effort on both sides: a logging failure never
  blocks or fails the actual action.

## 9. Compromise / rotation story

- **Rotate key** (`POST /devices/:id/rotate-key`, step-up gated):
  issues a new key, immediately invalidating the old one (new
  `apiKeyHash`) and forcibly disconnecting any live session still
  holding the old key (`ws/agentServer.ts`'s `disconnectDevice`) — a
  stale key doesn't linger until the connection happens to drop on its
  own. Verified against a running server: a held-open WS session closes
  within the same request as the rotation call.
- **Revoke** (`POST /devices/:id/revoke`, step-up gated): disables the
  device (`Device.enabled = false`) without deleting it or its audit
  history, and disconnects any live session the same way. A revoked
  device's hello is rejected outright (`"this device has been
  revoked"`), even with a technically-valid key. **Reactivate** reverses
  this without issuing a new key (ungated — the risky direction is
  revoking, not un-revoking).
- **Local kill switch**: unchecking Cloud Sync (or changing the API
  key) on the node's own System page calls `Agent.Reload()`
  (`internal/cloudagent/run.go`), which both wakes a waiting reconnect
  loop *and* forcibly closes any currently-open connection
  (`activeConn.Close`) — physical/local access to the node always wins,
  immediately, regardless of what the cloud side thinks. Verified
  end-to-end: disabling Cloud Sync while connected drops the device to
  offline within under a second.
- The node's own Cloud Sync card also shows **last connected** — the
  timestamp of the most recent successful hello handshake, "never" if
  none yet — as an honest liveness signal independent of the enabled
  toggle.

## 10. Short-lived, revocable sessions

- Access tokens: 15 minute JWT (`auth/jwt.ts`'s `signAccessToken`),
  held only in memory on the client (never localStorage — an XSS can't
  just read it out of storage; lost on reload, silently restored via
  the refresh flow).
- Refresh tokens: 30 day random token, only its SHA-256 hash persisted
  (`Session` model), delivered as an httpOnly cookie scoped to
  `/api/auth`. **Rotated on every use** — the old refresh token is
  revoked (`revokedAt`) the instant a new one is issued, so a
  captured-and-replayed refresh token only ever works once.
- `POST /api/auth/logout` revokes the current session's refresh token
  immediately.
- Step-up tokens (see #5) are a separate, much shorter-lived (5 min)
  credential on top of this, not a substitute for it.

## Dependency audit

Run as part of Phase 4 hardening; re-run periodically, not treated as
a one-time checkbox.

- **Go** (`go build`'s module graph): `govulncheck ./...` reports **0
  vulnerabilities** reachable by this code's actual call graph (0 in
  directly imported packages; some number of advisories exist in
  transitive modules this code never calls into, which govulncheck
  correctly doesn't flag as exploitable here).
- **Cloud server** (`server/`): `npm audit` — **0 vulnerabilities**
  after bumping `vitest` within its existing major version (2.x →
  3.2.7) to clear a critical transitive `vite`/`esbuild` advisory in
  the dev/test dependency chain; full test suite re-verified green
  after the bump.
- **Cloud client** (`client/`): `npm audit` reports one moderate/high
  advisory in `esbuild`/`vite`'s **local development server** (a
  malicious website could read responses from a running `vite dev`
  server — see GHSA-67mh-4wv8-2f99). This does **not** affect the
  production build output (`vite build`'s static assets contain no dev
  server). Clearing it requires a breaking `vite` 6+ upgrade; left as a
  documented, accepted risk rather than risking the build for a
  dev-only, local-network-only exposure. Revisit when a non-breaking
  fix becomes available, or before any change that would make the dev
  server more broadly reachable than a developer's own machine.

## Known constraints, not yet solved

- **Single-process WS↔REST bridging**: a browser's REST call must land
  on the same Express process holding that device's live WS connection
  (`services/relay.ts`'s in-memory `pending` map and
  `ws/agentServer.ts`'s in-memory `connections` map). Fine for a single
  Node.js instance; horizontal scaling would need sticky routing or a
  pub/sub broker (Redis) to relay calls/results across processes. Not
  built speculatively — documented here so it isn't rediscovered the
  hard way.
- **TLS enforcement is deployment-level, not code-level**, on both ends
  (see #7) — a misconfigured deployment could still run either side
  over plaintext. No automated test currently proves a `ws://` URL is
  refused, because nothing in the code refuses one.

# NA4WX Allstar Cloud

Public, multi-tenant companion to [HamVoipConfigGui](https://github.com/na4wx/HamVoipConfigGui). An operator creates an account here, registers a device, and gets an API key to paste into that node's own "Cloud Sync" settings card (System page). The node then dials out to this service (never the reverse — most nodes sit behind home NAT with no port forwarding) and this site can manage it remotely, with a UI that matches the local app's own look.

Full feature parity with the local app: accounts and device
registration, node config CRUD, sounds/TTS, WX courtesy tones, sound
scheduling, SA818 radio programming, SkywarnPlus, capability-gated
remote restart/reboot and raw config editing, on-demand live node
status, per-device API key rotation/revocation, step-up
password-re-check auth on the highest-risk actions, and an independent
audit trail on both sides.

See [`docs/PROTOCOL.md`](docs/PROTOCOL.md) for the exact node↔cloud
wire protocol and action catalog, and [`docs/SECURITY.md`](docs/SECURITY.md)
for the full security model and current dependency audit status.

## Layout

- `server/` — Express + TypeScript + MongoDB API, plus the WebSocket endpoint the node dials into (`/agent`).
- `client/` — React + TypeScript (Vite) frontend.
- `docs/` — protocol and security reference docs.

## Running locally

Requires Node 20+, `mongod` running locally (or a `MONGODB_URI` pointing elsewhere).

```sh
cd server && cp .env.example .env && npm install && npm run dev
cd client && npm install && npm run dev
```

The client dev server proxies `/api` and `/agent` to the server (see `client/vite.config.ts`), so both can run side by side without CORS configuration.

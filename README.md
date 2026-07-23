# NA4WX Allstar Cloud

Public, multi-tenant companion to [HamVoipConfigGui](https://github.com/na4wx/HamVoipConfigGui). An operator creates an account here, registers a device, and gets an API key to paste into that node's own "Cloud Sync" settings card (System page). The node then dials out to this service (never the reverse — most nodes sit behind home NAT with no port forwarding) and this site can manage it remotely, with a UI that matches the local app's own look.

See the local app repo's plan file for the full phased design (connectivity model, message protocol, security requirements). This repo currently implements Phase 1: accounts, device registration/API keys, and read-only connectivity status.

## Layout

- `server/` — Express + TypeScript + MongoDB API, plus the WebSocket endpoint the node dials into (`/agent`).
- `client/` — React + TypeScript (Vite) frontend.

## Running locally

Requires Node 20+, `mongod` running locally (or a `MONGODB_URI` pointing elsewhere).

```sh
cd server && cp .env.example .env && npm install && npm run dev
cd client && npm install && npm run dev
```

The client dev server proxies `/api` and `/agent` to the server (see `client/vite.config.ts`), so both can run side by side without CORS configuration.

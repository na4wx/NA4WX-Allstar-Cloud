// pm2 process definitions for both halves of this app -- run `pm2
// start ecosystem.config.js` from the repo root once each side has
// been built:
//
//   cd server && npm install && npm run build   # -> server/dist/index.js
//   cd client && npm install && npm run build   # -> client/dist/
//
// server/.env must exist (see server/.env.example) -- src/config/env.ts
// loads it via dotenv/config relative to the process's cwd, which pm2
// sets to "server" below, so no env vars need repeating here.
//
// The server MUST stay a single instance (fork mode, no cluster/
// exec_mode:"cluster", no instances > 1): its device connections
// (ws/agentServer.ts), pending relay calls (services/relay.ts), and
// rate limiter state (ws/upgradeRateLimiter.ts, express-rate-limit's
// in-memory store) all live in one process's memory. Running more than
// one instance would silently split that state across processes --
// see docs/SECURITY.md's "Known constraints" section.
module.exports = {
  apps: [
    {
      name: "na4wx-cloud-server",
      cwd: "./server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      // Serves the built React app (client/dist) with Vite's own
      // preview server -- a real static-file server, not the dev
      // server (no hot reload, no proxy needed since --host exposes it
      // directly). Fine for a small single-box deployment; swap this
      // app out for nginx/another static host once one is in place, and
      // point it at the same /api and /agent routes on the server port
      // instead (see client/vite.config.ts's dev-proxy comment for why
      // those two need to share an origin in front of the browser).
      name: "na4wx-cloud-client",
      cwd: "./client",
      script: "node_modules/.bin/vite",
      args: "preview --host 0.0.0.0 --port 4173",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

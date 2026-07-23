import http from "node:http";

import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connect } from "./db/mongoose.js";
import { attachAgentServer } from "./ws/agentServer.js";

async function main(): Promise<void> {
  await connect();

  const app = buildApp();
  const server = http.createServer(app);

  // The node-agent WebSocket endpoint (/agent) shares this same
  // http.Server/port with the REST API -- there is only ever one
  // listening address for this whole service, matching how
  // HamVoipConfigGui's own cloudagent only ever dials out to one URL.
  attachAgentServer(server);

  server.listen(env.port, () => {
    console.log(`na4wx-allstar-cloud listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("fatal startup error:", err);
  process.exit(1);
});

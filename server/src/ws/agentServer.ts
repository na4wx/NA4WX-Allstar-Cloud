import type { Server as HTTPServer } from "node:http";

import { WebSocketServer, type WebSocket } from "ws";

import { DeviceModel, toDeviceSummary } from "../models/Device.js";
import { resolveCall } from "../services/relay.js";
import { hashAPIKey } from "../utils/apiKey.js";
import { broadcast } from "./browserHub.js";

// envelope mirrors HamVoipConfigGui's own internal/cloudagent/protocol.go
// exactly -- the one message shape carried in both directions. See that
// file's doc comment for why every field is optional here: which ones
// are populated depends on Type.
interface Envelope {
  type: string;
  apiKey?: string;
  nodes?: string[];
  ok?: boolean;
  error?: string;
  id?: string;
  action?: string;
  params?: unknown;
  data?: unknown;
  event?: string;
  node?: string;
}

// connections holds one live WebSocket per currently-connected device,
// keyed by Device _id string -- services/relay.ts looks a connection up
// here to send a "call" envelope and await the correlated "result".
const connections = new Map<string, WebSocket>();

export function getConnection(deviceId: string): WebSocket | undefined {
  return connections.get(deviceId);
}

function send(ws: WebSocket, msg: Envelope): void {
  ws.send(JSON.stringify(msg));
}

// attachAgentServer wires the /agent WebSocket upgrade path onto an
// existing http.Server, alongside Express's own request handling on the
// same port -- there is deliberately no separate listener/port for
// this, since the whole point of the design is that a node only ever
// dials out to one well-known address.
export function attachAgentServer(server: HTTPServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url ?? "", "http://localhost");
    if (pathname !== "/agent") {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    let deviceId: string | null = null;

    ws.once("message", async (raw) => {
      let hello: Envelope;
      try {
        hello = JSON.parse(raw.toString());
      } catch {
        ws.close();
        return;
      }
      if (hello.type !== "hello" || !hello.apiKey) {
        send(ws, { type: "helloAck", ok: false, error: "expected a hello message" });
        ws.close();
        return;
      }

      const device = await DeviceModel.findOne({ apiKeyHash: hashAPIKey(hello.apiKey) });
      if (!device) {
        send(ws, { type: "helloAck", ok: false, error: "invalid API key" });
        ws.close();
        return;
      }

      deviceId = String(device._id);
      device.status = "online";
      device.lastSeenAt = new Date();
      device.set(
        "nodes",
        (hello.nodes ?? []).map((number) => ({ number, callsign: "", lastSeenAt: new Date() })),
      );
      await device.save();

      connections.set(deviceId, ws);
      send(ws, { type: "helloAck", ok: true });
      broadcast(deviceId, toDeviceSummary(device));

      ws.on("message", (raw2) => handleMessage(deviceId as string, raw2));
      ws.on("close", () => handleClose(deviceId as string));
      ws.on("error", () => handleClose(deviceId as string));
    });
  });
}

async function handleMessage(deviceId: string, raw: import("ws").RawData): Promise<void> {
  let msg: Envelope;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (msg.type === "event" && msg.event === "status") {
    const device = await DeviceModel.findById(deviceId);
    if (!device) {
      return;
    }
    device.lastStatus = msg.data;
    device.lastSeenAt = new Date();
    device.status = "online";
    await device.save();
    broadcast(deviceId, toDeviceSummary(device));
    return;
  }

  if (msg.type === "result" && msg.id) {
    resolveCall(msg.id, msg.ok === true, msg.error, msg.data);
    return;
  }
}

async function handleClose(deviceId: string): Promise<void> {
  connections.delete(deviceId);
  const device = await DeviceModel.findById(deviceId);
  if (!device) {
    return;
  }
  device.status = "offline";
  await device.save();
  broadcast(deviceId, toDeviceSummary(device));
}

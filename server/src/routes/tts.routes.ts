import { Router, type Request } from "express";

import { requireAuth } from "../auth/middleware.js";
import { authorizeDevice } from "../middleware/authorizeDevice.js";
import { ttsRateLimiter } from "../middleware/rateLimiter.js";
import { env } from "../config/env.js";
import { findVoice, listVoices, synthesize } from "../services/piperTts.js";

// ttsRouter is mounted at /api/devices/:deviceId/tts. Unlike every other
// router in this app, it never calls sendAction/auditedSendAction -- no
// device relay happens here at all. Speech is synthesized entirely by
// this process (see services/piperTts.ts) and handed straight back to
// the browser for in-page preview; only a separate, explicit "send to
// device" step (the existing POST /api/devices/:deviceId/sounds,
// unchanged by this feature) actually reaches the node. deviceId is
// still required and checked via authorizeDevice below purely so only a
// user who owns at least one device can spend this process's CPU on
// synthesis -- it's otherwise unused in either handler.
export const ttsRouter = Router({ mergeParams: true });
ttsRouter.use(requireAuth, authorizeDevice);

type Params = Request<{ deviceId: string }>;

const maxTtsTextLength = 500;

ttsRouter.get("/voices", async (_req: Params, res) => {
  const voices = await listVoices(env.piperVoicesDir);
  res.json(voices.map((v) => v.name));
});

ttsRouter.post("/generate", ttsRateLimiter, async (req: Params, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const voiceName = typeof req.body?.voice === "string" ? req.body.voice : "";
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  if (text.length > maxTtsTextLength) {
    res.status(400).json({ error: `text must be ${maxTtsTextLength} characters or fewer` });
    return;
  }
  const voice = await findVoice(env.piperVoicesDir, voiceName);
  if (!voice) {
    res.status(400).json({ error: `unknown voice "${voiceName}"` });
    return;
  }
  const wav = await synthesize(env.piperBin, voice.modelPath, text);
  res.json({ dataBase64: wav.toString("base64") });
});

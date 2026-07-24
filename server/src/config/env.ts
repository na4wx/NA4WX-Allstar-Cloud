import "dotenv/config";

// env centralizes every environment variable this service reads, with
// fail-fast checks for the secrets it can't run without -- an empty
// JWT_SECRET or API_KEY_PEPPER would silently make every access token
// and every device API key hash trivially forgeable/collidable, so
// those two are required rather than defaulted.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/na4wx-allstar-cloud",
  jwtSecret: required("JWT_SECRET"),
  apiKeyPepper: required("API_KEY_PEPPER"),
  isProduction: process.env.NODE_ENV === "production",

  // clientOrigin enables CORS (see app.ts) for a client served from a
  // different origin than this API -- e.g. a separate
  // allstar.example.com / api-allstar.example.com subdomain split,
  // rather than a reverse proxy putting both behind one origin. Unset
  // by default: same-origin deployments (the more common case, and
  // this repo's own local dev setup via client/vite.config.ts's dev
  // proxy) need no CORS configuration at all.
  clientOrigin: process.env.CLIENT_ORIGIN,

  // piperBin/piperVoicesDir configure server-side text-to-speech (see
  // services/piperTts.ts) -- Piper run on this process instead of the
  // node, for the same reason the node's own internal/tts package runs
  // it locally: free, fully offline neural TTS, just with real CPU/RAM
  // behind it instead of a Pi's. No required() check: a missing/empty
  // voices dir just means listVoices() returns [] (matches the Go
  // side's own ListVoices treating a missing directory as "no voices,"
  // not an error) -- TTS generation is optional, not load-bearing.
  piperBin: process.env.PIPER_BIN ?? "piper",
  piperVoicesDir: process.env.PIPER_VOICES_DIR ?? "",

  // appUrl is the browser-facing origin this service is reached at --
  // used only to build the link embedded in a password-reset email
  // (see services/mailer.ts). Deliberately separate from clientOrigin
  // above: that one is CORS-only and unset by default in the common
  // same-origin deployment, so it can't be relied on here. Must be set
  // to the real public origin in production (e.g.
  // https://allstar.na4wx.com) or reset links will point at localhost.
  appUrl: process.env.APP_URL ?? "http://localhost:5173",

  // SMTP config for password-reset emails (see services/mailer.ts and
  // routes/auth.routes.ts's POST /forgot-password). No required()
  // check, same reasoning as Piper above: a missing SMTP_HOST just
  // means the reset email is logged instead of sent -- useful for local
  // dev, and it means this feature degrading doesn't take the whole
  // auth router down with it. Must be configured for real users to
  // actually receive a reset email in production.
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "NA4WX Allstar Cloud <no-reply@localhost>",
};

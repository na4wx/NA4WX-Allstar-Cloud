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
};

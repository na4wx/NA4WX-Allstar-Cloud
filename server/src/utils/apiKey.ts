import crypto from "node:crypto";

import { env } from "../config/env.js";

// keyPrefix marks a value as one of this service's own device API keys
// -- helps a human (or an automated secret scanner) recognize a leaked
// key in a log line at a glance. Matches the Go app's plan doc's
// Security section (#1).
const keyPrefix = "hvc_live_";

export interface GeneratedAPIKey {
  plaintext: string; // shown to the operator exactly once
  hash: string; // what's actually stored (see hashAPIKey)
  hint: string; // last 4 chars, safe to display later
}

// generateAPIKey creates a new high-entropy device API key. The
// plaintext is never persisted anywhere -- only hash and hint are
// stored on the Device document.
export function generateAPIKey(): GeneratedAPIKey {
  const plaintext = keyPrefix + crypto.randomBytes(32).toString("base64url");
  return { plaintext, hash: hashAPIKey(plaintext), hint: plaintext.slice(-4) };
}

// hashAPIKey computes an HMAC-SHA256 of key using API_KEY_PEPPER as the
// HMAC key -- not a plain hash, so a stolen copy of the Device
// collection alone (without the separately-held pepper) can't be
// brute-forced offline against a key-space guess. High-entropy input
// (32 random bytes) also means this doesn't need bcrypt's deliberate
// slowness -- there's no realistic online guessing attack to slow down.
export function hashAPIKey(key: string): string {
  return crypto.createHmac("sha256", env.apiKeyPepper).update(key).digest("hex");
}

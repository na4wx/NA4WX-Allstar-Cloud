import { describe, expect, it } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const { generateAPIKey, hashAPIKey } = await import("./apiKey.js");

describe("generateAPIKey", () => {
  it("returns a plaintext key prefixed for recognizability", () => {
    const key = generateAPIKey();
    expect(key.plaintext.startsWith("hvc_live_")).toBe(true);
  });

  it("returns a hint matching the plaintext's last 4 characters", () => {
    const key = generateAPIKey();
    expect(key.hint).toBe(key.plaintext.slice(-4));
    expect(key.hint).toHaveLength(4);
  });

  it("never stores the plaintext as the hash", () => {
    const key = generateAPIKey();
    expect(key.hash).not.toBe(key.plaintext);
    expect(key.hash).toBe(hashAPIKey(key.plaintext));
  });

  it("produces different keys each call", () => {
    const a = generateAPIKey();
    const b = generateAPIKey();
    expect(a.plaintext).not.toBe(b.plaintext);
  });
});

describe("hashAPIKey", () => {
  it("is deterministic for the same input", () => {
    expect(hashAPIKey("some-key")).toBe(hashAPIKey("some-key"));
  });

  it("differs for different inputs", () => {
    expect(hashAPIKey("key-a")).not.toBe(hashAPIKey("key-b"));
  });
});

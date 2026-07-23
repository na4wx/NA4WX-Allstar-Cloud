import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } = await import("./jwt.js");

describe("access tokens", () => {
  it("round-trips the user id", () => {
    const token = signAccessToken("user-123");
    expect(verifyAccessToken(token)).toBe("user-123");
  });

  it("rejects a malformed token", () => {
    expect(verifyAccessToken("not-a-real-token")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ sub: "user-123" }, "wrong-secret", { expiresIn: "15m" });
    expect(verifyAccessToken(forged)).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("generates high-entropy, distinct tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(32);
  });

  it("hashes deterministically and never returns the plaintext", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toBe(hashRefreshToken(token));
  });
});

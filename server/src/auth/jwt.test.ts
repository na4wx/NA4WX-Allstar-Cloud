import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken, signStepUpToken, verifyStepUpToken } = await import(
  "./jwt.js"
);

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

describe("step-up tokens", () => {
  it("verifies for the exact user id it was issued for", () => {
    const token = signStepUpToken("user-123");
    expect(verifyStepUpToken(token, "user-123")).toBe(true);
  });

  it("rejects a step-up token presented for a different user id", () => {
    const token = signStepUpToken("user-123");
    expect(verifyStepUpToken(token, "user-456")).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifyStepUpToken("not-a-real-token", "user-123")).toBe(false);
  });

  // A plain access token must never satisfy a step-up check, even
  // though both are signed with the same secret -- the stepUp claim is
  // what actually distinguishes them.
  it("rejects a valid access token lacking the stepUp claim", () => {
    const accessToken = signAccessToken("user-123");
    expect(verifyStepUpToken(accessToken, "user-123")).toBe(false);
  });

  it("rejects a step-up token signed with a different secret", () => {
    const forged = jwt.sign({ sub: "user-123", stepUp: true }, "wrong-secret", { expiresIn: "5m" });
    expect(verifyStepUpToken(forged, "user-123")).toBe(false);
  });
});

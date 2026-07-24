import { describe, expect, it } from "vitest";

import { generatePasswordResetToken, hashPasswordResetToken } from "./passwordReset.js";

describe("password reset tokens", () => {
  it("generates high-entropy, distinct tokens", () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(32);
  });

  it("hashes deterministically and never returns the plaintext", () => {
    const token = generatePasswordResetToken();
    const hash = hashPasswordResetToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toBe(hashPasswordResetToken(token));
  });
});

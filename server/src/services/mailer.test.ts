import { describe, expect, it } from "vitest";

process.env.JWT_SECRET ??= "test-secret";
process.env.API_KEY_PEPPER ??= "test-pepper";

const { sendPasswordResetEmail } = await import("./mailer.js");

describe("sendPasswordResetEmail", () => {
  // SMTP_HOST is intentionally left unset in this test environment --
  // this proves the "optional feature" path (see mailer.ts's own doc
  // comment): a cloud instance with no SMTP configured must not have
  // POST /forgot-password blow up because of it.
  it("no-ops without throwing or attempting a network connection when SMTP isn't configured", async () => {
    await expect(sendPasswordResetEmail("someone@example.com", "https://allstar.example.com/reset-password?token=abc")).resolves.toBeUndefined();
  });
});

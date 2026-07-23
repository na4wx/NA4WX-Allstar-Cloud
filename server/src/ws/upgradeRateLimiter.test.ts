import { beforeEach, describe, expect, it, vi } from "vitest";

import { allowUpgrade, sweepStaleEntries } from "./upgradeRateLimiter.js";

describe("allowUpgrade", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts up to the per-IP limit", () => {
    const ip = "203.0.113.1";
    for (let i = 0; i < 20; i++) {
      expect(allowUpgrade(ip)).toBe(true);
    }
  });

  it("rejects the attempt once an IP exceeds its limit within the window", () => {
    const ip = "203.0.113.2";
    for (let i = 0; i < 20; i++) {
      allowUpgrade(ip);
    }
    expect(allowUpgrade(ip)).toBe(false);
  });

  it("tracks each IP independently", () => {
    const a = "203.0.113.3";
    const b = "203.0.113.4";
    for (let i = 0; i < 20; i++) {
      allowUpgrade(a);
    }
    expect(allowUpgrade(a)).toBe(false);
    expect(allowUpgrade(b)).toBe(true);
  });

  it("allows attempts again once the window has passed", () => {
    vi.useFakeTimers();
    try {
      const ip = "203.0.113.5";
      for (let i = 0; i < 20; i++) {
        allowUpgrade(ip);
      }
      expect(allowUpgrade(ip)).toBe(false);

      vi.advanceTimersByTime(61 * 1000);
      expect(allowUpgrade(ip)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("sweepStaleEntries", () => {
  it("does not throw, and stale IPs can be rate-limited fresh afterward", () => {
    vi.useFakeTimers();
    try {
      const ip = "203.0.113.6";
      allowUpgrade(ip);
      vi.advanceTimersByTime(61 * 1000);
      expect(() => sweepStaleEntries()).not.toThrow();

      for (let i = 0; i < 20; i++) {
        expect(allowUpgrade(ip)).toBe(true);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

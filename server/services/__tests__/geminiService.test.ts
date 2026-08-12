import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Gemini Service API Key Cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should clean up expired keys from blacklistedKeys and stale keys from nextAllowedTimeByKey", async () => {
    const { _testMaps } = await import("../geminiService");
    _testMaps.blacklistedKeys.clear();
    _testMaps.nextAllowedTimeByKey.clear();
    const now = Date.now();

    // 1. Setup blacklistedKeys
    // Key A: expired (expiry is in the past)
    _testMaps.blacklistedKeys.set("key_black_expired", now - 1000);
    // Key B: not expired (expiry is 15 minutes in the future)
    _testMaps.blacklistedKeys.set("key_black_active", now + 15 * 60 * 1000);

    // 2. Setup nextAllowedTimeByKey
    // Key C: stale (nextAllowedTime was set 40 minutes ago, which is > 30 minutes threshold)
    _testMaps.nextAllowedTimeByKey.set("key_rate_stale", now - 40 * 60 * 1000);
    // Key D: active (nextAllowedTime is now)
    _testMaps.nextAllowedTimeByKey.set("key_rate_active", now);

    // Trigger the interval by advancing time by 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000);

    // Assert blacklistedKeys
    expect(_testMaps.blacklistedKeys.has("key_black_expired")).toBe(false);
    expect(_testMaps.blacklistedKeys.has("key_black_active")).toBe(true);

    // Assert nextAllowedTimeByKey
    expect(_testMaps.nextAllowedTimeByKey.has("key_rate_stale")).toBe(false);
    expect(_testMaps.nextAllowedTimeByKey.has("key_rate_active")).toBe(true);
  });
});

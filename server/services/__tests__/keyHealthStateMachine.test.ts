import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { quotaService, KeyHealthState } from "../quotaService";
import { AIErrorCode } from "../../constants/errors";
import { normalizeUpstreamError } from "../../utils/errorClassifier";

describe("Key Health State Machine & Recovery Engine", () => {
  const testKey = "AIzaSyTestHealthStateMachineKey1234567";
  const model = "gemini-2.5-flash";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial State", () => {
    it("should initialize a new key in Healthy state and isAvailable = true", () => {
      const uniqueKey = "AIzaSyNewInitialKey999999999999999999";
      const health = quotaService.getKeyHealth(uniqueKey);

      expect(health.state).toBe("Healthy");
      expect(health.isAvailable).toBe(true);
      expect(health.cooldownRemainingMs).toBe(0);
      expect(health.consecutiveErrors).toBe(0);
    });

    it("should return Disabled state for empty or whitespace-only keys", () => {
      const healthEmpty = quotaService.getKeyHealth("");
      expect(healthEmpty.state).toBe("Disabled");
      expect(healthEmpty.isAvailable).toBe(false);

      const healthWhitespace = quotaService.getKeyHealth("   ");
      expect(healthWhitespace.state).toBe("Disabled");
      expect(healthWhitespace.isAvailable).toBe(false);
    });
  });

  describe("State Transitions with Recorded Reasons", () => {
    it("should transition to AuthFailed upon 401/403 errors and record reason", () => {
      const authKey = "AIzaSyAuthTestKey1111111111111111111";
      const err = normalizeUpstreamError({ status: 401, message: "API key not valid" });

      quotaService.recordCategorizedError(authKey, model, err);
      const health = quotaService.getKeyHealth(authKey);

      expect(health.state).toBe("AuthFailed");
      expect(health.isAvailable).toBe(false);
      expect(health.transitionReason).toContain("401/403");
    });

    it("should transition to RateLimited upon 429 RPM/TPM limit with cooldown", () => {
      const rateKey = "AIzaSyRateLimitKey222222222222222222";
      const err = normalizeUpstreamError({ status: 429, message: "Resource exhausted: rate limit exceeded" });

      quotaService.recordCategorizedError(rateKey, model, err);
      const health = quotaService.getKeyHealth(rateKey);

      expect(health.state).toBe("RateLimited");
      expect(health.isAvailable).toBe(false);
      expect(health.cooldownRemainingMs).toBeGreaterThan(0);
      expect(health.transitionReason).toContain("429");
    });

    it("should transition to QuotaExhausted upon 429 RPD daily quota error", () => {
      const quotaKey = "AIzaSyQuotaExhaustedKey3333333333333";
      const err = normalizeUpstreamError({ status: 429, message: "Daily request limit exceeded (RPD)" });

      quotaService.recordCategorizedError(quotaKey, model, err);
      const health = quotaService.getKeyHealth(quotaKey);

      expect(health.state).toBe("QuotaExhausted");
      expect(health.isAvailable).toBe(false);
      expect(health.transitionReason).toContain("RPD");
    });

    it("should transition to Cooldown upon 503 Overload and Network errors", () => {
      const overloadKey = "AIzaSyOverloadKey44444444444444444";
      const err503 = normalizeUpstreamError({ status: 503, message: "The model is overloaded" });

      quotaService.recordCategorizedError(overloadKey, model, err503);
      const health = quotaService.getKeyHealth(overloadKey);

      expect(health.state).toBe("Cooldown");
      expect(health.isAvailable).toBe(false);
      expect(health.cooldownRemainingMs).toBeGreaterThan(0);
      expect(health.transitionReason).toContain("503");
    });

    it("should transition to Degraded on sporadic errors and then Cooldown after consecutive threshold", () => {
      const degradedKey = "AIzaSyDegradedKey55555555555555555";
      const unknownErr = normalizeUpstreamError(new Error("Random glitch"));

      // 1 error -> Degraded
      quotaService.recordCategorizedError(degradedKey, model, unknownErr);
      let health = quotaService.getKeyHealth(degradedKey);
      expect(health.state).toBe("Degraded");
      expect(health.isAvailable).toBe(true);

      // Consecutive errors -> Cooldown
      quotaService.recordCategorizedError(degradedKey, model, unknownErr);
      quotaService.recordCategorizedError(degradedKey, model, unknownErr);
      health = quotaService.getKeyHealth(degradedKey);
      expect(health.state).toBe("Cooldown");
      expect(health.isAvailable).toBe(false);
    });

    it("should support manual disable and re-enable", () => {
      const toggleKey = "AIzaSyManualToggleKey666666666666666";

      quotaService.setKeyDisabled(toggleKey, true, "Bảo trì định kỳ");
      let health = quotaService.getKeyHealth(toggleKey);
      expect(health.state).toBe("Disabled");
      expect(health.isAvailable).toBe(false);
      expect(health.transitionReason).toBe("Bảo trì định kỳ");

      quotaService.setKeyDisabled(toggleKey, false);
      health = quotaService.getKeyHealth(toggleKey);
      expect(health.state).toBe("Healthy");
      expect(health.isAvailable).toBe(true);
      expect(health.transitionReason).toContain("Kích hoạt lại");
    });
  });

  describe("Recovery Policies", () => {
    it("should automatically recover from Cooldown/RateLimited when TTL expires", () => {
      const ttlKey = "AIzaSyTTLRecoveryKey777777777777777777";
      const err = normalizeUpstreamError({ status: 503, message: "Model overloaded" }); // 3s cooldown

      const now = Date.now();
      quotaService.recordCategorizedError(ttlKey, model, err, now);

      let health = quotaService.getKeyHealth(ttlKey, now);
      expect(health.state).toBe("Cooldown");
      expect(health.isAvailable).toBe(false);

      // Advance time by 4 seconds
      const futureNow = now + 4000;
      vi.setSystemTime(new Date(futureNow));

      health = quotaService.getKeyHealth(ttlKey, futureNow);
      expect(health.state).toBe("Healthy");
      expect(health.isAvailable).toBe(true);
      expect(health.cooldownRemainingMs).toBe(0);
      expect(health.transitionReason).toContain("Phục hồi");
    });

    it("should NEVER automatically recover from AuthFailed", () => {
      const permKey = "AIzaSyPermanentAuthKey8888888888888888";
      const err = normalizeUpstreamError({ status: 401, message: "API_KEY_INVALID" });

      const now = Date.now();
      quotaService.recordCategorizedError(permKey, model, err, now);

      let health = quotaService.getKeyHealth(permKey, now);
      expect(health.state).toBe("AuthFailed");
      expect(health.isAvailable).toBe(false);

      // Advance time by 1 day
      const nextDay = now + 24 * 60 * 60 * 1000;
      vi.setSystemTime(new Date(nextDay));

      health = quotaService.getKeyHealth(permKey, nextDay);
      expect(health.state).toBe("AuthFailed");
      expect(health.isAvailable).toBe(false);
    });

    it("should recover QuotaExhausted when daily reset day changes in America/Los_Angeles", () => {
      const dailyKey = "AIzaSyDailyRolloverKey99999999999999";
      const day1 = new Date("2026-08-20T20:00:00Z").getTime();
      vi.setSystemTime(new Date(day1));

      const quotaErr = normalizeUpstreamError({ status: 429, message: "Daily request limit exceeded (RPD)" });
      quotaService.recordCategorizedError(dailyKey, model, quotaErr, day1);

      let health = quotaService.getKeyHealth(dailyKey, day1);
      expect(health.state).toBe("QuotaExhausted");
      expect(health.isAvailable).toBe(false);

      // Advance to next day in Los Angeles (08:00 UTC next day = 01:00 AM PDT)
      const day2 = new Date("2026-08-21T08:00:00Z").getTime();
      vi.setSystemTime(new Date(day2));

      health = quotaService.getKeyHealth(dailyKey, day2);
      expect(health.state).toBe("Healthy");
      expect(health.isAvailable).toBe(true);
      expect(health.transitionReason).toContain("Phục hồi");
    });

    it("should recover Degraded key back to Healthy upon successful API calls", () => {
      const degradedRecoverKey = "AIzaSyDegradedRecoveryKey00000000";
      const err = normalizeUpstreamError(new Error("Transient socket hang up"));

      quotaService.recordCategorizedError(degradedRecoverKey, model, err);
      let health = quotaService.getKeyHealth(degradedRecoverKey);
      expect(health.state).toBe("Degraded");

      // Successful call recovers state
      quotaService.recordUsage(degradedRecoverKey, model, "success");
      health = quotaService.getKeyHealth(degradedRecoverKey);
      expect(health.state).toBe("Healthy");
      expect(health.isAvailable).toBe(true);
      expect(health.transitionReason).toContain("Phục hồi");
    });
  });
});

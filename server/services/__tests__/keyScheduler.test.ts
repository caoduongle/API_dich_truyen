import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaService } from '../quotaService';
import { computePerKeyIntervalMs, _testMaps } from '../geminiService';
import { modelInfoService } from '../modelInfoService';
import { AIErrorCode } from '../../constants/errors';

describe('Quota-Aware Per-Key RPM Scheduler', () => {
  beforeEach(() => {
    quotaService.resetAll();
    modelInfoService.clearCache();
    _testMaps.nextAllowedTimeByKey.clear();
    _testMaps.resetActiveRequests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Story 1: computePerKeyIntervalMs & Independent Per-Key Pacing', () => {
    it('calculates accurate safety intervals for various custom RPMs', () => {
      // 15 RPM -> 60000 / (15 * 0.9) = 4444.44 -> ceil = 4445ms
      expect(computePerKeyIntervalMs(15)).toBe(4445);

      // 60 RPM -> 60000 / (60 * 0.9) = 1111.11 -> ceil = 1112ms
      expect(computePerKeyIntervalMs(60)).toBe(1112);

      // 120 RPM -> 60000 / (120 * 0.9) = 555.55 -> ceil = 556ms
      expect(computePerKeyIntervalMs(120)).toBe(556);

      // 300 RPM -> clamped to server safety floor 400ms
      expect(computePerKeyIntervalMs(300)).toBe(400);
    });

    it('falls back to model tier default intervals when RPM is not explicitly provided', () => {
      expect(computePerKeyIntervalMs(undefined, 'gemini-2.5-pro')).toBe(6000);
      expect(computePerKeyIntervalMs(undefined, 'gemini-3.1-flash-lite')).toBe(3500);
      expect(computePerKeyIntervalMs(undefined, 'gemma-4-31b-it')).toBe(2000);
      expect(computePerKeyIntervalMs(undefined, 'gemini-2.5-flash')).toBe(4445);
    });

    it('maintains independent pacing clocks for Key A (15 RPM) and Key B (60 RPM)', () => {
      const keyA = 'AIzaSyKeyA_FreeTier_15RPM';
      const keyB = 'AIzaSyKeyB_PayG_60RPM';

      const intervalA = computePerKeyIntervalMs(15);
      const intervalB = computePerKeyIntervalMs(60);

      const now = 1000000;
      // Simulate dispatching Key A at time `now`
      _testMaps.nextAllowedTimeByKey.set(keyA, now + intervalA);

      // Key A has remaining delay = 4445ms
      const delayA = Math.max(0, (_testMaps.nextAllowedTimeByKey.get(keyA) || 0) - (now + 500));
      expect(delayA).toBe(3945);

      // Key B was not dispatched, remaining delay = 0ms
      const delayB = Math.max(0, (_testMaps.nextAllowedTimeByKey.get(keyB) || 0) - (now + 500));
      expect(delayB).toBe(0);

      // Now dispatch Key B at time `now + 500`
      _testMaps.nextAllowedTimeByKey.set(keyB, (now + 500) + intervalB);

      // At now + 2000ms:
      // Key B (interval 1112ms) is already ready (delay = 0)
      const delayB_after = Math.max(0, (_testMaps.nextAllowedTimeByKey.get(keyB) || 0) - (now + 2000));
      expect(delayB_after).toBe(0);

      // Key A (interval 4445ms) still has pending delay = 2445ms
      const delayA_after = Math.max(0, (_testMaps.nextAllowedTimeByKey.get(keyA) || 0) - (now + 2000));
      expect(delayA_after).toBe(2445);
    });
  });

  describe('User Story 2: Multi-Stage Candidate Key Filtering', () => {
    const validKey = 'AIzaSyValidKey_1234567890';
    const model = 'gemini-2.5-flash';

    it('filters out disabled or AuthFailed keys', () => {
      const authFailedKey = 'AIzaSyAuthFailedKey_123';
      quotaService.recordCategorizedError(authFailedKey, model, {
        code: AIErrorCode.AUTH_FAILED,
        message: 'Invalid API key',
        isRetryable: false,
        recommendedAction: 'disable_key',
        httpStatus: 401,
      });

      const score = quotaService.calculateKeyScore(authFailedKey, model);
      expect(score.isEligible).toBe(false);
      expect(score.rejectReason).toContain('AuthFailed');
    });

    it('filters out keys in active cooldown or open circuit breaker', () => {
      const coolingKey = 'AIzaSyCoolingKey_456';
      quotaService.recordCategorizedError(coolingKey, model, {
        code: AIErrorCode.RATE_LIMITED,
        message: 'Quota exceeded',
        isRetryable: true,
        recommendedAction: 'cooldown_key',
        httpStatus: 429,
        retryAfterSec: 30,
      });

      const score = quotaService.calculateKeyScore(coolingKey, model);
      expect(score.isEligible).toBe(false);
      expect(score.rejectReason).toContain('RateLimited');
    });

    it('filters out keys verified not to support the requested model', () => {
      const keyWithoutModel = 'AIzaSyKeyWithoutGemma';
      const score = quotaService.calculateKeyScore(keyWithoutModel, 'gemma-4-31b-it', {
        isModelSupported: false,
      });

      expect(score.isEligible).toBe(false);
      expect(score.rejectReason).toContain('không hỗ trợ mô hình');
    });

    it('filters out keys that reached sliding window minute RPM capacity', () => {
      const now = Date.now();
      const rpmCappedKey = 'AIzaSyRpmCappedKey';

      // Record 15 requests in current minute for 15 RPM key
      for (let i = 0; i < 15; i++) {
        quotaService.recordUsage(rpmCappedKey, model, 'success', now - (i * 1000), { totalTokens: 100, promptTokens: 50, outputTokens: 50 });
      }

      const score = quotaService.calculateKeyScore(rpmCappedKey, model, {
        keyRpm: 15,
      }, now);

      expect(score.isEligible).toBe(false);
      expect(score.rejectReason).toContain('chạm giới hạn RPM');
    });

    it('filters out keys that would exceed sliding window minute TPM capacity', () => {
      const now = Date.now();
      const tpmCappedKey = 'AIzaSyTpmCappedKey';

      // Record 940,000 tokens consumed in current minute (out of 1,000,000 max TPM)
      quotaService.recordUsage(tpmCappedKey, model, 'success', now - 5000, { totalTokens: 940000, promptTokens: 500000, outputTokens: 440000 });

      // Request requiring 30,000 tokens -> total 970,000 > 950,000 (95% safety ceiling)
      const score = quotaService.calculateKeyScore(tpmCappedKey, model, {
        estimatedTokens: 30000,
        keyMaxTpm: 1000000,
      }, now);

      expect(score.isEligible).toBe(false);
      expect(score.rejectReason).toContain('vượt ngưỡng an toàn TPM');
    });

    it('filters out keys that reached daily RPD capacity', () => {
      const now = Date.now();
      const rpdCappedKey = 'AIzaSyRpdCappedKey';

      // Set requestsToday to 1500 by recording calls earlier today (outside the 60s RPM window)
      for (let i = 0; i < 1500; i++) {
        quotaService.recordUsage(rpdCappedKey, model, 'success', now - 120000 - (i * 10), { totalTokens: 10, promptTokens: 5, outputTokens: 5 });
      }

      const score = quotaService.calculateKeyScore(rpdCappedKey, model, {
        keyRpm: 15,
        keyMaxRpd: 1500,
      }, now);

      expect(score.isEligible).toBe(false);
      expect(score.rejectReason).toContain('chạm giới hạn RPD');
    });
  });

  describe('User Story 3: Predictive Scoring, Idle Time Round-Robin & Concurrency', () => {
    const model = 'gemini-2.5-flash';
    const now = Date.now();

    it('prioritizes least recently used keys for natural round-robin distribution', () => {
      const keyRecentlyUsed = 'AIzaSyKeyRecentlyUsed';
      const keyIdle = 'AIzaSyKeyIdle';

      // Key 1 used 5 seconds ago
      quotaService.recordUsage(keyRecentlyUsed, model, 'success', now - 5000, { totalTokens: 1000, promptTokens: 500, outputTokens: 500 });

      // Key 2 used 120 seconds ago
      quotaService.recordUsage(keyIdle, model, 'success', now - 120000, { totalTokens: 1000, promptTokens: 500, outputTokens: 500 });

      const scoreRecent = quotaService.calculateKeyScore(keyRecentlyUsed, model, { keyRpm: 15 }, now);
      const scoreIdle = quotaService.calculateKeyScore(keyIdle, model, { keyRpm: 15 }, now);

      expect(scoreRecent.isEligible).toBe(true);
      expect(scoreIdle.isEligible).toBe(true);
      expect(scoreIdle.score).toBeGreaterThan(scoreRecent.score);
    });

    it('gives readiness bonus to keys with zero wait delay over keys with pending pacing delay', () => {
      const keyReady = 'AIzaSyKeyReady';
      const keyDelayed = 'AIzaSyKeyDelayed';

      const scoreReady = quotaService.calculateKeyScore(keyReady, model, { pacingDelayMs: 0 }, now);
      const scoreDelayed = quotaService.calculateKeyScore(keyDelayed, model, { pacingDelayMs: 2500 }, now);

      expect(scoreReady.score).toBeGreaterThan(scoreDelayed.score);
    });

    it('applies error penalties to keys with consecutive failures', () => {
      const healthyKey = 'AIzaSyHealthyKey';
      const flawedKey = 'AIzaSyFlawedKey';

      quotaService.recordCategorizedError(flawedKey, model, {
        code: AIErrorCode.SERVER_ERROR,
        message: 'Temporary server glitch',
        isRetryable: true,
        recommendedAction: 'cooldown_key',
        httpStatus: 503,
      }, now);

      const scoreHealthy = quotaService.calculateKeyScore(healthyKey, model, {}, now);
      const scoreFlawed = quotaService.calculateKeyScore(flawedKey, model, {}, now + 4000); // after 3s cooldown

      expect(scoreHealthy.score).toBeGreaterThan(scoreFlawed.score);
    });

    it('gives bonus for keys verified to support the requested model', () => {
      const uninspectedKey = 'AIzaSyUninspectedKey';
      const verifiedKey = 'AIzaSyVerifiedKey';

      const scoreUninspected = quotaService.calculateKeyScore(uninspectedKey, model, { isModelSupported: 'uninspected' }, now);
      const scoreVerified = quotaService.calculateKeyScore(verifiedKey, model, { isModelSupported: true }, now);

      expect(scoreVerified.score).toBeGreaterThan(scoreUninspected.score);
    });

    it('simulates balanced rotation across multiple candidate keys', () => {
      const keys = ['AIzaSyKey1', 'AIzaSyKey2', 'AIzaSyKey3'];
      let simTime = Date.now();

      // Dispatch 6 sequential requests, verifying keys rotate naturally
      const selectedKeyHistory: string[] = [];

      for (let req = 0; req < 6; req++) {
        // Score all keys
        const candidates = keys.map(k => {
          const pacing = _testMaps.nextAllowedTimeByKey.get(k) || 0;
          const pacingDelayMs = Math.max(0, pacing - simTime);
          const res = quotaService.calculateKeyScore(k, model, { keyRpm: 15, pacingDelayMs }, simTime);
          return { key: k, score: res.score, isEligible: res.isEligible };
        });

        candidates.sort((a, b) => b.score - a.score);
        const chosen = candidates[0].key;
        selectedKeyHistory.push(chosen);

        // Record usage and advance pacing
        quotaService.recordUsage(chosen, model, 'success', simTime, { totalTokens: 100, promptTokens: 50, outputTokens: 50 });
        const interval = computePerKeyIntervalMs(15);
        _testMaps.nextAllowedTimeByKey.set(chosen, simTime + interval);

        simTime += 500; // Next request arrives 500ms later
      }

      // First 3 requests should pick Key1, Key2, Key3 in round-robin fashion
      expect(selectedKeyHistory.slice(0, 3)).toEqual(['AIzaSyKey1', 'AIzaSyKey2', 'AIzaSyKey3']);
    });
  });
});

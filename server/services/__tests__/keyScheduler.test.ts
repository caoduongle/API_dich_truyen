import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaService } from '../quotaService';
import { computeGroupIntervalMs, computePerKeyIntervalMs, _testMaps } from '../geminiService';
import { modelInfoService } from '../modelInfoService';
import { AIErrorCode } from '../../constants/errors';

describe('Quota-Aware QuotaGroup & Key Health Scheduler', () => {
  beforeEach(() => {
    quotaService.resetAll();
    modelInfoService.clearCache();
    _testMaps.nextAllowedTimeByKey.clear();
    _testMaps.nextAllowedTimeByGroup.clear();
    _testMaps.resetActiveRequests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Story 1: computeGroupIntervalMs & Safe Pacing Floors', () => {
    it('calculates accurate safety intervals for various configured group RPMs', () => {
      // 15 RPM -> 60000 / (15 * 0.9) = 4444.44 -> ceil = 4445ms
      expect(computeGroupIntervalMs(15)).toBe(4445);
      expect(computePerKeyIntervalMs(15)).toBe(4445);

      // 60 RPM -> 60000 / (60 * 0.9) = 1111.11 -> ceil = 1112ms
      expect(computeGroupIntervalMs(60)).toBe(1112);

      // 120 RPM -> 60000 / (120 * 0.9) = 555.55 -> ceil = 556ms
      expect(computeGroupIntervalMs(120)).toBe(556);

      // 300 RPM -> clamped to server safety floor 400ms
      expect(computeGroupIntervalMs(300)).toBe(400);
    });

    it('falls back to model tier default intervals when RPM is not explicitly provided', () => {
      expect(computeGroupIntervalMs(undefined, 'gemini-2.5-pro')).toBe(6000);
      expect(computeGroupIntervalMs(undefined, 'gemini-3.1-flash-lite')).toBe(3500);
      expect(computeGroupIntervalMs(undefined, 'gemma-4-31b-it')).toBe(2000);
      expect(computeGroupIntervalMs(undefined, 'gemini-2.5-flash')).toBe(4445);
    });

    it('maintains independent pacing clocks across different Quota Groups', () => {
      const groupAId = 'group_alpha_15';
      const groupBId = 'group_beta_60';

      const intervalA = computeGroupIntervalMs(15);
      const intervalB = computeGroupIntervalMs(60);

      const now = 1000000;
      // Simulate dispatching Group A at time `now`
      _testMaps.nextAllowedTimeByGroup.set(groupAId, now + intervalA);

      // Group A has remaining delay = 4445 - 500 = 3945ms
      const delayA = Math.max(0, (_testMaps.nextAllowedTimeByGroup.get(groupAId) || 0) - (now + 500));
      expect(delayA).toBe(3945);

      // Group B was not dispatched, remaining delay = 0ms
      const delayB = Math.max(0, (_testMaps.nextAllowedTimeByGroup.get(groupBId) || 0) - (now + 500));
      expect(delayB).toBe(0);

      // Now dispatch Group B at time `now + 500`
      _testMaps.nextAllowedTimeByGroup.set(groupBId, (now + 500) + intervalB);

      // At now + 2000ms:
      // Group B (interval 1112ms) is already ready (delay = 0)
      const delayB_after = Math.max(0, (_testMaps.nextAllowedTimeByGroup.get(groupBId) || 0) - (now + 2000));
      expect(delayB_after).toBe(0);

      // Group A (interval 4445ms) still has pending delay = 2445ms
      const delayA_after = Math.max(0, (_testMaps.nextAllowedTimeByGroup.get(groupAId) || 0) - (now + 2000));
      expect(delayA_after).toBe(2445);
    });
  });

  describe('User Story 2: Hierarchical Quota Group & Key Health Evaluation', () => {
    const model = 'gemini-2.5-flash';

    it('filters out Quota Groups with no healthy keys (AuthFailed/Disabled)', () => {
      const authFailedKey = 'AIzaSyAuthFailedKey_123';
      quotaService.registerQuotaGroup({
        id: 'group_auth_fail',
        configuredRpm: 15,
        keyIds: [authFailedKey],
      });

      quotaService.recordCategorizedError(authFailedKey, model, {
        code: AIErrorCode.AUTH_FAILED,
        message: 'Invalid API key',
        isRetryable: false,
        recommendedAction: 'disable_key',
        httpStatus: 401,
      });

      const evalResults = quotaService.evaluateQuotaGroups([authFailedKey], model);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('không có API key nào');
    });

    it('filters out Quota Groups in active cooldown (e.g. 429 quota exhaustion)', () => {
      const coolingKey = 'AIzaSyCoolingKey_456';
      const now = Date.now();
      quotaService.registerQuotaGroup({
        id: 'group_cooling',
        configuredRpm: 15,
        keyIds: [coolingKey],
      });

      quotaService.triggerGroupCooldown('group_cooling', 30000, '429 Rate Limit', now);

      const evalResults = quotaService.evaluateQuotaGroups([coolingKey], model, 2000, now);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('Cooldown');
    });

    it('filters out Quota Groups that reached sliding window minute RPM capacity', () => {
      const now = Date.now();
      const rpmCappedKey = 'AIzaSyRpmCappedKey';

      quotaService.registerQuotaGroup({
        id: 'group_rpm_capped',
        configuredRpm: 15,
        keyIds: [rpmCappedKey],
      });

      // Record 15 requests in current minute for 15 RPM group
      for (let i = 0; i < 15; i++) {
        quotaService.recordGroupUsage('group_rpm_capped', rpmCappedKey, model, 'success', now - (i * 1000), { totalTokens: 100, promptTokens: 50, outputTokens: 50 });
      }

      const evalResults = quotaService.evaluateQuotaGroups([rpmCappedKey], model, 2000, now);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('giới hạn RPM');
    });

    it('filters out Quota Groups that would exceed sliding window minute TPM capacity', () => {
      const now = Date.now();
      const tpmCappedKey = 'AIzaSyTpmCappedKey';

      quotaService.registerQuotaGroup({
        id: 'group_tpm_capped',
        configuredRpm: 60,
        configuredTpm: 1000000,
        keyIds: [tpmCappedKey],
      });

      // Record 940,000 tokens consumed in current minute (out of 1,000,000 max TPM)
      quotaService.recordGroupUsage('group_tpm_capped', tpmCappedKey, model, 'success', now - 5000, { totalTokens: 940000, promptTokens: 500000, outputTokens: 440000 });

      // Request requiring 30,000 tokens -> total 970,000 > 950,000 (95% safety ceiling)
      const evalResults = quotaService.evaluateQuotaGroups([tpmCappedKey], model, 30000, now);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('TPM');
    });

    it('filters out Quota Groups that reached daily RPD capacity', () => {
      const now = Date.now();
      const rpdCappedKey = 'AIzaSyRpdCappedKey';

      quotaService.registerQuotaGroup({
        id: 'group_rpd_capped',
        configuredRpm: 15,
        configuredRpd: 1500,
        keyIds: [rpdCappedKey],
      });

      // Set requestsToday to 1500 by recording calls earlier today (outside the 60s RPM window)
      for (let i = 0; i < 1500; i++) {
        quotaService.recordGroupUsage('group_rpd_capped', rpdCappedKey, model, 'success', now - 120000 - (i * 10), { totalTokens: 10, promptTokens: 5, outputTokens: 5 });
      }

      const evalResults = quotaService.evaluateQuotaGroups([rpdCappedKey], model, 2000, now);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('RPD');
    });
  });

  describe('User Story 3: Predictive Group Scoring & Least-Recently-Used Key Selection', () => {
    const model = 'gemini-2.5-flash';
    const now = Date.now();

    it('prioritizes least recently used keys in group for natural round-robin distribution', () => {
      const keyRecentlyUsed = 'AIzaSyKeyRecentlyUsed';
      const keyIdle = 'AIzaSyKeyIdle';

      quotaService.registerQuotaGroup({
        id: 'group_lru_test',
        configuredRpm: 15,
        keyIds: [keyRecentlyUsed, keyIdle],
      });

      // Key 1 used 5 seconds ago
      quotaService.recordGroupUsage('group_lru_test', keyRecentlyUsed, model, 'success', now - 5000, { totalTokens: 1000, promptTokens: 500, outputTokens: 500 });

      // Key 2 used 120 seconds ago
      quotaService.recordGroupUsage('group_lru_test', keyIdle, model, 'success', now - 120000, { totalTokens: 1000, promptTokens: 500, outputTokens: 500 });

      const bestKey = quotaService.selectBestKeyInGroup('group_lru_test', [keyRecentlyUsed, keyIdle], now);
      expect(bestKey).not.toBeNull();
      expect(bestKey!.key).toBe(keyIdle);
    });

    it('applies error penalties when selecting keys with consecutive failures', () => {
      const healthyKey = 'AIzaSyHealthyKey';
      const flawedKey = 'AIzaSyFlawedKey';

      quotaService.registerQuotaGroup({
        id: 'group_penalty_test',
        configuredRpm: 15,
        keyIds: [healthyKey, flawedKey],
      });

      quotaService.recordCategorizedError(flawedKey, model, {
        code: AIErrorCode.SERVER_ERROR,
        message: 'Temporary server glitch',
        isRetryable: true,
        recommendedAction: 'cooldown_key',
        httpStatus: 503,
      }, now);

      const bestKey = quotaService.selectBestKeyInGroup('group_penalty_test', [healthyKey, flawedKey], now + 4000); // after 3s cooldown
      expect(bestKey).not.toBeNull();
      expect(bestKey!.key).toBe(healthyKey);
    });

    it('simulates balanced rotation across candidate keys within a QuotaGroup', () => {
      const keys = ['AIzaSyKey1', 'AIzaSyKey2', 'AIzaSyKey3'];
      quotaService.registerQuotaGroup({
        id: 'group_rotation_sim',
        configuredRpm: 60,
        keyIds: keys,
      });

      let simTime = Date.now();
      const selectedKeyHistory: string[] = [];

      for (let req = 0; req < 6; req++) {
        const bestKey = quotaService.selectBestKeyInGroup('group_rotation_sim', keys, simTime);
        expect(bestKey).not.toBeNull();
        const chosen = bestKey!.key;
        selectedKeyHistory.push(chosen);

        quotaService.recordGroupUsage('group_rotation_sim', chosen, model, 'success', simTime, { totalTokens: 100, promptTokens: 50, outputTokens: 50 });
        simTime += 500;
      }

      // First 3 requests rotate across Key1, Key2, Key3
      expect(new Set(selectedKeyHistory.slice(0, 3)).size).toBe(3);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaService, hashApiKey } from '../quotaService';
import { AIErrorCode } from '../../constants/errors';

describe('Quota Group & Project-Based Quota Accounting (TASK 01)', () => {
  beforeEach(() => {
    quotaService.resetAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── USER STORY 1: SAME PROJECT KEYS SHARE QUOTA (P1 MVP) ──
  describe('User Story 1: Project-Level Quota Accounting & Shared Group Capacity', () => {
    it('shares sliding-window RPM consumption between Key A1 and Key A2 in the same project', () => {
      const keyA1 = 'AIzaSyProjectA_Key1_SecretA';
      const keyA2 = 'AIzaSyProjectA_Key2_SecretB';
      const now = 1000000;

      // Register Project A with 2 keys and 15 RPM
      quotaService.registerQuotaGroup({
        id: 'group_project_a',
        projectId: 'project-a',
        name: 'Project Alpha',
        configuredRpm: 15,
        keyIds: [keyA1, keyA2],
      });

      // Send 8 requests with Key A1
      for (let i = 0; i < 8; i++) {
        quotaService.recordGroupUsage('group_project_a', keyA1, 'gemini-2.5-flash', 'success', now + i * 100);
      }

      // Send 7 requests with Key A2
      for (let i = 0; i < 7; i++) {
        quotaService.recordGroupUsage('group_project_a', keyA2, 'gemini-2.5-flash', 'success', now + 1000 + i * 100);
      }

      const group = quotaService.getQuotaGroup('group_project_a')!;
      expect(group.observedUsage.requestsThisMinute).toBe(15);
      expect(group.observedUsage.requestsTotal).toBe(15);

      // Now evaluate quota groups: Project A should be recognized as rate-limited
      const evalResults = quotaService.evaluateQuotaGroups([keyA1, keyA2], 'gemini-2.5-flash', 2000, now + 2000);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('giới hạn RPM');
    });

    it('shares TPM sliding window token consumption across sibling keys in the same project', () => {
      const keyA1 = 'AIzaSyProjA_Key1';
      const keyA2 = 'AIzaSyProjA_Key2';
      const now = 1000000;

      quotaService.registerQuotaGroup({
        id: 'group_proj_tpm',
        configuredRpm: 60,
        configuredTpm: 100000, // 100k TPM limit
        keyIds: [keyA1, keyA2],
      });

      // Key A1 consumes 60k tokens
      quotaService.recordGroupUsage('group_proj_tpm', keyA1, 'gemini-2.5-flash', 'success', now, {
        promptTokens: 40000,
        outputTokens: 20000,
        totalTokens: 60000,
      });

      // Key A2 consumes 36k tokens (total = 96k > 95% of 100k)
      quotaService.recordGroupUsage('group_proj_tpm', keyA2, 'gemini-2.5-flash', 'success', now + 500, {
        promptTokens: 20000,
        outputTokens: 16000,
        totalTokens: 36000,
      });

      const group = quotaService.getQuotaGroup('group_proj_tpm')!;
      expect(group.observedUsage.tokensThisMinute).toBe(96000);

      // An additional request of 2000 tokens should be rejected due to TPM limit
      const evalResults = quotaService.evaluateQuotaGroups([keyA1, keyA2], 'gemini-2.5-flash', 2000, now + 1000);
      expect(evalResults[0].isEligible).toBe(false);
      expect(evalResults[0].rejectReason).toContain('TPM');
    });
  });

  // ── USER STORY 2: MULTI-PROJECT QUOTA ISOLATION (P2) ──
  describe('User Story 2: Multi-Project Quota Isolation & Independent Scaling', () => {
    it('ensures saturating Project Alpha does not throttle or affect Project Beta', () => {
      const keyA1 = 'AIzaSyProjectAlpha_Key1';
      const keyA2 = 'AIzaSyProjectAlpha_Key2';
      const keyB1 = 'AIzaSyProjectBeta_Key1';
      const keyB2 = 'AIzaSyProjectBeta_Key2';
      const now = 1000000;

      // Project Alpha: 15 RPM
      quotaService.registerQuotaGroup({
        id: 'group_alpha',
        projectId: 'project-alpha',
        name: 'Project Alpha',
        configuredRpm: 15,
        keyIds: [keyA1, keyA2],
      });

      // Project Beta: 60 RPM
      quotaService.registerQuotaGroup({
        id: 'group_beta',
        projectId: 'project-beta',
        name: 'Project Beta',
        configuredRpm: 60,
        keyIds: [keyB1, keyB2],
      });

      // Saturate Project Alpha with 15 requests
      for (let i = 0; i < 15; i++) {
        quotaService.recordGroupUsage('group_alpha', keyA1, 'gemini-2.5-flash', 'success', now + i * 50);
      }

      // Evaluate both groups
      const evalResults = quotaService.evaluateQuotaGroups([keyA1, keyA2, keyB1, keyB2], 'gemini-2.5-flash', 2000, now + 1000);
      
      const alphaRes = evalResults.find(r => r.group.id === 'group_alpha')!;
      const betaRes = evalResults.find(r => r.group.id === 'group_beta')!;

      expect(alphaRes.isEligible).toBe(false);
      expect(alphaRes.rejectReason).toContain('giới hạn RPM');

      expect(betaRes.isEligible).toBe(true);
      expect(betaRes.score).toBeGreaterThan(0);

      // Best key in Project Beta should be available
      const bestKeyBeta = quotaService.selectBestKeyInGroup('group_beta', [keyB1, keyB2], now + 1000);
      expect(bestKeyBeta).not.toBeNull();
      expect([keyB1, keyB2]).toContain(bestKeyBeta!.key);
    });
  });

  // ── USER STORY 3: KEY HEALTH ISOLATION & HIERARCHICAL SCHEDULING (P3) ──
  describe('User Story 3: Hierarchical Scheduler Flow & Key Health Isolation', () => {
    it('isolates 401/403 authentication failures to the specific key without disabling the group', () => {
      const keyA1 = 'AIzaSyInvalidKey_A1';
      const keyA2 = 'AIzaSyValidKey_A2';
      const now = 1000000;

      quotaService.registerQuotaGroup({
        id: 'group_auth_test',
        configuredRpm: 15,
        keyIds: [keyA1, keyA2],
      });

      // Key A1 encounters Auth Failed error
      quotaService.recordCategorizedError(keyA1, 'gemini-2.5-flash', {
        code: AIErrorCode.AUTH_FAILED,
        message: 'API_KEY_INVALID',
        isRetryable: false,
        recommendedAction: 'disable_key',
        httpStatus: 401,
      }, now);

      // Key A1 should be AuthFailed / unavailable
      const healthA1 = quotaService.getKeyHealth(keyA1, now);
      expect(healthA1.state).toBe('AuthFailed');
      expect(healthA1.isAvailable).toBe(false);

      // Key A2 should remain Healthy / available
      const healthA2 = quotaService.getKeyHealth(keyA2, now);
      expect(healthA2.state).toBe('Healthy');
      expect(healthA2.isAvailable).toBe(true);

      // Group evaluation should succeed because Key A2 is still healthy
      const evalResults = quotaService.evaluateQuotaGroups([keyA1, keyA2], 'gemini-2.5-flash', 2000, now);
      expect(evalResults[0].isEligible).toBe(true);

      // Selecting best key in group must pick Key A2, skipping Key A1
      const bestKey = quotaService.selectBestKeyInGroup('group_auth_test', [keyA1, keyA2], now);
      expect(bestKey).not.toBeNull();
      expect(bestKey!.key).toBe(keyA2);
    });

    it('isolates transient 503 key cooldown while allowing sibling key to serve requests', () => {
      const keyA1 = 'AIzaSyKeyA1_503';
      const keyA2 = 'AIzaSyKeyA2_Healthy';
      const now = 1000000;

      quotaService.registerQuotaGroup({
        id: 'group_cooldown_test',
        configuredRpm: 15,
        keyIds: [keyA1, keyA2],
      });

      // Key A1 encounters 503 Overloaded (3s cooldown)
      quotaService.recordCategorizedError(keyA1, 'gemini-2.5-flash', {
        code: AIErrorCode.OVERLOADED,
        message: 'Service Overloaded',
        isRetryable: true,
        recommendedAction: 'cooldown_key',
        httpStatus: 503,
        retryAfterSec: 3,
      }, now);

      expect(quotaService.getKeyHealth(keyA1, now).isAvailable).toBe(false);
      expect(quotaService.getKeyHealth(keyA2, now).isAvailable).toBe(true);

      const bestKey = quotaService.selectBestKeyInGroup('group_cooldown_test', [keyA1, keyA2], now);
      expect(bestKey!.key).toBe(keyA2);
    });

    it('triggers group cooldown on 429 quota exhaustion and rotates to alternate group', () => {
      const keyA = 'AIzaSyKey_GroupA';
      const keyB = 'AIzaSyKey_GroupB';
      const now = 1000000;

      quotaService.registerQuotaGroup({
        id: 'group_a_429',
        configuredRpm: 15,
        keyIds: [keyA],
      });

      quotaService.registerQuotaGroup({
        id: 'group_b_backup',
        configuredRpm: 15,
        keyIds: [keyB],
      });

      // Group A suffers 429 Rate Limited / Cooldown
      quotaService.triggerGroupCooldown('group_a_429', 5000, '429 Rate Limit', now);

      const evalResults = quotaService.evaluateQuotaGroups([keyA, keyB], 'gemini-2.5-flash', 2000, now);
      
      const groupARes = evalResults.find(r => r.group.id === 'group_a_429')!;
      const groupBRes = evalResults.find(r => r.group.id === 'group_b_backup')!;

      expect(groupARes.isEligible).toBe(false);
      expect(groupBRes.isEligible).toBe(true);
      expect(evalResults[0].group.id).toBe('group_b_backup');
    });

    it('rejects group evaluation when group reaches daily RPD quota exhaustion', () => {
      const keyA1 = 'AIzaSyKeyA1_RpdExhaust';
      const keyA2 = 'AIzaSyKeyA2_RpdExhaust';
      const now = 1000000;

      quotaService.registerQuotaGroup({
        id: 'group_rpd_exhaust',
        configuredRpm: 15,
        configuredRpd: 10, // Small limit for testing
        keyIds: [keyA1, keyA2],
      });

      // Saturate 10 requests today
      for (let i = 0; i < 10; i++) {
        quotaService.recordGroupUsage('group_rpd_exhaust', i % 2 === 0 ? keyA1 : keyA2, 'gemini-2.5-flash', 'success', now + i * 10);
      }

      const group = quotaService.getQuotaGroup('group_rpd_exhaust')!;
      expect(group.observedUsage.requestsToday).toBe(10);

      // Evaluate after the 60s sliding window so RPM is 0, but RPD is reached
      const futureEval = quotaService.evaluateQuotaGroups([keyA1, keyA2], 'gemini-2.5-flash', 2000, now + 70000);
      expect(futureEval[0].isEligible).toBe(false);
      expect(futureEval[0].rejectReason).toContain('RPD');
    });

    it('keeps group available when at least one key is healthy among multiple failed keys', () => {
      const key1 = 'AIzaSyKey_Fail1';
      const key2 = 'AIzaSyKey_Fail2';
      const key3 = 'AIzaSyKey_Healthy3';
      const now = 1000000;

      quotaService.registerQuotaGroup({
        id: 'group_3keys_test',
        configuredRpm: 15,
        keyIds: [key1, key2, key3],
      });

      // Key 1 fails auth
      quotaService.recordCategorizedError(key1, 'gemini-2.5-flash', {
        code: AIErrorCode.AUTH_FAILED,
        message: 'Invalid key',
        isRetryable: false,
        recommendedAction: 'disable_key',
        httpStatus: 401,
      }, now);

      // Key 2 is in cooldown
      quotaService.recordCategorizedError(key2, 'gemini-2.5-flash', {
        code: AIErrorCode.OVERLOADED,
        message: 'Overloaded',
        isRetryable: true,
        recommendedAction: 'cooldown_key',
        retryAfterSec: 10,
        httpStatus: 503,
      }, now);

      // Key 3 is healthy
      expect(quotaService.getKeyHealth(key1, now).isAvailable).toBe(false);
      expect(quotaService.getKeyHealth(key2, now).isAvailable).toBe(false);
      expect(quotaService.getKeyHealth(key3, now).isAvailable).toBe(true);

      const evalResults = quotaService.evaluateQuotaGroups([key1, key2, key3], 'gemini-2.5-flash', 2000, now);
      expect(evalResults[0].isEligible).toBe(true);

      const bestKey = quotaService.selectBestKeyInGroup('group_3keys_test', [key1, key2, key3], now);
      expect(bestKey).not.toBeNull();
      expect(bestKey!.key).toBe(key3);
    });
  });

  // ── TASK 02: TÁCH ProviderQuota KHỎI FALLBACK/SCHEDULING HINT ──
  describe('TASK 02: Semantic Separation of ProviderQuota and Sourced SchedulingHint', () => {
    it('provider quota unknown: initializes providerQuota as undefined when no verified metadata exists', () => {
      const key = 'AIzaSyUnverifiedKey';
      const group = quotaService.registerQuotaGroup({
        id: 'group_unknown_quota',
        keyIds: [key],
      });

      // providerQuota must strictly be undefined (never fake defaults like 15 RPM / 1M TPM / 1500 RPD)
      expect(group.providerQuota).toBeUndefined();
    });

    it('provider quota known: accurately records verified provider quota with source and timestamp', () => {
      const key = 'AIzaSyVerifiedKey';
      const now = 1000000;
      const group = quotaService.registerQuotaGroup({
        id: 'group_known_quota',
        keyIds: [key],
        providerQuota: {
          rpm: 60,
          tpm: 2000000,
          rpd: 5000,
          verifiedAt: now,
        },
      });

      expect(group.providerQuota).toBeDefined();
      expect(group.providerQuota?.rpm).toBe(60);
      expect(group.providerQuota?.tpm).toBe(2000000);
      expect(group.providerQuota?.rpd).toBe(5000);
      expect(group.providerQuota?.source).toBe('provider');
      expect(group.providerQuota?.verifiedAt).toBe(now);

      // Scheduling hint is automatically sourced from provider
      expect(group.schedulingHint.source).toBe('provider');
      expect(group.schedulingHint.effectiveIntervalMs).toBe(1112);
    });

    it('configured hint: prioritizes user custom limits over provider and fallback hints', () => {
      const key = 'AIzaSyConfiguredKey';
      const group = quotaService.registerQuotaGroup({
        id: 'group_configured_hint',
        configuredRpm: 30,
        keyIds: [key],
        providerQuota: {
          rpm: 60,
          source: 'provider',
        },
      });

      // Configured RPM (30) overrides Provider RPM (60) for pacing
      expect(group.schedulingHint.source).toBe('configured');
      expect(group.schedulingHint.isCustom).toBe(true);
      expect(group.schedulingHint.effectiveIntervalMs).toBe(2223);
      expect(group.providerQuota?.rpm).toBe(60);
    });

    it('fallback hint: derives scheduling hint from model fallback tier when quota is unverified', () => {
      const key = 'AIzaSyFallbackKey';
      const group = quotaService.registerQuotaGroup({
        id: 'group_fallback_hint',
        keyIds: [key],
      });

      expect(group.providerQuota).toBeUndefined();
      expect(group.schedulingHint.source).toBe('model-fallback');
      expect(group.schedulingHint.effectiveIntervalMs).toBe(4445); // Default Flash tier

      // Pro tier fallback
      const proHint = quotaService.deriveSchedulingHint(group.configuredLimits, group.providerQuota, 'gemini-2.5-pro');
      expect(proHint.source).toBe('model-fallback');
      expect(proHint.effectiveIntervalMs).toBe(6000);

      // Flash-Lite tier fallback
      const liteHint = quotaService.deriveSchedulingHint(group.configuredLimits, group.providerQuota, 'gemini-3.1-flash-lite');
      expect(liteHint.source).toBe('model-fallback');
      expect(liteHint.effectiveIntervalMs).toBe(3500);
    });

    it('verified quota update: dynamically updates provider quota without overwriting user configured limits', () => {
      const key = 'AIzaSyUpdateKey';
      const now = 1000000;
      const group = quotaService.registerQuotaGroup({
        id: 'group_update_quota',
        configuredRpm: 10,
        keyIds: [key],
      });

      expect(group.providerQuota).toBeUndefined();
      expect(group.configuredLimits.configuredRpm).toBe(10);
      expect(group.schedulingHint.source).toBe('configured');
      expect(group.schedulingHint.effectiveIntervalMs).toBe(6667);

      // Verify and update provider quota with 60 RPM
      const updated = quotaService.updateProviderQuota('group_update_quota', {
        rpm: 60,
        tpm: 1000000,
        rpd: 2000,
      }, now);

      expect(updated).not.toBeNull();
      expect(updated!.providerQuota?.rpm).toBe(60);
      expect(updated!.providerQuota?.source).toBe('provider');
      expect(updated!.providerQuota?.verifiedAt).toBe(now);

      // Configured limits are preserved and still take precedence in scheduling
      expect(updated!.configuredLimits.configuredRpm).toBe(10);
      expect(updated!.schedulingHint.source).toBe('configured');
      expect(updated!.schedulingHint.effectiveIntervalMs).toBe(6667);
    });
  });
});

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
  });

  // ── USER STORY 4: 4-TIER DATA CLASSIFICATION (P4) ──
  describe('User Story 4: Strict 4-Tier Quota Data Classification', () => {
    it('verifies providerQuota.isVerified defaults to false and is never conflated with configuredLimits', () => {
      const key = 'AIzaSyUserConfigKey';
      const group = quotaService.registerQuotaGroup({
        id: 'group_classification_test',
        configuredRpm: 60,
        configuredTpm: 2000000,
        configuredRpd: 5000,
        keyIds: [key],
      });

      // 1. providerQuota must remain unverified
      expect(group.providerQuota.isVerified).toBe(false);
      expect(group.providerQuota.rpm).toBe(15);

      // 2. configuredLimits must preserve user values
      expect(group.configuredLimits.configuredRpm).toBe(60);
      expect(group.configuredLimits.configuredTpm).toBe(2000000);
      expect(group.configuredLimits.configuredRpd).toBe(5000);

      // 3. schedulingHint must be derived correctly
      expect(group.schedulingHint.isCustom).toBe(true);
      expect(group.schedulingHint.effectiveIntervalMs).toBe(1112);
      expect(group.schedulingHint.safetyFloorMs).toBe(400);

      // 4. observedUsage must track runtime counts independently
      expect(group.observedUsage.requestsTotal).toBe(0);
      expect(group.observedUsage.requestsThisMinute).toBe(0);
    });
  });
});

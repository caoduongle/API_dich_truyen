import { describe, it, expect, beforeEach, vi } from 'vitest';
import { quotaService, hashApiKey, maskApiKey } from '../quotaService';
import { generateWithRotation } from '../geminiService';
import { AIErrorCode } from '../../constants/errors';
import { logAttemptTelemetry } from '../../utils/telemetryLogger';

// Mock GoogleGenAI for rotation tests
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      apiKey: string;
      constructor(options: any) {
        this.apiKey = options?.apiKey;
      }
      models = {
        generateContent: (...args: any[]) => mockGenerateContent(this.apiKey, ...args),
      };
    },
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    },
    HarmBlockThreshold: {
      BLOCK_NONE: 'BLOCK_NONE',
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY',
      BOOLEAN: 'BOOLEAN',
    },
  };
});

describe('Scheduler Observability & Explainable Telemetry (TASK 12)', () => {
  beforeEach(() => {
    quotaService.resetAll();
    mockGenerateContent.mockReset();
    vi.clearAllMocks();
  });

  // ── USER STORY 1 (P1): Request Tracing & Retries Explainability ──
  describe('User Story 1: Request Tracing & Retries Explainability', () => {
    it('preserves the same requestId across rotation retries and records attempt-level traces', async () => {
      const customRequestId = 'req_test_retry_trace_123';
      const key1 = 'AIzaSyKeyOneTest111111111111111111111';
      const key2 = 'AIzaSyKeyTwoTest222222222222222222222';

      // Key 1 fails with 429 Rate Limit; Key 2 succeeds
      mockGenerateContent.mockImplementation((key: string) => {
        if (key === key1) {
          const err: any = new Error('Resource has been exhausted (e.g. check quota)');
          err.status = 429;
          return Promise.reject(err);
        }
        return Promise.resolve({
          text: 'Bản dịch thử nghiệm thành công.',
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 30, totalTokenCount: 80 },
        });
      });

      const result = await generateWithRotation(
        [key1, key2],
        'models/gemini-2.5-flash',
        'System prompt',
        'User prompt',
        undefined,
        0.3,
        0,
        undefined,
        undefined,
        customRequestId
      );

      expect(result.text).toBe('Bản dịch thử nghiệm thành công.');
      expect(result.requestId).toBe(customRequestId);

      // Verify attempts recorded in QuotaService
      const recent = quotaService.getRecentAttempts();
      expect(recent.length).toBeGreaterThanOrEqual(2);

      const tracesForRequest = recent.filter(t => t.requestId === customRequestId);
      expect(tracesForRequest.length).toBe(2);

      // Attempt 1: Failed on Key 1
      expect(tracesForRequest[0].attempt).toBe(1);
      expect(tracesForRequest[0].status).toBe('failure');
      expect(tracesForRequest[0].errorCode).toBe(AIErrorCode.RATE_LIMITED);
      expect(tracesForRequest[0].latencyMs).toBeGreaterThanOrEqual(0);

      // Attempt 2: Succeeded on Key 2
      expect(tracesForRequest[1].attempt).toBe(2);
      expect(tracesForRequest[1].status).toBe('success');
      expect(tracesForRequest[1].errorCode).toBeNull();
      expect(tracesForRequest[1].latencyMs).toBeGreaterThanOrEqual(0);

      // Logical summary assertions
      const summary = quotaService.getLogicalSummary();
      expect(summary.logicalRequestsTotal).toBe(1);
      expect(summary.successfulRequestsTotal).toBe(1);
      expect(summary.providerAttemptsTotal).toBe(2);
      expect(summary.retriesTotal).toBe(1);
    });

    it('generates a unique requestId when none is provided and retains it across attempts', async () => {
      const key1 = 'AIzaSyKeyA111111111111111111111111111';
      mockGenerateContent.mockResolvedValueOnce({
        text: 'Thành công',
        candidates: [{ finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
      });

      const result = await generateWithRotation(
        [key1],
        'models/gemini-2.5-flash',
        'System',
        'Prompt'
      );

      expect(result.requestId).toMatch(/^req_/);
      const recent = quotaService.getRecentAttempts();
      expect(recent[0].requestId).toBe(result.requestId);
    });
  });

  // ── USER STORY 2 (P2): Key Selection & Scheduler Decisions ──
  describe('User Story 2: Key Selection & Scheduler Decision Transparency', () => {
    it('records selection counts and categorizes rejection reasons accurately', () => {
      const keyHealthy = 'AIzaSyHealthyKey1234567890123456789';
      const keyCooldown = 'AIzaSyCooldownKey1234567890123456789';
      const keyDisabled = 'AIzaSyDisabledKey1234567890123456789';

      quotaService.setKeyDisabled(keyDisabled, true, 'Vô hiệu hóa thủ công');
      quotaService.recordCategorizedError(
        keyCooldown,
        'models/gemini-2.5-flash',
        { code: AIErrorCode.OVERLOADED, httpStatus: 503, message: 'Overloaded', isRetryable: true, recommendedAction: 'cooldown_key' }
      );

      // Evaluate keys
      quotaService.recordKeySelection(3);
      quotaService.recordKeyRejection('disabled');
      quotaService.recordKeyRejection('in_cooldown');
      quotaService.recordQueueWait(450);

      const tel = quotaService.getSchedulerTelemetry();
      expect(tel.selectionCount).toBe(3);
      expect(tel.rejectedTotal).toBe(2);
      expect(tel.rejectedByReason.disabled).toBe(1);
      expect(tel.rejectedByReason.in_cooldown).toBe(1);
      expect(tel.queueWaitTotalMs).toBe(450);
      expect(tel.queueWaitAvgMs).toBe(150);
    });
  });

  // ── USER STORY 3 (P3): Per-Model & Per-Key Diagnostic Breakdown ──
  describe('User Story 3: Per-Model Latency & Per-Key Diagnostics', () => {
    it('accumulates and calculates per-model latency profiles (total, min, max, avg)', () => {
      const key = 'AIzaSyModelTestKey123456789012345678';
      const model = 'models/gemini-2.5-flash';

      quotaService.recordUsage(key, model, 'success', Date.now(), { promptTokens: 100, outputTokens: 50, totalTokens: 150 }, 1000);
      quotaService.recordUsage(key, model, 'success', Date.now(), { promptTokens: 100, outputTokens: 50, totalTokens: 150 }, 2000);
      quotaService.recordUsage(key, model, 'error', Date.now(), undefined, 3000);

      const snapshots = quotaService.getQuotaSnapshot([key]);
      const modelStats = snapshots[0].byModel[model];

      expect(modelStats.requestsTotal).toBe(3);
      expect(modelStats.errorsTotal).toBe(1);
      expect(modelStats.totalLatencyMs).toBe(6000);
      expect(modelStats.avgLatencyMs).toBe(2000);
      expect(modelStats.minLatencyMs).toBe(1000);
      expect(modelStats.maxLatencyMs).toBe(3000);
    });

    it('tracks per-key quotaEvents and cooldownEvents across errors and rate limits', () => {
      const key = 'AIzaSyKeyEventsTest123456789012345678';
      const model = 'models/gemini-2.5-flash';

      // 429 Rate limited -> 1 quota event, 1 cooldown event
      quotaService.recordCategorizedError(
        key,
        model,
        { code: AIErrorCode.RATE_LIMITED, httpStatus: 429, message: 'Rate limit hit', isRetryable: true, recommendedAction: 'rotate_key' }
      );

      // 503 Overload -> 1 cooldown event
      quotaService.recordCategorizedError(
        key,
        model,
        { code: AIErrorCode.OVERLOADED, httpStatus: 503, message: '503 Overload', isRetryable: true, recommendedAction: 'cooldown_key' }
      );

      const snapshots = quotaService.getQuotaSnapshot([key]);
      expect(snapshots[0].quotaEventsTotal).toBe(1);
      expect(snapshots[0].cooldownEventsTotal).toBe(2);
    });
  });

  // ── USER STORY 4 (P4): Zero-Leakage Sensitive Data Redaction ──
  describe('User Story 4: Strict Sensitive Data Redaction', () => {
    it('masks raw API keys in telemetry attempt logs and snapshots', () => {
      const rawKey = 'AIzaSySecretApiKeyToMask1234567890ABCD';
      const masked = maskApiKey(rawKey);

      expect(masked).not.toBe(rawKey);
      expect(masked).toBe('AIzaSy...ABCD');
      expect(masked.includes('SecretApiKeyToMask')).toBe(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logAttemptTelemetry({
        requestId: 'req_redact_01',
        modelId: 'models/gemini-2.5-flash',
        keyIdentifier: rawKey,
        keyIndex: 0,
        attempt: 1,
        status: 'success',
        errorCode: null,
        latencyMs: 850,
        queueWaitMs: 0,
        timestamp: Date.now(),
      });

      // Assert that the raw key was NOT printed to console
      for (const call of consoleSpy.mock.calls) {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(rawKey);
      }

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});

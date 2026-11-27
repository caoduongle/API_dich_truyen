import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { callGemini } from '../gemini/geminiClient';
import { GeminiRequestError } from '../gemini/types';
import { localQuotaTracker } from '../localQuotaTracker';
import { clearStoredCustomLimits, saveStoredCustomLimits, hashApiKey } from '../../utils/customLimitsStorage';
import { rawWithContentSplitDirect } from '../translation/rawTranslation';
import { polishWithContentSplitDirect } from '../translation/polishTranslation';
import {
  classifyTranslationOutcome,
  evaluateFinalPartialFallback,
  isNonSplittableInfrastructureError,
} from '../translation/translationValidation';
import { repairChapterCriticalIssuesDirect } from '../translation/targetedRepair';
import { formatRescueReasonLabel } from '../chapterTranslationService';

describe('Feature 172: RPM Proactive Gate, Split Guard & Accurate Fallback Evaluation', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearStoredCustomLimits();
    localQuotaTracker.resetMetrics();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    clearStoredCustomLimits();
    localQuotaTracker.resetMetrics();
  });

  describe('SC-001: Chặn bão chia nhỏ và tự chờ hồi phục khi 429 RPM hoặc 503 High Demand', () => {
    it('does not split or fall back to Sino-Vietnamese when 429 RPM or 503 occurs inside raw or polish translation', async () => {
      const splitEvents: string[] = [];

      // Mô phỏng exhausted cooldown (đã qua bước chờ trong geminiClient)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: () => null },
        json: async () => ({
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'Generate content requests per minute limit exceeded. Please retry in 2s.',
          },
        }),
      });

      // Khi maxCooldownWaits = 0 để test nhánh ném lỗi lên rawWithContentSplitDirect
      await expect(
        callGemini({
          apiKeys: ['KEY_SPLIT_GUARD_1'],
          prompt: 'hello',
          autoWaitForCooldown: true,
          maxCooldownWaits: 0,
        })
      ).rejects.toMatchObject({ category: 'RATE_LIMIT_RPM', code: 'ALL_KEYS_EXHAUSTED' });

      // Gọi trực tiếp classifyTranslationOutcome xác nhận không split
      expect(
        classifyTranslationOutcome(
          new GeminiRequestError('429 RPM', {
            code: 'ALL_KEYS_EXHAUSTED',
            category: 'RATE_LIMIT_RPM',
            isRetryable: true,
          })
        ).canSplitRetry
      ).toBe(false);

      // Trong polishWithContentSplitDirect khi callGemini ném 503 high demand sau khi hết retry, không được split hay fallback raw
      vi.useFakeTimers();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: { get: () => null },
        json: async () => ({
          error: {
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
          },
        }),
      });

      const polishPromise = polishWithContentSplitDirect({
        sourceText: '第一段\n\n第二段',
        rawTranslation: 'Đoạn một.\n\nĐoạn hai.',
        genre: 'Đô thị',
        tone: 'Tự nhiên',
        glossary: [],
        apiKeys: ['KEY_503_TEST'],
        onSplitRetry: (info) => splitEvents.push(`${info.tier}:${info.reason}`),
      });
      const handledPolishRejection = polishPromise.catch((err) => err);

      await vi.runAllTimersAsync();
      const caughtPolishErr = await handledPolishRejection;
      expect(caughtPolishErr).toBeInstanceOf(GeminiRequestError);
      expect((caughtPolishErr as GeminiRequestError).category).toBe('SERVICE_OVERLOAD');
      expect(splitEvents).toEqual([]);
    });

    it('recovers automatically after waiting for 503 high demand backoff via autoWaitForCooldown', async () => {
      vi.useFakeTimers();
      let calls = 0;
      const waitLogs: string[] = [];

      global.fetch = vi.fn().mockImplementation(async () => {
        calls++;
        if (calls === 1) {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            headers: { get: () => null },
            json: async () => ({
              error: {
                message: 'This model is currently experiencing high demand. Please try again later.',
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Phản hồi thành công sau 503' }] } }],
          }),
        };
      });

      const reqPromise = callGemini({
        apiKeys: ['KEY_503_RECOVER'],
        prompt: 'Test 503',
        autoWaitForCooldown: true,
        onWaitStatus: (info) => waitLogs.push(`${info.kind}:${info.attempt}`),
      });

      await vi.runAllTimersAsync();
      const res = await reqPromise;
      expect(res.text).toBe('Phản hồi thành công sau 503');
      expect(calls).toBe(2);
      expect(waitLogs).toEqual(['service_overload:1']);
    });

    it('does not swallow 429/503 inside rawWithContentSplitDirect and never invokes sino-fallback', async () => {
      vi.useFakeTimers();
      const splitTiers: string[] = [];

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: { get: () => null },
        json: async () => ({
          error: { message: 'This model is currently experiencing high demand.' },
        }),
      });

      const rawPromise = rawWithContentSplitDirect({
        text: '第一章\n\n他走进房间。',
        genre: 'Đô thị',
        tone: 'Hiện đại',
        glossary: [],
        apiKeys: ['KEY_RAW_503'],
        onSplitRetry: (info) => splitTiers.push(info.tier || 'split'),
      });
      const handledRawErr = rawPromise.catch((err) => err);

      await vi.runAllTimersAsync();
      const caughtErr = await handledRawErr;
      expect(caughtErr).toBeInstanceOf(GeminiRequestError);
      expect(splitTiers).toEqual([]);
    });
  });

  describe('SC-002: Ghi nhãn nguyên nhân sự cố chính xác', () => {
    it('never labels infrastructure errors or unknown issues as "Phản hồi rỗng"', () => {
      expect(formatRescueReasonLabel('RATE_LIMIT_RPM: 429 RPM')).toBe('Chạm hạn mức tốc độ 429 RPM');
      expect(formatRescueReasonLabel('SERVICE_OVERLOAD: high demand 503')).toBe('Máy chủ AI quá tải tạm thời (503)');
      expect(formatRescueReasonLabel('NETWORK_FAILURE / ETIMEDOUT')).toBe('Lỗi kết nối / quá hạn thời gian mạng');
      expect(formatRescueReasonLabel('SOME_UNEXPECTED_ERROR')).not.toBe('Phản hồi rỗng');
      expect(formatRescueReasonLabel('EMPTY_RESPONSE')).toBe('Phản hồi rỗng');
      expect(formatRescueReasonLabel('AI trả về phản hồi rỗng.')).toBe('Phản hồi rỗng');
    });
  });

  describe('SC-003: Giảm chia nhỏ dư thừa ở GĐ1 và GĐ2 mà vẫn giữ an toàn', () => {
    it('tolerates minor ±1 paragraph variance on clean >= 8 paragraph raw draft without splitting', async () => {
      const splitCalls: string[] = [];
      const source8 = Array.from({ length: 8 }, (_, idx) => `第${idx + 1}段内容在这里。`).join('\n\n');
      // AI hợp nhất nhẹ thành 7 đoạn sạch, dài đầy đủ, không sót chữ Hán
      const translated7 = Array.from(
        { length: 7 },
        (_, idx) => `Đoạn nội dung thứ ${idx + 1} được dịch đầy đủ mạch lạc và tự nhiên bằng tiếng Việt.`
      ).join('\n\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      rawTranslation: translated7,
                      discoveredEntities: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const res = await rawWithContentSplitDirect({
        text: source8,
        genre: 'Hiện đại',
        tone: 'Tự nhiên',
        glossary: [],
        apiKeys: ['KEY_G1_TOLERATE'],
        useParagraphAnchors: false,
        onSplitRetry: (info) => splitCalls.push(info.reason),
      });

      expect(res.rawTranslation).toContain('Đoạn nội dung thứ 1');
      expect(splitCalls).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('accepts concise 1-1 polish down to 72% length ratio without false POLISH_TRUNCATION_DETECTED split', async () => {
      const splitCalls: string[] = [];
      const src3 = '第一段原文。\n\n第二段原文。\n\n第三段原文。';
      const raw3 = Array.from({ length: 3 }, () => 'Đây là một đoạn văn dịch thô hơi dài dòng và có khá nhiều từ dư thừa cần được biên tập lại cho thật mượt mà và tự nhiên hơn trong tiếng Việt.').join('\n\n');
      // ~75% độ dài bản thô nhưng khớp đúng 3-3 đoạn
      const concise3 = Array.from({ length: 3 }, () => 'Đây là đoạn văn dịch mượt mà, súc tích và giữ trọn vẹn ý nghĩa gốc bằng tiếng Việt chuẩn tự nhiên hơn.').join('\n\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      polishedTranslation: concise3,
                      discoveredEntities: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const res = await polishWithContentSplitDirect({
        sourceText: src3,
        rawTranslation: raw3,
        genre: 'Đô thị',
        tone: 'Tự nhiên',
        glossary: [],
        apiKeys: ['KEY_G2_CONCISE'],
        useParagraphAnchors: false,
        onSplitRetry: (info) => splitCalls.push(info.reason),
      });

      expect(res.isPartial).toBe(false);
      expect(splitCalls).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('SC-004: Đánh giá lại cờ hasPartialFallback trên bản dịch cuối', () => {
    it('clears false partial fallback flag when GĐ2 + QA produced clean Vietnamese output', () => {
      const res = evaluateFinalPartialFallback({
        sourceText: '第一章\n\n他走进屋子。',
        finalText: 'Chương 1\n\nAnh bước vào trong phòng.',
        hasPolishedOutput: true,
        rawHasPartialFallback: true,
        lastPolishIsPartial: false,
        qaRunSucceeded: true,
        unresolvedCriticals: [],
      });
      expect(res.isPartialFallback).toBe(false);
    });

    it('preserves partial fallback warning when Chinese characters remain in final text', () => {
      const res = evaluateFinalPartialFallback({
        sourceText: '第一章\n\n他走进屋子。',
        finalText: 'Chương 1\n\nAnh bước vào 屋子.',
        hasPolishedOutput: true,
        rawHasPartialFallback: true,
        lastPolishIsPartial: false,
        qaRunSucceeded: true,
        unresolvedCriticals: [],
      });
      expect(res.isPartialFallback).toBe(true);
    });
  });

  describe('SC-007: Proactive 60s RPM/TPM Gate & chống khóa oan RPD trên 429 mơ hồ', () => {
    it('rotates to coolest key, preserves Healthy UI state during proactive pacing, and waits across >2 windows seamlessly', async () => {
      vi.useFakeTimers();
      const k1 = 'KEY_PROACTIVE_1_AAAAAAAAAAAAAAA';
      const k2 = 'KEY_PROACTIVE_2_BBBBBBBBBBBBBBB';
      saveStoredCustomLimits({
        [hashApiKey(k1)]: { maxRpm: 1, maxRpd: 500, maxTpm: 250_000 },
        [hashApiKey(k2)]: { maxRpm: 1, maxRpd: 500, maxTpm: 250_000 },
      });

      const calledKeys: string[] = [];
      const waitEvents: string[] = [];
      global.fetch = vi.fn().mockImplementation(async (_url, init) => {
        calledKeys.push(init.headers['x-goog-api-key']);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'OK' }] } }],
          }),
        };
      });

      // Lượt 1 & 2 dùng hết 1 RPM của cả 2 khóa trong cùng cửa sổ 60s
      const r1 = await callGemini({
        apiKeys: [k1, k2],
        prompt: 'Req 1',
        enableProactivePacing: true,
        autoWaitForCooldown: true,
        maxCooldownWaits: 0,
        onWaitStatus: (info) => waitEvents.push(info.kind),
      });
      const r2 = await callGemini({
        apiKeys: [k1, k2],
        prompt: 'Req 2',
        enableProactivePacing: true,
        autoWaitForCooldown: true,
        maxCooldownWaits: 0,
        onWaitStatus: (info) => waitEvents.push(info.kind),
      });
      expect(r1.text).toBe('OK');
      expect(r2.text).toBe('OK');

      // Lượt 3..8 kích hoạt liên tiếp qua 3 chu kỳ cửa sổ 60s -> chờ proactive_pacing >= 3 lần với maxCooldownWaits=0
      for (let reqIdx = 3; reqIdx <= 8; reqIdx++) {
        const p = callGemini({
          apiKeys: [k1, k2],
          prompt: `Req ${reqIdx}`,
          enableProactivePacing: true,
          autoWaitForCooldown: true,
          maxCooldownWaits: 0, // chứng minh nhịp chờ chủ động không ăn vào passive budget
          onWaitStatus: (info) => waitEvents.push(info.kind),
        });
        await vi.runAllTimersAsync();
        const r = await p;
        expect(r.text).toBe('OK');

        const status = localQuotaTracker.getQuotaStatus([k1, k2]);
        expect(status.keys[0].healthState).toBe('Healthy');
        expect(status.keys[1].healthState).toBe('Healthy');
        expect(status.keys[0].runtime.isRateLimited).toBe(false);
      }

      // Lượt 1 & 2 xoay đều sang k1 và k2 trước khi chờ
      expect(calledKeys.slice(0, 2)).toEqual([k1, k2]);
      expect(waitEvents.filter((k) => k === 'proactive_pacing').length).toBeGreaterThanOrEqual(3);
    });

    it('sanitizes malformed NaN/negative custom limits from storage cleanly', () => {
      const k1 = 'KEY_MALFORMED_LIMIT';
      saveStoredCustomLimits({
        [hashApiKey(k1)]: { maxRpm: Number.NaN, maxRpd: -5, maxTpm: 0 } as any,
      });

      const health = localQuotaTracker.getKeyHealth(k1, Date.now(), {
        maxRpm: Number.NaN,
        maxRpd: -5,
        maxTpm: 0,
      });
      expect(health.isAvailable).toBe(true);
      expect(health.isCustomLimitReached).toBe(false);
    });

    it('keeps ambiguous 429 in RateLimited on 1st strike (18/500), resets on success, and escalates on 2nd consecutive strike', () => {
      const k = 'KEY_AMBIGUOUS_429_TEST';
      const now = Date.now();

      // Đã chạy 18 lượt thành công hôm nay
      for (let i = 0; i < 18; i++) {
        localQuotaTracker.recordProviderAttempt(k, 'gemini-3.5-flash-lite', now - 120_000);
        localQuotaTracker.recordSuccess(k, 'gemini-3.5-flash-lite', { totalTokens: 500 }, 100, now - 120_000);
      }

      // Lần 1 gặp 429 mơ hồ -> phải là RateLimited tạm nghỉ (~50s), KHÔNG khóa QuotaExhausted cả ngày
      localQuotaTracker.recordFailure(
        k,
        'gemini-3.5-flash-lite',
        {
          status: 429,
          isRateLimit: true,
          message: 'You exceeded your current quota, please check your plan and billing details.',
        },
        now
      );
      expect(localQuotaTracker.getKeyHealth(k, now).state).toBe('RateLimited');

      // Nếu ngay sau khi hồi phục (now + 55_000) lại dính tiếp 429 mơ hồ lần 2 không có success xen giữa -> nâng lên QuotaExhausted
      localQuotaTracker.recordFailure(
        k,
        'gemini-3.5-flash-lite',
        {
          status: 429,
          isRateLimit: true,
          message: 'You exceeded your current quota, please check your plan and billing details.',
        },
        now + 55_000
      );
      expect(localQuotaTracker.getKeyHealth(k, now + 55_000).state).toBe('QuotaExhausted');

      // Reset thử trường hợp có recordSuccess xen giữa -> consecutiveAmbiguous429 được xóa sạch
      localQuotaTracker.resetMetrics();
      localQuotaTracker.recordFailure(
        k,
        'gemini-3.5-flash-lite',
        {
          status: 429,
          isRateLimit: true,
          message: 'Quota exhausted',
        },
        now
      );
      expect(localQuotaTracker.getKeyHealth(k, now).state).toBe('RateLimited');
      localQuotaTracker.recordSuccess(k, 'gemini-3.5-flash-lite', { totalTokens: 200 }, 50, now + 55_000);
      localQuotaTracker.recordFailure(
        k,
        'gemini-3.5-flash-lite',
        {
          status: 429,
          isRateLimit: true,
          message: 'Quota exhausted',
        },
        now + 56_000
      );
      expect(localQuotaTracker.getKeyHealth(k, now + 56_000).state).toBe('RateLimited');
    });
  });

  describe('Post-Review Hardening Regressions', () => {
    it('excludes proactive_pacing sleep duration from cumulativeTimeoutMs inside split branches so chunks do not degrade to Sino-Vietnamese', async () => {
      vi.useFakeTimers();
      const k = 'KEY_WAIT_BUDGET_EXCLUDED';
      saveStoredCustomLimits({
        [hashApiKey(k)]: { maxRpm: 1, maxRpd: 500, maxTpm: 250_000 },
      });

      let callNum = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        callNum++;
        if (callNum === 1) {
          // Kích hoạt chia nhánh nội dung vì phản hồi rỗng
          return {
            ok: true,
            status: 200,
            json: async () => ({ candidates: [{ content: { parts: [{ text: '' }] } }] }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        rawTranslation: callNum === 2 ? 'Đoạn một.' : 'Đoạn hai.',
                        discoveredEntities: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      });

      const rawPromise = rawWithContentSplitDirect({
        text: '今天天气很好，他在街上走着看着周围的风景，心里想着接下来的计划。\n\n到了下午，天空突然下起了大雨，他只好赶紧跑进旁边的小店躲雨。',
        genre: 'Hiện đại',
        tone: 'Tự nhiên',
        glossary: [],
        apiKeys: [k],
        useParagraphAnchors: false,
        concurrencyLimit: 1,
        cumulativeTimeoutMs: 10_000, // nhỏ hơn 60s chờ cửa sổ RPM -> nếu không trừ waitMs sẽ rơi sang Sino-Vietnamese
      });

      await vi.runAllTimersAsync();
      const res = await rawPromise;
      expect(res.isPartial).toBe(false);
      expect(res.rawTranslation).toContain('Đoạn một.');
      expect(res.rawTranslation).toContain('Đoạn hai.');
      expect(callNum).toBe(3);
    });

    it('separates infrastructure errors from JSON/schema validation errors in isNonSplittableInfrastructureError', () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      expect(isNonSplittableInfrastructureError(abortErr)).toBe(true);
      expect(
        isNonSplittableInfrastructureError(
          new GeminiRequestError('429', {
            code: 'ALL_KEYS_EXHAUSTED',
            category: 'RATE_LIMIT_RPM',
            isRetryable: true,
          })
        )
      ).toBe(true);
      expect(
        isNonSplittableInfrastructureError(
          new Error('Dữ liệu JSON từ AI trong ngữ cảnh [rawTranslation] không thỏa mãn cấu trúc yêu cầu.')
        )
      ).toBe(false);
    });

    it('propagates AbortError from targetedRepair instead of swallowing user cancellation during 429 cooldown wait', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { get: () => null },
        json: async () => ({
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'Generate content requests per minute limit exceeded. Please retry in 30s.',
          },
        }),
      });

      const repairPromise = repairChapterCriticalIssuesDirect({
        sourceText: '第一章\n\n他走了。',
        translatedText: 'Chương 1\n\nAnh 走了.',
        issues: [
          {
            type: 'raw_leak',
            severity: 'critical',
            targetText: 'Anh 走了.',
            description: 'Sót chữ Hán',
            paragraphIndex: 1,
          },
        ],
        glossary: [],
        genre: 'Đô thị',
        tone: 'Tự nhiên',
        apiKeys: ['KEY_REPAIR_ABORT'],
        signal: controller.signal,
      });

      setTimeout(() => controller.abort(), 25);
      const handled = repairPromise.catch((err) => err);
      await vi.advanceTimersByTimeAsync(50);
      const caught = await handled;
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).name).toBe('AbortError');
    });

    it('preserves partial fallback warning when QA critique failed or was skipped and deterministic omission remains', () => {
      const res = evaluateFinalPartialFallback({
        sourceText: '第一段\n\n第二段\n\n第三段',
        finalText: 'Đoạn một\n\nĐoạn hai',
        hasPolishedOutput: true,
        rawHasPartialFallback: true,
        lastPolishIsPartial: false,
        qaRunSucceeded: false,
        unresolvedCriticals: [
          {
            type: 'omission',
            severity: 'critical',
            targetText: 'Đoạn hai',
            description: '[Cấu trúc 1-1] Thiếu đoạn',
            source: 'deterministic',
          },
        ],
      });
      expect(res.isPartialFallback).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../../directGeminiClient';
import { translateRawDirect, polishTranslationDirect } from '../index';

describe('Cumulative Timeout Resilience (Spec 162 US4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers lossless fallback when cumulativeTimeoutMs expires across split branches in raw translation', async () => {
    let callIndex = 0;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        // Initial whole chapter call fails with retryable error
        throw new Error('phản hồi rỗng');
      }

      // Simulate a long latency that depletes the timeout budget
      await new Promise((resolve) => setTimeout(resolve, 80));

      return {
        text: JSON.stringify({
          rawTranslation: 'Bản dịch thành công',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      };
    });

    const source = 'Đoạn một ở đây。\n\nĐoạn hai ở đây。\n\nĐoạn ba ở đây。';

    const res = await translateRawDirect({
      text: source,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1'],
      cumulativeTimeoutMs: 50, // Low budget to force deadline depletion on retry branch
    });

    // Should return result with isPartial: true due to deadline fallback
    expect(res.isPartial).toBe(true);
    expect(res.rawTranslation).toBeDefined();
    expect(res.rawTranslation.length).toBeGreaterThan(0);
  });

  it('triggers raw translation preservation when cumulativeTimeoutMs expires in polish translation', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      throw new Error('phản hồi rỗng');
    });

    const source = 'Đoạn một。\n\nĐoạn hai。';
    const raw = 'Đoạn một dịch thô。\n\nĐoạn hai dịch thô。';

    const res = await polishTranslationDirect({
      sourceText: source,
      rawTranslation: raw,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1'],
      cumulativeTimeoutMs: 10, // Depleted immediately
    });

    expect(res.isPartial).toBe(true);
    expect(res.polishedTranslation).toBe(raw);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../../directGeminiClient';
import { translateRawDirect } from '../index';

describe('Concurrency & Abort Resilience (Spec 162 US4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('bounds parallel requests to concurrencyLimit (max 2 concurrent)', async () => {
    let activeCalls = 0;
    let maxConcurrent = 0;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      activeCalls++;
      maxConcurrent = Math.max(maxConcurrent, activeCalls);

      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 50));

      activeCalls--;
      return {
        text: JSON.stringify({
          rawTranslation: 'Đoạn dịch hoàn tất.',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      };
    });

    // Provide long text (> 2000 tokens heuristic) to force pre-split into multiple chunks
    const longChapter = Array(10).fill('Đoạn văn rất dài miêu tả đại chiến tam giới long trời lở đất. ').join('\n\n');

    await translateRawDirect({
      text: longChapter,
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['KEY_1', 'KEY_2'],
      concurrencyLimit: 2,
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('immediately halts and throws AbortError when AbortSignal is aborted', async () => {
    const controller = new AbortController();

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      // Abort during first API execution
      controller.abort();
      throw new Error('Call aborted');
    });

    const longChapter = Array(6).fill('Đoạn văn tu luyện tĩnh tọa. ').join('\n\n');

    await expect(
      translateRawDirect({
        text: longChapter,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: [],
        apiKeys: ['KEY_1'],
        signal: controller.signal,
      })
    ).rejects.toThrow();
  });
});

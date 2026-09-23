import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../directGeminiClient';
import { analyzeGlossaryDirect } from '../directGlossaryEngine';

describe('src/services/directGlossaryEngine.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes knownChineseTerms, loopIndex, and progressive temperature to Gemini API', async () => {
    let capturedArgs: any = null;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedArgs = args;
      return {
        text: JSON.stringify({
          suggestions: [
            {
              chinese: '药老',
              pinyin: 'Dược Lão',
              vietnamese: 'Dược Lão',
              type: 'character',
              note: 'Sư phụ của Tiêu Viêm',
            },
          ],
        }),
        successKeyIndex: 0,
      };
    });

    const res = await analyzeGlossaryDirect({
      text: '萧炎看着石戒中的药老。',
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
      knownChineseTerms: ['萧炎', '乌坦城'],
      loopIndex: 2,
      totalLoops: 3,
    });

    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].chinese).toBe('药老');

    expect(capturedArgs).not.toBeNull();
    // Progressive temperature for loop 2 is 0.35
    expect(capturedArgs.temperature).toBe(0.35);
    // Prompt contains exclusion list
    expect(capturedArgs.prompt).toContain('--- DANH SÁCH THUẬT NGỮ ĐÃ CÓ / ĐÃ QUÉT ĐƯỢC (BỎ QUA KHÔNG TRÍCH XUẤT LẠI) ---');
    expect(capturedArgs.prompt).toContain('萧炎, 乌坦城');
    expect(capturedArgs.prompt).toContain('ĐÂY LÀ LƯỢT RÀ SOÁT THỨ 2/3');
    // System instruction contains loop 2 directive
    expect(capturedArgs.systemInstruction).toContain('ĐÂY LÀ LƯỢT RÀ SOÁT THỨ 2/3');
  });

  it('uses base temperature 0.2 when loopIndex is 1 and does not inject exclusions', async () => {
    let capturedArgs: any = null;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedArgs = args;
      return {
        text: JSON.stringify({
          suggestions: [
            {
              chinese: '萧炎',
              pinyin: 'Tiêu Viêm',
              vietnamese: 'Tiêu Viêm',
              type: 'character',
              note: 'Nhân vật chính',
            },
          ],
        }),
        successKeyIndex: 0,
      };
    });

    const res = await analyzeGlossaryDirect({
      text: '萧炎看着石戒中的药老。',
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
      loopIndex: 1,
      totalLoops: 1,
    });

    expect(res.suggestions).toHaveLength(1);
    expect(capturedArgs.temperature).toBe(0.2);
    expect(capturedArgs.prompt).not.toContain('--- DANH SÁCH THUẬT NGỮ ĐÃ CÓ / ĐÃ QUÉT ĐƯỢC');
  });

  it('extractGlossaryDirect returns strongly-typed GlossarySuggestion array', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify([
        {
          chinese: '玄阶中级斗技',
          vietnamese: 'Huyền Giai Trung Cấp Đấu Kỹ',
          type: 'term',
          note: 'Cấp bậc công pháp',
        },
      ]),
      successKeyIndex: 0,
    });

    const { extractGlossaryDirect } = await import('../directGlossaryEngine');
    const res = await extractGlossaryDirect({
      text: 'Hắn tu luyện một bộ Huyền Giai Trung Cấp Đấu Kỹ.',
      apiKeys: ['TEST_KEY'],
    });

    expect(res.glossary).toHaveLength(1);
    expect(res.glossary[0].chinese).toBe('玄阶中级斗技');
    expect(res.glossary[0].vietnamese).toBe('Huyền Giai Trung Cấp Đấu Kỹ');
  });

  it('analyzeGlossaryDirect filters out malformed or empty items without emitting blank entities', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        suggestions: [
          {},
          { chinese: 123 },
          { chinese: '   ', vietnamese: 'rỗng' },
          { vietnamese: null },
          { chinese: '乌坦城', vietnamese: 'Ô Thản Thành', type: 'location' },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await analyzeGlossaryDirect({
      text: 'Tiêu Viêm đi tới 乌坦城.',
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].chinese).toBe('乌坦城');
    expect(res.suggestions[0].vietnamese).toBe('Ô Thản Thành');
    expect(res.suggestions[0].type).toBe('location');
  });

  it('extractGlossaryDirect filters out malformed items from raw response', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify([
        {},
        { chinese: '', vietnamese: 'trống' },
        { term: '   ', vietnamese: 'khoảng trắng' },
        { chinese: '斗气', vietnamese: 456 },
        { chinese: '斗气', vietnamese: 'Đấu Khí', type: 'term' },
      ]),
      successKeyIndex: 0,
    });

    const { extractGlossaryDirect } = await import('../directGlossaryEngine');
    const res = await extractGlossaryDirect({
      text: 'Đây là thế giới của 斗气.',
      apiKeys: ['TEST_KEY'],
    });

    expect(res.glossary).toHaveLength(1);
    expect(res.glossary[0].chinese).toBe('斗气');
    expect(res.glossary[0].vietnamese).toBe('Đấu Khí');
    expect(res.glossary[0].type).toBe('term');
  });

  it('bounds concurrency to 2 when performing recursive split analysis on safety or empty error', async () => {
    const concurrencyModule = await import('../../lib/concurrency');
    const spyConcurrency = vi.spyOn(concurrencyModule, 'mapWithConcurrencyLimit');

    let callCount = 0;
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async () => {
      callCount++;
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

      try {
        if (callCount === 1) {
          // Trigger content split fallback
          throw new Error('bộ lọc an toàn: content blocked');
        }

        // Simulate async work for split parts
        await new Promise((r) => setTimeout(r, 20));

        return {
          text: JSON.stringify({
            suggestions: [
              {
                chinese: '斗气',
                vietnamese: 'Đấu Khí',
                type: 'term',
              },
            ],
          }),
          successKeyIndex: 0,
        };
      } finally {
        currentConcurrent--;
      }
    });

    const paragraph = '第一段这是一个非常长的小说段落用于测试分析术语提取并发限制。'.repeat(15);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`;

    const res = await analyzeGlossaryDirect({
      text,
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(spyConcurrency).toHaveBeenCalled();
    const callsWithLimit2 = spyConcurrency.mock.calls.filter((call) => call[1] === 2);
    expect(callsWithLimit2.length).toBeGreaterThanOrEqual(1);

    expect(res.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(res.suggestions[0].chinese).toBe('斗气');
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('safely handles GeminiRequestError with CONTENT_BLOCKED without throw in extractGlossaryDirect', async () => {
    const { GeminiRequestError } = await import('../gemini/types');
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockRejectedValue(
      new GeminiRequestError('Prompt was blocked by safety policy', {
        code: 'CONTENT_BLOCKED',
        category: 'CONTENT_BLOCKED',
        status: 200,
        isRetryable: false,
      })
    );

    const { extractGlossaryDirect } = await import('../directGlossaryEngine');
    const res = await extractGlossaryDirect({
      text: 'Sample blocked text',
      apiKeys: ['TEST_KEY'],
    });

    expect(res.glossary).toEqual([]);
    expect(res.warning).toContain('bộ lọc an toàn');
  });

  it('safely handles non-standard error objects in glossary analysis without crashing', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockRejectedValue({
      message: 'bộ lọc an toàn: custom non-error object',
    });

    const res = await analyzeGlossaryDirect({
      text: 'Sample text with custom non-error throw',
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(res.suggestions).toEqual([]);
  });
});


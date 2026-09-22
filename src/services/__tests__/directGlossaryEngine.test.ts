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
});


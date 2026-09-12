import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as directGeminiClient from '../directGeminiClient';
import {
  translateRawDirect,
  polishTranslationDirect,
  qaCritiqueDirect,
  rewriteSentenceDirect,
} from '../directTranslationEngine';

describe('src/services/directTranslationEngine.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('executes translateRawDirect and returns structured translation and discovered entities', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        rawTranslation: 'Chương 1: Khởi Đầu\n\nSở Phong nhìn bầu trời.',
        discoveredEntities: [
          {
            chinese: '楚风',
            pinyin: 'Sở Phong',
            vietnamese: 'Sở Phong',
            type: 'character',
            note: 'Nhân vật chính',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await translateRawDirect({
      text: '第一章 初始\n\n楚风看着天空。',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    expect(res.rawTranslation).toContain('Chương 1: Khởi Đầu');
    expect(res.rawTranslation).toContain('Sở Phong nhìn bầu trời');
    expect(res.discoveredEntities).toHaveLength(1);
    expect(res.discoveredEntities[0].chinese).toBe('楚风');
    expect(res.successKeyIndex).toBe(0);
  });

  it('executes polishTranslationDirect and preserves chapter title', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        polishedTranslation: 'Sở Phong ngước mắt nhìn lên vòm trời bao la.',
      }),
      successKeyIndex: 0,
    });

    const res = await polishTranslationDirect({
      sourceText: '第一章 初始\n\n楚风看着天空。',
      rawTranslation: 'Chương 1: Khởi Đầu\n\nSở Phong nhìn bầu trời.',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    expect(res.polishedTranslation.startsWith('Chương 1: Khởi Đầu')).toBe(true);
    expect(res.polishedTranslation).toContain('Sở Phong ngước mắt');
  });

  it('executes polishTranslationDirect with roundIndex = 2 and uses dynamic temperature and round 2 prompt', async () => {
    let capturedArgs: any = null;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedArgs = args;
      return {
        text: JSON.stringify({
          polishedTranslation: 'Sở Phong nhìn lên bầu trời bao la vô tận.',
        }),
        successKeyIndex: 0,
      };
    });

    const res = await polishTranslationDirect({
      sourceText: '第一章 初始\n\n楚风看着天空。',
      rawTranslation: 'Chương 1: Khởi Đầu\n\nSở Phong ngước mắt nhìn lên vòm trời bao la.',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [],
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
      roundIndex: 2,
      totalRounds: 3,
    });

    expect(res.polishedTranslation).toContain('Sở Phong nhìn lên bầu trời');
    expect(capturedArgs).not.toBeNull();
    // Round 2 uses temperature 0.50
    expect(capturedArgs.temperature).toBe(0.5);
    // Prompt contains round 1 translation label
    expect(capturedArgs.prompt).toContain('[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 1]');
    // System instruction contains round 2 directive
    expect(capturedArgs.systemInstruction).toContain('ĐÂY LÀ LƯỢT CHUỐT VĂN THỨ 2/3');
  });

  it('executes qaCritiqueDirect and returns validation report', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: false,
        issues: [
          {
            type: 'omission',
            severity: 'critical',
            targetText: '',
            description: 'Thiếu đoạn văn kết chương',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await qaCritiqueDirect({
      sourceText: '原文',
      translatedText: 'Bản dịch',
      apiKeys: ['AQ_TEST_KEY'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    expect(res.isValid).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].type).toBe('omission');
    expect(res.issues[0].targetText).toBe('');
  });

  it('executes rewriteSentenceDirect and sends targeted prompt with only targetText and context', async () => {
    let capturedCallArgs: any = null;
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedCallArgs = args;
      return {
        text: JSON.stringify({
          rewrittenSentence: 'Hắn cất bước đi về phía trước một cách thong thả.',
        }),
        successKeyIndex: 1,
      };
    });

    const target = 'Hắn đi về phía trước.';
    const context = 'Mặt trời lặn sau rặng núi.';
    const issueMessage = 'Câu văn hơi cứng, cần mềm mại hơn.';

    const res = await rewriteSentenceDirect({
      targetText: target,
      context,
      issueMessage,
      apiKeys: ['KEY_1', 'KEY_2'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 1,
    });

    expect(res.rewrittenSentence).toBe('Hắn cất bước đi về phía trước một cách thong thả.');
    expect(res.successKeyIndex).toBe(1);

    // Verify targeted prompt payload: contains targetText, context, issueMessage
    expect(capturedCallArgs).not.toBeNull();
    expect(capturedCallArgs.prompt).toContain(target);
    expect(capturedCallArgs.prompt).toContain(context);
    expect(capturedCallArgs.prompt).toContain(issueMessage);
    // Does NOT contain whole chapter content or unrelated prompt builders
    expect(capturedCallArgs.prompt).not.toContain('Chương 1');
    expect(capturedCallArgs.prompt).not.toContain('Bản dịch thô');
    expect(capturedCallArgs.temperature).toBe(0.4);
    expect(capturedCallArgs.startKeyIndex).toBe(1);
  });

  it('throws an error when rewriteSentenceDirect receives an empty response', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({ rewrittenSentence: '   ' }),
      successKeyIndex: 0,
    });

    await expect(
      rewriteSentenceDirect({
        targetText: 'Một câu ngắn.',
        apiKeys: ['KEY_1'],
      })
    ).rejects.toThrow('AI không trả về câu viết lại hợp lệ.');
  });
});

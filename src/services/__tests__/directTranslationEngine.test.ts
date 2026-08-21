import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as directGeminiClient from '../directGeminiClient';
import {
  translateRawDirect,
  polishTranslationDirect,
  qaCritiqueDirect,
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

  it('executes qaCritiqueDirect and returns validation report', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: false,
        issues: [
          {
            type: 'omission',
            severity: 'critical',
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
  });
});

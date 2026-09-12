import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSingleChapterTranslation, isDraftTruncated } from '../chapterTranslationService';
import * as db from '../db';
import * as directEngine from '../directTranslationEngine';

describe('src/services/chapterTranslationService.ts personal key enforcement', () => {
  const mockChapter = {
    id: 'chap_1',
    title: 'Chương 1',
    sourceText: '第一章 文本\n\n中文内容。',
    rawTranslation: '',
    polishedTranslation: '',
    paragraphs: [],
    translatedLines: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'getChapterFromDB').mockResolvedValue(mockChapter as any);
    vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);
  });

  it('routes to direct translation engine when personal API keys are provided', async () => {
    const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
      rawTranslation: 'Chương 1: Tiêu đề\n\nNội dung thô.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });
    const directPolishSpy = vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
      polishedTranslation: 'Chương 1: Tiêu đề\n\nNội dung chuốt mượt mà.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });

    const res = await executeSingleChapterTranslation({
      chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
      glossarySnapshot: [],
      signal: new AbortController().signal,
      logPrefix: '[Test]',
      startKeyIndex: 0,
      projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
      apiKeys: ['AQ_USER_KEY_123'],
      selectedModel: 'gemini-2.5-flash',
      polishCycles: 1,
      autoTranslateMode: 'resume',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      enableAiQaCritique: false,
      enableSegmentTranslation: false,
      addLog: () => {},
    });

    expect(res.success).toBe(true);
    expect(directRawSpy).toHaveBeenCalled();
    expect(directPolishSpy).toHaveBeenCalled();
    expect(res.updatedChapter?.polishedTranslation).toContain('Nội dung chuốt mượt mà');
  });

  it('immediately throws error and rejects when no personal API keys are provided', async () => {
    const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect');
    const directPolishSpy = vi.spyOn(directEngine, 'polishTranslationDirect');

    await expect(
      executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: [], // Empty keys
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'resume',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: false,
        enableSegmentTranslation: false,
        addLog: () => {},
      })
    ).rejects.toThrow(/Chưa cấu hình API Key cá nhân/i);

    expect(directRawSpy).not.toHaveBeenCalled();
    expect(directPolishSpy).not.toHaveBeenCalled();
  });

  it('detects convergence and terminates polishing early when text similarity is >= 96%', async () => {
    vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
      rawTranslation: 'Chương 1: Tiêu đề\n\nNội dung dịch thô ban đầu.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });

    const calls: number[] = [];
    const logs: string[] = [];

    // Round 1 and Round 2 return identical or near-identical text
    vi.spyOn(directEngine, 'polishTranslationDirect').mockImplementation(async (params) => {
      calls.push(params.roundIndex || 1);
      if (params.roundIndex === 1) {
        return {
          polishedTranslation: 'Chương 1: Tiêu đề\n\nSở Phong ngước mắt nhìn lên bầu trời bao la vô tận.',
          successKeyIndex: 0,
        };
      }
      // Round 2 returns identical text -> 100% similarity >= 96%
      return {
        polishedTranslation: 'Chương 1: Tiêu đề\n\nSở Phong ngước mắt nhìn lên bầu trời bao la vô tận.',
        successKeyIndex: 0,
      };
    });

    const res = await executeSingleChapterTranslation({
      chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
      glossarySnapshot: [],
      signal: new AbortController().signal,
      logPrefix: '[Test]',
      startKeyIndex: 0,
      projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
      apiKeys: ['AQ_USER_KEY_123'],
      selectedModel: 'gemini-2.5-flash',
      polishCycles: 4, // Requests 4 rounds
      autoTranslateMode: 'resume',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      enableAiQaCritique: false,
      enableSegmentTranslation: false,
      addLog: (msg) => logs.push(msg),
    });

    expect(res.success).toBe(true);
    // Should stop at round 2 because of convergence, NOT run round 3 or 4
    expect(calls).toEqual([1, 2]);
    expect(logs.some((l) => l.includes('[Hội tụ]'))).toBe(true);
  });

  it('preserves prior round polish result when round 3 throws empty response error and finishes successfully', async () => {
    vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
      rawTranslation: 'Chương 1: Tiêu đề\n\nNội dung dịch thô ban đầu.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });

    const calls: number[] = [];
    const logs: string[] = [];

    vi.spyOn(directEngine, 'polishTranslationDirect').mockImplementation(async (params) => {
      calls.push(params.roundIndex || 1);
      if (params.roundIndex === 1) {
        return {
          polishedTranslation: 'Chương 1: Tiêu đề\n\nBản chuốt Lượt 1: Cấu trúc câu chuẩn xác.',
          successKeyIndex: 0,
        };
      }
      if (params.roundIndex === 2) {
        return {
          polishedTranslation: 'Chương 1: Tiêu đề\n\nBản chuốt Lượt 2: Nhịp điệu câu văn thuần Việt mượt mà.',
          successKeyIndex: 0,
        };
      }
      // Round 3 throws empty response error
      throw new Error('AI trả về phản hồi rỗng.');
    });

    const res = await executeSingleChapterTranslation({
      chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
      glossarySnapshot: [],
      signal: new AbortController().signal,
      logPrefix: '[Test]',
      startKeyIndex: 0,
      projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
      apiKeys: ['AQ_USER_KEY_123'],
      selectedModel: 'gemini-3.5-flash-lite',
      polishCycles: 3,
      autoTranslateMode: 'resume',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      enableAiQaCritique: false,
      enableSegmentTranslation: false,
      addLog: (msg) => logs.push(msg),
    });

    expect(res.success).toBe(true);
    expect(calls).toEqual([1, 2, 3]);
    // Verifies Round 2 result was preserved!
    expect(res.updatedChapter?.polishedTranslation).toContain('Bản chuốt Lượt 2: Nhịp điệu câu văn thuần Việt mượt mà.');
    expect(logs.some((l) => l.includes('[Cứu nguy] Vòng biên tập thứ 3'))).toBe(true);
  });

  it('falls back to firstDraft when round 1 throws empty response error and finishes successfully', async () => {
    vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
      rawTranslation: 'Chương 1: Tiêu đề\n\nBản dịch thô Phase 1 hoàn chỉnh.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });

    const logs: string[] = [];
    vi.spyOn(directEngine, 'polishTranslationDirect').mockRejectedValue(
      new Error('AI trả về phản hồi rỗng.')
    );

    const res = await executeSingleChapterTranslation({
      chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
      glossarySnapshot: [],
      signal: new AbortController().signal,
      logPrefix: '[Test]',
      startKeyIndex: 0,
      projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
      apiKeys: ['AQ_USER_KEY_123'],
      selectedModel: 'gemini-3.5-flash-lite',
      polishCycles: 1,
      autoTranslateMode: 'resume',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      enableAiQaCritique: false,
      enableSegmentTranslation: false,
      addLog: (msg) => logs.push(msg),
    });

    expect(res.success).toBe(true);
    expect(res.updatedChapter?.polishedTranslation).toContain('Bản dịch thô Phase 1 hoàn chỉnh.');
    expect(logs.some((l) => l.includes('[Cứu nguy] Vòng biên tập thứ 1'))).toBe(true);
  });

  describe('isDraftTruncated integrity guard', () => {
    it('returns true if draft is empty', () => {
      expect(isDraftTruncated('', 'Một đoạn tiếng Trung dài hơn một trăm năm mươi ký tự...'.repeat(5))).toBe(true);
      expect(isDraftTruncated('   ', 'Một đoạn tiếng Trung dài hơn một trăm năm mươi ký tự...'.repeat(5))).toBe(true);
    });

    it('returns false for short source texts (<= 150 chars)', () => {
      expect(isDraftTruncated('Đoạn dịch ngắn.', '短文本。')).toBe(false);
    });

    it('returns true if draft character length is less than 35% of source text', () => {
      const source = '这是一段非常长的中文源文本。'.repeat(20); // ~280 chars
      const truncatedDraft = 'Bản dịch bị cụt.'; // 16 chars
      expect(isDraftTruncated(truncatedDraft, source)).toBe(true);
    });

    it('returns true if source has >= 3 paragraphs but draft only has 1 paragraph and < 50% length', () => {
      const source = '段落一 内容很多。\n\n段落二 内容也很多。\n\n段落三 还有很多内容。'.repeat(5);
      const singleParagraphDraft = 'Chỉ có đúng một đoạn văn duy nhất ở đây.';
      expect(isDraftTruncated(singleParagraphDraft, source)).toBe(true);
    });

    it('returns false when draft is complete and proportional', () => {
      const source = '第一段。\n\n第二段。\n\n第三段。'.repeat(5);
      const completeDraft = 'Đoạn thứ nhất rất đầy đủ và chi tiết.\n\nĐoạn thứ hai cũng rất đầy đủ.\n\nĐoạn thứ ba hoàn chỉnh.'.repeat(5);
      expect(isDraftTruncated(completeDraft, source)).toBe(false);
    });
  });

  describe('autoTranslateMode: from_scratch and repolish behaviors', () => {
    it('unconditionally executes Phase 1 in from_scratch mode even when chapter already has existing drafts', async () => {
      const existingChapter = {
        ...mockChapter,
        rawTranslation: 'Bản dịch thô cũ.',
        polishedTranslation: 'Bản chuốt cũ.',
      };
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue(existingChapter as any);

      const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Chương 1: Tiêu đề\n\nBản dịch thô MỚI HOÀN TOÀN.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });
      vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Chương 1: Tiêu đề\n\nBản chuốt MỚI.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'from_scratch',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: false,
        enableSegmentTranslation: false,
        addLog: () => {},
      });

      expect(res.success).toBe(true);
      expect(directRawSpy).toHaveBeenCalled();
      expect(res.updatedChapter?.rawTranslation).toContain('Bản dịch thô MỚI HOÀN TOÀN');
      expect(res.updatedChapter?.polishedTranslation).toContain('Bản chuốt MỚI');
    });

    it('reuses existing valid rawTranslation and preserves it in repolish mode', async () => {
      const longSource = '第一段 中文很多很多。\n\n第二段 中文很多很多。\n\n第三段 还有很多中文。'.repeat(10);
      const longRaw = 'Đoạn 1 dịch thô đầy đủ.\n\nĐoạn 2 dịch thô đầy đủ.\n\nĐoạn 3 dịch thô đầy đủ.'.repeat(10);

      const existingChapter = {
        ...mockChapter,
        sourceText: longSource,
        rawTranslation: longRaw,
        polishedTranslation: 'Bản chuốt cũ cần làm mới.',
      };
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue(existingChapter as any);

      const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect');
      const directPolishSpy = vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Bản chuốt phong cách mới mượt mà.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'repolish',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: false,
        enableSegmentTranslation: false,
        addLog: () => {},
      });

      expect(res.success).toBe(true);
      expect(directRawSpy).not.toHaveBeenCalled(); // Phase 1 was skipped safely!
      expect(directPolishSpy).toHaveBeenCalledWith(expect.objectContaining({
        rawTranslation: longRaw, // Strictly used rawTranslation, NOT polishedTranslation!
      }));
      // Original rawTranslation was preserved byte-for-byte!
      expect(res.updatedChapter?.rawTranslation).toBe(longRaw);
      expect(res.updatedChapter?.polishedTranslation).toContain('Bản chuốt phong cách mới mượt mà');
    });

    it('falls back to Phase 1 in repolish mode if existing rawTranslation is truncated', async () => {
      const longSource = '第一段 中文很多很多。\n\n第二段 中文很多很多。\n\n第三段 还有很多中文。'.repeat(10);
      const truncatedRaw = 'Đoạn cụt'; // 8 chars vs hundreds of Chinese characters

      const existingChapter = {
        ...mockChapter,
        sourceText: longSource,
        rawTranslation: truncatedRaw,
        polishedTranslation: 'Bản chuốt cụt',
      };
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue(existingChapter as any);

      const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Bản dịch thô mới đầy đủ sau khi phát hiện bản cũ bị cụt.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });
      vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Bản chuốt mới đầy đủ.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const logs: string[] = [];
      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'repolish',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: false,
        enableSegmentTranslation: false,
        addLog: (msg) => logs.push(msg),
      });

      expect(res.success).toBe(true);
      expect(directRawSpy).toHaveBeenCalled(); // Triggered fresh raw translation!
      expect(logs.some((l) => l.includes('[Cảnh báo toàn vẹn]'))).toBe(true);
      expect(res.updatedChapter?.rawTranslation).toContain('Bản dịch thô mới đầy đủ');
    });
  });
});

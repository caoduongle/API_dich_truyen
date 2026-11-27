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

    it('successfully recovers and completes chapter translation when GĐ1/GĐ2 triggers onSplitRetry for UNTRANSLATED_CHINESE_LEFTOVER', async () => {
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue(mockChapter as any);

      const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect').mockImplementation(async (params) => {
        params.onSplitRetry?.({
          stage: 'raw',
          depth: 0,
          partsCount: 2,
          reason: 'UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường',
        });
        return {
          rawTranslation: 'Bản dịch thô đã cứu nguy thành công qua chia nhỏ thích ứng.',
          discoveredEntities: [],
          successKeyIndex: 0,
        };
      });

      const directPolishSpy = vi.spyOn(directEngine, 'polishTranslationDirect').mockImplementation(async (params) => {
        params.onSplitRetry?.({
          stage: 'polish',
          depth: 0,
          partsCount: 2,
          reason: 'UNTRANSLATED_CHINESE_LEFTOVER: Bản chuốt chứa tỉ lệ chữ Hán bất thường',
        });
        return {
          polishedTranslation: 'Bản chuốt đã cứu nguy thành công qua chia nhỏ thích ứng.',
          discoveredEntities: [],
          successKeyIndex: 0,
        };
      });

      const logs: string[] = [];
      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test-Recover]',
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
        addLog: (msg) => logs.push(msg),
      });

      expect(res.success).toBe(true);
      expect(directRawSpy).toHaveBeenCalled();
      expect(directPolishSpy).toHaveBeenCalled();
      expect(logs.some((l) => l.includes('[Cứu nguy GĐ1]') && l.includes('Bản dịch sót nhiều chữ Hán'))).toBe(true);
      expect(logs.some((l) => l.includes('[Cứu nguy GĐ2 Lượt 1]') && l.includes('Bản chuốt văn sót nhiều chữ Hán'))).toBe(true);
      expect(res.updatedChapter?.status).toBe('completed');
      expect(res.updatedChapter?.rawTranslation).toContain('đã cứu nguy thành công');
      expect(res.updatedChapter?.polishedTranslation).toContain('đã cứu nguy thành công');
    });

    it('US3: outputs tier-specific diagnostic logs for line-by-line and sino-fallback tiers', async () => {
      const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect').mockImplementation(async (params) => {
        // Trigger split event
        params.onSplitRetry?.({
          stage: 'raw',
          depth: 0,
          partsCount: 2,
          reason: 'UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường',
          tier: 'split',
        });
        // Trigger line-by-line event
        params.onSplitRetry?.({
          stage: 'raw',
          depth: 2,
          partsCount: 1,
          reason: 'UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường',
          tier: 'line-by-line',
        });
        // Trigger sino-fallback event
        params.onSplitRetry?.({
          stage: 'raw',
          depth: 2,
          partsCount: 1,
          reason: 'SINO_FALLBACK_RESCUE',
          tier: 'sino-fallback',
        });
        return {
          rawTranslation: 'Bản dịch thô đã cứu nguy thành công qua đa tầng.',
          discoveredEntities: [],
          successKeyIndex: 0,
        };
      });

      vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Bản chuốt mượt mà.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const logs: string[] = [];
      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test-Tiers]',
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
        addLog: (msg) => logs.push(msg),
      });

      expect(res.success).toBe(true);
      expect(directRawSpy).toHaveBeenCalled();
      expect(logs.some((l) => l.includes('[Cứu nguy GĐ1]') && l.includes('phân đoạn thích ứng cấp 1'))).toBe(true);
      expect(logs.some((l) => l.includes('[Cứu nguy GĐ1 - Dịch từng dòng]') && l.includes('dịch phân rã từng dòng'))).toBe(true);
      expect(logs.some((l) => l.includes('[Cứu nguy GĐ1 - Phiên âm dự phòng]') && l.includes('phiên âm Hán-Việt & từ điển dự phòng'))).toBe(true);
    });

    it('preserves code === "ALL_KEYS_EXHAUSTED" when raw translation throws quota exhaustion', async () => {
      const quotaErr = new Error('Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED).');
      (quotaErr as any).code = 'ALL_KEYS_EXHAUSTED';
      vi.spyOn(directEngine, 'translateRawDirect').mockRejectedValue(quotaErr);

      await expect(
        executeSingleChapterTranslation({
          chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
          glossarySnapshot: [],
          signal: new AbortController().signal,
          logPrefix: '[Test-Quota]',
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
        })
      ).rejects.toMatchObject({
        code: 'ALL_KEYS_EXHAUSTED',
        isOverload: true,
      });
    });

    it('preserves code === "ALL_KEYS_EXHAUSTED" when polish phase throws quota exhaustion', async () => {
      vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Bản dịch thô thành công.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const quotaErr = new Error('Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED).');
      (quotaErr as any).code = 'ALL_KEYS_EXHAUSTED';
      vi.spyOn(directEngine, 'polishTranslationDirect').mockRejectedValue(quotaErr);

      await expect(
        executeSingleChapterTranslation({
          chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
          glossarySnapshot: [],
          signal: new AbortController().signal,
          logPrefix: '[Test-Polish-Quota]',
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
        })
      ).rejects.toMatchObject({
        code: 'ALL_KEYS_EXHAUSTED',
        isOverload: true,
      });
    });
  });

  describe('Phase 3 AI QA Critique integration', () => {
    it('executes qaCritiqueDirect and attaches strongly-typed DirectQaCritiqueIssue[] to updated chapter', async () => {
      vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Chương 1: Tiêu đề\n\nBản dịch thô.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });
      vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Chương 1: Tiêu đề\n\nBản dịch chuốt.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const mockIssues = [
        {
          type: 'omission' as const,
          severity: 'warning' as const,
          targetText: 'đoạn bị thiếu',
          description: 'Bỏ sót một câu trong đoạn 2',
        },
      ];

      const qaCritiqueSpy = vi.spyOn(directEngine, 'qaCritiqueDirect').mockResolvedValue({
        isValid: false,
        issues: mockIssues,
        successKeyIndex: 0,
      });

      const logs: string[] = [];
      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [{ id: 'g1', chinese: '萧炎', vietnamese: 'Tiêu Viêm', type: 'character' } as any],
        signal: new AbortController().signal,
        logPrefix: '[Test-QA]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'from_scratch',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: true,
        enableSegmentTranslation: false,
        addLog: (msg) => logs.push(msg),
      });

      expect(res.success).toBe(true);
      expect(qaCritiqueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          glossary: expect.arrayContaining([
            expect.objectContaining({ chinese: '萧炎', vietnamese: 'Tiêu Viêm' }),
          ]),
        })
      );
      expect(res.updatedChapter?.qaIssues).toEqual(mockIssues);
      expect(logs.some((l) => l.includes('[OMISSION]') && l.includes('Bỏ sót một câu'))).toBe(true);
    });

    it('clears stale QA issues on a chapter when a new QA run succeeds with zero issues (User Story 4)', async () => {
      const priorIssues = [
        {
          type: 'omission' as const,
          severity: 'warning' as const,
          targetText: 'câu cũ',
          description: 'Lỗi cũ từ lần dịch trước',
        },
      ];

      // Mock chapter having prior issues in DB
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue({
        ...mockChapter,
        qaIssues: priorIssues,
      } as any);

      vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Chương 1: Tiêu đề\n\nNội dung thô.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });
      vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Chương 1: Tiêu đề\n\nNội dung chuốt hoàn hảo.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      // QA returns clean pass with 0 issues
      vi.spyOn(directEngine, 'qaCritiqueDirect').mockResolvedValue({
        isValid: true,
        issues: [],
        successKeyIndex: 0,
      });

      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test-QA-Clean]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'from_scratch',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: true,
        enableSegmentTranslation: false,
        addLog: () => {},
      });

      expect(res.success).toBe(true);
      // All prior issues must be erased!
      expect(res.updatedChapter?.qaIssues).toEqual([]);
    });

    it('preserves prior QA issues when QA critique execution fails with an error (User Story 4)', async () => {
      const priorIssues = [
        {
          type: 'terminology' as const,
          severity: 'error' as const,
          targetText: 'thuật ngữ',
          description: 'Thuật ngữ không khớp',
        },
      ];

      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue({
        ...mockChapter,
        qaIssues: priorIssues,
      } as any);

      vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Chương 1: Tiêu đề\n\nNội dung thô.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });
      vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
        polishedTranslation: 'Chương 1: Tiêu đề\n\nNội dung chuốt.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      // QA throws network exception
      vi.spyOn(directEngine, 'qaCritiqueDirect').mockRejectedValue(new Error('Network error during QA'));

      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [],
        signal: new AbortController().signal,
        logPrefix: '[Test-QA-Fail]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 1,
        autoTranslateMode: 'from_scratch',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: true,
        enableSegmentTranslation: false,
        addLog: () => {},
      });

      expect(res.success).toBe(true);
      // Prior issues must be preserved because QA failed
      expect(res.updatedChapter?.qaIssues).toEqual(priorIssues);
    });
  });

  describe('Polish Round Fidelity Gate integration (Spec 163 US3)', () => {
    it('reverts to previousRoundText and stops early when polish round 2 introduces an ungrounded proper noun', async () => {
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue({
        ...mockChapter,
        sourceText: '第一章 初始\n\n楚风站在山门前。',
      } as any);

      vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: 'Chương 1: Khởi đầu\n\nSở Phong đứng trước cổng núi.',
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const roundsCalled: number[] = [];
      vi.spyOn(directEngine, 'polishTranslationDirect').mockImplementation(async (params) => {
        roundsCalled.push(params.roundIndex || 1);
        if (params.roundIndex === 1) {
          return {
            polishedTranslation: 'Chương 1: Khởi đầu\n\nSở Phong lặng lẽ đứng trước cổng núi cao vút.',
            successKeyIndex: 0,
          };
        }
        return {
          polishedTranslation:
            'Chương 1: Khởi đầu\n\nSở Phong đứng trước cổng núi của Huyết Sát Thần Điện gặp Lý Vô Song.',
          successKeyIndex: 0,
        };
      });

      const logs: string[] = [];
      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [
          {
            id: 'g1',
            chinese: '楚风',
            pinyin: 'Sở Phong',
            vietnamese: 'Sở Phong',
            type: 'character',
            note: '',
            origin: 'manual',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        signal: new AbortController().signal,
        logPrefix: '[Test-Fidelity]',
        startKeyIndex: 0,
        projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 3,
        autoTranslateMode: 'from_scratch',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: false,
        enableSegmentTranslation: false,
        addLog: (msg) => logs.push(msg),
      });

      expect(res.success).toBe(true);
      expect(roundsCalled).toEqual([1, 2]);
      expect(res.updatedChapter?.polishedTranslation).toBe(
        'Chương 1: Khởi đầu\n\nSở Phong lặng lẽ đứng trước cổng núi cao vút.'
      );
      expect(logs.some((l) => l.includes('Hậu kiểm GĐ2 Lượt 2'))).toBe(true);
    });
  });

  describe('Feature 171: Selective Paragraph Merge, GĐ1→GĐ2 Handoff & Post-QA Critical Count', () => {
    it('merges valid polished paragraphs selectively on multi-paragraph chapters, hands off GĐ1 compliance issues, and counts unresolved criticals', async () => {
      const srcParas = [
        '第一章 天马',
        '千江月推开大门。',
        '钱仓一站在窗边。',
        '“快点进来！”千江月喊道。',
        '大厅里十分安静。',
        '桌子上放着一台老旧相机。',
        '众人互相看了一眼。',
      ];
      vi.spyOn(db, 'getChapterFromDB').mockResolvedValue({
        ...mockChapter,
        sourceText: srcParas.join('\n\n'),
      } as any);

      vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
        rawTranslation: [
          'Chương 1: Thiên Mã',
          'Thiên Giang dừng bước trước cửa.', // thiếu Thiên Giang Nguyệt -> GĐ1 compliance bắt được
          'Tiền Thương Nhất đứng bên cửa sổ.',
          '"Mau vào đi!" Thiên Giang Nguyệt gọi.',
          'Đại sảnh rất yên tĩnh.',
          'Trên bàn đặt một chiếc máy ảnh cũ kỹ.',
          'Mọi người nhìn nhau một cái.',
        ].join('\n\n'),
        discoveredEntities: [],
        successKeyIndex: 0,
      });

      const roundsSeen: number[] = [];
      let round1Compliance: any[] = [];
      vi.spyOn(directEngine, 'polishTranslationDirect').mockImplementation(async (params) => {
        roundsSeen.push(params.roundIndex || 1);
        if (params.roundIndex === 1) {
          round1Compliance = params.complianceIssuesToFix || [];
          return {
            polishedTranslation: [
              'Chương 1: Thiên Mã',
              'Thiên Giang Nguyệt khẽ đẩy cửa bước vào.', // Đã sửa đúng theo bàn giao!
              'Tiền Thương Nhất đứng lặng bên khung cửa sổ.',
              '"Mau vào đi!" Thiên Giang Nguyệt cất tiếng gọi.',
              'Trong đại sảnh tĩnh lặng như tờ.',
              'Trên mặt bàn phủ bụi đặt một chiếc máy ảnh cũ kỹ.',
              'Mọi người khẽ liếc nhìn nhau đầy cảnh giác.',
            ].join('\n\n'),
            successKeyIndex: 0,
          };
        }
        // Lượt 2 làm mượt đoạn 5,6,7 nhưng vô tình làm mất ngoặc thoại đoạn 4 -> chỉ hoàn tác riêng đoạn 4!
        return {
          polishedTranslation: [
            'Chương 1: Thiên Mã',
            'Thiên Giang Nguyệt khẽ đẩy cửa bước vào.',
            'Tiền Thương Nhất đứng lặng bên khung cửa sổ.',
            'Mau vào đi! Thiên Giang Nguyệt cất tiếng gọi.', // mất ngoặc thoại ở đoạn 4
            'Không gian trong đại sảnh tĩnh mịch đến rợn người.',
            'Trên mặt bàn phủ lớp bụi dày đặt một chiếc máy ảnh cũ kỹ.',
            'Ánh mắt mọi người giao nhau thoáng chút đề phòng.',
          ].join('\n\n'),
          successKeyIndex: 0,
        };
      });

      vi.spyOn(directEngine, 'qaCritiqueDirect').mockResolvedValue({
        isValid: true,
        issues: [],
        successKeyIndex: 0,
      });

      const logs: string[] = [];
      const res = await executeSingleChapterTranslation({
        chapterMeta: { id: 'chap_1', title: 'Chương 1', order: 1 } as any,
        glossarySnapshot: [
          {
            id: 'g1',
            chinese: '千江月',
            pinyin: 'Thiên Giang Nguyệt',
            vietnamese: 'Thiên Giang Nguyệt',
            type: 'character',
            note: 'Nữ',
            origin: 'manual',
            createdAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 'g2',
            chinese: '钱仓一',
            pinyin: 'Tiền Thương Nhất',
            vietnamese: 'Tiền Thương Nhất',
            type: 'character',
            note: 'Nam',
            origin: 'manual',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        signal: new AbortController().signal,
        logPrefix: '[F171]',
        startKeyIndex: 0,
        projState: { genre: 'Kinh Dị', tone: 'U ám', description: '' },
        apiKeys: ['AQ_USER_KEY_123'],
        selectedModel: 'gemini-2.5-flash',
        polishCycles: 2,
        autoTranslateMode: 'from_scratch',
        additionalInstructions: '',
        isExtractionDuringTranslationEnabled: false,
        enableAiQaCritique: true,
        enableSegmentTranslation: false,
        addLog: (msg) => logs.push(msg),
      });

      expect(round1Compliance.some((iss) => iss.expectedTerm?.chinese === '千江月')).toBe(true);
      expect(roundsSeen).toEqual([1, 2]);
      expect(res.success).toBe(true);
      expect(res.unresolvedCriticalCount).toBe(0);
      // Đoạn 4 được giữ nguyên ngoặc thoại từ lượt 1, trong khi đoạn 5-7 vẫn nhận văn phong lượt 2
      expect(res.updatedChapter?.polishedTranslation).toContain('"Mau vào đi!" Thiên Giang Nguyệt cất tiếng gọi.');
      expect(res.updatedChapter?.polishedTranslation).toContain('Không gian trong đại sảnh tĩnh mịch đến rợn người.');
      expect(logs.some((l) => l.includes('Hợp nhất cấp đoạn'))).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSingleChapterTranslation } from '../chapterTranslationService';
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
});

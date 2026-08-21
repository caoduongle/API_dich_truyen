import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSingleChapterTranslation } from '../chapterTranslationService';
import * as db from '../db';
import * as apiClient from '../../utils/apiClient';
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
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch');

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
    expect(apiFetchSpy).not.toHaveBeenCalled();
    expect(res.updatedChapter?.polishedTranslation).toContain('Nội dung chuốt mượt mà');
  });

  it('immediately throws error and rejects when no personal API keys are provided', async () => {
    const directRawSpy = vi.spyOn(directEngine, 'translateRawDirect');
    const directPolishSpy = vi.spyOn(directEngine, 'polishTranslationDirect');
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch');

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
    expect(apiFetchSpy).not.toHaveBeenCalled();
  });
});

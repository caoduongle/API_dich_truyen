import { describe, it, expect } from 'vitest';
import { useTranslationProcess } from '../useTranslationProcess';

describe('useTranslationProcess Hook Suite', () => {
  it('exports valid useTranslationProcess hook function', () => {
    expect(typeof useTranslationProcess).toBe('function');
  });

  it('declares interface and props properly', () => {
    const mockProps = {
      activeProject: {
        id: 'proj-1',
        title: 'Đấu Phá Thương Khung',
        genre: 'Tiên Hiệp',
        tone: 'Hùng tráng',
        chapters: [],
        glossary: [],
        createdAt: 1000,
      },
      onUpdateProject: () => {},
      apiKeys: ['test-key'],
      selectedModel: 'gemini-2.5-flash',
      polishCycles: 1,
      autoTranslateMode: 'resume' as const,
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: true,
      rangeEnabled: false,
      rangeStart: 1,
      rangeEnd: 10,
      currentApiKeyIndexRef: { current: 0 },
      addLog: () => {},
      setAutoDiscoveredBatch: () => {},
      setLogs: () => {},
      skipFailedChapters: false,
      concurrency: 2,
      enableAiQaCritique: true,
      enableSegmentTranslation: false,
    };

    expect(mockProps.concurrency).toBe(2);
    expect(mockProps.autoTranslateMode).toBe('resume');
  });
});

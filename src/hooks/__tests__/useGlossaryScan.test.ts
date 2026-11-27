// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGlossaryScan } from '../useGlossaryScan';
import { StoryProject, Chapter } from '../../types';
import { GeminiRequestError } from '../../services/gemini/types';

const mockAnalyzeGlossaryDirect = vi.fn();
const mockGetChaptersByProjectFromDB = vi.fn();
const mockShowToast = vi.fn();
const mockInspectKeyPoolCooldown = vi.fn();

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({ showToast: mockShowToast }),
}));

vi.mock('../../services/db', () => ({
  getChaptersByProjectFromDB: (...args: any[]) => mockGetChaptersByProjectFromDB(...args),
}));

vi.mock('../../services/directGlossaryEngine', () => ({
  analyzeGlossaryDirect: (...args: any[]) => mockAnalyzeGlossaryDirect(...args),
}));

vi.mock('../../services/gemini/geminiKeyScheduler', () => ({
  inspectKeyPoolCooldown: (...args: any[]) => mockInspectKeyPoolCooldown(...args),
}));

vi.mock('../../utils/modelRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/modelRegistry')>();
  return {
    ...actual,
    getDynamicPacingInterval: () => 0,
  };
});

function buildSampleProject(chapterCount: number): { project: StoryProject; chapters: Chapter[] } {
  const chapters: Chapter[] = Array.from({ length: chapterCount }, (_, idx) => ({
    id: `chap_${idx + 1}`,
    title: `Chương ${idx + 1}`,
    sourceText: `正文内容 ${idx + 1}`,
    rawTranslation: '',
    polishedTranslation: '',
    paragraphs: [],
    translatedLines: [],
    status: 'not_started',
    createdAt: '2026-11-27T00:00:00Z',
    updatedAt: '2026-11-27T00:00:00Z',
  }));

  const project: StoryProject = {
    id: 'proj_scan_test',
    title: 'Bộ Truyện Kiểm Thử',
    author: 'Tác giả',
    genre: 'Đô Thị',
    tone: 'Dịch thuần Việt mượt mà',
    description: '',
    glossary: [],
    pendingGlossary: [],
    chapters: chapters.map(({ id, title, status, createdAt, updatedAt }) => ({
      id,
      title,
      status,
      createdAt,
      updatedAt,
    })),
    createdAt: '2026-11-27T00:00:00Z',
  };

  return { project, chapters };
}

describe('useGlossaryScan Hook Suite (Feature 168)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockInspectKeyPoolCooldown.mockReturnValue({
      availableKeyIndex: 0,
      minCooldownRemainingMs: 0,
      nextRecoveringKeyIndex: 0,
      hasRecoverableCooldown: false,
      allPermanentlyExhausted: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountHook(project: StoryProject, extractionLoops = 1, apiKeys: string[] = ['AIzaSyTestKey123456']) {
    const logs: Array<{ message: string; type?: string }> = [];
    const onUpdateProject = vi.fn();
    let latest!: ReturnType<typeof useGlossaryScan>;

    function Harness() {
      latest = useGlossaryScan({
        activeProject: project,
        onUpdateProject,
        apiKeys,
        selectedModel: 'gemini-3.5-flash-lite',
        extractionLoops,
        scanRangeEnabled: false,
        scanRangeStart: 1,
        scanRangeEnd: project.chapters.length,
        currentApiKeyIndexRef: { current: 0 },
        addLog: (message, type) => logs.push({ message, type }),
        setAutoDiscoveredBatch: vi.fn(),
      });
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(React.createElement(Harness));
    });

    return {
      get current() {
        return latest;
      },
      logs,
      onUpdateProject,
      unmount: () => {
        act(() => {
          root.unmount();
        });
      },
    };
  }

  it('waits out RPM cooldown at interrupted chapter and continues cleanly without skipping remaining chapters', async () => {
    vi.useFakeTimers();
    const { project, chapters } = buildSampleProject(4);
    mockGetChaptersByProjectFromDB.mockResolvedValue(chapters);

    let chap2Attempts = 0;
    mockAnalyzeGlossaryDirect.mockImplementation(async ({ sourceChapterId }) => {
      if (sourceChapterId === 'chap_2' && chap2Attempts === 0) {
        chap2Attempts++;
        throw new GeminiRequestError(
          'Toàn bộ API Key đang tạm nghỉ giới hạn tốc độ RPM (chờ hồi phục sau ~37s).',
          {
            code: 'ALL_KEYS_EXHAUSTED',
            category: 'RATE_LIMIT_RPM',
            status: 429,
            isRetryable: true,
            retryAfterMs: 36_500,
          }
        );
      }
      return {
        suggestions: [
          {
            chinese: `词_${sourceChapterId}`,
            pinyin: `Từ ${sourceChapterId}`,
            vietnamese: `Từ ${sourceChapterId}`,
            type: 'term',
            note: '',
          },
        ],
        successKeyIndex: 0,
      };
    });

    const hook = mountHook(project, 1);

    let scanPromise!: Promise<void>;
    await act(async () => {
      scanPromise = hook.current.handleAutoExtractGlossary();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(hook.logs.some((l) => l.message.includes('Tạm chờ hồi phục hạn mức RPM'))).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(38_000);
      await scanPromise;
    });

    // chap_1 (1), chap_2 (fail + retry = 2), chap_3 (1), chap_4 (1) => 5 total calls
    expect(mockAnalyzeGlossaryDirect).toHaveBeenCalledTimes(5);
    const savedProj = hook.onUpdateProject.mock.calls.at(-1)?.[0] as StoryProject;
    expect(savedProj.glossary).toHaveLength(4);
    expect(savedProj.glossaryScanQueueState?.failedIds).toEqual([]);
    expect(
      hook.logs.some((l) => l.message.includes('ĐÃ HOÀN TẤT TOÀN BỘ QUY TRÌNH QUÉT LỌC TỰ ĐỘNG THÀNH CÔNG'))
    ).toBe(true);

    hook.unmount();
  });

  it('halts immediately across all loops on terminal RPD exhaustion and preserves remaining chapters in failedIds', async () => {
    const { project, chapters } = buildSampleProject(5);
    mockGetChaptersByProjectFromDB.mockResolvedValue(chapters);

    mockAnalyzeGlossaryDirect.mockImplementation(async ({ sourceChapterId }) => {
      if (sourceChapterId === 'chap_1') {
        return {
          suggestions: [{ chinese: '主角', pinyin: 'Chủ Giác', vietnamese: 'Nhân Vật', type: 'character', note: '' }],
          successKeyIndex: 0,
        };
      }
      // chap_2 hits permanent daily limit
      throw new GeminiRequestError(
        'Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED).',
        {
          code: 'ALL_KEYS_EXHAUSTED',
          category: 'QUOTA_EXHAUSTED_RPD',
          status: 429,
          isRetryable: false,
        }
      );
    });

    const hook = mountHook(project, 2);

    await act(async () => {
      await hook.current.handleAutoExtractGlossary();
    });

    // Must stop right at chap_2: never invoke chap_3, chap_4, chap_5 or loop 2
    expect(mockAnalyzeGlossaryDirect).toHaveBeenCalledTimes(2);
    const savedProj = hook.onUpdateProject.mock.calls.at(-1)?.[0] as StoryProject;
    expect(savedProj.glossary).toHaveLength(1);
    expect(savedProj.glossaryScanQueueState?.failedIds).toEqual(['chap_2', 'chap_3', 'chap_4', 'chap_5']);
    expect(
      hook.logs.some((l) => l.message.includes('TẠM DỪNG DO HẾT HẠN MỨC QUOTA'))
    ).toBe(true);
    expect(
      hook.logs.some((l) => l.message.includes('ĐÃ HOÀN TẤT TOÀN BỘ QUY TRÌNH QUÉT LỌC TỰ ĐỘNG THÀNH CÔNG'))
    ).toBe(false);

    hook.unmount();
  });

  it('cancels RPM cooldown wait immediately (<500ms) when user requests Stop', async () => {
    vi.useFakeTimers();
    const { project, chapters } = buildSampleProject(3);
    mockGetChaptersByProjectFromDB.mockResolvedValue(chapters);

    mockAnalyzeGlossaryDirect.mockRejectedValue(
      new GeminiRequestError('RPM limit reached', {
        code: 'ALL_KEYS_EXHAUSTED',
        category: 'RATE_LIMIT_RPM',
        status: 429,
        isRetryable: true,
        retryAfterMs: 40_000,
      })
    );

    const hook = mountHook(project, 1);

    let scanPromise!: Promise<void>;
    await act(async () => {
      scanPromise = hook.current.handleAutoExtractGlossary();
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(hook.current.isScanningGlossary).toBe(true);
    expect(hook.logs.some((l) => l.message.includes('Tạm chờ hồi phục hạn mức RPM'))).toBe(true);

    // Click Stop while waiting 40s cooldown
    await act(async () => {
      await hook.current.handleAutoExtractGlossary();
      await vi.advanceTimersByTimeAsync(50);
      await scanPromise;
    });

    expect(hook.current.isScanningGlossary).toBe(false);
    expect(mockAnalyzeGlossaryDirect).toHaveBeenCalledTimes(1);
    expect(hook.logs.some((l) => l.message.includes('ĐÃ DỪNG THEO YÊU CẦU'))).toBe(true);

    hook.unmount();
  });

  it('rotates startKeyIndex round-robin across chapters when multiple API keys are configured', async () => {
    const { project, chapters } = buildSampleProject(3);
    mockGetChaptersByProjectFromDB.mockResolvedValue(chapters);

    const startKeyIndices: number[] = [];
    mockAnalyzeGlossaryDirect.mockImplementation(async ({ startKeyIndex }) => {
      startKeyIndices.push(startKeyIndex);
      return {
        suggestions: [],
        successKeyIndex: startKeyIndex,
      };
    });

    const hook = mountHook(project, 1, ['KEY_A', 'KEY_B']);

    await act(async () => {
      await hook.current.handleAutoExtractGlossary();
    });

    expect(startKeyIndices).toEqual([0, 1, 0]);
    hook.unmount();
  });
});

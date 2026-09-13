import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTranslationProcess, UseTranslationProcessProps } from '../useTranslationProcess';
import { StoryProject } from '../../types';
import * as chapterService from '../../services/chapterTranslationService';
import { localQuotaTracker } from '../../services/localQuotaTracker';
import { clearStoredCustomLimits } from '../../utils/customLimitsStorage';

// Mock dependencies
vi.mock('../../services/db', () => ({
  getChapterFromDB: vi.fn().mockResolvedValue(null),
  saveChapterToDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../utils/download', () => ({
  triggerDownload: vi.fn(),
}));

vi.mock('../../services/chapterTranslationService', () => ({
  executeSingleChapterTranslation: vi.fn(),
}));

vi.mock('../../utils/modelRegistry', () => ({
  getDynamicPacingInterval: () => 0,
  isTpmNearLimit: () => false,
}));

// React Hook Test Harness
let stateSlots: any[] = [];
let stateIndex = 0;
let refSlots: any[] = [];
let refIndex = 0;

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  return {
    ...actual,
    useState: (initial: any) => {
      const idx = stateIndex++;
      if (stateSlots.length <= idx) {
        stateSlots[idx] = initial;
      }
      const setState = (val: any) => {
        stateSlots[idx] = typeof val === 'function' ? val(stateSlots[idx]) : val;
      };
      return [stateSlots[idx], setState];
    },
    useRef: (initial: any) => {
      const idx = refIndex++;
      if (refSlots.length <= idx) {
        refSlots[idx] = { current: initial };
      }
      return refSlots[idx];
    },
    useCallback: (fn: any) => fn,
    useEffect: (fn: any) => {
      if (typeof fn === 'function') fn();
    },
    useMemo: (fn: any) => fn(),
  };
});

describe('useTranslationProcess Key Rotation & Quota Fast-Break Tests', () => {
  const mockProject: StoryProject = {
    id: 'proj-test',
    title: 'Test Story',
    author: 'Tác giả',
    genre: 'Tiên Hiệp',
    tone: 'Trang nghiêm',
    description: '',
    chapters: [
      { id: 'chap-1', title: 'Chương 1', status: 'not_started', createdAt: '', updatedAt: '' },
      { id: 'chap-2', title: 'Chương 2', status: 'not_started', createdAt: '', updatedAt: '' },
      { id: 'chap-3', title: 'Chương 3', status: 'not_started', createdAt: '', updatedAt: '' },
    ],
    glossary: [],
    pendingGlossary: [],
    createdAt: new Date().toISOString(),
  };

  let logs: string[] = [];
  let updatedProject: StoryProject = mockProject;

  const resetHarness = () => {
    stateSlots = [];
    stateIndex = 0;
    refSlots = [];
    refIndex = 0;
    logs = [];
    updatedProject = { ...mockProject };
  };

  const createProps = (overrides?: Partial<UseTranslationProcessProps>): UseTranslationProcessProps => {
    return {
      activeProject: mockProject,
      onUpdateProject: (p) => { updatedProject = p; },
      apiKeys: ['key-A', 'key-B', 'key-C'],
      selectedModel: 'gemini-2.5-flash',
      polishCycles: 1,
      autoTranslateMode: 'resume',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      rangeEnabled: false,
      rangeStart: 1,
      rangeEnd: 10,
      currentApiKeyIndexRef: { current: 0 },
      addLog: (msg) => logs.push(msg),
      setAutoDiscoveredBatch: vi.fn(),
      setLogs: vi.fn(),
      skipFailedChapters: true,
      concurrency: 1,
      enableAiQaCritique: false,
      enableSegmentTranslation: false,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localQuotaTracker.resetMetrics();
    clearStoredCustomLimits();
    resetHarness();

    // Stub URL object for export download
    if (typeof globalThis.URL.createObjectURL !== 'function') {
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    }
    if (typeof globalThis.URL.revokeObjectURL !== 'function') {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports valid useTranslationProcess hook function', () => {
    expect(typeof useTranslationProcess).toBe('function');
  });

  it('rotates key index to (lastKeyIndex + 1) % keyCount on chapter success', async () => {
    const keyRef = { current: 0 };
    const props = createProps({ currentApiKeyIndexRef: keyRef });

    const execSpy = vi.spyOn(chapterService, 'executeSingleChapterTranslation');
    execSpy
      .mockResolvedValueOnce({
        chapterId: 'chap-1',
        success: true,
        isOverload: false,
        newGlossaryItems: [],
        newPendingItems: [],
        updatedChapter: null,
        lastKeyIndex: 0,
      })
      .mockResolvedValueOnce({
        chapterId: 'chap-2',
        success: true,
        isOverload: false,
        newGlossaryItems: [],
        newPendingItems: [],
        updatedChapter: null,
        lastKeyIndex: 1,
      });

    const hook = useTranslationProcess(props);
    const queue = mockProject.chapters.slice(0, 2);

    await hook.runTranslationLoop(queue, 0);

    expect(execSpy).toHaveBeenCalledTimes(2);
    // Chapter 1 called with startKeyIndex: 0
    expect(execSpy.mock.calls[0][0].startKeyIndex).toBe(0);
    // Chapter 2 called with startKeyIndex: 1 (rotated from 0 -> 1)
    expect(execSpy.mock.calls[1][0].startKeyIndex).toBe(1);
    // Final key index should advance to (1 + 1) % 3 = 2
    expect(keyRef.current).toBe(2);
  });

  it('rotates key index to next healthy candidate on chapter failure instead of sticking to failed key', async () => {
    const keyRef = { current: 0 };
    const props = createProps({ currentApiKeyIndexRef: keyRef, skipFailedChapters: true });

    const execSpy = vi.spyOn(chapterService, 'executeSingleChapterTranslation');
    // Chapter 1 fails with transient overload
    execSpy
      .mockRejectedValueOnce(Object.assign(new Error('AI quá tải tạm thời'), { isOverload: true }))
      // Chapter 2 succeeds
      .mockResolvedValueOnce({
        chapterId: 'chap-2',
        success: true,
        isOverload: false,
        newGlossaryItems: [],
        newPendingItems: [],
        updatedChapter: null,
        lastKeyIndex: 1,
      });

    const hook = useTranslationProcess(props);
    const queue = mockProject.chapters.slice(0, 2);

    await hook.runTranslationLoop(queue, 0);

    expect(execSpy).toHaveBeenCalledTimes(2);
    // Chapter 1 was executed with key 0
    expect(execSpy.mock.calls[0][0].startKeyIndex).toBe(0);
    // Chapter 2 was executed with key 1 (successfully advanced past key 0)
    expect(execSpy.mock.calls[1][0].startKeyIndex).toBe(1);
    // Confirms skip warning was logged
    expect(logs.some(l => l.includes('Bỏ qua chương "Chương 1" lỗi'))).toBe(true);
  });

  it('terminates immediately (fast-break) when error has ALL_KEYS_EXHAUSTED without skipping entire queue', async () => {
    const keyRef = { current: 0 };
    const props = createProps({ currentApiKeyIndexRef: keyRef, skipFailedChapters: true });

    const execSpy = vi.spyOn(chapterService, 'executeSingleChapterTranslation');
    const quotaErr = Object.assign(
      new Error('Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED).'),
      { code: 'ALL_KEYS_EXHAUSTED', isOverload: true }
    );
    execSpy.mockRejectedValue(quotaErr);

    const hook = useTranslationProcess(props);
    const queue = mockProject.chapters; // 3 chapters

    await hook.runTranslationLoop(queue, 0);

    // Fast break should trigger after Chapter 1 fails; Chapters 2 & 3 must NOT be called
    expect(execSpy).toHaveBeenCalledTimes(1);
    expect(logs.some(l => l.includes('TẤT CẢ API KEY ĐÃ CẠN KIỆT HẠN MỨC QUOTA'))).toBe(true);
    // Should NOT falsely log "Bỏ qua chương ... lỗi và tiếp tục..."
    expect(logs.some(l => l.includes('Bỏ qua chương "Chương 1" lỗi và tiếp tục'))).toBe(false);
  });

  it('terminates immediately when error message contains "Toàn bộ API Key đã hết hạn mức"', async () => {
    const keyRef = { current: 0 };
    const props = createProps({ currentApiKeyIndexRef: keyRef, skipFailedChapters: true });

    const execSpy = vi.spyOn(chapterService, 'executeSingleChapterTranslation');
    execSpy.mockRejectedValue(
      new Error('Toàn bộ API Key đã hết hạn mức (hoặc đã chạm ngưỡng cá nhân). Vui lòng kiểm tra Bảng điều khiển Quota.')
    );

    const hook = useTranslationProcess(props);
    const queue = mockProject.chapters; // 3 chapters

    await hook.runTranslationLoop(queue, 0);

    // Fast break triggers immediately
    expect(execSpy).toHaveBeenCalledTimes(1);
    expect(logs.some(l => l.includes('TẤT CẢ API KEY ĐÃ CẠN KIỆT HẠN MỨC QUOTA'))).toBe(true);
  });

  it('handleRetryFailedChapters automatically selects the next healthy key before retrying', async () => {
    const keyRef = { current: 0 }; // Currently on Key-A
    // Mark Key-A as QuotaExhausted
    localQuotaTracker.recordFailure('key-A', 'gemini-2.5-flash', {
      status: 429,
      isRateLimit: true,
      message: 'daily quota exhausted',
    });

    const projectWithFailed: StoryProject = {
      ...mockProject,
      translationQueueState: {
        queueIds: ['chap-1'],
        currentIndex: 0,
        mode: 'resume',
        skipFailedChapters: true,
        failedIds: ['chap-1'],
      },
    };

    const props = createProps({
      activeProject: projectWithFailed,
      currentApiKeyIndexRef: keyRef,
      apiKeys: ['key-A', 'key-B', 'key-C'],
    });

    const execSpy = vi.spyOn(chapterService, 'executeSingleChapterTranslation').mockResolvedValue({
      chapterId: 'chap-1',
      success: true,
      isOverload: false,
      newGlossaryItems: [],
      newPendingItems: [],
      updatedChapter: null,
      lastKeyIndex: 1,
    });

    const hook = useTranslationProcess(props);

    hook.handleRetryFailedChapters();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Initially skipped Key-A (0) and ran Chapter 1 with Key-B (1)
    expect(execSpy).toHaveBeenCalled();
    expect(execSpy.mock.calls[0][0].startKeyIndex).toBe(1);
    // Upon Chapter 1 success with Key-B (1), advanced to (1 + 1) % 3 = 2
    expect(keyRef.current).toBe(2);
  });
});

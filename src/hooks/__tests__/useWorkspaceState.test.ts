import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveOrUpdateChapter, useWorkspaceState, UseWorkspaceStateProps } from '../useWorkspaceState';
import { StoryProject, Chapter } from '../../types';
import { polishTranslationDirect, qaCritiqueDirect } from '../../services/directTranslationEngine';
import { runHeuristicQualityScan } from '../../services/hakoQualityEngine';

// Notification mock
const mockShowToast = vi.fn();
const mockShowConfirm = vi.fn();
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    showToast: mockShowToast,
    showConfirm: mockShowConfirm,
  }),
}));

// CRDT mock
vi.mock('../useChapterCRDT', () => ({
  useChapterCRDT: () => ({
    status: 'offline',
    collaborators: [],
    updateRawTranslation: vi.fn(),
    updatePolishedTranslation: vi.fn(),
    applyRemoteDiff: vi.fn(),
  }),
}));

// Direct translation engine mock
vi.mock('../../services/directTranslationEngine', () => ({
  translateRawDirect: vi.fn(),
  polishTranslationDirect: vi.fn(),
  qaCritiqueDirect: vi.fn(),
}));

// Hako quality engine mock
vi.mock('../../services/hakoQualityEngine', () => ({
  runHeuristicQualityScan: vi.fn(),
}));

// React hooks mock state
let stateSlots: any[] = [];
let stateIndex = 0;
let refSlots: any[] = [];
let refIndex = 0;
let registeredEffects: Array<() => void | (() => void)> = [];
let effectCleanups: Array<() => void> = [];
const prevDepsMap = new Map<number, any[] | undefined>();
let effectIdx = 0;
const callbackDepsMap = new Map<number, { fn: any; deps: any[] }>();
let callbackIdx = 0;
const memoDepsMap = new Map<number, { value: any; deps: any[] }>();
let memoIdx = 0;

vi.mock('react', () => ({
  useState: (initial: any) => {
    const idx = stateIndex++;
    if (stateSlots.length <= idx) {
      stateSlots[idx] = typeof initial === 'function' ? initial() : initial;
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
  useCallback: (fn: any, deps?: any[]) => {
    const currentIdx = callbackIdx++;
    const prev = callbackDepsMap.get(currentIdx);
    const hasChanged = !prev || !deps || deps.some((dep, i) => dep !== prev.deps[i]);
    if (hasChanged) {
      callbackDepsMap.set(currentIdx, { fn, deps: deps ? [...deps] : [] });
      return fn;
    }
    return prev.fn;
  },
  useMemo: (factory: any, deps?: any[]) => {
    const currentIdx = memoIdx++;
    const prev = memoDepsMap.get(currentIdx);
    const hasChanged = !prev || !deps || deps.some((dep, i) => dep !== prev.deps[i]);
    if (hasChanged) {
      const value = factory();
      memoDepsMap.set(currentIdx, { value, deps: deps ? [...deps] : [] });
      return value;
    }
    return prev.value;
  },
  useDeferredValue: (val: any) => val,
  useEffect: (effect: any, deps?: any[]) => {
    const currentIdx = effectIdx++;
    const prevDeps = prevDepsMap.get(currentIdx);
    const hasChanged = !prevDeps || !deps || deps.some((dep, i) => dep !== prevDeps[i]);
    if (hasChanged) {
      prevDepsMap.set(currentIdx, deps ? [...deps] : undefined);
      registeredEffects.push(effect);
    }
  },
}));

function flushEffects() {
  const effectsToRun = [...registeredEffects];
  registeredEffects = [];
  for (const eff of effectsToRun) {
    const cleanup = eff();
    if (typeof cleanup === 'function') {
      effectCleanups.push(cleanup);
    }
  }
}

function cleanupEffects() {
  for (const cleanup of effectCleanups) {
    try {
      cleanup();
    } catch {
      // ignore
    }
  }
  effectCleanups = [];
}

describe('Translator Workspace Upsert Logic (saveOrUpdateChapter)', () => {
  const createMockProject = (chapters: Chapter[] = []): StoryProject => ({
    id: 'proj_test_1',
    title: 'Đấu Phá Thương Khung',
    author: 'Thiên Tàm Thổ Đậu',
    genre: 'Tiên Hiệp',
    tone: 'Hùng tráng',
    description: 'Mô tả truyện',
    glossary: [],
    pendingGlossary: [],
    chapters,
    createdAt: '2026-08-20T00:00:00.000Z',
  });

  describe('US1: Update Existing Chapter In-Place', () => {
    it('updates existing chapter in-place when currentChapterId matches an existing chapter', () => {
      const existingChap: Chapter = {
        id: 'chap_100',
        title: 'Chương 1: Khởi đầu',
        sourceText: '这是第一章。',
        rawTranslation: 'Đây là chương một.',
        polishedTranslation: 'Đây là chương đầu tiên.',
        paragraphs: ['这是第一章。'],
        translatedLines: ['Đây là chương đầu tiên.'],
        status: 'completed',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };

      const project = createMockProject([existingChap]);

      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_100',
        activeProject: project,
        sourceText: '这是第一章。修改版。',
        chapterTitle: 'Chương 1: Khởi đầu (Sửa)',
        rawTranslation: 'Đây là chương một. Bản sửa.',
        polishedTranslation: 'Đây là chương đầu tiên sau khi chuốt lại.',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(true);
      expect(result!.savedChapter.id).toBe('chap_100');
      expect(result!.savedChapter.createdAt).toBe('2026-08-20T00:00:00.000Z');
      expect(result!.savedChapter.title).toBe('Chương 1: Khởi đầu (Sửa)');
      expect(result!.savedChapter.sourceText).toBe('这是第一章。修改版。');
      expect(result!.savedChapter.polishedTranslation).toBe('Đây là chương đầu tiên sau khi chuốt lại.');
      expect(result!.savedChapter.status).toBe('completed');
      expect(new Date(result!.savedChapter.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(existingChap.updatedAt).getTime()
      );

      // Verify array size remains 1 and no duplicate is prepended
      expect(result!.updatedProject.chapters.length).toBe(1);
      expect(result!.updatedProject.chapters[0].id).toBe('chap_100');
      expect(result!.updatedProject.chapters[0].title).toBe('Chương 1: Khởi đầu (Sửa)');
    });

    it('updates the correct chapter in a multi-chapter project preserving list order', () => {
      const chap1: Chapter = {
        id: 'chap_1',
        title: 'Chương 1',
        sourceText: '第一章',
        rawTranslation: 'Chương 1',
        polishedTranslation: 'Chương 1 hoàn thiện',
        status: 'completed',
        paragraphs: ['第一章'],
        translatedLines: ['Chương 1'],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };
      const chap2: Chapter = {
        id: 'chap_2',
        title: 'Chương 2',
        sourceText: '第二章',
        rawTranslation: 'Chương 2 thô',
        polishedTranslation: '',
        status: 'in_progress',
        paragraphs: ['第二章'],
        translatedLines: ['Chương 2'],
        createdAt: '2026-08-21T00:00:00.000Z',
        updatedAt: '2026-08-21T00:00:00.000Z',
      };
      const chap3: Chapter = {
        id: 'chap_3',
        title: 'Chương 3',
        sourceText: '第三章',
        rawTranslation: '',
        polishedTranslation: '',
        status: 'not_started',
        paragraphs: ['第三章'],
        translatedLines: [],
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
      };

      const project = createMockProject([chap1, chap2, chap3]);

      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_2',
        activeProject: project,
        sourceText: '第二章内容',
        chapterTitle: 'Chương 2: Cập Nhật',
        rawTranslation: 'Nội dung chương 2',
        polishedTranslation: 'Nội dung chương 2 trau chuốt',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(true);
      expect(result!.updatedProject.chapters.length).toBe(3);
      expect(result!.updatedProject.chapters[0].id).toBe('chap_1');
      expect(result!.updatedProject.chapters[1].id).toBe('chap_2');
      expect(result!.updatedProject.chapters[1].title).toBe('Chương 2: Cập Nhật');
      expect(result!.updatedProject.chapters[1].status).toBe('completed');
      expect(result!.updatedProject.chapters[2].id).toBe('chap_3');
    });

    it('sets status correctly to in_progress if only rawTranslation exists', () => {
      const existingChap: Chapter = {
        id: 'chap_101',
        title: 'Chương 2',
        sourceText: '原文',
        rawTranslation: '',
        polishedTranslation: '',
        status: 'not_started',
        paragraphs: ['原文'],
        translatedLines: [],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };

      const project = createMockProject([existingChap]);

      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_101',
        activeProject: project,
        sourceText: '原文',
        chapterTitle: 'Chương 2',
        rawTranslation: 'Bản dịch thô',
        polishedTranslation: '',
      });

      expect(result!.savedChapter.status).toBe('in_progress');
      expect(result!.savedChapter.translatedLines).toEqual(['Bản dịch thô']);
    });
  });

  describe('US2: Create New Chapter and Re-save binding', () => {
    it('creates a new chapter when currentChapterId is null and prepends it', () => {
      const project = createMockProject();

      const result = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '新的第一章内容。',
        chapterTitle: 'Chương 1: Tân Thế Giới',
        rawTranslation: 'Nội dung chương một mới.',
        polishedTranslation: 'Nội dung chương một mới hoàn toàn.',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(false);
      expect(result!.savedChapter.id).toMatch(/^chap_\d+/);
      expect(result!.savedChapter.title).toBe('Chương 1: Tân Thế Giới');
      expect(result!.updatedProject.chapters.length).toBe(1);
      expect(result!.updatedProject.chapters[0].id).toBe(result!.savedChapter.id);
    });

    it('subsequent save using newly created chapter ID performs in-place update without creating duplicate', () => {
      const project = createMockProject();

      // First save: Create new chapter
      const firstSave = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '第一章草稿',
        chapterTitle: 'Chương 1: Bản nháp',
        rawTranslation: 'Bản dịch thô nháp',
        polishedTranslation: '',
      });

      expect(firstSave!.isUpdate).toBe(false);
      const newId = firstSave!.savedChapter.id;
      const projectAfterFirstSave = firstSave!.updatedProject;
      expect(projectAfterFirstSave.chapters.length).toBe(1);

      // Second save (simulating Ctrl+S again in same editing session): Use newId
      const secondSave = saveOrUpdateChapter({
        currentChapterId: newId,
        activeProject: projectAfterFirstSave,
        sourceText: '第一章草稿 (hoàn thiện)',
        chapterTitle: 'Chương 1: Bản hoàn thiện',
        rawTranslation: 'Bản dịch thô nháp',
        polishedTranslation: 'Bản dịch biên tập hoàn chỉnh',
      });

      expect(secondSave!.isUpdate).toBe(true);
      expect(secondSave!.savedChapter.id).toBe(newId);
      expect(secondSave!.updatedProject.chapters.length).toBe(1);
      expect(secondSave!.updatedProject.chapters[0].title).toBe('Chương 1: Bản hoàn thiện');
      expect(secondSave!.updatedProject.chapters[0].status).toBe('completed');
    });

    it('falls back safely to create new chapter if currentChapterId is not found in chapters list', () => {
      const existingChap: Chapter = {
        id: 'chap_existing',
        title: 'Chương cũ',
        sourceText: '旧章节',
        rawTranslation: 'Chương cũ thô',
        polishedTranslation: 'Chương cũ',
        status: 'completed',
        paragraphs: ['旧章节'],
        translatedLines: ['Chương cũ'],
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };
      const project = createMockProject([existingChap]);

      // currentChapterId is a deleted chapter ID 'chap_deleted'
      const result = saveOrUpdateChapter({
        currentChapterId: 'chap_deleted',
        activeProject: project,
        sourceText: '这是新章节内容',
        chapterTitle: 'Chương Mới',
        rawTranslation: 'Bản dịch thô mới',
        polishedTranslation: '',
      });

      expect(result).not.toBeNull();
      expect(result!.isUpdate).toBe(false);
      expect(result!.updatedProject.chapters.length).toBe(2);
      expect(result!.updatedProject.chapters[0].id).toMatch(/^chap_\d+/);
      expect(result!.updatedProject.chapters[1].id).toBe('chap_existing');
    });
  });

  describe('US3 & Edge Cases', () => {
    it('returns null when sourceText is empty or whitespace-only', () => {
      const project = createMockProject();

      const result1 = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '',
        chapterTitle: 'Chương 1',
        rawTranslation: '',
        polishedTranslation: '',
      });
      expect(result1).toBeNull();

      const result2 = saveOrUpdateChapter({
        currentChapterId: 'chap_1',
        activeProject: project,
        sourceText: '   \n\t  ',
        chapterTitle: 'Chương 1',
        rawTranslation: '',
        polishedTranslation: '',
      });
      expect(result2).toBeNull();
    });

    it('generates fallback title if chapterTitle is empty', () => {
      const project = createMockProject();

      const result = saveOrUpdateChapter({
        currentChapterId: null,
        activeProject: project,
        sourceText: '有些内容',
        chapterTitle: '   ',
        rawTranslation: '',
        polishedTranslation: '',
      });

      expect(result!.savedChapter.title).toBe('Chương 1: Chưa đặt tên');
    });
  });
});

describe('useWorkspaceState Hook - Decoupled Audit Scanners & Manual Handlers', () => {
  const createDefaultProps = (overrides: Partial<UseWorkspaceStateProps> = {}): UseWorkspaceStateProps => ({
    activeProject: {
      id: 'proj_test_workspace',
      title: 'Đấu Phá Thương Khung',
      author: 'Thiên Tàm Thổ Đậu',
      genre: 'Tiên Hiệp',
      tone: 'Hùng tráng',
      description: 'Mô tả truyện',
      glossary: [],
      pendingGlossary: [],
      chapters: [
        {
          id: 'chap-1',
          title: 'Chương 1: Thiên Chi Kiêu Tử',
          status: 'completed',
          createdAt: '2026-08-20T00:00:00.000Z',
          updatedAt: '2026-08-20T00:00:00.000Z',
        },
      ],
      createdAt: '2026-08-20T00:00:00.000Z',
    },
    onUpdateProject: vi.fn(),
    apiKeys: ['test-api-key-123'],
    selectedModel: 'gemini-2.5-flash',
    warningParagraphMismatch: false,
    enableAiQaCritique: true,
    enableSegmentTranslation: false,
    ...overrides,
  });

  const renderWorkspaceHook = (props: UseWorkspaceStateProps) => {
    stateIndex = 0;
    refIndex = 0;
    effectIdx = 0;
    callbackIdx = 0;
    memoIdx = 0;
    const result = useWorkspaceState(props);
    flushEffects();
    return result;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupEffects();
    stateSlots = [];
    stateIndex = 0;
    refSlots = [];
    refIndex = 0;
    prevDepsMap.clear();
    effectIdx = 0;
    callbackDepsMap.clear();
    callbackIdx = 0;
    memoDepsMap.clear();
    memoIdx = 0;
    registeredEffects = [];
  });

  afterEach(() => {
    cleanupEffects();
  });

  describe('US1: Decouple Auto QA Critique from Polish Translation', () => {
    it('executes handlePolishTranslation without invoking qaCritiqueDirect even when enableAiQaCritique is true', async () => {
      const mockPolish = vi.mocked(polishTranslationDirect);
      const mockQa = vi.mocked(qaCritiqueDirect);
      mockPolish.mockResolvedValueOnce({
        polishedTranslation: 'La Phong ngước nhìn bầu trời đêm thăm thẳm.',
      } as any);

      const props = createDefaultProps({ enableAiQaCritique: true });
      let hook = renderWorkspaceHook(props);
      hook.setSourceText('罗峰看着夜空。');
      hook.setRawTranslation('La Phong nhìn đêm không.');
      hook = renderWorkspaceHook(props);

      await hook.handlePolishTranslation();

      expect(mockPolish).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceText: '罗峰看着夜空。',
          rawTranslation: 'La Phong nhìn đêm không.',
          apiKeys: ['test-api-key-123'],
          model: 'gemini-2.5-flash',
        })
      );
      // Crucial verification: qaCritiqueDirect is NOT called automatically
      expect(mockQa).not.toHaveBeenCalled();

      // Polished translation state updated
      hook = renderWorkspaceHook(props);
      expect(hook.polishedTranslation).toBe('La Phong ngước nhìn bầu trời đêm thăm thẳm.');
    });
  });

  describe('US2: Explicit Manual AI QA Critique Action (handleRunAiQaCritique)', () => {
    it('aborts and shows warning toast if apiKeys is empty', async () => {
      const mockQa = vi.mocked(qaCritiqueDirect);
      const props = createDefaultProps({ apiKeys: [] });
      let hook = renderWorkspaceHook(props);
      hook.setPolishedTranslation('Bản dịch tiếng Việt đã xong.');
      hook = renderWorkspaceHook(props);

      await hook.handleRunAiQaCritique();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Vui lòng cấu hình API Key để thực hiện kiểm duyệt AI.',
          type: 'warning',
        })
      );
      expect(mockQa).not.toHaveBeenCalled();
    });

    it('aborts and shows warning toast if polishedTranslation is empty', async () => {
      const mockQa = vi.mocked(qaCritiqueDirect);
      const props = createDefaultProps({ apiKeys: ['valid-key'] });
      const hook = renderWorkspaceHook(props);

      await hook.handleRunAiQaCritique();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Chưa có bản dịch hoàn thiện để kiểm định chất lượng.',
          type: 'warning',
        })
      );
      expect(mockQa).not.toHaveBeenCalled();
    });

    it('invokes qaCritiqueDirect and populates qaIssues when AI flags quality issues', async () => {
      const mockQa = vi.mocked(qaCritiqueDirect);
      mockQa.mockResolvedValueOnce({
        isValid: false,
        issues: [
          {
            type: 'omission',
            severity: 'critical',
            description: 'Sót vế câu so với nguyên tác',
            targetText: 'bầu trời đêm thăm thẳm',
          },
        ],
        successKeyIndex: 0,
      });

      const props = createDefaultProps({ apiKeys: ['key-abc'], selectedModel: 'gemini-2.5-flash' });
      let hook = renderWorkspaceHook(props);
      hook.setSourceText('罗峰看着浩瀚的星空。');
      hook.setPolishedTranslation('La Phong nhìn bầu trời đêm.');
      hook = renderWorkspaceHook(props);

      await hook.handleRunAiQaCritique();

      expect(mockQa).toHaveBeenCalledWith({
        sourceText: '罗峰看着浩瀚的星空。',
        translatedText: 'La Phong nhìn bầu trời đêm.',
        apiKeys: ['key-abc'],
        model: 'gemini-2.5-flash',
        startKeyIndex: 0,
      });

      hook = renderWorkspaceHook(props);
      expect(hook.qaIssues.length).toBe(1);
      expect(hook.qaIssues[0].type).toBe('omission');
      expect(hook.qaIssues[0].targetText).toBe('bầu trời đêm thăm thẳm');
      expect(hook.isCheckingQa).toBe(false);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Phát hiện 1 vấn đề'),
          type: 'warning',
        })
      );
    });

    it('shows success toast when AI critique finishes with zero issues', async () => {
      const mockQa = vi.mocked(qaCritiqueDirect);
      mockQa.mockResolvedValueOnce({
        isValid: true,
        issues: [],
        successKeyIndex: 0,
      });

      const props = createDefaultProps({ apiKeys: ['key-abc'] });
      let hook = renderWorkspaceHook(props);
      hook.setSourceText('罗峰看着浩瀚的星空。');
      hook.setPolishedTranslation('La Phong ngước nhìn tinh không bao la.');
      hook = renderWorkspaceHook(props);

      await hook.handleRunAiQaCritique();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Kiểm duyệt AI hoàn tất: Bản dịch đạt chuẩn'),
          type: 'success',
        })
      );
      hook = renderWorkspaceHook(props);
      expect(hook.qaIssues).toEqual([]);
      expect(hook.isCheckingQa).toBe(false);
    });

    it('catches critique API errors, displays toast error, and resets isCheckingQa', async () => {
      const mockQa = vi.mocked(qaCritiqueDirect);
      mockQa.mockRejectedValueOnce(new Error('Rate limit exceeded (429)'));

      const props = createDefaultProps({ apiKeys: ['key-abc'] });
      let hook = renderWorkspaceHook(props);
      hook.setSourceText('罗峰看着浩瀚的星空。');
      hook.setPolishedTranslation('La Phong ngước nhìn tinh không bao la.');
      hook = renderWorkspaceHook(props);

      await hook.handleRunAiQaCritique();

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Rate limit exceeded (429)',
          type: 'error',
        })
      );
      hook = renderWorkspaceHook(props);
      expect(hook.isCheckingQa).toBe(false);
    });
  });

  describe('US3: Debounced Real-Time Heuristic Quality Scan (handleRunHakoScan)', () => {
    it('clears hakoIssues when polishedTranslation is empty without calling runHeuristicQualityScan', () => {
      const mockScan = vi.mocked(runHeuristicQualityScan);
      const props = createDefaultProps();
      const hook = renderWorkspaceHook(props);

      hook.handleRunHakoScan();

      expect(mockScan).not.toHaveBeenCalled();
      expect(hook.hakoIssues).toEqual([]);
    });

    it('executes runHeuristicQualityScan synchronously and populates hakoIssues', () => {
      const mockScan = vi.mocked(runHeuristicQualityScan);
      const mockHakoIssues = [
        {
          id: 'hako_issue_1',
          chapterId: 'chap-1',
          chapterTitle: 'Chương 1: Thiên Chi Kiêu Tử',
          chapterNumber: 1,
          category: 'raw_leak' as const,
          severity: 'major' as const,
          vietnameseSnippet: 'La Phong nhìn thấy 龙涎草',
          explanation: 'Chứa ký tự Hán tự',
          decision: 'pending' as const,
          detectedBy: 'heuristic' as const,
          createdAt: '2026-09-10T12:00:00Z',
        },
      ];
      mockScan.mockReturnValueOnce(mockHakoIssues);

      const mockChapter: Chapter = {
        id: 'chap-1',
        title: 'Chương 1: Thiên Chi Kiêu Tử',
        sourceText: '罗峰看着天空。',
        rawTranslation: 'La Phong nhìn bầu trời.',
        polishedTranslation: 'La Phong nhìn thấy 龙涎草',
        paragraphs: ['罗峰看着天空。'],
        translatedLines: ['La Phong nhìn thấy 龙涎草'],
        status: 'completed',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      };
      const props = createDefaultProps({ loadedChapter: mockChapter });
      let hook = renderWorkspaceHook(props);
      // Re-render after loadedChapter effect has populated state slots
      hook = renderWorkspaceHook(props);

      hook.handleRunHakoScan();

      expect(mockScan).toHaveBeenCalledWith({
        chapterId: 'chap-1',
        title: 'Chương 1: Thiên Chi Kiêu Tử',
        chapterNumber: 1,
        vietnameseContent: 'La Phong nhìn thấy 龙涎草',
      });

      hook = renderWorkspaceHook(props);
      expect(hook.hakoIssues).toEqual(mockHakoIssues);
    });

    it('automatically triggers handleRunHakoScan after 500ms debounce on polishedTranslation change', () => {
      vi.useFakeTimers();
      const mockScan = vi.mocked(runHeuristicQualityScan);
      mockScan.mockReturnValue([]);

      const props = createDefaultProps();
      let hook = renderWorkspaceHook(props);

      // Typing new polished content
      hook.setPolishedTranslation('Nội dung vừa gõ xong...');
      hook = renderWorkspaceHook(props);

      // Immediately after typing, debounce timer is pending; scan should not have fired yet
      expect(mockScan).not.toHaveBeenCalled();

      // Fast-forward 500ms
      vi.advanceTimersByTime(500);

      expect(mockScan).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('Hook Export Contract', () => {
    it('exports hakoIssues array, handleRunAiQaCritique async handler, and handleRunHakoScan callback', () => {
      const hook = renderWorkspaceHook(createDefaultProps());
      expect(Array.isArray(hook.hakoIssues)).toBe(true);
      expect(typeof hook.handleRunAiQaCritique).toBe('function');
      expect(typeof hook.handleRunHakoScan).toBe('function');
      expect(Array.isArray(hook.qaIssues)).toBe(true);
      expect(typeof hook.isCheckingQa).toBe('boolean');
      expect(typeof hook.handleApplyAuditFix).toBe('function');
    });
  });

  describe('Feature 104: handleApplyAuditFix (Centralized Auto-Fix Handler)', () => {
    it('applies fix successfully when targetText matches polishedTranslation and calls exported setter', () => {
      const props = createDefaultProps();
      let hook = renderWorkspaceHook(props);
      hook.setActiveStage('polished');
      hook.setPolishedTranslation('Kiếm khí 纵横 chấn động toàn trường.');
      hook = renderWorkspaceHook(props);

      const issue = {
        id: 'issue-1',
        source: 'hako_rule' as const,
        severity: 'error' as const,
        title: 'Sót chữ Hán',
        message: 'Có chữ Hán chưa dịch',
        targetText: '纵横',
        suggestion: 'tung hoành',
        autoFixable: true,
        status: 'pending' as const,
      };

      const result = hook.handleApplyAuditFix(issue);

      expect(result).toBe(true);
      hook = renderWorkspaceHook(props);
      expect(hook.polishedTranslation).toBe('Kiếm khí tung hoành chấn động toàn trường.');
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Đã áp dụng sửa lỗi thành công.',
          type: 'success',
        })
      );
    });

    it('returns false and shows warning toast when targetText is not found (text drift)', () => {
      const props = createDefaultProps();
      let hook = renderWorkspaceHook(props);
      hook.setActiveStage('polished');
      hook.setPolishedTranslation('Bản dịch đã được biên tập lại hoàn toàn khác.');
      hook = renderWorkspaceHook(props);

      const issue = {
        id: 'issue-drift',
        source: 'hako_rule' as const,
        severity: 'warning' as const,
        title: 'Lỗi cũ',
        message: 'Lỗi trên văn bản cũ',
        targetText: 'Đoạn văn này không còn tồn tại',
        suggestion: 'Đoạn văn mới',
        autoFixable: true,
        status: 'pending' as const,
      };

      const result = hook.handleApplyAuditFix(issue);

      expect(result).toBe(false);
      // Text remains unchanged
      hook = renderWorkspaceHook(props);
      expect(hook.polishedTranslation).toBe('Bản dịch đã được biên tập lại hoàn toàn khác.');
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Nội dung đã thay đổi, không thể áp dụng sửa nhanh, vui lòng chạy lại kiểm định.',
          type: 'warning',
        })
      );
    });

    it('applies fix to rawTranslation when activeStage is raw', () => {
      const props = createDefaultProps();
      let hook = renderWorkspaceHook(props);
      hook.setActiveStage('raw');
      hook.setRawTranslation('Bản dịch thô có lỗi chính tả.');
      hook = renderWorkspaceHook(props);

      const issue = {
        id: 'issue-raw',
        source: 'hako_rule' as const,
        severity: 'warning' as const,
        title: 'Chính tả',
        message: 'Sửa chính tả',
        targetText: 'chính tả',
        suggestion: 'chuẩn xác',
        autoFixable: true,
        status: 'pending' as const,
      };

      const result = hook.handleApplyAuditFix(issue);

      expect(result).toBe(true);
      hook = renderWorkspaceHook(props);
      expect(hook.rawTranslation).toBe('Bản dịch thô có lỗi chuẩn xác.');
    });

    it('returns false if issue is not autoFixable and has no suggestion', () => {
      const props = createDefaultProps();
      const hook = renderWorkspaceHook(props);

      const issue = {
        id: 'issue-nonfixable',
        source: 'ai_critique' as const,
        severity: 'info' as const,
        title: 'Góp ý chung',
        message: 'Nên dùng từ ngữ bay bổng hơn',
        targetText: 'bay bổng',
        autoFixable: false,
        status: 'pending' as const,
      };

      const result = hook.handleApplyAuditFix(issue);
      expect(result).toBe(false);
    });
  });
});

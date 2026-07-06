import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlossaryApply } from '../useGlossaryApply';
import { StoryProject, GlossaryItem } from '../../types';

// Mock dependencies
vi.mock('../../services/db', () => ({
  getChaptersByProjectFromDB: vi.fn(),
  saveChapterToDB: vi.fn(),
}));

vi.mock('../../components/NotificationSystem', () => ({
  useNotifications: () => ({
    showToast: vi.fn(),
  }),
}));

let mockState = {
  isApplyingGlossary: false,
  applyGlossaryResult: null as any,
};

const mockSetIsApplying = vi.fn((val) => {
  mockState.isApplyingGlossary = typeof val === 'function' ? val(mockState.isApplyingGlossary) : val;
});

const mockSetApplyGlossaryResult = vi.fn((val) => {
  mockState.applyGlossaryResult = typeof val === 'function' ? val(mockState.applyGlossaryResult) : val;
});

let refCurrent: any = null;

vi.mock('react', () => {
  return {
    useState: (initial: any) => {
      if (typeof initial === 'boolean') {
        return [mockState.isApplyingGlossary, mockSetIsApplying];
      } else {
        return [mockState.applyGlossaryResult, mockSetApplyGlossaryResult];
      }
    },
    useEffect: (fn: any) => fn(),
    useCallback: (fn: any) => fn,
    useRef: (initial: any) => {
      if (refCurrent === null) {
        refCurrent = initial;
      }
      return {
        get current() {
          return refCurrent;
        },
        set current(val) {
          refCurrent = val;
        }
      };
    },
    startTransition: (fn: any) => fn(),
  };
});

describe('useGlossaryApply - Glossary application hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        refCurrent = null;
        mockState.isApplyingGlossary = false;
        mockState.applyGlossaryResult = null;
    });

    it('should replace both primary Chinese and its variants in the source text', async () => {
        const glossary: GlossaryItem[] = [
            {
                id: 'glo_1',
                chinese: '万剑归宗',
                pinyin: '',
                variants: ['萬劍歸宗'],
                vietnamese: 'Vạn Kiếm Quy Tông',
                type: 'term',
                note: '',
            }
        ];

        const activeProject: StoryProject = {
            id: 'proj_1',
            title: 'Test Proj',
            author: '',
            genre: '',
            tone: '',
            description: '',
            glossary,
            pendingGlossary: [],
            chapters: [
                {
                    id: 'chap_1',
                    title: 'Chương 1',
                    status: 'not_started',
                    createdAt: '',
                    updatedAt: '',
                }
            ],
            createdAt: '',
        };

        refCurrent = activeProject;

        const dbChapters = [
            {
                id: 'chap_1',
                title: 'Chương 1',
                sourceText: 'Câu 1: 万剑归宗! Câu 2: 萬劍歸宗!',
                rawTranslation: '',
                polishedTranslation: '',
                paragraphs: [],
                translatedLines: [],
                status: 'not_started' as const,
                createdAt: '',
                updatedAt: '',
            }
        ];

        const getChaptersMock = vi.mocked(await import('../../services/db')).getChaptersByProjectFromDB;
        getChaptersMock.mockResolvedValue(dbChapters);

        const saveChapterMock = vi.mocked(await import('../../services/db')).saveChapterToDB;
        saveChapterMock.mockResolvedValue(undefined as any);

        const onUpdateProject = vi.fn();
        const addLog = vi.fn();

        const hook = useGlossaryApply({
            activeProject,
            onUpdateProject,
            applyGlossaryRangeEnabled: false,
            applyGlossaryRangeStart: 1,
            applyGlossaryRangeEnd: 1,
            addLog,
        });

        await hook.handleApplyGlossaryToAllChapters();

        // Verify that saveChapterToDB was called with the updated sourceText
        expect(saveChapterMock).toHaveBeenCalled();
        const updatedChapter = saveChapterMock.mock.calls[0][0];
        expect(updatedChapter.processedSourceText).toBe('Câu 1: Vạn Kiếm Quy Tông! Câu 2: Vạn Kiếm Quy Tông!');
        
        // Verify that onUpdateProject was called
        expect(onUpdateProject).toHaveBeenCalled();
    });

    it('should prioritize longer forms (variants) over shorter forms to prevent partial replacement', async () => {
        const glossary: GlossaryItem[] = [
            {
                id: 'glo_1',
                chinese: '剑',
                pinyin: '',
                variants: ['劍'],
                vietnamese: 'Kiếm',
                type: 'term',
                note: '',
            },
            {
                id: 'glo_2',
                chinese: '万剑归宗',
                pinyin: '',
                variants: ['萬劍歸宗'],
                vietnamese: 'Vạn Kiếm Quy Tông',
                type: 'term',
                note: '',
            }
        ];

        const activeProject: StoryProject = {
            id: 'proj_1',
            title: 'Test Proj',
            author: '',
            genre: '',
            tone: '',
            description: '',
            glossary,
            pendingGlossary: [],
            chapters: [
                {
                    id: 'chap_1',
                    title: 'Chương 1',
                    status: 'not_started',
                    createdAt: '',
                    updatedAt: '',
                }
            ],
            createdAt: '',
        };

        refCurrent = activeProject;

        const dbChapters = [
            {
                id: 'chap_1',
                title: 'Chương 1',
                sourceText: 'Ta dùng 萬劍歸宗!',
                rawTranslation: '',
                polishedTranslation: '',
                paragraphs: [],
                translatedLines: [],
                status: 'not_started' as const,
                createdAt: '',
                updatedAt: '',
            }
        ];

        const getChaptersMock = vi.mocked(await import('../../services/db')).getChaptersByProjectFromDB;
        getChaptersMock.mockResolvedValue(dbChapters);

        const saveChapterMock = vi.mocked(await import('../../services/db')).saveChapterToDB;
        saveChapterMock.mockResolvedValue(undefined as any);

        const onUpdateProject = vi.fn();
        const addLog = vi.fn();

        const hook = useGlossaryApply({
            activeProject,
            onUpdateProject,
            applyGlossaryRangeEnabled: false,
            applyGlossaryRangeStart: 1,
            applyGlossaryRangeEnd: 1,
            addLog,
        });

        await hook.handleApplyGlossaryToAllChapters();

        expect(saveChapterMock).toHaveBeenCalled();
        const updatedChapter = saveChapterMock.mock.calls[0][0];
        expect(updatedChapter.processedSourceText).toBe('Ta dùng Vạn Kiếm Quy Tông!');
    });
});

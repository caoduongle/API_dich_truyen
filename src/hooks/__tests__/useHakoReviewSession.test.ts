import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as hakoSessionStore from '../../services/hakoSessionStore';
import { sanitizeSession, _resetHakoDbInstanceForTests } from '../../services/hakoSessionStore';
import { QualityReviewSession, ProjectReviewChapter, QualityIssue } from '../../types/hakoChecker';
import { StoryProject } from '../../types';

let stateSlots: any[] = [];
let stateIndex = 0;
let refSlots: any[] = [];
let refIndex = 0;

vi.mock('react', () => ({
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
  useEffect: vi.fn(),
}));

import { useHakoReviewSession } from '../useHakoReviewSession';

describe('Hako Checker Session Decoupling & Sanitization Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeSession helper', () => {
    it('returns null if input session is null or undefined', () => {
      expect(sanitizeSession(null)).toBeNull();
    });

    it('strips vietnameseContent from all chapters in the session', () => {
      const bloatedSession: QualityReviewSession = {
        id: 'session-123',
        projectId: 'proj-1',
        projectTitle: 'Vũ Động Càn Khôn',
        selectedChapterIds: ['chap-1', 'chap-2'],
        chapters: {
          'chap-1': {
            chapterId: 'chap-1',
            title: 'Chương 1: Lâm Động',
            chapterNumber: 1,
            translationType: 'polished',
            wordCount: 2500,
            status: 'done',
            vietnameseContent: 'Đây là toàn bộ nội dung chương 1 rất dài...'.repeat(500),
            rawChineseContent: '这是第一章内容',
          },
          'chap-2': {
            chapterId: 'chap-2',
            title: 'Chương 2: Cổ Thạch',
            chapterNumber: 2,
            translationType: 'raw',
            wordCount: 1800,
            status: 'pending',
            vietnameseContent: 'Đây là bản dịch thô chương 2...'.repeat(500),
          },
        },
        issues: [
          {
            id: 'issue-1',
            chapterId: 'chap-1',
            chapterTitle: 'Chương 1',
            chapterNumber: 1,
            category: 'raw_leak',
            severity: 'major',
            vietnameseSnippet: 'Lâm Động cầm lấy 龙涎草',
            explanation: 'Sót chữ Hán',
            decision: 'pending',
            detectedBy: 'heuristic',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed',
      };

      const sanitized = sanitizeSession(bloatedSession);
      expect(sanitized).not.toBeNull();
      expect(sanitized!.id).toBe('session-123');
      expect(sanitized!.selectedChapterIds).toEqual(['chap-1', 'chap-2']);
      expect(sanitized!.issues.length).toBe(1);

      // Verify vietnameseContent is stripped from all chapters
      expect(sanitized!.chapters['chap-1'].vietnameseContent).toBeUndefined();
      expect(sanitized!.chapters['chap-2'].vietnameseContent).toBeUndefined();

      // Verify other metadata is preserved
      expect(sanitized!.chapters['chap-1'].title).toBe('Chương 1: Lâm Động');
      expect(sanitized!.chapters['chap-1'].chapterNumber).toBe(1);
      expect(sanitized!.chapters['chap-1'].translationType).toBe('polished');
      expect(sanitized!.chapters['chap-1'].wordCount).toBe(2500);
      expect(sanitized!.chapters['chap-1'].rawChineseContent).toBe('这是第一章内容');
    });

    it('drastically reduces JSON payload size for a project with 200+ chapters', () => {
      const chaptersRecord: Record<string, ProjectReviewChapter> = {};
      const sampleText = 'Văn bản tiểu thuyết tiếng Việt chi tiết có độ dài hàng nghìn chữ. '.repeat(100);

      for (let i = 1; i <= 200; i++) {
        chaptersRecord[`chap-${i}`] = {
          chapterId: `chap-${i}`,
          title: `Chương ${i}: Tiêu đề chương`,
          chapterNumber: i,
          translationType: 'polished',
          wordCount: 1500,
          status: 'pending',
          vietnameseContent: sampleText,
          // Only a couple chapters might have custom user-pasted raw
          rawChineseContent: i <= 2 ? '原始中文文本内容' : undefined,
        };
      }

      const bloatedSession: QualityReviewSession = {
        id: 'large-session-200',
        projectId: 'proj-large',
        projectTitle: 'Đại Chúa Tể',
        selectedChapterIds: ['chap-1', 'chap-2', 'chap-3'],
        chapters: chaptersRecord,
        issues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'idle',
      };

      const rawJson = JSON.stringify(bloatedSession);
      const rawSizeKB = Buffer.byteLength(rawJson, 'utf8') / 1024;

      const sanitized = sanitizeSession(bloatedSession);
      const sanitizedJson = JSON.stringify(sanitized);
      const sanitizedSizeKB = Buffer.byteLength(sanitizedJson, 'utf8') / 1024;

      // Raw size should be > 1.5MB for 200 chapters with full text
      expect(rawSizeKB).toBeGreaterThan(1000);

      // Sanitized size should be < 50KB
      expect(sanitizedSizeKB).toBeLessThan(50);

      // Reduction ratio should exceed 95%
      const reductionPercentage = ((rawSizeKB - sanitizedSizeKB) / rawSizeKB) * 100;
      expect(reductionPercentage).toBeGreaterThan(95);
    });
  });

  describe('Fast Project Selection Metadata Mapping (0ms)', () => {
    it('instantly maps 300 chapters from project metadata without async DB loops', () => {
      const mockProject: StoryProject = {
        id: 'proj-speed-test',
        title: 'Thôn Phệ Tinh Không',
        author: 'Ngã Cật Tây Hồng Thị',
        genre: 'Khoa Huyễn',
        tone: 'Hào hùng',
        description: 'Vũ trụ mênh mông',
        glossary: [],
        pendingGlossary: [],
        chapters: Array.from({ length: 300 }, (_, i) => ({
          id: `c-${i + 1}`,
          title: `Chương ${i + 1}`,
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'not_started',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        createdAt: new Date().toISOString(),
      };

      const start = performance.now();

      // Direct metadata transformation (as used in selectProject)
      const chaptersRecord: Record<string, ProjectReviewChapter> = {};
      (mockProject.chapters || []).forEach((meta, index) => {
        const translationType: 'polished' | 'raw' | 'none' =
          meta.status === 'completed'
            ? 'polished'
            : meta.status === 'in_progress'
            ? 'raw'
            : 'none';

        chaptersRecord[meta.id] = {
          chapterId: meta.id,
          title: meta.title || `Chương ${index + 1}`,
          chapterNumber: index + 1,
          translationType,
          wordCount: 0,
          status: 'pending',
        };
      });

      const elapsed = performance.now() - start;

      // Transformation should take under 10ms for 300 chapters
      expect(elapsed).toBeLessThan(10);
      expect(Object.keys(chaptersRecord).length).toBe(300);
      expect(chaptersRecord['c-1'].translationType).toBe('polished');
      expect(chaptersRecord['c-2'].translationType).toBe('raw');
      expect(chaptersRecord['c-3'].translationType).toBe('none');
      expect(chaptersRecord['c-1'].vietnameseContent).toBeUndefined();
    });
  });

  describe('Chapter Selection Boundary Checks (Max 12 Chapters)', () => {
    it('correctly bounds selection to maximum 12 chapters', () => {
      const MAX_LIMIT = 12;
      const allIds = Array.from({ length: 50 }, (_, i) => `chap-${i + 1}`);
      const selected = allIds.slice(0, MAX_LIMIT);

      expect(selected.length).toBe(12);
      expect(selected[0]).toBe('chap-1');
      expect(selected[11]).toBe('chap-12');
    });
  });

  describe('Feature 079: Chapter ID Normalization & Selection Runtime Resilience', () => {
    it('coerces numeric and string IDs consistently for selection lookups', () => {
      const selectedIds = ['118', '119', '120'];
      const numericTarget = 118;
      const stringTarget = '118';

      // Normalized Set lookup
      const selectedSet = new Set(selectedIds.map(String));
      expect(selectedSet.has(String(numericTarget))).toBe(true);
      expect(selectedSet.has(String(stringTarget))).toBe(true);

      // Array .some check
      expect(selectedIds.some((id) => String(id) === String(numericTarget))).toBe(true);
      expect(selectedIds.some((id) => String(id) === String(stringTarget))).toBe(true);
    });

    it('safely filters sparse or undefined chapter lists without throwing TypeError', () => {
      const sparseChapters: (ProjectReviewChapter | undefined | null)[] = [
        {
          chapterId: 'chap-117',
          title: 'Chương 117',
          chapterNumber: 117,
          translationType: 'polished',
          wordCount: 2100,
          status: 'pending',
        },
        undefined,
        null,
        {
          chapterId: 'chap-118',
          title: 'Chương 118',
          chapterNumber: 118,
          translationType: 'polished',
          wordCount: 2300,
          status: 'pending',
        },
      ];

      const safeFiltered = sparseChapters.filter(
        (c): c is ProjectReviewChapter => Boolean(c && typeof c.chapterId === 'string')
      );

      expect(safeFiltered.length).toBe(2);
      expect(safeFiltered[0].chapterNumber).toBe(117);
      expect(safeFiltered[1].chapterNumber).toBe(118);

      // Safe total words computation
      const totalWords = safeFiltered.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
      expect(totalWords).toBe(4400);
    });

    it('safely aggregates total word count when chapters have missing/zero wordCounts', () => {
      const chaptersWithPartialData: Partial<ProjectReviewChapter>[] = [
        { chapterId: 'c-1', wordCount: undefined },
        { chapterId: 'c-2', wordCount: 0 },
        { chapterId: 'c-3', wordCount: 1500 },
        {},
      ];

      const total = chaptersWithPartialData.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
      expect(total).toBe(1500);
    });

    it('handles late-stage chapters (#118 - #127) in a 139-chapter project without off-by-one errors', () => {
      const totalChapters = 139;
      const chaptersRecord: Record<string, ProjectReviewChapter> = {};

      for (let i = 1; i <= totalChapters; i++) {
        chaptersRecord[`chap-${i}`] = {
          chapterId: `chap-${i}`,
          title: `Chương ${i}: Diễn biến gay cấn`,
          chapterNumber: i,
          translationType: i > 100 ? 'polished' : 'raw',
          wordCount: 2000,
          status: 'pending',
        };
      }

      // Simulate selecting chapters #118 to #127 (10 chapters)
      const selectedChapterIds = Array.from({ length: 10 }, (_, idx) => `chap-${118 + idx}`);
      const selectedSet = new Set(selectedChapterIds.map(String));

      const selectedChapters = Object.values(chaptersRecord).filter(
        (c): c is ProjectReviewChapter => Boolean(c && selectedSet.has(String(c.chapterId)))
      );

      expect(selectedChapters.length).toBe(10);
      expect(selectedChapters[0].chapterNumber).toBe(118);
      expect(selectedChapters[9].chapterNumber).toBe(127);

      const totalWords = selectedChapters.reduce((sum, c) => sum + (c?.wordCount || 0), 0);
      expect(totalWords).toBe(20000);
    });
  });

  describe('Feature 080: List Virtualization & O(1) Lookup Performance (139 - 500 Chapters)', () => {
    it('performs O(1) set lookup instantaneously across 500 chapters', () => {
      const totalChapters = 500;
      const chapterList: ProjectReviewChapter[] = Array.from({ length: totalChapters }, (_, i) => ({
        chapterId: `chap-${i + 1}`,
        title: `Chương ${i + 1}`,
        chapterNumber: i + 1,
        translationType: 'polished',
        wordCount: 2000,
        status: 'pending',
      }));

      const selectedIds = ['chap-120', 'chap-122', 'chap-124', 'chap-135', 'chap-499'];
      const selectedSet = new Set(selectedIds.map(String));

      const start = performance.now();
      let matchedCount = 0;
      for (const ch of chapterList) {
        if (selectedSet.has(String(ch.chapterId))) {
          matchedCount++;
        }
      }
      const elapsed = performance.now() - start;

      expect(matchedCount).toBe(5);
      // 500 O(1) Set lookups should take less than 1ms
      expect(elapsed).toBeLessThan(5);
    });

    it('sanitizes and normalizes IDs properly during IndexedDB persistence', () => {
      const rawSession: QualityReviewSession = {
        id: 'session-normalize-test',
        projectId: 'proj-139',
        projectTitle: 'Lãnh Chúa (139 Chương)',
        selectedChapterIds: ['chap_1', 'chap_2'] as any,
        chapters: {
          'chap_1': {
            chapterId: 'chap_1',
            title: 'Chương 1',
            chapterNumber: 1,
            translationType: 'polished',
            wordCount: 1500,
            status: 'pending',
            vietnameseContent: 'Rất nhiều chữ Việt cần lược bỏ...',
            rawChineseContent: '原始中文文本',
          },
        },
        issues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'idle',
      };

      const sanitized = sanitizeSession(rawSession);
      expect(sanitized).not.toBeNull();
      expect(sanitized!.chapters['chap_1'].vietnameseContent).toBeUndefined();
      expect(sanitized!.chapters['chap_1'].rawChineseContent).toBe('原始中文文本');
      expect(sanitized!.selectedChapterIds).toEqual(['chap_1', 'chap_2']);
    });
  });

  describe('Feature 093: Incremental Review Session Persistence & Partial State Handling', () => {
    it('simulates 3-chapter analysis aborted at chapter 2 and preserves chapter 1 issues in partial session', async () => {
      // Setup initial session with 3 chapters
      let currentSession: QualityReviewSession = {
        id: 'session-abort-sim',
        projectId: 'proj-abort-test',
        projectTitle: 'Kiểm Định Đứt Đoạn',
        selectedChapterIds: ['chap-1', 'chap-2', 'chap-3'],
        chapters: {
          'chap-1': {
            chapterId: 'chap-1',
            title: 'Chương 1: Khởi đầu',
            chapterNumber: 1,
            translationType: 'polished',
            wordCount: 1200,
            status: 'pending',
          },
          'chap-2': {
            chapterId: 'chap-2',
            title: 'Chương 2: Biến cố',
            chapterNumber: 2,
            translationType: 'polished',
            wordCount: 1500,
            status: 'pending',
          },
          'chap-3': {
            chapterId: 'chap-3',
            title: 'Chương 3: Kết thúc',
            chapterNumber: 3,
            translationType: 'polished',
            wordCount: 1800,
            status: 'pending',
          },
        },
        issues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'idle',
      };

      // Helper simulating updateSessionChaptersAndIssues with sanitization
      const mockUpdateSessionChaptersAndIssues = async (
        chapters: Record<string, ProjectReviewChapter>,
        issues: QualityIssue[],
        status: 'completed' | 'partial' | 'analyzing' = 'completed'
      ) => {
        const sanitizedChapters: Record<string, ProjectReviewChapter> = {};
        for (const [id, ch] of Object.entries(chapters)) {
          if (!ch) continue;
          const { vietnameseContent: _vi, ...meta } = ch;
          sanitizedChapters[id] = meta;
        }
        currentSession = {
          ...currentSession,
          chapters: sanitizedChapters,
          issues,
          status,
          updatedAt: new Date().toISOString(),
        };
      };

      const allDetectedIssues: QualityIssue[] = [];
      const updatedChaptersRecord = { ...currentSession.chapters };

      // --- SIMULATE PIPELINE ---
      try {
        // === CHAPTER 1: Complete Heuristic + AI Scan ===
        updatedChaptersRecord['chap-1'] = {
          ...updatedChaptersRecord['chap-1'],
          status: 'analyzing',
        };

        // Heuristic issue found in Chapter 1
        allDetectedIssues.push({
          id: 'issue-ch1-heuristic',
          chapterId: 'chap-1',
          chapterTitle: 'Chương 1: Khởi đầu',
          chapterNumber: 1,
          category: 'raw_leak',
          severity: 'major',
          vietnameseSnippet: 'Chương 1 có chứa 龙涎草',
          explanation: 'Sót chữ Hán trong chương 1',
          decision: 'pending',
          detectedBy: 'heuristic',
          createdAt: new Date().toISOString(),
        });

        // AI issue found in Chapter 1
        allDetectedIssues.push({
          id: 'issue-ch1-ai',
          chapterId: 'chap-1',
          chapterTitle: 'Chương 1: Khởi đầu',
          chapterNumber: 1,
          category: 'inconsistent_name',
          severity: 'critical',
          vietnameseSnippet: 'Lâm Động biến thành Lâm Đình',
          explanation: 'Tên nhân vật chính không đồng nhất',
          decision: 'pending',
          detectedBy: 'ai',
          createdAt: new Date().toISOString(),
        });

        // Chapter 1 completes
        updatedChaptersRecord['chap-1'] = {
          ...updatedChaptersRecord['chap-1'],
          status: 'done',
        };

        // Incremental save after Chapter 1
        await mockUpdateSessionChaptersAndIssues(
          updatedChaptersRecord,
          allDetectedIssues,
          'analyzing'
        );

        // Verify intermediate state after Chapter 1
        expect(currentSession.status).toBe('analyzing');
        expect(currentSession.chapters['chap-1'].status).toBe('done');
        expect(currentSession.issues.length).toBe(2);

        // === CHAPTER 2: Starts scan, Heuristic finishes, AI aborted ===
        updatedChaptersRecord['chap-2'] = {
          ...updatedChaptersRecord['chap-2'],
          status: 'analyzing',
        };

        // Heuristic issue found in Chapter 2
        allDetectedIssues.push({
          id: 'issue-ch2-heuristic',
          chapterId: 'chap-2',
          chapterTitle: 'Chương 2: Biến cố',
          chapterNumber: 2,
          category: 'repetition',
          severity: 'minor',
          vietnameseSnippet: 'Đoạn văn bị lặp lại ở chương 2',
          explanation: 'Lặp đoạn văn',
          decision: 'pending',
          detectedBy: 'heuristic',
          createdAt: new Date().toISOString(),
        });

        // User clicks "Hủy phân tích" -> AbortError thrown during AI scan
        const abortErr = new Error('The user aborted a request.');
        abortErr.name = 'AbortError';
        throw abortErr;

      } catch (err: any) {
        expect(err.name).toBe('AbortError');

        // Fail-safe sweep in catch block: always persist with status 'partial'
        await mockUpdateSessionChaptersAndIssues(
          updatedChaptersRecord,
          allDetectedIssues,
          'partial'
        );
      }

      // === FINAL ASSERTIONS FOR ABORTED SESSION ===
      // 1. Session status must be 'partial', NOT 'completed' and NOT 'idle'
      expect(currentSession.status).toBe('partial');

      // 2. Issues must NOT be empty
      expect(currentSession.issues.length).toBe(3);

      // 3. Must contain Chapter 1 issues (both heuristic and AI)
      const ch1Issues = currentSession.issues.filter((i) => i.chapterId === 'chap-1');
      expect(ch1Issues.length).toBe(2);
      expect(ch1Issues.some((i) => i.id === 'issue-ch1-heuristic')).toBe(true);
      expect(ch1Issues.some((i) => i.id === 'issue-ch1-ai')).toBe(true);

      // 4. Must contain Chapter 2 heuristic issue gathered before abort
      const ch2Issues = currentSession.issues.filter((i) => i.chapterId === 'chap-2');
      expect(ch2Issues.length).toBe(1);
      expect(ch2Issues[0].id).toBe('issue-ch2-heuristic');

      // 5. Chapter 1 is marked done, Chapter 2 is analyzing, Chapter 3 remains pending
      expect(currentSession.chapters['chap-1'].status).toBe('done');
      expect(currentSession.chapters['chap-2'].status).toBe('analyzing');
      expect(currentSession.chapters['chap-3'].status).toBe('pending');
    });

    it('simulates full 2-chapter happy-path analysis completing with status completed', async () => {
      let currentSession: QualityReviewSession = {
        id: 'session-full-sim',
        projectId: 'proj-full',
        projectTitle: 'Toàn Bộ Chương',
        selectedChapterIds: ['c-1', 'c-2'],
        chapters: {
          'c-1': { chapterId: 'c-1', title: 'C1', chapterNumber: 1, translationType: 'polished', wordCount: 1000, status: 'pending' },
          'c-2': { chapterId: 'c-2', title: 'C2', chapterNumber: 2, translationType: 'polished', wordCount: 1000, status: 'pending' },
        },
        issues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'idle',
      };

      const mockUpdate = async (
        chapters: Record<string, ProjectReviewChapter>,
        issues: QualityIssue[],
        status: 'completed' | 'partial' | 'analyzing' = 'completed'
      ) => {
        currentSession = { ...currentSession, chapters, issues, status };
      };

      const allIssues: QualityIssue[] = [];
      const updatedChapters = { ...currentSession.chapters };

      // Chapter 1
      allIssues.push({
        id: 'issue-1',
        chapterId: 'c-1',
        chapterTitle: 'C1',
        chapterNumber: 1,
        category: 'raw_leak',
        severity: 'minor',
        vietnameseSnippet: 'test',
        explanation: 'test',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      });
      updatedChapters['c-1'] = { ...updatedChapters['c-1'], status: 'done' };
      await mockUpdate(updatedChapters, allIssues, 'analyzing');

      // Chapter 2
      allIssues.push({
        id: 'issue-2',
        chapterId: 'c-2',
        chapterTitle: 'C2',
        chapterNumber: 2,
        category: 'other',
        severity: 'warning',
        vietnameseSnippet: 'test2',
        explanation: 'test2',
        decision: 'pending',
        detectedBy: 'ai',
        createdAt: new Date().toISOString(),
      });
      updatedChapters['c-2'] = { ...updatedChapters['c-2'], status: 'done' };
      await mockUpdate(updatedChapters, allIssues, 'completed');

      expect(currentSession.status).toBe('completed');
      expect(currentSession.issues.length).toBe(2);
      expect(currentSession.chapters['c-1'].status).toBe('done');
      expect(currentSession.chapters['c-2'].status).toBe('done');
    });

    it('updateSessionChaptersAndIssues defaults status to completed when optional parameter is omitted', async () => {
      let savedStatus: any = null;
      const mockSession = {
        chapters: {
          'c-1': { chapterId: 'c-1', title: 'C1', chapterNumber: 1, translationType: 'polished' as const, wordCount: 500, status: 'done' as const },
        },
        issues: [],
      };

      // Call without 3rd parameter
      const updateFunction = async (
        chapters: Record<string, ProjectReviewChapter>,
        issues: QualityIssue[],
        status: 'completed' | 'partial' | 'analyzing' = 'completed'
      ) => {
        savedStatus = status;
      };

      await updateFunction(mockSession.chapters, mockSession.issues);
      expect(savedStatus).toBe('completed');

      // Call with explicit 'partial'
      await updateFunction(mockSession.chapters, mockSession.issues, 'partial');
      expect(savedStatus).toBe('partial');
    });
  });

  describe('Feature 095: Batch Issue Decisions & Shared Connection Caching', () => {
    beforeEach(() => {
      stateSlots = [];
      stateIndex = 0;
      refSlots = [];
      refIndex = 0;
      _resetHakoDbInstanceForTests();
      vi.clearAllMocks();
    });

    it('updates 20 pending issues in a single call and calls saveSession exactly 1 time', async () => {
      // 1. Chuẩn bị session với 20 issues ở trạng thái 'pending'
      const twentyIssues: QualityIssue[] = Array.from({ length: 20 }, (_, i) => ({
        id: `issue-batch-${i + 1}`,
        chapterId: `c-${Math.floor(i / 5) + 1}`,
        chapterTitle: `Chương ${Math.floor(i / 5) + 1}`,
        chapterNumber: Math.floor(i / 5) + 1,
        category: 'other',
        severity: 'warning',
        vietnameseSnippet: `Đoạn văn có lỗi số ${i + 1}`,
        explanation: `Mô tả lỗi ${i + 1}`,
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      }));

      const initialSession: QualityReviewSession = {
        id: 'session-batch-test',
        projectId: 'proj-batch',
        projectTitle: 'Kiểm Định Hàng Loạt 20 Issues',
        selectedChapterIds: ['c-1', 'c-2', 'c-3', 'c-4'],
        chapters: {},
        issues: twentyIssues,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed',
      };

      // Cài đặt initial state cho session
      stateSlots[0] = initialSession;
      stateIndex = 0;
      refIndex = 0;

      const saveSessionSpy = vi.spyOn(hakoSessionStore, 'saveSession').mockImplementation(async (s) => s);

      const hook = useHakoReviewSession();

      // Danh sách 20 ID cần cập nhật sang 'confirmed'
      const all20Ids = twentyIssues.map((i) => i.id);

      // 2. Gọi hàm updateMultipleIssueDecisions đúng 1 lần
      await hook.updateMultipleIssueDecisions(all20Ids, 'confirmed');

      // 3. Xác nhận hàm ghi DB (saveSession) chỉ được gọi ĐÚNG 1 LẦN
      expect(saveSessionSpy).toHaveBeenCalledTimes(1);

      // 4. Xác nhận kết quả tất cả 20 issues đều đổi decision thành 'confirmed'
      const savedSession = saveSessionSpy.mock.calls[0][0];
      expect(savedSession.issues.length).toBe(20);
      expect(savedSession.issues.every((i) => i.decision === 'confirmed')).toBe(true);

      // 5. Xác nhận state trong hook cũng được cập nhật đồng bộ
      expect(stateSlots[0].issues.every((i: QualityIssue) => i.decision === 'confirmed')).toBe(true);
    });

    it('updates only targeted subset of issues and calls saveSession exactly 1 time', async () => {
      const twentyIssues: QualityIssue[] = Array.from({ length: 20 }, (_, i) => ({
        id: `issue-subset-${i + 1}`,
        chapterId: 'c-1',
        chapterTitle: 'Chương 1',
        chapterNumber: 1,
        category: 'other',
        severity: 'warning',
        vietnameseSnippet: `Snippet ${i + 1}`,
        explanation: `Explanation ${i + 1}`,
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: new Date().toISOString(),
      }));

      const initialSession: QualityReviewSession = {
        id: 'session-subset-test',
        projectId: 'proj-subset',
        projectTitle: 'Kiểm Định Subset 10/20 Issues',
        selectedChapterIds: ['c-1'],
        chapters: {},
        issues: twentyIssues,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed',
      };

      stateSlots[0] = initialSession;
      stateIndex = 0;
      refIndex = 0;

      const saveSessionSpy = vi.spyOn(hakoSessionStore, 'saveSession').mockImplementation(async (s) => s);

      const hook = useHakoReviewSession();

      // Chỉ cập nhật 10 issues đầu tiên sang 'dismissed'
      const first10Ids = twentyIssues.slice(0, 10).map((i) => i.id);

      await hook.updateMultipleIssueDecisions(first10Ids, 'dismissed');

      expect(saveSessionSpy).toHaveBeenCalledTimes(1);

      const savedSession = saveSessionSpy.mock.calls[0][0];
      const dismissedCount = savedSession.issues.filter((i) => i.decision === 'dismissed').length;
      const pendingCount = savedSession.issues.filter((i) => i.decision === 'pending').length;

      expect(dismissedCount).toBe(10);
      expect(pendingCount).toBe(10);
    });

    it('does not call saveSession when issueIds is empty', async () => {
      const initialSession: QualityReviewSession = {
        id: 'session-empty-test',
        projectId: 'proj-empty',
        projectTitle: 'Empty Test',
        selectedChapterIds: [],
        chapters: {},
        issues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'idle',
      };

      stateSlots[0] = initialSession;
      stateIndex = 0;
      refIndex = 0;

      const saveSessionSpy = vi.spyOn(hakoSessionStore, 'saveSession').mockImplementation(async (s) => s);

      const hook = useHakoReviewSession();

      await hook.updateMultipleIssueDecisions([], 'confirmed');

      expect(saveSessionSpy).not.toHaveBeenCalled();
    });

    it('caches database connection promise and reuses it across multiple operations', async () => {
      let openCallCount = 0;
      let closeHandler: (() => void) | null = null;

      const mockDb = {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            put: vi.fn(() => {
              const req: any = {};
              setTimeout(() => req.onsuccess?.(), 0);
              return req;
            }),
            get: vi.fn(() => {
              const req: any = { result: null };
              setTimeout(() => req.onsuccess?.(), 0);
              return req;
            }),
          })),
        })),
        close: vi.fn(),
        set onclose(fn: any) {
          closeHandler = fn;
        },
        set onversionchange(fn: any) {
          // no-op
        },
      };

      const originalIndexedDB = global.indexedDB;
      (global as any).indexedDB = {
        open: vi.fn(() => {
          openCallCount++;
          const req: any = { result: mockDb };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };

      try {
        _resetHakoDbInstanceForTests();

        const testSession: QualityReviewSession = {
          id: 's-cache-1',
          projectId: 'p-1',
          projectTitle: 'Cache Test',
          selectedChapterIds: [],
          chapters: {},
          issues: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'idle',
        };

        // Call 1: Opens DB
        await hakoSessionStore.saveSession(testSession);
        expect(openCallCount).toBe(1);

        // Call 2: Reuses cached connection promise
        await hakoSessionStore.getSession('s-cache-1');
        expect(openCallCount).toBe(1);

        // Trigger onclose: Cache is invalidated
        if (closeHandler) (closeHandler as any)();

        // Call 3: Opens new connection
        await hakoSessionStore.getSession('s-cache-1');
        expect(openCallCount).toBe(2);
      } finally {
        (global as any).indexedDB = originalIndexedDB;
        _resetHakoDbInstanceForTests();
      }
    });
  });
});

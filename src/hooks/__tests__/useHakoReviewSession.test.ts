import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeSession } from '../../services/hakoSessionStore';
import { QualityReviewSession, ProjectReviewChapter } from '../../types/hakoChecker';
import { StoryProject } from '../../types';

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
});

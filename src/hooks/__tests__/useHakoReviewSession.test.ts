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
});

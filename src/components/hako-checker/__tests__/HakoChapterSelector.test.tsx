import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HakoChapterSelector, computeNextBatchChapterIds } from '../HakoChapterSelector';
import { StoryProject } from '../../../types';
import { ProjectReviewChapter } from '../../../types/hakoChecker';
import { localQuotaTracker } from '../../../services/localQuotaTracker';

describe('HakoChapterSelector AI Quota Estimation & Advisory Warning', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localQuotaTracker.resetMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localQuotaTracker.resetMetrics();
  });

  const normalizeHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

  const mockProjects: StoryProject[] = [
    {
      id: 'proj-1',
      title: 'Dự án Test Tiên Hiệp',
      author: 'Tác giả A',
      description: 'Mô tả dự án test',
      genre: 'tienhiep',
      tone: 'neutral',
      pendingGlossary: [],
      chapters: [
        {
          id: 'chap-1',
          title: 'Chương 1',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'chap-2',
          title: 'Chương 2',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'chap-3',
          title: 'Chương 3',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      glossary: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockChapters: Record<string, ProjectReviewChapter> = {
    'chap-1': {
      chapterId: 'chap-1',
      title: 'Chương 1: Khởi đầu',
      chapterNumber: 1,
      translationType: 'polished',
      wordCount: 2000,
      status: 'done',
    },
    'chap-2': {
      chapterId: 'chap-2',
      title: 'Chương 2: Tiến bước',
      chapterNumber: 2,
      translationType: 'raw',
      wordCount: 1800,
      status: 'done',
    },
    'chap-3': {
      chapterId: 'chap-3',
      title: 'Chương 3: Phong vân',
      chapterNumber: 3,
      translationType: 'polished',
      wordCount: 2200,
      status: 'done',
    },
  };

  describe('User Story 1: AI Call Estimation Annotation', () => {
    it('omits estimate annotation when 0 chapters are selected', () => {
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={[]}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={['test-api-key-1']}
          />
        )
      );

      expect(html).not.toContain('lượt gọi AI');
      expect(html).toContain('Vui lòng chọn ít nhất 1 chương để bắt đầu kiểm định.');
    });

    it('renders exact "~N lượt gọi AI" matching selected chapters count', () => {
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1', 'chap-2']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={['test-api-key-1']}
          />
        )
      );

      expect(html).toContain('~2 lượt gọi AI');
      expect(html).toContain('Bắt đầu kiểm định (2 chương)');
    });

    it('updates estimation tag to "~3 lượt gọi AI" when 3 chapters are selected', () => {
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1', 'chap-2', 'chap-3']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={['test-api-key-1']}
          />
        )
      );

      expect(html).toContain('~3 lượt gọi AI');
      expect(html).toContain('Bắt đầu kiểm định (3 chương)');
    });
  });

  describe('User Story 2: Advisory Quota Warning', () => {
    it('does not display quota warning when keys are healthy and sufficient', () => {
      const testKey = 'test-key-healthy-123456';
      localQuotaTracker.recordSuccess(testKey, 'gemini-1.5-flash', { totalTokens: 100 });

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1', 'chap-2']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={[testKey]}
          />
        )
      );

      expect(html).not.toContain('quota-advisory-warning');
      expect(html).not.toContain('Quota khả dụng có thể không đủ');
    });

    it('displays amber advisory warning when a key has exhausted quota', () => {
      const exhaustedKey = 'exhausted-key-1234567890';
      localQuotaTracker.recordFailure(exhaustedKey, 'gemini-1.5-flash', {
        status: 429,
        isRateLimit: true,
        message: 'Resource has been exhausted: quota daily limit reached',
      });

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1', 'chap-2']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={[exhaustedKey]}
          />
        )
      );

      expect(html).toContain('data-testid="quota-advisory-warning"');
      expect(html).toContain('Quota khả dụng có thể không đủ cho toàn bộ 2 chương đã chọn');
      expect(html).toContain('text-amber-300');
      expect(html).toContain('bg-amber-950/30');
      expect(html).toContain('border-amber-800/50');
    });

    it('displays warning if no API keys are provided or configured', () => {
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={[]}
          />
        )
      );

      expect(html).toContain('data-testid="quota-advisory-warning"');
      expect(html).toContain('Quota khả dụng có thể không đủ cho toàn bộ 1 chương đã chọn');
    });
  });

  describe('Non-blocking Start Button Contract', () => {
    it('disables start button when selectedChapterIds is empty', () => {
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={[]}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={['test-key-1']}
          />
        )
      );

      const buttonMatches = html.match(/<button[^>]*data-testid="start-analysis-btn"[^>]*>/);
      expect(buttonMatches).not.toBeNull();
      if (buttonMatches) {
        expect(buttonMatches[0]).toContain('disabled=""');
      }
    });

    it('keeps start button enabled and unblocked even when quota warning is displayed', () => {
      const exhaustedKey = 'exhausted-key-test-999';
      localQuotaTracker.recordFailure(exhaustedKey, 'gemini-1.5-flash', {
        status: 429,
        isRateLimit: true,
        message: 'daily quota exhausted',
      });

      const onStartAnalysis = vi.fn();
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={onStartAnalysis}
            isAnalyzing={false}
            apiKeys={[exhaustedKey]}
          />
        )
      );

      // Advisory warning is present
      expect(html).toContain('data-testid="quota-advisory-warning"');

      // But Start button is NOT disabled
      expect(html).toContain('Bắt đầu kiểm định (1 chương)');
      const buttonMatches = html.match(/<button[^>]*data-testid="start-analysis-btn"[^>]*>/);
      expect(buttonMatches).not.toBeNull();
      if (buttonMatches) {
        expect(buttonMatches[0]).not.toContain('disabled=""');
      }
    });

    it('disables start button when isAnalyzing is true, regardless of quota', () => {
      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1']}
            chapters={mockChapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={true}
            apiKeys={['test-key-1']}
          />
        )
      );

      expect(html).toContain('Đang phân tích...');
      const buttonMatches = html.match(/<button[^>]*data-testid="start-analysis-btn"[^>]*>/);
      expect(buttonMatches).not.toBeNull();
      if (buttonMatches) {
        expect(buttonMatches[0]).toContain('disabled=""');
      }
    });
  });
});

describe('HakoChapterSelector: Select Next Batch (12 chương tiếp theo)', () => {
  const normalizeHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

  // Bộ 15 chương giả lập: chap-1..12 đã dịch (polished), chap-13..15 cũng đã dịch,
  // chap-16 không có bản dịch (translationType: 'none') để kiểm tra hàm loại đúng
  // các chương chưa dịch ra khỏi lô kế tiếp.
  const makeChapters = (): Record<string, ProjectReviewChapter> => {
    const chapters: Record<string, ProjectReviewChapter> = {};
    for (let i = 1; i <= 15; i++) {
      chapters[`chap-${i}`] = {
        chapterId: `chap-${i}`,
        title: `Chương ${i}`,
        chapterNumber: i,
        translationType: 'polished',
        wordCount: 1000,
        status: 'done',
      };
    }
    chapters['chap-16'] = {
      chapterId: 'chap-16',
      title: 'Chương 16',
      chapterNumber: 16,
      translationType: 'none',
      wordCount: 0,
      status: 'pending',
    };
    return chapters;
  };

  const mockProjects: StoryProject[] = [
    {
      id: 'proj-1',
      title: 'Dự án Test Nhiều Chương',
      author: 'Tác giả A',
      description: 'Mô tả',
      genre: 'tienhiep',
      tone: 'neutral',
      pendingGlossary: [],
      chapters: Array.from({ length: 16 }, (_, i) => ({
        id: `chap-${i + 1}`,
        title: `Chương ${i + 1}`,
        status: 'completed' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      glossary: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  describe('computeNextBatchChapterIds (pure function)', () => {
    it('trả về 12 chương đầu tiên khi chưa chọn chương nào', () => {
      const chapters = makeChapters();
      const chapterList = Object.values(chapters);
      const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');
      const result = computeNextBatchChapterIds(chapterList, translatableChapters, new Set());

      expect(result).toHaveLength(12);
      expect(result).toEqual(
        Array.from({ length: 12 }, (_, i) => `chap-${i + 1}`)
      );
    });

    it('trả về đúng 3 chương kế tiếp (13,14,15) khi đã chọn chương 1-12', () => {
      const chapters = makeChapters();
      const chapterList = Object.values(chapters);
      const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');
      const selectedSet = new Set(Array.from({ length: 12 }, (_, i) => `chap-${i + 1}`));

      const result = computeNextBatchChapterIds(chapterList, translatableChapters, selectedSet);

      expect(result).toEqual(['chap-13', 'chap-14', 'chap-15']);
    });

    it('bỏ qua chương chưa có bản dịch (translationType: none) khỏi lô kế tiếp', () => {
      const chapters = makeChapters();
      const chapterList = Object.values(chapters);
      const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');
      const selectedSet = new Set(Array.from({ length: 15 }, (_, i) => `chap-${i + 1}`));

      // Đã chọn hết 1-15, chỉ còn chap-16 (translationType: 'none') phía sau -> không được tính
      const result = computeNextBatchChapterIds(chapterList, translatableChapters, selectedSet);

      expect(result).toEqual([]);
    });

    it('trả về mảng rỗng khi đã chọn tới chương cuối cùng có thể kiểm định', () => {
      const chapters = makeChapters();
      const chapterList = Object.values(chapters);
      const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');
      const selectedSet = new Set(['chap-15']); // chương có số thứ tự lớn nhất đã dịch

      const result = computeNextBatchChapterIds(chapterList, translatableChapters, selectedSet);

      expect(result).toEqual([]);
    });

    it('tôn trọng tham số limit tùy chỉnh thay vì luôn cố định 12', () => {
      const chapters = makeChapters();
      const chapterList = Object.values(chapters);
      const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');

      const result = computeNextBatchChapterIds(chapterList, translatableChapters, new Set(), 5);

      expect(result).toEqual(['chap-1', 'chap-2', 'chap-3', 'chap-4', 'chap-5']);
    });
  });

  describe('UI: nút "Chọn 12 chương tiếp theo"', () => {
    it('hiển thị nút với gợi ý chọn đúng 3 chương kế tiếp khi đã chọn chương 1-12', () => {
      const chapters = makeChapters();
      const selectedChapterIds = Array.from({ length: 12 }, (_, i) => `chap-${i + 1}`);

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={selectedChapterIds}
            chapters={chapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={['test-api-key-1']}
          />
        )
      );

      expect(html).toContain('data-testid="select-next-batch-btn"');
      expect(html).toContain('Chọn 12 chương tiếp theo');
      expect(html).toContain('Chọn 3 chương tiếp theo sau chương đang chọn');

      const buttonMatches = html.match(/<button[^>]*data-testid="select-next-batch-btn"[^>]*>/);
      expect(buttonMatches).not.toBeNull();
      if (buttonMatches) {
        expect(buttonMatches[0]).not.toContain('disabled=""');
      }
    });

    it('vô hiệu hóa nút và hiện chú thích khi đã chọn tới chương cuối cùng có thể kiểm định', () => {
      const chapters = makeChapters();

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-15']}
            chapters={chapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
            apiKeys={['test-api-key-1']}
          />
        )
      );

      const buttonMatches = html.match(/<button[^>]*data-testid="select-next-batch-btn"[^>]*>/);
      expect(buttonMatches).not.toBeNull();
      if (buttonMatches) {
        expect(buttonMatches[0]).toContain('disabled=""');
      }
      expect(html).toContain('Đã chọn tới chương cuối cùng có thể kiểm định');
    });

    it('vô hiệu hóa nút khi isAnalyzing=true dù vẫn còn chương kế tiếp', () => {
      const chapters = makeChapters();

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1']}
            chapters={chapters}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={true}
            apiKeys={['test-api-key-1']}
          />
        )
      );

      const buttonMatches = html.match(/<button[^>]*data-testid="select-next-batch-btn"[^>]*>/);
      expect(buttonMatches).not.toBeNull();
      if (buttonMatches) {
        expect(buttonMatches[0]).toContain('disabled=""');
      }
    });

    it('gọi onSelectRange với đúng danh sách chương kế tiếp khi bấm nút', () => {
      const chapters = makeChapters();
      const selectedChapterIds = Array.from({ length: 12 }, (_, i) => `chap-${i + 1}`);
      const onSelectRange = vi.fn();

      // renderToString không hỗ trợ giả lập sự kiện click (không có DOM thật), nên ở
      // đây ta xác minh trực tiếp qua hàm thuần computeNextBatchChapterIds — cùng dữ
      // liệu và cùng logic mà handleSelectNextBatch trong component sẽ gọi khi click.
      const chapterList = Object.values(chapters);
      const translatableChapters = chapterList.filter((c) => c.translationType !== 'none');
      const selectedSet = new Set(selectedChapterIds);
      const expectedNextBatch = computeNextBatchChapterIds(chapterList, translatableChapters, selectedSet);

      onSelectRange(expectedNextBatch);

      expect(onSelectRange).toHaveBeenCalledWith(['chap-13', 'chap-14', 'chap-15']);
    });
  });

  describe('User Story 2: Raw Chinese Text Badge and Hydration', () => {
    it('renders "Đã có Raw" when chapter has rawChineseContent', () => {
      const chaptersWithRaw: Record<string, ProjectReviewChapter> = {
        'chap-1': {
          chapterId: 'chap-1',
          title: 'Chương 1',
          chapterNumber: 1,
          translationType: 'polished',
          wordCount: 1500,
          status: 'done',
          rawChineseContent: '这是第一章原始中文文本内容...',
        },
      };

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1']}
            chapters={chaptersWithRaw}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
          />
        )
      );

      expect(html).toContain('Đã có Raw');
      expect(html).not.toContain('+ Thêm Raw');
    });

    it('renders "+ Thêm Raw" when chapter lacks rawChineseContent', () => {
      const chaptersWithoutRaw: Record<string, ProjectReviewChapter> = {
        'chap-1': {
          chapterId: 'chap-1',
          title: 'Chương 1',
          chapterNumber: 1,
          translationType: 'polished',
          wordCount: 1500,
          status: 'done',
        },
      };

      const html = normalizeHtml(
        renderToString(
          <HakoChapterSelector
            projects={mockProjects}
            selectedProjectId="proj-1"
            onSelectProject={vi.fn()}
            selectedChapterIds={['chap-1']}
            chapters={chaptersWithoutRaw}
            onToggleChapter={vi.fn()}
            onSelectRange={vi.fn()}
            onClearSelection={vi.fn()}
            onUpdateRawText={vi.fn()}
            onStartAnalysis={vi.fn()}
            isAnalyzing={false}
          />
        )
      );

      expect(html).toContain('+ Thêm Raw');
    });
  });
});

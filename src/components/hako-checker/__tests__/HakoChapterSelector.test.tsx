import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HakoChapterSelector } from '../HakoChapterSelector';
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

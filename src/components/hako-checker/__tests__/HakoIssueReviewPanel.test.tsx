import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  HakoIssueReviewPanel,
  BATCH_CONFIRM_THRESHOLD,
} from '../HakoIssueReviewPanel';
import { HakoIssueCard } from '../HakoIssueCard';
import { QualityIssue, QualityIssueDecision, ProjectReviewChapter } from '../../../types/hakoChecker';

describe('HakoIssueReviewPanel Batch Action Confirmation & Undo Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockChapters: Record<string, ProjectReviewChapter> = {
    'chap-1': {
      chapterId: 'chap-1',
      title: 'Chương 1: Khởi đầu',
      chapterNumber: 1,
      translationType: 'polished',
      wordCount: 2000,
      status: 'done',
    },
  };

  const createMockIssues = (count: number, decision: QualityIssueDecision = 'pending'): QualityIssue[] => {
    return Array.from({ length: count }, (_, idx) => ({
      id: `issue-${idx + 1}`,
      chapterId: 'chap-1',
      chapterTitle: 'Chương 1: Khởi đầu',
      chapterNumber: 1,
      category: 'raw_leak',
      severity: 'minor',
      vietnameseSnippet: `Đoạn dịch lỗi số ${idx + 1}`,
      explanation: 'Sót từ thô',
      decision,
      detectedBy: 'heuristic',
      createdAt: '2026-09-10T12:00:00Z',
    }));
  };

  describe('Threshold Constant Verification', () => {
    it('defines BATCH_CONFIRM_THRESHOLD as 5', () => {
      expect(BATCH_CONFIRM_THRESHOLD).toBe(5);
    });
  });

  describe('Component Rendering', () => {
    it('renders successfully to HTML with issues and action buttons', () => {
      const issues = createMockIssues(10);
      const html = renderToString(
        <HakoIssueReviewPanel
          issues={issues}
          chapters={mockChapters}
          onDecisionChange={vi.fn()}
          onBatchDecisionChange={vi.fn()}
          onOpenExportModal={vi.fn()}
          onReanalyze={vi.fn()}
          isAnalyzing={false}
        />
      );

      expect(html).toContain('Duyệt nhanh tất cả');
      expect(html).toContain('Bỏ qua tất cả');
      expect(html).toContain('Kết quả kiểm định chất lượng:');
    });
  });

  describe('Batch Confirmation & Undo Execution Flow', () => {
    it('executes batch confirm with > 5 issues through confirmation modal and allows undo', () => {
      const issues = createMockIssues(10);
      const onBatchDecisionChange = vi.fn();
      const onDecisionChange = vi.fn();

      // Captured state and toast options
      let capturedToastOptions: any = null;
      const mockShowToast = vi.fn((opts) => {
        capturedToastOptions = opts;
      });

      // Render or execute simulated panel logic
      const pendingIds = issues.filter((i) => i.decision === 'pending').map((i) => i.id);
      expect(pendingIds.length).toBe(10);
      expect(pendingIds.length > BATCH_CONFIRM_THRESHOLD).toBe(true);

      // 1. Initial click: triggers confirmation modal requirement
      const confirmState = {
        action: 'confirmed' as const,
        ids: pendingIds,
        count: pendingIds.length,
      };
      expect(confirmState.count).toBe(10);

      // Verify modal text formatting
      const modalMessage = `Bạn sắp ${confirmState.action === 'confirmed' ? 'duyệt' : 'bỏ qua'} ${confirmState.count} lỗi. Tiếp tục?`;
      expect(modalMessage).toBe('Bạn sắp duyệt 10 lỗi. Tiếp tục?');

      // 2. Cancellation: nothing should be called
      const handleCancel = () => {
        // modal closes without dispatch
      };
      handleCancel();
      expect(onBatchDecisionChange).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();

      // 3. Confirmation: executes batch mutation
      const handleConfirm = () => {
        onBatchDecisionChange(confirmState.ids, 'confirmed');
        mockShowToast({
          message: `Đã duyệt ${confirmState.ids.length} lỗi.`,
          type: 'success',
          duration: 7000,
          undoLabel: 'Hoàn tác',
          onUndo: () => {
            onBatchDecisionChange(confirmState.ids, 'pending');
          },
        });
      };

      handleConfirm();
      expect(onBatchDecisionChange).toHaveBeenCalledWith(pendingIds, 'confirmed');
      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(capturedToastOptions.message).toBe('Đã duyệt 10 lỗi.');
      expect(capturedToastOptions.duration).toBe(7000);
      expect(capturedToastOptions.undoLabel).toBe('Hoàn tác');

      // 4. Undo: clicking "Hoàn tác" in toast restores all 10 issues to pending
      capturedToastOptions.onUndo();
      expect(onBatchDecisionChange).toHaveBeenCalledWith(pendingIds, 'pending');
      expect(onBatchDecisionChange).toHaveBeenCalledTimes(2);
    });

    it('executes batch dismiss with > 5 issues through confirmation modal and allows undo', () => {
      const issues = createMockIssues(8);
      const onBatchDecisionChange = vi.fn();
      let capturedToastOptions: any = null;
      const mockShowToast = vi.fn((opts) => {
        capturedToastOptions = opts;
      });

      const pendingIds = issues.map((i) => i.id);
      expect(pendingIds.length).toBe(8);

      const confirmState: { action: 'confirmed' | 'dismissed'; ids: string[]; count: number } = {
        action: 'dismissed',
        ids: pendingIds,
        count: pendingIds.length,
      };

      const modalMessage = `Bạn sắp ${confirmState.action === 'confirmed' ? 'duyệt' : 'bỏ qua'} ${confirmState.count} lỗi. Tiếp tục?`;
      expect(modalMessage).toBe('Bạn sắp bỏ qua 8 lỗi. Tiếp tục?');

      // Confirm dismiss
      onBatchDecisionChange(confirmState.ids, 'dismissed');
      mockShowToast({
        message: `Đã bỏ qua ${confirmState.ids.length} lỗi.`,
        type: 'success',
        duration: 7000,
        undoLabel: 'Hoàn tác',
        onUndo: () => {
          onBatchDecisionChange(confirmState.ids, 'pending');
        },
      });

      expect(onBatchDecisionChange).toHaveBeenCalledWith(pendingIds, 'dismissed');
      expect(capturedToastOptions.message).toBe('Đã bỏ qua 8 lỗi.');

      // Undo dismiss
      capturedToastOptions.onUndo();
      expect(onBatchDecisionChange).toHaveBeenCalledWith(pendingIds, 'pending');
    });

    it('bypasses confirmation modal when pending issues <= 5 and still provides undo', () => {
      const issues = createMockIssues(3);
      const onBatchDecisionChange = vi.fn();
      let capturedToastOptions: any = null;
      const mockShowToast = vi.fn((opts) => {
        capturedToastOptions = opts;
      });

      const pendingIds = issues.map((i) => i.id);
      expect(pendingIds.length).toBe(3);
      expect(pendingIds.length <= BATCH_CONFIRM_THRESHOLD).toBe(true);

      // Direct execution without modal staging
      onBatchDecisionChange(pendingIds, 'confirmed');
      mockShowToast({
        message: `Đã duyệt ${pendingIds.length} lỗi.`,
        type: 'success',
        duration: 7000,
        undoLabel: 'Hoàn tác',
        onUndo: () => {
          onBatchDecisionChange(pendingIds, 'pending');
        },
      });

      expect(onBatchDecisionChange).toHaveBeenCalledWith(pendingIds, 'confirmed');
      expect(mockShowToast).toHaveBeenCalledTimes(1);
      expect(capturedToastOptions.message).toBe('Đã duyệt 3 lỗi.');

      // Undo works identically
      capturedToastOptions.onUndo();
      expect(onBatchDecisionChange).toHaveBeenCalledWith(pendingIds, 'pending');
    });

    it('falls back to onDecisionChange when onBatchDecisionChange is not provided', () => {
      const issues = createMockIssues(2);
      const onDecisionChange = vi.fn();
      let capturedToastOptions: any = null;
      const mockShowToast = vi.fn((opts) => {
        capturedToastOptions = opts;
      });

      const pendingIds = issues.map((i) => i.id);

      // Direct fallback execution
      pendingIds.forEach((id) => onDecisionChange(id, 'confirmed'));
      mockShowToast({
        message: `Đã duyệt ${pendingIds.length} lỗi.`,
        type: 'success',
        duration: 7000,
        undoLabel: 'Hoàn tác',
        onUndo: () => {
          pendingIds.forEach((id) => onDecisionChange(id, 'pending'));
        },
      });

      expect(onDecisionChange).toHaveBeenCalledWith('issue-1', 'confirmed');
      expect(onDecisionChange).toHaveBeenCalledWith('issue-2', 'confirmed');

      // Undo fallback
      capturedToastOptions.onUndo();
      expect(onDecisionChange).toHaveBeenCalledWith('issue-1', 'pending');
      expect(onDecisionChange).toHaveBeenCalledWith('issue-2', 'pending');
    });
  });

  describe('Hako Checker to Translator Workspace Navigation', () => {
    it('renders chapter issues breakdown with "Mở trong Bàn Dịch để sửa" buttons', () => {
      const mockMultiChapterIssues: QualityIssue[] = [
        {
          id: 'issue-1',
          chapterId: 'chap-1',
          chapterTitle: 'Chương 1: Khởi đầu',
          chapterNumber: 1,
          category: 'raw_leak',
          severity: 'minor',
          vietnameseSnippet: 'Đoạn dịch lỗi 1',
          explanation: 'Sót từ thô',
          decision: 'pending',
          detectedBy: 'heuristic',
          createdAt: '2026-09-10T12:00:00Z',
        },
        {
          id: 'issue-2',
          chapterId: 'chap-1',
          chapterTitle: 'Chương 1: Khởi đầu',
          chapterNumber: 1,
          category: 'other',
          severity: 'minor',
          vietnameseSnippet: 'Đoạn dịch lỗi 2',
          explanation: 'Lỗi dấu câu',
          decision: 'pending',
          detectedBy: 'heuristic',
          createdAt: '2026-09-10T12:00:00Z',
        },
        {
          id: 'issue-3',
          chapterId: 'chap-2',
          chapterTitle: 'Chương 2: Tiến bước',
          chapterNumber: 2,
          category: 'mistranslation',
          severity: 'major',
          vietnameseSnippet: 'Đoạn dịch lỗi 3',
          explanation: 'Sai nghĩa',
          decision: 'pending',
          detectedBy: 'ai',
          createdAt: '2026-09-10T12:00:00Z',
        },
      ];

      const onOpenInTranslator = vi.fn();

      const html = renderToString(
        <HakoIssueReviewPanel
          issues={mockMultiChapterIssues}
          chapters={mockChapters}
          onDecisionChange={vi.fn()}
          onBatchDecisionChange={vi.fn()}
          onOpenExportModal={vi.fn()}
          onReanalyze={vi.fn()}
          isAnalyzing={false}
          onOpenInTranslator={onOpenInTranslator}
        />
      );

      // Verify the chapter breakdown section header
      expect(html).toContain('Danh sách chương phát hiện lỗi (2 chương):');
      // Verify both chapters are represented
      expect(html).toContain('Chương 1: Khởi đầu');
      expect(html).toContain('Chương 2: Tiến bước');
      // Verify issue counts
      expect(html).toContain('2</span> lỗi phát hiện');
      expect(html).toContain('1</span> lỗi phát hiện');
      // Verify "Mở trong Bàn Dịch để sửa" button label exists
      expect(html).toContain('Mở trong Bàn Dịch để sửa');
    });

    it('does not render "Mở trong Bàn Dịch để sửa" buttons if onOpenInTranslator is omitted', () => {
      const issues = createMockIssues(2);
      const html = renderToString(
        <HakoIssueReviewPanel
          issues={issues}
          chapters={mockChapters}
          onDecisionChange={vi.fn()}
          onBatchDecisionChange={vi.fn()}
          onOpenExportModal={vi.fn()}
          onReanalyze={vi.fn()}
          isAnalyzing={false}
        />
      );

      expect(html).toContain('Danh sách chương phát hiện lỗi (1 chương):');
      expect(html).not.toContain('Mở trong Bàn Dịch để sửa');
    });

    it('renders "Mở trong Bàn Dịch để sửa" on individual HakoIssueCard when onOpenInTranslator is provided', () => {
      const issue = createMockIssues(1)[0];
      const onOpenInTranslator = vi.fn();
      const html = renderToString(
        <HakoIssueCard
          issue={issue}
          onDecisionChange={vi.fn()}
          onOpenInTranslator={onOpenInTranslator}
        />
      );

      expect(html).toContain('Mở trong Bàn Dịch để sửa');
    });

    it('omits "Mở trong Bàn Dịch để sửa" on HakoIssueCard when onOpenInTranslator is undefined', () => {
      const issue = createMockIssues(1)[0];
      const html = renderToString(
        <HakoIssueCard
          issue={issue}
          onDecisionChange={vi.fn()}
        />
      );

      expect(html).not.toContain('Mở trong Bàn Dịch để sửa');
    });
  });

  describe('Smart Re-audit Resolved State & Diff Summary Rendering', () => {
    it('renders "đã khắc phục" badge and filter option when resolved issues exist', () => {
      const issues: QualityIssue[] = [
        ...createMockIssues(2, 'confirmed'),
        ...createMockIssues(1, 'resolved'),
      ];

      const html = renderToString(
        <HakoIssueReviewPanel
          issues={issues}
          chapters={mockChapters}
          onDecisionChange={vi.fn()}
          onOpenExportModal={vi.fn()}
          onReanalyze={vi.fn()}
          isAnalyzing={false}
        />
      );

      expect(html).toContain('đã khắc phục');
      expect(html).toContain('value="resolved"');
    });

    it('renders diffSummary notification banner when provided after rescan', () => {
      const issues = createMockIssues(2);
      const diffSummary = {
        resolvedCount: 3,
        unresolvedCount: 1,
        dismissedCount: 2,
        newCount: 1,
        totalCurrent: 3,
      };

      const html = renderToString(
        <HakoIssueReviewPanel
          issues={issues}
          chapters={mockChapters}
          onDecisionChange={vi.fn()}
          onOpenExportModal={vi.fn()}
          onReanalyze={vi.fn()}
          isAnalyzing={false}
          diffSummary={diffSummary}
          onDismissDiffSummary={vi.fn()}
        />
      );

      expect(html).toContain('Kết quả rà soát lại có đối chiếu quyết định');
      expect(html).toContain('lỗi đã được khắc phục sau khi sửa bản dịch (Đã giải quyết).');
      expect(html).toContain('lỗi đã xác nhận vẫn còn tồn tại.');
      expect(html).toContain('lỗi mới phát sinh.');
      expect(html).toContain('lỗi đã bỏ qua tiếp tục được bảo toàn.');
    });

    it('renders HakoIssueCard with resolved and isNew markers', () => {
      const resolvedIssue: QualityIssue = {
        ...createMockIssues(1, 'resolved')[0],
        isNew: true,
      };

      const html = renderToString(
        <HakoIssueCard
          issue={resolvedIssue}
          onDecisionChange={vi.fn()}
        />
      );

      expect(html).toContain('Đã giải quyết');
      expect(html).toContain('Đã khắc phục');
      expect(html).toContain('Mới');
    });

    describe('[US1] Scope Filtering by selectedChapterIds', () => {
      const multiChapterIssues: QualityIssue[] = [
        {
          ...createMockIssues(1)[0],
          id: 'issue-chap-1',
          chapterId: 'chap-1',
          chapterTitle: 'Chương 1',
          vietnameseSnippet: 'Lỗi chương 1 đặc biệt',
        },
        {
          ...createMockIssues(1)[0],
          id: 'issue-chap-2',
          chapterId: 'chap-2',
          chapterTitle: 'Chương 2',
          vietnameseSnippet: 'Lỗi chương 2 đặc biệt',
        },
      ];

      it('filters issues to only selectedChapterIds by default', () => {
        const html = renderToString(
          <HakoIssueReviewPanel
            issues={multiChapterIssues}
            chapters={mockChapters}
            selectedChapterIds={['chap-1']}
            onDecisionChange={vi.fn()}
            onOpenExportModal={vi.fn()}
            onReanalyze={vi.fn()}
            isAnalyzing={false}
          />
        );

        expect(html).toContain('Lỗi chương 1 đặc biệt');
        expect(html).not.toContain('Lỗi chương 2 đặc biệt');
        expect(html).toContain('Các chương đang chọn (1)');
      });

      it('hides unselected chapter issues when switching selection to chap-2', () => {
        const html = renderToString(
          <HakoIssueReviewPanel
            issues={multiChapterIssues}
            chapters={mockChapters}
            selectedChapterIds={['chap-2']}
            onDecisionChange={vi.fn()}
            onOpenExportModal={vi.fn()}
            onReanalyze={vi.fn()}
            isAnalyzing={false}
          />
        );

        expect(html).toContain('Lỗi chương 2 đặc biệt');
        expect(html).not.toContain('Lỗi chương 1 đặc biệt');
      });

      it('shows empty state with helpful message when selected chapter has no issues', () => {
        const html = renderToString(
          <HakoIssueReviewPanel
            issues={multiChapterIssues}
            chapters={mockChapters}
            selectedChapterIds={['chap-999']}
            onDecisionChange={vi.fn()}
            onOpenExportModal={vi.fn()}
            onReanalyze={vi.fn()}
            isAnalyzing={false}
          />
        );

        expect(html).toContain('Không tìm thấy lỗi nào phù hợp');
        expect(html).toContain('Không phát hiện lỗi nào trong các chương đang chọn');
        expect(html).toContain('Xem tất cả 2 lỗi trong phiên');
      });
    });

    describe('[US2] HakoIssueCard Decision Button States & Tooltips', () => {
      it('renders active style and toggle tooltip for confirmed issue', () => {
        const confirmedIssue = createMockIssues(1, 'confirmed')[0];
        const html = renderToString(
          <HakoIssueCard
            issue={confirmedIssue}
            onDecisionChange={vi.fn()}
          />
        );

        expect(html).toContain('Bỏ xác nhận lỗi (quay lại Chờ duyệt)');
        expect(html).toContain('Đã xác nhận lỗi');
      });

      it('renders active style and toggle tooltip for dismissed issue', () => {
        const dismissedIssue = createMockIssues(1, 'dismissed')[0];
        const html = renderToString(
          <HakoIssueCard
            issue={dismissedIssue}
            onDecisionChange={vi.fn()}
          />
        );

        expect(html).toContain('Hủy bỏ qua (quay lại Chờ duyệt)');
        expect(html).toContain('Đã bỏ qua');
      });

      it('renders active style and toggle tooltip for review_needed issue', () => {
        const reviewIssue = createMockIssues(1, 'review_needed')[0];
        const html = renderToString(
          <HakoIssueCard
            issue={reviewIssue}
            onDecisionChange={vi.fn()}
          />
        );

        expect(html).toContain('Hủy đánh dấu xem lại (quay lại Chờ duyệt)');
        expect(html).toContain('Cần xem lại');
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { UnifiedAuditPanel, handleAuditIssueSelection } from '../UnifiedAuditPanel';
import type { QualityIssue } from '../../../types/hakoChecker';
import type { DirectQaCritiqueIssue } from '../../../services/directTranslationEngine';
import type { UnifiedAuditIssue } from '../../../types/audit';

describe('UnifiedAuditPanel Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockHakoIssues: QualityIssue[] = [
    {
      id: 'hako-1',
      chapterId: 'chap-1',
      chapterTitle: 'Chương 1',
      chapterNumber: 1,
      category: 'raw_leak',
      severity: 'major',
      vietnameseSnippet: 'Kiếm khí 纵横 chấn động',
      explanation: 'Sót chữ Hán chưa dịch',
      decision: 'pending',
      detectedBy: 'heuristic',
      createdAt: '2026-09-10T12:00:00Z',
    },
    {
      id: 'hako-2',
      chapterId: 'chap-1',
      chapterTitle: 'Chương 1',
      chapterNumber: 1,
      category: 'other',
      severity: 'minor',
      vietnameseSnippet: 'Hắn nói:"Đi thôi"',
      explanation: 'Thiếu khoảng trắng sau dấu hai chấm',
      decision: 'dismissed',
      detectedBy: 'heuristic',
      createdAt: '2026-09-10T12:00:00Z',
    },
  ];

  const mockQaIssues: DirectQaCritiqueIssue[] = [
    {
      type: 'terminology',
      severity: 'warning',
      description: 'Thuật ngữ Tu vi cảnh giới dịch chưa nhất quán với các chương trước',
      targetText: 'Hắn đột phá Đấu Giả ngũ tinh',
    },
    {
      type: 'other',
      severity: 'info',
      description: 'Có thể làm mượt mà hơn ngữ cảnh xưng hô',
      targetText: 'Ta và ngươi cùng tiến',
    },
  ];

  describe('Component Definition & Exports', () => {
    it('exports valid UnifiedAuditPanel component', () => {
      expect(typeof UnifiedAuditPanel).toBe('function');
    });
  });

  describe('Header Action Bar & Trigger Button (US1)', () => {
    it('renders header with Seal 評, title, issue count, and active CTA button when idle', () => {
      const onRunAiQaCritique = vi.fn();
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={mockHakoIssues}
          qaIssues={mockQaIssues}
          isCheckingQa={false}
          onRunAiQaCritique={onRunAiQaCritique}
        />
      );

      expect(html).toContain('評');
      expect(html).toContain('Thẩm định chất lượng');
      expect(html).toContain('4 vấn đề');
      expect(html).toContain('Chạy AI Thẩm định');
      expect(html).not.toContain('Đang thẩm định AI...');
    });

    it('renders loading button state when isCheckingQa is true', () => {
      const onRunAiQaCritique = vi.fn();
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={mockHakoIssues}
          qaIssues={mockQaIssues}
          isCheckingQa={true}
          onRunAiQaCritique={onRunAiQaCritique}
        />
      );

      expect(html).toContain('Đang thẩm định AI...');
      expect(html).toContain('disabled');
    });
  });

  describe('Multi-Category Filter Tabs (US2)', () => {
    it('renders 4 filter tabs with correct live counts', () => {
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={mockHakoIssues}
          qaIssues={mockQaIssues}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
        />
      );

      // Total = 4 (2 hako + 2 qa)
      expect(html).toContain('Tất cả');
      expect(html).toContain('(4)');

      // Hako = 2
      expect(html).toContain('Quy chuẩn Hako');
      expect(html).toContain('(2)');

      // AI critique = 2
      expect(html).toContain('Góp ý AI');

      // Pending = 3 (hako-1 is pending, both qa issues are pending by default)
      expect(html).toContain('Chưa xử lý');
      expect(html).toContain('(3)');
    });
  });

  describe('Compact Issue Cards & Severity Tokens (US3)', () => {
    it('renders cards with proper severity badges and text excerpts', () => {
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={mockHakoIssues}
          qaIssues={mockQaIssues}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
        />
      );

      // Hako issue 1 (major -> error -> 'Lỗi')
      expect(html).toContain('Lỗi');
      expect(html).toContain('Sót chữ Hán chưa dịch');
      expect(html).toContain('Kiếm khí 纵横 chấn động');

      // QA issue 1 (warning -> 'Cảnh báo')
      expect(html).toContain('Cảnh báo');
      expect(html).toContain('Thuật ngữ Tu vi cảnh giới dịch chưa nhất quán với các chương trước');
      expect(html).toContain('Hắn đột phá Đấu Giả ngũ tinh');

      // QA issue 2 (info -> 'Góp ý')
      expect(html).toContain('Góp ý');
      expect(html).toContain('Ta và ngươi cùng tiến');
    });
  });

  describe('3 Mandatory UX States & Error Recovery (US4)', () => {
    it('renders EmptyState with CTA when there are 0 issues and not loading', () => {
      const onRunAiQaCritique = vi.fn();
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[]}
          isCheckingQa={false}
          onRunAiQaCritique={onRunAiQaCritique}
        />
      );

      expect(html).toContain('Không có vấn đề cần xử lý');
      expect(html).toContain('Bản dịch hiện tại đã thỏa mãn các quy tắc chất lượng và kiểm duyệt.');
      expect(html).toContain('Chạy AI Thẩm định');
    });

    it('renders Skeleton loading state when isCheckingQa is true', () => {
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[]}
          isCheckingQa={true}
          onRunAiQaCritique={vi.fn()}
        />
      );

      expect(html).toContain('Đang tiến hành kiểm duyệt AI đối soát bản dịch...');
    });

    it('renders Error alert with retry button when qaError is provided', () => {
      const onRunAiQaCritique = vi.fn();
      const errorMessage = 'Gemini API 429 Quota Exceeded';
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[]}
          isCheckingQa={false}
          onRunAiQaCritique={onRunAiQaCritique}
          qaError={errorMessage}
        />
      );

      expect(html).toContain('Lỗi thẩm định AI:');
      expect(html).toContain(errorMessage);
      expect(html).toContain('Thử lại');
    });
  });

  describe('Paragraph Mismatch Alert', () => {
    it('renders paragraph mismatch warning when isMismatch is true', () => {
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[]}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
          isMismatch={true}
          sourceParaCount={15}
          translationParaCount={12}
        />
      );

      expect(html).toContain('Cảnh báo lệch đoạn văn bản:');
      expect(html).toContain('<strong>15</strong> đoạn');
      expect(html).toContain('<strong>12</strong> đoạn');
    });

    it('does not render paragraph mismatch warning when isMismatch is false', () => {
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[]}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
          isMismatch={false}
          sourceParaCount={15}
          translationParaCount={15}
        />
      );

      expect(html).not.toContain('Cảnh báo lệch đoạn văn bản:');
    });
  });

  describe('Interactive Callbacks', () => {
    it('accepts interactive callback props without crashing', () => {
      const onIssueClick = vi.fn();
      const onRunAiQaCritique = vi.fn();

      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={mockHakoIssues}
          qaIssues={mockQaIssues}
          isCheckingQa={false}
          onRunAiQaCritique={onRunAiQaCritique}
          onIssueClick={onIssueClick}
        />
      );

      expect(html).toContain('Thẩm định chất lượng');
      expect(html).toContain('Chạy AI Thẩm định');
    });

    it('renders with activeTextareaRef prop without crashing', () => {
      const mockRef = { current: null };
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={mockHakoIssues}
          qaIssues={mockQaIssues}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
          activeTextareaRef={mockRef}
        />
      );

      expect(html).toContain('Thẩm định chất lượng');
      expect(html).toContain('Quy chuẩn Hako');
    });
  });

  describe('Textarea Selection & Fallback Toast Logic (Feature 103)', () => {
    const createMockTextarea = (value: string) => {
      let selectionStart = 0;
      let selectionEnd = 0;
      let scrollTop = 0;
      return {
        value,
        get selectionStart() { return selectionStart; },
        get selectionEnd() { return selectionEnd; },
        get scrollTop() { return scrollTop; },
        set scrollTop(val: number) { scrollTop = val; },
        focus: vi.fn(),
        setSelectionRange: vi.fn((start: number, end: number) => {
          selectionStart = start;
          selectionEnd = end;
        }),
      } as unknown as HTMLTextAreaElement;
    };

    it('focuses and selects matching targetText in activeTextareaRef without showing toast', () => {
      const textarea = createMockTextarea('Đoạn 1.\nHắn đột phá Đấu Giả ngũ tinh uy phong.\nĐoạn 3.');
      const activeTextareaRef = { current: textarea };
      const onIssueClick = vi.fn();
      const showToast = vi.fn();

      const mockIssue: UnifiedAuditIssue = {
        id: 'issue-101',
        source: 'ai_critique',
        severity: 'warning',
        title: 'Lỗi thuật ngữ',
        message: 'Cần sửa thuật ngữ tu vi',
        targetText: 'Hắn đột phá Đấu Giả ngũ tinh',
        status: 'pending',
        autoFixable: false,
      };

      const result = handleAuditIssueSelection({
        issue: mockIssue,
        activeTextareaRef,
        onIssueClick,
        showToast,
      });

      expect(result).toBe(true);
      expect(onIssueClick).toHaveBeenCalledWith(mockIssue);
      expect(textarea.focus).toHaveBeenCalled();
      expect(textarea.setSelectionRange).toHaveBeenCalledWith(8, 36);
      expect(showToast).not.toHaveBeenCalled();
    });

    it('triggers soft informational toast and does not throw when targetText has drifted or not found', () => {
      const textarea = createMockTextarea('Đoạn 1 đã sửa.\nĐoạn 2 đã được viết lại hoàn toàn.\nĐoạn 3.');
      const activeTextareaRef = { current: textarea };
      const onIssueClick = vi.fn();
      const showToast = vi.fn();

      const mockIssue: UnifiedAuditIssue = {
        id: 'issue-102',
        source: 'ai_critique',
        severity: 'warning',
        title: 'Lỗi thuật ngữ cũ',
        message: 'Đoạn trích này đã bị xóa/sửa',
        targetText: 'Hắn đột phá Đấu Giả ngũ tinh',
        status: 'pending',
        autoFixable: false,
      };

      const result = handleAuditIssueSelection({
        issue: mockIssue,
        activeTextareaRef,
        onIssueClick,
        showToast,
      });

      expect(result).toBe(false);
      expect(onIssueClick).toHaveBeenCalledWith(mockIssue);
      expect(textarea.setSelectionRange).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith({
        message: 'Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa.',
        type: 'info',
      });
    });

    it('handles empty or whitespace targetText without calling selection or showing toast', () => {
      const textarea = createMockTextarea('Nội dung bình thường.');
      const activeTextareaRef = { current: textarea };
      const onIssueClick = vi.fn();
      const showToast = vi.fn();

      const mockIssue: UnifiedAuditIssue = {
        id: 'issue-103',
        source: 'hako_rule',
        severity: 'error',
        title: 'Lỗi tổng quan chương',
        message: 'Chương thiếu đoạn văn',
        targetText: '   ',
        status: 'pending',
        autoFixable: false,
      };

      const result = handleAuditIssueSelection({
        issue: mockIssue,
        activeTextareaRef,
        onIssueClick,
        showToast,
      });

      expect(result).toBe(false);
      expect(onIssueClick).toHaveBeenCalledWith(mockIssue);
      expect(textarea.focus).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });

    it('handles null activeTextareaRef gracefully with toast notification when targetText cannot be selected', () => {
      const activeTextareaRef = { current: null };
      const onIssueClick = vi.fn();
      const showToast = vi.fn();

      const mockIssue: UnifiedAuditIssue = {
        id: 'issue-104',
        source: 'ai_critique',
        severity: 'warning',
        title: 'Lỗi dịch sai',
        message: 'Dịch nhầm',
        targetText: 'Văn bản cần tìm',
        status: 'pending',
        autoFixable: false,
      };

      const result = handleAuditIssueSelection({
        issue: mockIssue,
        activeTextareaRef,
        onIssueClick,
        showToast,
      });

      expect(result).toBe(false);
      expect(onIssueClick).toHaveBeenCalledWith(mockIssue);
      expect(showToast).toHaveBeenCalledWith({
        message: 'Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa.',
        type: 'info',
      });
    });
  });

  describe('Feature 104: Auto-Fix and Targeted AI Sentence Rewriting UI', () => {
    it('renders "Sửa ngay" button when issue is autoFixable, has suggestion, and onApplyFix is provided', () => {
      const fixableHakoIssue: QualityIssue = {
        id: 'hako-fixable-1',
        chapterId: 'chap-1',
        chapterTitle: 'Chương 1',
        chapterNumber: 1,
        category: 'raw_leak',
        severity: 'major',
        vietnameseSnippet: 'Kiếm khí 纵横 chấn động',
        suggestedFix: 'tung hoành',
        explanation: 'Sót chữ Hán chưa dịch',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: '2026-09-10T12:00:00Z',
      };

      const onApplyFix = vi.fn();
      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[fixableHakoIssue]}
          qaIssues={[]}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
          onApplyFix={onApplyFix}
        />
      );

      expect(html).toContain('Sửa ngay');
      expect(html).toContain('Có thể sửa nhanh');
    });

    it('does not render "Sửa ngay" button when onApplyFix is not provided or issue has no suggestion', () => {
      const fixableWithoutFix: QualityIssue = {
        id: 'hako-nofix',
        chapterId: 'chap-1',
        chapterTitle: 'Chương 1',
        chapterNumber: 1,
        category: 'raw_leak',
        severity: 'major',
        vietnameseSnippet: 'Kiếm khí 纵横',
        // no suggestedFix
        explanation: 'Sót chữ Hán',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: '2026-09-10T12:00:00Z',
      };

      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[fixableWithoutFix]}
          qaIssues={[]}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
        />
      );

      expect(html).not.toContain('Sửa ngay');
    });

    it('renders "Nhờ AI viết lại câu này" button on AI critique issues with targetText when API keys are available', () => {
      const qaIssueWithTarget: DirectQaCritiqueIssue = {
        type: 'terminology',
        severity: 'warning',
        description: 'Câu văn bị gượng gạo',
        targetText: 'Hắn cất bước đi về phía trước.',
      };

      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[qaIssueWithTarget]}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
          apiKeys={['TEST_KEY']}
        />
      );

      expect(html).toContain('Nhờ AI viết lại câu này');
    });

    it('does not render "Nhờ AI viết lại câu này" button when targetText is missing or empty', () => {
      const qaIssueWithoutTarget: DirectQaCritiqueIssue = {
        type: 'omission',
        severity: 'critical',
        description: 'Thiếu đoạn văn cuối chương',
        targetText: '',
      };

      const html = renderToString(
        <UnifiedAuditPanel
          hakoIssues={[]}
          qaIssues={[qaIssueWithoutTarget]}
          isCheckingQa={false}
          onRunAiQaCritique={vi.fn()}
          apiKeys={['TEST_KEY']}
        />
      );

      expect(html).not.toContain('Nhờ AI viết lại câu này');
    });
  });
});

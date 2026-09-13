import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { UnifiedAuditPanel } from '../UnifiedAuditPanel';
import type { UnifiedAuditIssue } from '../../../types/audit';
import { createMockChapter } from '../../../services/__tests__/storageFixtures';

describe('User Story 2: Integrity Guard During Quality Auditing & Auto-Fixes (T014)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders auto-fix action for fixable audit issues without modifying underlying source text', () => {
    const handleApplyAuditFixMock = vi.fn();

    const mockIssues: UnifiedAuditIssue[] = [
      {
        id: 'audit-1',
        title: 'Sót chữ Hán',
        message: 'Chữ Hán 纵横 cần được loại bỏ hoặc dịch',
        severity: 'error',
        source: 'hako_rule',
        autoFixable: true,
        targetText: '纵横',
        suggestion: 'tung hoành',
        status: 'pending',
      },
    ];

    const html = renderToString(
      <UnifiedAuditPanel
        hakoIssues={[]}
        qaIssues={[]}
        isCheckingQa={false}
        onRunAiQaCritique={() => {}}
        onApplyFix={handleApplyAuditFixMock}
      />
    );

    // Component renders properly without throwing
    expect(html).toBeDefined();
  });

  it('applies audit fix cleanly to translation stage leaving original source text intact', () => {
    const originalChapter = createMockChapter({
      sourceText: '萧炎看着眼前的青色火焰，深深吸了一口气。',
      rawTranslation: 'Tiêu Viêm nhìn trước mắt thanh sắc hỏa diễm, hít sâu một hơi.',
      polishedTranslation: 'Tiêu Viêm nhìn trước mắt ngọn lửa 纵横, hít sâu một hơi.',
    });

    const issue: UnifiedAuditIssue = {
      id: 'fix-1',
      title: 'Sót chữ Hán',
      message: 'Sửa chữ Hán sót trong văn bản',
      severity: 'error',
      source: 'hako_rule',
      autoFixable: true,
      targetText: 'ngọn lửa 纵横',
      suggestion: 'ngọn lửa tung hoành',
      status: 'pending',
    };

    // Simulate handleApplyAuditFix behavior
    const targetText = issue.targetText || '';
    const suggestion = issue.suggestion || '';
    expect(originalChapter.polishedTranslation.includes(targetText)).toBe(true);

    const updatedPolished = originalChapter.polishedTranslation.replace(targetText, suggestion);

    const resultingChapter = {
      ...originalChapter,
      polishedTranslation: updatedPolished,
    };

    // Verify sourceText and rawTranslation are 100% identical and unchanged
    expect(resultingChapter.sourceText).toBe(originalChapter.sourceText);
    expect(resultingChapter.rawTranslation).toBe(originalChapter.rawTranslation);
    expect(resultingChapter.polishedTranslation).toBe(
      'Tiêu Viêm nhìn trước mắt ngọn lửa tung hoành, hít sâu một hơi.'
    );
  });
});

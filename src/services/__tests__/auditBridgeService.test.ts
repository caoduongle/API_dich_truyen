import { describe, it, expect } from 'vitest';
import {
  mapHakoIssueToUnified,
  mapQaIssueToUnified,
  isHakoCategoryAutoFixable,
  generateQaIssueId,
  calculateAuditScore,
  getAuditScoreTier,
} from '../auditBridgeService';
import {
  HAKO_SEVERITY_MAP,
  QA_SEVERITY_MAP,
  mapHakoSeverity,
  mapQaSeverity,
  type UnifiedAuditIssue,
} from '../../types/audit';
import type { QualityIssue } from '../../types/hakoChecker';
import type { DirectQaCritiqueIssue } from '../directTranslationEngine';

describe('auditBridgeService', () => {
  describe('Severity Mapping Tables & Helpers', () => {
    it('correctly maps all Hako severities according to specification', () => {
      expect(HAKO_SEVERITY_MAP.critical).toBe('error');
      expect(HAKO_SEVERITY_MAP.major).toBe('error');
      expect(HAKO_SEVERITY_MAP.minor).toBe('warning');
      expect(HAKO_SEVERITY_MAP.warning).toBe('warning');

      expect(mapHakoSeverity('critical')).toBe('error');
      expect(mapHakoSeverity('major')).toBe('error');
      expect(mapHakoSeverity('minor')).toBe('warning');
      expect(mapHakoSeverity('warning')).toBe('warning');
    });

    it('correctly maps all QA Critique severities according to specification', () => {
      expect(QA_SEVERITY_MAP.critical).toBe('error');
      expect(QA_SEVERITY_MAP.warning).toBe('warning');
      expect(QA_SEVERITY_MAP.info).toBe('info');

      expect(mapQaSeverity('critical')).toBe('error');
      expect(mapQaSeverity('warning')).toBe('warning');
      expect(mapQaSeverity('info')).toBe('info');
    });
  });

  describe('isHakoCategoryAutoFixable', () => {
    it('returns true only for deterministic syntax/rule categories', () => {
      expect(isHakoCategoryAutoFixable('raw_leak')).toBe(true);
      expect(isHakoCategoryAutoFixable('repetition')).toBe(true);
    });

    it('returns false for semantic, linguistic, and complex context categories', () => {
      expect(isHakoCategoryAutoFixable('inconsistent_name')).toBe(false);
      expect(isHakoCategoryAutoFixable('pronoun_gender')).toBe(false);
      expect(isHakoCategoryAutoFixable('terminology_drift')).toBe(false);
      expect(isHakoCategoryAutoFixable('mistranslation')).toBe(false);
      expect(isHakoCategoryAutoFixable('omission')).toBe(false);
      expect(isHakoCategoryAutoFixable('hallucination')).toBe(false);
      expect(isHakoCategoryAutoFixable('wrong_chapter')).toBe(false);
      expect(isHakoCategoryAutoFixable('other')).toBe(false);
    });
  });

  describe('mapHakoIssueToUnified', () => {
    it('correctly maps a raw_leak Hako issue with autoFixable=true and targetText', () => {
      const hakoIssue: QualityIssue = {
        id: 'issue-raw-123',
        chapterId: 'chap-1',
        chapterTitle: 'Chương 1',
        chapterNumber: 1,
        category: 'raw_leak',
        severity: 'critical',
        vietnameseSnippet: 'Hắn nhìn thấy 剑 khí ngút trời.',
        rawSnippet: '剑',
        explanation: 'Phát hiện ký tự Hán tự chưa dịch',
        suggestedFix: 'Dịch "剑" thành "kiếm"',
        decision: 'pending',
        detectedBy: 'heuristic',
        createdAt: '2026-09-10T12:00:00Z',
      };

      const unified = mapHakoIssueToUnified(hakoIssue);

      expect(unified).toEqual({
        id: 'issue-raw-123',
        source: 'hako_rule',
        severity: 'error',
        title: 'Sót ký tự Hán tự / Raw',
        message: 'Phát hiện ký tự Hán tự chưa dịch',
        targetText: 'Hắn nhìn thấy 剑 khí ngút trời.',
        suggestion: 'Dịch "剑" thành "kiếm"',
        autoFixable: true,
        status: 'pending',
      });
    });

    it('correctly maps a repetition issue with autoFixable=true', () => {
      const hakoIssue: QualityIssue = {
        id: 'issue-rep-456',
        chapterId: 'chap-1',
        chapterTitle: 'Chương 1',
        chapterNumber: 1,
        category: 'repetition',
        severity: 'major',
        vietnameseSnippet: 'Đoạn văn bị trùng lặp.',
        explanation: 'Lặp đoạn văn',
        decision: 'confirmed',
        detectedBy: 'heuristic',
        createdAt: '2026-09-10T12:00:00Z',
      };

      const unified = mapHakoIssueToUnified(hakoIssue);

      expect(unified.source).toBe('hako_rule');
      expect(unified.severity).toBe('error');
      expect(unified.autoFixable).toBe(true);
      expect(unified.status).toBe('pending');
      expect(unified.suggestion).toBeUndefined();
    });

    it('correctly sets autoFixable=false for mistranslation, omission, and name inconsistency', () => {
      const mistranslationIssue: QualityIssue = {
        id: 'issue-mis-789',
        chapterId: 'chap-2',
        chapterTitle: 'Chương 2',
        chapterNumber: 2,
        category: 'mistranslation',
        severity: 'warning',
        vietnameseSnippet: 'Bản dịch sai nghĩa.',
        explanation: 'Dịch sai nghĩa câu gốc',
        decision: 'review_needed',
        detectedBy: 'ai',
        createdAt: '2026-09-10T12:00:00Z',
      };

      const unified = mapHakoIssueToUnified(mistranslationIssue);

      expect(unified.severity).toBe('warning');
      expect(unified.autoFixable).toBe(false);
      expect(unified.status).toBe('pending');
    });

    it('maps dismissed Hako decision to status "ignored"', () => {
      const dismissedIssue: QualityIssue = {
        id: 'issue-dis-000',
        chapterId: 'chap-3',
        chapterTitle: 'Chương 3',
        chapterNumber: 3,
        category: 'other',
        severity: 'minor',
        vietnameseSnippet: 'Chi tiết nhỏ',
        explanation: 'Không nghiêm trọng',
        decision: 'dismissed',
        detectedBy: 'heuristic',
        createdAt: '2026-09-10T12:00:00Z',
      };

      const unified = mapHakoIssueToUnified(dismissedIssue);

      expect(unified.severity).toBe('warning');
      expect(unified.status).toBe('ignored');
      expect(unified.autoFixable).toBe(false);
    });
  });

  describe('mapQaIssueToUnified', () => {
    it('correctly maps a QA critique issue with provided ID', () => {
      const qaIssue: DirectQaCritiqueIssue = {
        type: 'addition',
        severity: 'warning',
        targetText: 'Câu văn tự vẽ ra không có trong bản gốc.',
        description: 'Phát hiện thêm thắt tình tiết ngoài lề.',
      };

      const unified = mapQaIssueToUnified(qaIssue, 'custom-qa-id-1');

      expect(unified).toEqual({
        id: 'custom-qa-id-1',
        source: 'ai_critique',
        severity: 'warning',
        title: 'Thêm thắt nội dung',
        message: 'Phát hiện thêm thắt tình tiết ngoài lề.',
        targetText: 'Câu văn tự vẽ ra không có trong bản gốc.',
        suggestion: undefined,
        autoFixable: false,
        status: 'pending',
      });
    });

    it('correctly generates an ID when none is provided and maps critical severity to error', () => {
      const qaIssue: DirectQaCritiqueIssue = {
        type: 'omission',
        severity: 'critical',
        targetText: '',
        description: 'Bỏ sót đoạn thoại quan trọng của nhân vật chính.',
      };

      const unified = mapQaIssueToUnified(qaIssue);

      expect(unified.id).toMatch(/^qa-/);
      expect(unified.source).toBe('ai_critique');
      expect(unified.severity).toBe('error');
      expect(unified.title).toBe('Bỏ sót nội dung');
      expect(unified.message).toBe('Bỏ sót đoạn thoại quan trọng của nhân vật chính.');
      expect(unified.targetText).toBe('');
      expect(unified.suggestion).toBeUndefined();
      expect(unified.autoFixable).toBe(false);
      expect(unified.status).toBe('pending');
    });

    it('correctly maps info severity to info for QA critique', () => {
      const qaIssue: DirectQaCritiqueIssue = {
        type: 'terminology',
        severity: 'info',
        targetText: 'Trúc Cơ Kỳ',
        description: 'Thuật ngữ có thể dịch chuẩn hơn.',
      };

      const unified = mapQaIssueToUnified(qaIssue);

      expect(unified.severity).toBe('info');
      expect(unified.title).toBe('Sai lệch thuật ngữ');
      expect(unified.autoFixable).toBe(false);
      expect(unified.status).toBe('pending');
    });
  });

  describe('generateQaIssueId', () => {
    it('generates unique non-empty string IDs prefixed with qa-', () => {
      const id1 = generateQaIssueId();
      const id2 = generateQaIssueId();

      expect(id1).toMatch(/^qa-/);
      expect(id2).toMatch(/^qa-/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('calculateAuditScore', () => {
    const makeIssue = (
      id: string,
      severity: 'error' | 'warning' | 'info',
      status: 'pending' | 'resolved' | 'ignored'
    ): UnifiedAuditIssue => ({
      id,
      source: 'hako_rule',
      severity,
      title: 'Issue',
      message: 'Message',
      autoFixable: false,
      status,
    });

    it('returns 100 for an empty issue list', () => {
      expect(calculateAuditScore([])).toBe(100);
    });

    it('returns 100 when all issues are resolved or ignored', () => {
      const issues: UnifiedAuditIssue[] = [
        makeIssue('1', 'error', 'resolved'),
        makeIssue('2', 'error', 'ignored'),
        makeIssue('3', 'warning', 'resolved'),
        makeIssue('4', 'info', 'ignored'),
      ];
      expect(calculateAuditScore(issues)).toBe(100);
    });

    it('deducts 8 points for pending error', () => {
      const issues: UnifiedAuditIssue[] = [makeIssue('1', 'error', 'pending')];
      expect(calculateAuditScore(issues)).toBe(92);
    });

    it('deducts 3 points for pending warning', () => {
      const issues: UnifiedAuditIssue[] = [makeIssue('1', 'warning', 'pending')];
      expect(calculateAuditScore(issues)).toBe(97);
    });

    it('deducts 1 point for pending info', () => {
      const issues: UnifiedAuditIssue[] = [makeIssue('1', 'info', 'pending')];
      expect(calculateAuditScore(issues)).toBe(99);
    });

    it('correctly calculates mixed pending issues (1 error, 2 warnings, 1 info -> 85)', () => {
      const issues: UnifiedAuditIssue[] = [
        makeIssue('1', 'error', 'pending'),
        makeIssue('2', 'warning', 'pending'),
        makeIssue('3', 'warning', 'pending'),
        makeIssue('4', 'info', 'pending'),
      ];
      // 100 - (8*1 + 3*2 + 1*1) = 85
      expect(calculateAuditScore(issues)).toBe(85);
    });

    it('deducts only for pending issues and ignores resolved/ignored ones in mixed list', () => {
      const issues: UnifiedAuditIssue[] = [
        makeIssue('1', 'error', 'pending'), // -8
        makeIssue('2', 'error', 'resolved'), // 0
        makeIssue('3', 'warning', 'pending'), // -3
        makeIssue('4', 'warning', 'ignored'), // 0
        makeIssue('5', 'info', 'resolved'), // 0
      ];
      // 100 - 8 - 3 = 89
      expect(calculateAuditScore(issues)).toBe(89);
    });

    it('clamps score at 0 when deductions exceed 100 points', () => {
      // 15 errors = -120 points
      const issues: UnifiedAuditIssue[] = Array.from({ length: 15 }, (_, i) =>
        makeIssue(`err-${i}`, 'error', 'pending')
      );
      expect(calculateAuditScore(issues)).toBe(0);
    });

    it('never exceeds 100', () => {
      expect(calculateAuditScore([])).toBe(100);
    });
  });

  describe('getAuditScoreTier', () => {
    it('returns "Xuất sắc" and tone "polish" for scores >= 90', () => {
      expect(getAuditScoreTier(100)).toEqual({ label: 'Xuất sắc', tone: 'polish' });
      expect(getAuditScoreTier(95)).toEqual({ label: 'Xuất sắc', tone: 'polish' });
      expect(getAuditScoreTier(90)).toEqual({ label: 'Xuất sắc', tone: 'polish' });
    });

    it('returns "Khá" and tone "warning" for scores from 70 to 89', () => {
      expect(getAuditScoreTier(89)).toEqual({ label: 'Khá', tone: 'warning' });
      expect(getAuditScoreTier(75)).toEqual({ label: 'Khá', tone: 'warning' });
      expect(getAuditScoreTier(70)).toEqual({ label: 'Khá', tone: 'warning' });
    });

    it('returns "Cần rà soát lại" and tone "danger" for scores < 70', () => {
      expect(getAuditScoreTier(69)).toEqual({ label: 'Cần rà soát lại', tone: 'danger' });
      expect(getAuditScoreTier(50)).toEqual({ label: 'Cần rà soát lại', tone: 'danger' });
      expect(getAuditScoreTier(0)).toEqual({ label: 'Cần rà soát lại', tone: 'danger' });
    });
  });
});

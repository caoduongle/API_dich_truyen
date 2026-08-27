import { describe, it, expect } from 'vitest';
import {
  runHeuristicQualityScan,
  generateQualityReport,
  generateIssueId,
} from '../hakoQualityEngine';
import { QualityReviewSession } from '../../types/hakoChecker';

describe('hakoQualityEngine Unit Tests', () => {
  describe('generateIssueId', () => {
    it('generates unique issue IDs', () => {
      const id1 = generateIssueId();
      const id2 = generateIssueId();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('issue-')).toBe(true);
    });
  });

  describe('runHeuristicQualityScan', () => {
    it('detects CJK Chinese characters in Vietnamese translation as raw leaks', () => {
      const chapter = {
        chapterId: 'c1',
        title: 'Chương 1',
        chapterNumber: 1,
        vietnameseContent: 'Hắn nhìn về phía trước, đột nhiên phát hiện một gốc 龙涎草 mọc trên vách đá.',
      };

      const issues = runHeuristicQualityScan(chapter);
      expect(issues.length).toBe(1);
      expect(issues[0].category).toBe('raw_leak');
      expect(issues[0].severity).toBe('major');
      expect(issues[0].vietnameseSnippet).toContain('龙涎草');
      expect(issues[0].chapterId).toBe('c1');
      expect(issues[0].chapterNumber).toBe(1);
      expect(issues[0].decision).toBe('pending');
      expect(issues[0].detectedBy).toBe('heuristic');
    });

    it('marks severity as critical when raw leaks have 5 or more CJK characters', () => {
      const chapter = {
        chapterId: 'c1',
        title: 'Chương 1',
        chapterNumber: 1,
        vietnameseContent: 'Câu này hoàn toàn chưa dịch: 斗破苍穹大结局 toàn bộ là tiếng Trung.',
      };

      const issues = runHeuristicQualityScan(chapter);
      expect(issues.length).toBe(1);
      expect(issues[0].category).toBe('raw_leak');
      expect(issues[0].severity).toBe('critical');
      expect(issues[0].chapterNumber).toBe(1);
    });

    it('detects duplicate consecutive paragraphs', () => {
      const chapter = {
        chapterId: 'c2',
        title: 'Chương 2',
        chapterNumber: 2,
        vietnameseContent: [
          'Tiêu Viêm thở dài một hơi, chậm rãi bước ra khỏi phòng luyện công.',
          'Tiêu Viêm thở dài một hơi, chậm rãi bước ra khỏi phòng luyện công.',
          'Bên ngoài viện lạc, ánh trăng sáng tỏ rọi xuống mặt đất.',
        ].join('\n\n'),
      };

      const issues = runHeuristicQualityScan(chapter);
      const repIssues = issues.filter((i) => i.category === 'repetition');
      expect(repIssues.length).toBe(1);
      expect(repIssues[0].severity).toBe('major');
      expect(repIssues[0].chapterNumber).toBe(2);
      expect(repIssues[0].explanation).toContain('lặp lại y hệt');
    });

    it('detects placeholder tags and error markers', () => {
      const chapter = {
        chapterId: 'c3',
        title: 'Chương 3',
        chapterNumber: 3,
        vietnameseContent: 'Hắn vận chuyển công pháp [chưa dịch] để hồi phục đấu khí.',
      };

      const issues = runHeuristicQualityScan(chapter);
      const placeholderIssues = issues.filter((i) => i.category === 'other');
      expect(placeholderIssues.length).toBe(1);
      expect(placeholderIssues[0].severity).toBe('warning');
      expect(placeholderIssues[0].chapterNumber).toBe(3);
      expect(placeholderIssues[0].explanation).toContain('[chưa dịch]');
    });

    it('returns empty array when text is clean', () => {
      const chapter = {
        chapterId: 'c4',
        title: 'Chương 4',
        chapterNumber: 4,
        vietnameseContent: 'Tiêu Viêm mở mắt ra, nhìn thấy Dược Lão đang mỉm cười nhìn mình.\n\n"Sư phụ, con đã đột phá rồi."',
      };

      const issues = runHeuristicQualityScan(chapter);
      expect(issues.length).toBe(0);
    });
  });

  describe('generateQualityReport', () => {
    it('calculates statistics, sorts chapters by chapterNumber ascending, and formats markdown report accurately', () => {
      const mockSession: QualityReviewSession = {
        id: 'test-session-1',
        projectId: 'proj-123',
        projectTitle: 'Đấu Phá Thương Khung',
        selectedChapterIds: ['c1', 'c2', 'c134'],
        chapters: {
          c1: {
            chapterId: 'c1',
            title: 'Chương 1: Mở màn',
            chapterNumber: 1,
            vietnameseContent: 'Nội dung chương 1...',
            rawChineseContent: '第1章...',
            translationType: 'polished',
            wordCount: 1500,
            status: 'done',
          },
          c2: {
            chapterId: 'c2',
            title: 'Chương 2: Đấu Khí Các',
            chapterNumber: 2,
            vietnameseContent: 'Nội dung chương 2...',
            rawChineseContent: '第2章...',
            translationType: 'raw',
            wordCount: 1800,
            status: 'done',
          },
          c134: {
            chapterId: 'c134',
            title: 'Chương 134: Trang bức',
            chapterNumber: 134,
            vietnameseContent: 'Nội dung chương 134...',
            translationType: 'polished',
            wordCount: 2000,
            status: 'done',
          },
        },
        issues: [
          // Non-consecutive order to test sorting
          {
            id: 'i-134',
            chapterId: 'c134',
            chapterTitle: 'Chương 134: Trang bức',
            chapterNumber: 134,
            category: 'mistranslation',
            severity: 'major',
            vietnameseSnippet: 'Dịch sai câu khẩu quyết',
            explanation: 'Sai nghĩa raw',
            decision: 'confirmed',
            detectedBy: 'ai',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'i1',
            chapterId: 'c1',
            chapterTitle: 'Chương 1: Mở màn',
            chapterNumber: 1,
            category: 'inconsistent_name',
            severity: 'major',
            vietnameseSnippet: 'Tiêu Đỉnh đổi thành Tiêu Chiến',
            explanation: 'Tên đại ca bị nhầm thành tên cha',
            decision: 'confirmed',
            moderatorNote: 'Cần sửa lại thành Tiêu Đỉnh',
            detectedBy: 'ai',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'i2',
            chapterId: 'c1',
            chapterTitle: 'Chương 1: Mở màn',
            chapterNumber: 1,
            category: 'raw_leak',
            severity: 'critical',
            vietnameseSnippet: 'Sót chữ 龙涎草',
            explanation: 'Sót raw',
            decision: 'confirmed',
            detectedBy: 'heuristic',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'i3',
            chapterId: 'c2',
            chapterTitle: 'Chương 2: Đấu Khí Các',
            chapterNumber: 2,
            category: 'pronoun_gender',
            severity: 'minor',
            vietnameseSnippet: 'Huân Nhi xưng anh',
            explanation: 'Nghi vấn đổi xưng hô',
            decision: 'review_needed',
            detectedBy: 'ai',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'i4',
            chapterId: 'c2',
            chapterTitle: 'Chương 2: Đấu Khí Các',
            chapterNumber: 2,
            category: 'other',
            severity: 'warning',
            vietnameseSnippet: 'Văn phong hơi dài',
            explanation: 'Không phải lỗi nặng',
            decision: 'dismissed',
            detectedBy: 'ai',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed',
      };

      const report = generateQualityReport(mockSession);
      expect(report.totalChaptersReviewed).toBe(3);
      expect(report.stats.totalIssues).toBe(5);
      expect(report.stats.confirmedCount).toBe(3);
      expect(report.stats.reviewNeededCount).toBe(1);
      expect(report.stats.dismissedCount).toBe(1);
      expect(report.stats.bySeverity.critical).toBe(1);
      expect(report.stats.bySeverity.major).toBe(2);

      expect(report.formattedMarkdown).toContain('# BÁO CÁO KIỂM ĐỊNH CHẤT LƯỢNG BẢN DỊCH');
      expect(report.formattedMarkdown).toContain('Đấu Phá Thương Khung');
      expect(report.formattedMarkdown).toContain('### Chương #1 — Chương 1: Mở màn');
      expect(report.formattedMarkdown).toContain('### Chương #134 — Chương 134: Trang bức');
      
      // Verify chapter 1 appears before chapter 134 in markdown output
      const idxChap1 = report.formattedMarkdown.indexOf('### Chương #1 —');
      const idxChap134 = report.formattedMarkdown.indexOf('### Chương #134 —');
      expect(idxChap1).toBeGreaterThan(-1);
      expect(idxChap134).toBeGreaterThan(idxChap1);

      expect(report.formattedMarkdown).toContain('Tên đại ca bị nhầm thành tên cha');
      expect(report.formattedMarkdown).toContain('Cần sửa lại thành Tiêu Đỉnh');
      expect(report.formattedMarkdown).toContain('CÁC ĐIỂM CẦN HỘI Ý THÊM VỚI DỊCH GIẢ');
      expect(report.formattedMarkdown).toContain('[Chương #2 · Chương 2: Đấu Khí Các]');
    });
  });

  describe('JIT Batch Scanning (up to 12 selected chapters)', () => {
    it('executes heuristic scans accurately on 12 JIT loaded chapter payloads', () => {
      const jitChapters = Array.from({ length: 12 }, (_, i) => ({
        chapterId: `jit-chap-${i + 1}`,
        title: `Chương ${i + 1}: Tiêu đề`,
        chapterNumber: i + 1,
        vietnameseContent: i === 3 
          ? 'Đoạn văn này có chứa 凝血草 và đoạn văn này có chứa 凝血草 lặp lại liên tiếp trong một câu.'
          : `Nội dung bản dịch chương ${i + 1} hoàn chỉnh bằng tiếng Việt trong sáng không tì vết.`,
      }));

      const allIssues = [];
      for (const ch of jitChapters) {
        const issues = runHeuristicQualityScan(ch);
        allIssues.push(...issues);
      }

      expect(jitChapters.length).toBe(12);
      expect(allIssues.length).toBeGreaterThan(0);
      expect(allIssues.some((issue) => issue.chapterId === 'jit-chap-4' && issue.category === 'raw_leak' && issue.chapterNumber === 4)).toBe(true);
    });
  });
});

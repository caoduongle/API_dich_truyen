import { describe, it, expect, vi, afterEach } from 'vitest';
import * as directGeminiClient from '../directGeminiClient';
import {
  runHeuristicQualityScan,
  runAiQualityScan,
  generateQualityReport,
  generateIssueId,
  generateIssueFingerprint,
  normalizeIssueSnippet,
  reconcileIssuesWithDecisions,
  isSnippetStillPresentInContent,
} from '../hakoQualityEngine';
import { QualityReviewSession, QualityIssue } from '../../types/hakoChecker';

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

    it('detects severe truncation when Vietnamese length is < 35% of Chinese raw text', () => {
      const chapter = {
        chapterId: 'c138',
        title: 'Chương 138: Đâm thẳng vào hạ bộ',
        chapterNumber: 138,
        // 80 words Vietnamese text
        vietnameseContent:
          'Kiểm tra xem trên người đối phương có thứ gì đáng giá hay không vốn là thói quen mỗi khi Tô Bạch ra tay sát hại kẻ khác, nhưng điều khiến hắn có chút thất vọng là, trên người vị luyện khí giả này ngoài một thanh phi kiếm ra thì chẳng còn gì khác; ngoại trừ bộ quần áo đang mặc, đến cả một món trang sức tùy thân cũng không có.',
        // 2000 Chinese characters
        rawChineseContent: '第一百三十八章 捅向裆部\n' + '检查对方身上是否有值钱的东西，是苏白每次杀人后的习惯...'.repeat(70),
        translationType: 'polished' as const,
      };

      const issues = runHeuristicQualityScan(chapter);
      const omissionIssues = issues.filter((i) => i.category === 'omission');
      expect(omissionIssues.length).toBe(1);
      expect(omissionIssues[0].severity).toBe('critical');
      expect(omissionIssues[0].explanation).toContain('thiếu hụt nội dung nghiêm trọng');
      expect(omissionIssues[0].suggestedFix).toContain('Dịch lại');
    });

    it('detects structural paragraph collapse when raw has >= 3 paragraphs but translation has only 1 paragraph', () => {
      const chapter = {
        chapterId: 'c139',
        title: 'Chương 139',
        chapterNumber: 139,
        vietnameseContent: 'Đoạn dịch duy nhất nhưng bản gốc có rất nhiều đoạn văn khác nhau.',
        rawChineseContent:
          '第一段中文文本内容，这里详细描述了主人公进入山谷的经过，四周云雾缭绕，极为神秘莫测...\n\n' +
          '第二段中文文本内容，突然前方出现了一道奇异的光芒，伴随着阵阵低沉的兽吼声响彻天地...\n\n' +
          '第三段中文文本内容，他立刻拔出身后的长剑，真气运转全身，警惕地注视着四周的一切动静...\n\n' +
          '第四段中文文本内容，战斗一触即发，狂风呼啸，空气中弥漫着浓厚而压抑的肃杀紧张气息。',
        translationType: 'polished' as const,
      };

      const issues = runHeuristicQualityScan(chapter);
      const omissionIssues = issues.filter((i) => i.category === 'omission');
      expect(omissionIssues.length).toBe(1);
      expect(omissionIssues[0].severity).toBe('critical');
      expect(omissionIssues[0].explanation).toContain('cấu trúc đoạn văn bất thường');
    });

    it('detects abnormally short chapter (< 150 words) when raw is absent but marked as polished', () => {
      const chapter = {
        chapterId: 'c140',
        title: 'Chương 140',
        chapterNumber: 140,
        vietnameseContent: 'Chỉ có một câu dịch ngắn ngủi trong toàn bộ chương.',
        translationType: 'polished' as const,
      };

      const issues = runHeuristicQualityScan(chapter);
      const omissionIssues = issues.filter((i) => i.category === 'omission');
      expect(omissionIssues.length).toBe(1);
      expect(omissionIssues[0].severity).toBe('major');
      expect(omissionIssues[0].explanation).toContain('Nghi vấn thiếu hụt nội dung');
    });

    it('does not flag legitimately short chapters when raw source text is <= 150 characters', () => {
      const chapter = {
        chapterId: 'c141',
        title: 'Thông báo',
        chapterNumber: 141,
        vietnameseContent: 'Tác giả có lời: Hôm nay nghỉ một ngày để dưỡng bệnh, mai sẽ bù hai chương.',
        rawChineseContent: '作者有话说：今天请假一天，明天补更两章。',
        translationType: 'polished' as const,
      };

      const issues = runHeuristicQualityScan(chapter);
      const omissionIssues = issues.filter((i) => i.category === 'omission');
      expect(omissionIssues.length).toBe(0);
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

  describe('runAiQualityScan - All Keys Exhausted Fast-Break', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('emits exactly 1 summary warning issue and stops immediately without calling callGeminiDirect for remaining chapters', async () => {
      const chapters = [
        { chapterId: 'c1', title: 'Chương 1', chapterNumber: 1, vietnameseContent: 'Nội dung chương 1' },
        { chapterId: 'c2', title: 'Chương 2', chapterNumber: 2, vietnameseContent: 'Nội dung chương 2' },
        { chapterId: 'c3', title: 'Chương 3', chapterNumber: 3, vietnameseContent: 'Nội dung chương 3' },
      ];

      const exhaustedError = new Error('Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: Quota exceeded');
      (exhaustedError as any).code = 'ALL_KEYS_EXHAUSTED';

      const spy = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockRejectedValue(exhaustedError);

      const issues = await runAiQualityScan({
        apiKeys: ['KEY_1', 'KEY_2'],
        projectTitle: 'Dự án Test Quota',
        chapters,
      });

      // (a) Chỉ có đúng 1 issue cảnh báo tổng quát được tạo ra (không phải 3)
      expect(issues.length).toBe(1);
      expect(issues[0].chapterId).toBe('c1');
      expect(issues[0].category).toBe('other');
      expect(issues[0].severity).toBe('warning');
      expect(issues[0].explanation).toContain('Toàn bộ API Key đã hết hạn mức');

      // (b) callGeminiDirect KHÔNG bị gọi lại cho chương 2 và 3
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('preserves prior chapter results and breaks when ALL_KEYS_EXHAUSTED occurs on a subsequent chapter', async () => {
      const chapters = [
        { chapterId: 'c1', title: 'Chương 1', chapterNumber: 1, vietnameseContent: 'Nội dung chương 1' },
        { chapterId: 'c2', title: 'Chương 2', chapterNumber: 2, vietnameseContent: 'Nội dung chương 2' },
        { chapterId: 'c3', title: 'Chương 3', chapterNumber: 3, vietnameseContent: 'Nội dung chương 3' },
      ];

      const exhaustedError = new Error('Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED).');
      (exhaustedError as any).code = 'ALL_KEYS_EXHAUSTED';

      const spy = vi.spyOn(directGeminiClient, 'callGeminiDirect')
        // Chapter 1 succeeds and finds 1 issue
        .mockResolvedValueOnce({
          text: JSON.stringify({
            issues: [
              {
                category: 'inconsistent_name',
                severity: 'critical',
                vietnameseSnippet: 'Tên nhân vật',
                explanation: 'Nhầm tên nhân vật',
              },
            ],
          }),
          successKeyIndex: 0,
        })
        // Chapter 2 fails with ALL_KEYS_EXHAUSTED
        .mockRejectedValueOnce(exhaustedError);

      const issues = await runAiQualityScan({
        apiKeys: ['KEY_1'],
        projectTitle: 'Dự án Test',
        chapters,
      });

      // Chapter 1 issue is preserved + Chapter 2 quota warning issue
      expect(issues.length).toBe(2);
      expect(issues[0].chapterId).toBe('c1');
      expect(issues[0].category).toBe('inconsistent_name');
      expect(issues[1].chapterId).toBe('c2');
      expect(issues[1].explanation).toContain('Toàn bộ API Key đã hết hạn mức');

      // callGeminiDirect called twice (chapter 1 and chapter 2), chapter 3 skipped
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('continues processing subsequent chapters when error is NOT ALL_KEYS_EXHAUSTED', async () => {
      const chapters = [
        { chapterId: 'c1', title: 'Chương 1', chapterNumber: 1, vietnameseContent: 'Nội dung chương 1' },
        { chapterId: 'c2', title: 'Chương 2', chapterNumber: 2, vietnameseContent: 'Nội dung chương 2' },
      ];

      const genericError = new Error('Nội dung văn bản bị bộ lọc an toàn của AI từ chối.');

      const spy = vi.spyOn(directGeminiClient, 'callGeminiDirect')
        .mockRejectedValueOnce(genericError)
        .mockResolvedValueOnce({
          text: JSON.stringify({ issues: [] }),
          successKeyIndex: 0,
        });

      const issues = await runAiQualityScan({
        apiKeys: ['KEY_1'],
        projectTitle: 'Dự án Test',
        chapters,
      });

      // Chapter 1 gets localized warning, Chapter 2 succeeds
      expect(issues.length).toBe(1);
      expect(issues[0].chapterId).toBe('c1');
      expect(issues[0].explanation).toContain('Nội dung văn bản bị bộ lọc');

      // Both chapters were called
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('preserves AI omission issue when Gemini returns omission without vietnameseSnippet', async () => {
      const chapters = [
        {
          chapterId: 'c138',
          title: 'Chương 138',
          chapterNumber: 138,
          vietnameseContent: 'Kiểm tra xem trên người đối phương có thứ gì đáng giá hay không...',
          rawChineseContent: '第一百三十八章 捅向裆部 检查对方身上是否有值钱的东西...',
        },
      ];

      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValueOnce({
        text: JSON.stringify({
          issues: [
            {
              category: 'omission',
              severity: 'critical',
              rawSnippet: '第二段未翻译的原始内容...',
              explanation: 'Bản dịch kết thúc đột ngột, thiếu hơn 80% phần sau của chương.',
              suggestedFix: 'Dịch bổ sung phần còn lại.',
            },
          ],
        }),
        successKeyIndex: 0,
      });

      const issues = await runAiQualityScan({
        apiKeys: ['KEY_VALID'],
        projectTitle: 'Đại Phát Thanh Kinh Dị',
        chapters,
      });

      expect(issues.length).toBe(1);
      expect(issues[0].category).toBe('omission');
      expect(issues[0].severity).toBe('critical');
      expect(issues[0].rawSnippet).toContain('第二段未翻译的原始内容');
      expect(issues[0].vietnameseSnippet).toBeTruthy();
    });
  });

  describe('generateIssueFingerprint & normalizeIssueSnippet', () => {
    it('normalizes whitespace and removes trailing ellipsis', () => {
      const snip1 = 'Đoạn văn có nhiều   khoảng   trắng...';
      const snip2 = 'đoạn văn có nhiều khoảng trắng';
      expect(normalizeIssueSnippet('repetition', snip1)).toBe(normalizeIssueSnippet('repetition', snip2));
    });

    it('extracts exact CJK characters for raw_leak category', () => {
      const snip1 = 'Phát hiện ký tự 龙涎草 ở vách đá...';
      const snip2 = 'Một câu khác nhưng vẫn chứa 龙涎草 ở cuối.';
      expect(normalizeIssueSnippet('raw_leak', snip1)).toBe('cjk:龙涎草');
      expect(normalizeIssueSnippet('raw_leak', snip2)).toBe('cjk:龙涎草');
      expect(generateIssueFingerprint('chap1', 'raw_leak', snip1)).toBe(
        generateIssueFingerprint('chap1', 'raw_leak', snip2)
      );
    });

    it('differentiates distinct categories or chapterIds', () => {
      const fp1 = generateIssueFingerprint('chap1', 'raw_leak', 'Hán tự 剑');
      const fp2 = generateIssueFingerprint('chap2', 'raw_leak', 'Hán tự 剑');
      const fp3 = generateIssueFingerprint('chap1', 'other', 'Hán tự 剑');
      expect(fp1).not.toBe(fp2);
      expect(fp1).not.toBe(fp3);
    });
  });

  describe('reconcileIssuesWithDecisions', () => {
    const createSampleIssue = (overrides: Partial<QualityIssue> = {}): QualityIssue => ({
      id: `issue-${Math.random()}`,
      chapterId: 'chap1',
      chapterTitle: 'Chương 1',
      chapterNumber: 1,
      category: 'raw_leak',
      severity: 'major',
      vietnameseSnippet: 'Có ký tự 龙涎草 chưa dịch',
      explanation: 'Sót chữ Hán',
      decision: 'pending',
      detectedBy: 'heuristic',
      createdAt: '2026-09-12T00:00:00.000Z',
      ...overrides,
    });

    it('[US1] retains dismissed decision and does not re-alert on rescan', () => {
      const oldIssue = createSampleIssue({ id: 'old-1', decision: 'dismissed' });
      const scannedIssue = createSampleIssue({ id: 'new-temp-1' });

      const result = reconcileIssuesWithDecisions([oldIssue], [scannedIssue], ['chap1']);

      expect(result.reconciledIssues.length).toBe(1);
      expect(result.reconciledIssues[0].id).toBe('old-1');
      expect(result.reconciledIssues[0].decision).toBe('dismissed');
      expect(result.diffSummary.dismissedCount).toBe(1);
    });

    it('[US2] transitions confirmed issue to resolved when text is fixed in rescan', () => {
      const oldIssue = createSampleIssue({ id: 'old-confirmed', decision: 'confirmed' });
      // Scanned issues is empty (fixed text)
      const result = reconcileIssuesWithDecisions([oldIssue], [], ['chap1']);

      expect(result.reconciledIssues.length).toBe(1);
      expect(result.reconciledIssues[0].id).toBe('old-confirmed');
      expect(result.reconciledIssues[0].decision).toBe('resolved');
      expect(result.reconciledIssues[0].resolvedAt).toBeDefined();
      expect(result.diffSummary.resolvedCount).toBe(1);
    });

    it('[US2] preserves confirmed decision when issue persists on rescan', () => {
      const oldIssue = createSampleIssue({ id: 'old-confirmed', decision: 'confirmed' });
      const scannedIssue = createSampleIssue({ id: 'scanned-1' });

      const result = reconcileIssuesWithDecisions([oldIssue], [scannedIssue], ['chap1']);

      expect(result.reconciledIssues.length).toBe(1);
      expect(result.reconciledIssues[0].id).toBe('old-confirmed');
      expect(result.reconciledIssues[0].decision).toBe('confirmed');
      expect(result.diffSummary.unresolvedCount).toBe(1);
    });

    it('[US3] preserves review_needed decision and moderatorNote across rescan', () => {
      const oldIssue = createSampleIssue({
        id: 'old-review',
        decision: 'review_needed',
        moderatorNote: 'Cần thảo luận thêm với nhóm dịch',
      });
      const scannedIssue = createSampleIssue({ id: 'scanned-2' });

      const result = reconcileIssuesWithDecisions([oldIssue], [scannedIssue], ['chap1']);

      expect(result.reconciledIssues.length).toBe(1);
      expect(result.reconciledIssues[0].id).toBe('old-review');
      expect(result.reconciledIssues[0].decision).toBe('review_needed');
      expect(result.reconciledIssues[0].moderatorNote).toBe('Cần thảo luận thêm với nhóm dịch');
    });

    it('[US4] marks newly introduced issues with isNew: true and decision: pending', () => {
      const oldIssue = createSampleIssue({ id: 'old-1', decision: 'confirmed' });
      const sameScanned = createSampleIssue({ id: 'same' });
      const brandNewScanned = createSampleIssue({
        id: 'new-error',
        vietnameseSnippet: 'Một lỗi mới xuất hiện 乾坤袋',
      });

      const result = reconcileIssuesWithDecisions([oldIssue], [sameScanned, brandNewScanned], ['chap1']);

      expect(result.reconciledIssues.length).toBe(2);
      const newIssue = result.reconciledIssues.find((i) => i.vietnameseSnippet.includes('乾坤袋'));
      expect(newIssue).toBeDefined();
      expect(newIssue?.decision).toBe('pending');
      expect(newIssue?.isNew).toBe(true);
      expect(result.diffSummary.newCount).toBe(1);
    });

    it('leaves issues from non-scanned chapters untouched', () => {
      const chap2Issue = createSampleIssue({ chapterId: 'chap2', id: 'chap2-issue', decision: 'confirmed' });
      const chap1Old = createSampleIssue({ chapterId: 'chap1', id: 'chap1-issue', decision: 'dismissed' });
      const chap1New = createSampleIssue({ chapterId: 'chap1' });

      const result = reconcileIssuesWithDecisions([chap2Issue, chap1Old], [chap1New], ['chap1']);

      expect(result.reconciledIssues.find((i) => i.id === 'chap2-issue')).toBeDefined();
      expect(result.reconciledIssues.find((i) => i.id === 'chap1-issue')?.decision).toBe('dismissed');
    });

    it('[US3] does NOT convert confirmed issue to resolved if chaptersContentMap still contains the snippet', () => {
      const oldIssue = createSampleIssue({
        id: 'old-confirmed',
        chapterId: 'chap1',
        decision: 'confirmed',
        category: 'mistranslation',
        vietnameseSnippet: 'cộng thêm tên xui xẻo bỏ mạng đầu tiên',
      });
      // Lần quét mới (AI) không phát hiện lỗi này, nhưng bản dịch tiếng Việt vẫn còn nguyên đoạn vi phạm
      const chaptersContentMap = new Map<string, string>([
        ['chap1', 'Đoạn văn này có chứa cộng thêm tên xui xẻo bỏ mạng đầu tiên mà dịch giả chưa hề sửa.'],
      ]);

      const result = reconcileIssuesWithDecisions([oldIssue], [], ['chap1'], chaptersContentMap);

      expect(result.reconciledIssues.length).toBe(1);
      expect(result.reconciledIssues[0].id).toBe('old-confirmed');
      // Phải giữ nguyên confirmed, KHÔNG được chuyển thành resolved
      expect(result.reconciledIssues[0].decision).toBe('confirmed');
      expect(result.diffSummary.unresolvedCount).toBe(1);
      expect(result.diffSummary.resolvedCount).toBe(0);
    });

    it('[US3] converts confirmed issue to resolved when chaptersContentMap proves the snippet was removed/fixed', () => {
      const oldIssue = createSampleIssue({
        id: 'old-confirmed',
        chapterId: 'chap1',
        decision: 'confirmed',
        category: 'mistranslation',
        vietnameseSnippet: 'cộng thêm tên xui xẻo bỏ mạng đầu tiên',
      });
      // Dịch giả đã sửa thành: "cộng thêm thính giả bị giết đầu tiên"
      const chaptersContentMap = new Map<string, string>([
        ['chap1', 'Đoạn văn này đã được dịch giả sửa thành cộng thêm thính giả bị giết đầu tiên chuẩn xác.'],
      ]);

      const result = reconcileIssuesWithDecisions([oldIssue], [], ['chap1'], chaptersContentMap);

      expect(result.reconciledIssues.length).toBe(1);
      expect(result.reconciledIssues[0].id).toBe('old-confirmed');
      expect(result.reconciledIssues[0].decision).toBe('resolved');
      expect(result.diffSummary.resolvedCount).toBe(1);
    });
  });

  describe('isSnippetStillPresentInContent', () => {
    it('detects CJK characters for raw_leak category', () => {
      expect(isSnippetStillPresentInContent('raw_leak', 'Chứa 龙涎草 chưa dịch', 'Có một cây 龙涎草 ở đây')).toBe(true);
      expect(isSnippetStillPresentInContent('raw_leak', 'Chứa 龙涎草 chưa dịch', 'Đã dịch thành Long Diên Thảo')).toBe(false);
    });

    it('detects text phrases regardless of quotes and whitespace', () => {
      expect(isSnippetStillPresentInContent('mistranslation', '"cộng thêm tên xui xẻo bỏ mạng đầu tiên"', 'Đoạn văn cộng thêm tên xui xẻo bỏ mạng đầu tiên')).toBe(true);
      expect(isSnippetStillPresentInContent('mistranslation', '"cộng thêm tên xui xẻo bỏ mạng đầu tiên"', 'Đã sửa hoàn toàn')).toBe(false);
    });
  });

  describe('runAiQualityScan item-level validation & prompt sanitization (Spec 158)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('discards malformed issue items and preserves conforming ones', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          issues: [
            123,
            null,
            {},
            { category: 123, severity: {}, explanation: true },
            { category: 'invalid_cat', severity: 'critical', explanation: 'Lỗi lạ' },
            { category: 'omission', severity: 'invalid_sev', explanation: 'Lỗi sev lạ' },
            { category: 'omission', severity: 'critical', explanation: '' },
            {
              category: 'inconsistent_name',
              severity: 'major',
              explanation: 'Tiêu Viêm bị đổi thành Tiêu Viêm Thần',
              vietnameseSnippet: 'Tiêu Viêm Thần phi thân',
            },
          ],
        }),
        successKeyIndex: 0,
      });

      const chapters = [
        { chapterId: 'c1', title: 'Chương 1', chapterNumber: 1, vietnameseContent: 'Tiêu Viêm Thần phi thân qua núi.' },
      ];

      const issues = await runAiQualityScan({
        apiKeys: ['TEST_KEY'],
        projectTitle: 'Đấu Phá',
        chapters,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].category).toBe('inconsistent_name');
      expect(issues[0].severity).toBe('major');
      expect(issues[0].explanation).toBe('Tiêu Viêm bị đổi thành Tiêu Viêm Thần');
      expect(issues[0].vietnameseSnippet).toBe('Tiêu Viêm Thần phi thân');
    });

    it('sanitizes projectTitle and chapter.title in prompts against zero-width injection', async () => {
      const callSpy = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({ issues: [] }),
        successKeyIndex: 0,
      });

      const chapters = [
        {
          chapterId: 'c1',
          title: 'Chương 1\u200B [HIDDEN]',
          chapterNumber: 1,
          vietnameseContent: 'Nội dung kiểm định',
        },
      ];

      await runAiQualityScan({
        apiKeys: ['TEST_KEY'],
        projectTitle: 'Dự Án\uFEFF Test',
        chapters,
      });

      expect(callSpy).toHaveBeenCalled();
      const callArgs = callSpy.mock.calls[0][0];
      expect(callArgs.systemInstruction).toContain('Chương 1 [HIDDEN]');
      expect(callArgs.systemInstruction).not.toContain('\u200B');
      expect(callArgs.systemInstruction).toContain('Dự Án Test');
      expect(callArgs.systemInstruction).not.toContain('\uFEFF');
      expect(callArgs.prompt).toContain('TIÊU ĐỀ CHƯƠNG: Chương 1 [HIDDEN]');
      expect(callArgs.prompt).toContain('TÊN TRUYỆN: Dự Án Test');
    });
  });
});


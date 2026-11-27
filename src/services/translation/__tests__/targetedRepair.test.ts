import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repairChapterCriticalIssuesDirect } from '../targetedRepair';
import { getGenreStyleGuide, getToneStyleGuide } from '../../../config/translationStyles';
import { executeSingleChapterTranslation } from '../../chapterTranslationService';
import { mapQaIssueToUnified, calculateAuditScore } from '../../auditBridgeService';
import * as directGeminiClient from '../../directGeminiClient';
import * as db from '../../db';
import * as directEngine from '../../directTranslationEngine';

describe('Targeted Paragraph Repair Service (US4 / FR-016 - FR-025)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('surgically splices only the targeted critical paragraph and preserves unrelated paragraphs byte-for-byte', async () => {
    const sourceText = [
      '第一章 启程',
      '萧炎站在山门前。',
      '他拿出了玄重尺，神色凝重。',
      '众人纷纷退避三舍。',
    ].join('\n\n');

    const p0 = 'Chương 1: Khởi hành';
    const p1 = 'Tiêu Viêm đứng trước sơn môn.';
    const p2Broken = 'Hắn lấy ra cây thước nặng bình thường, thần sắc bình thản.';
    const p3 = 'Mọi người đồng loạt lùi lại ba bước.';
    // Mixed CRLF and LF spacing to verify exact slice preservation around paragraph 2
    const translatedText = `${p0}\r\n\r\n${p1}\n\n${p2Broken}\r\n\r\n${p3}`;

    const spy = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        repairedParagraph: 'Hắn rút ra Huyền Trọng Xích, thần sắc ngưng trọng.',
      }),
      successKeyIndex: 1,
    });

    const result = await repairChapterCriticalIssuesDirect({
      sourceText,
      translatedText,
      issues: [
        {
          type: 'terminology',
          severity: 'critical',
          targetText: p2Broken,
          description: 'Sai thuật ngữ Huyền Trọng Xích',
          paragraphIndex: 2,
          source: 'deterministic',
          expectedTerm: { chinese: '玄重尺', vietnamese: 'Huyền Trọng Xích' },
        },
        {
          type: 'other',
          severity: 'info',
          targetText: p1,
          description: 'Góp ý nhẹ không cần sửa tự động',
          paragraphIndex: 1,
        },
      ],
      glossary: [
        {
          id: 'g1',
          chinese: '玄重尺',
          pinyin: 'Huyền Trọng Xích',
          vietnamese: 'Huyền Trọng Xích',
          type: 'term',
          note: '',
          origin: 'manual',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      apiKeys: ['TEST_KEY_1', 'TEST_KEY_2'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 0,
    });

    // Called once for paragraph 2 only (skipped info issue on paragraph 1)
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.repairedParagraphIndices).toEqual([2]);
    expect(result.rejectedParagraphIndices).toEqual([]);
    expect(result.successKeyIndex).toBe(1);

    // Character-for-character preservation of surrounding paragraphs and separators
    expect(result.repairedTranslatedText).toBe(
      `${p0}\r\n\r\n${p1}\n\nHắn rút ra Huyền Trọng Xích, thần sắc ngưng trọng.\r\n\r\n${p3}`
    );
    expect(result.updatedIssues[0].repaired).toBe(true);
    expect(result.updatedIssues[1].repaired).toBeUndefined();
  });

  it('rolls back replacement and rejects paragraph when repaired output introduces a new glossary or Han leftover violation', async () => {
    const sourceText = '第一章 启程\n\n萧炎手持玄重尺。\n\n夜风微凉。';
    const translatedText = 'Chương 1: Khởi hành\n\nTiêu Viêm tay cầm Huyền Trọng Xích.\n\nGió đêm se lạnh.';

    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        // Violates both Han leftover & missing glossary term compared to baseline
        repairedParagraph: 'Tiêu Viêm tay cầm 萧炎 và làm mất bảo vật.',
      }),
      successKeyIndex: 0,
    });

    const result = await repairChapterCriticalIssuesDirect({
      sourceText,
      translatedText,
      issues: [
        {
          type: 'mistranslation',
          severity: 'critical',
          targetText: 'Tiêu Viêm tay cầm Huyền Trọng Xích.',
          description: 'Lỗi ngữ nghĩa kiểm tra thử rollback',
          paragraphIndex: 1,
        },
      ],
      glossary: [
        {
          id: 'g1',
          chinese: '玄重尺',
          pinyin: 'Huyền Trọng Xích',
          vietnamese: 'Huyền Trọng Xích',
          type: 'term',
          note: '',
          origin: 'manual',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      apiKeys: ['TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(result.repairedParagraphIndices).toEqual([]);
    expect(result.rejectedParagraphIndices).toEqual([1]);
    expect(result.repairedTranslatedText).toBe(translatedText);
    expect(result.updatedIssues[0].repaired).toBeUndefined();
  });

  it('groups multiple critical issues on the same paragraph into one repair call and honors AbortSignal', async () => {
    const sourceText = '萧炎道。\n\n云韵点头。';
    const translatedText = 'Tiêu Viêm nói.\n\nVân Vận gật đầu.';

    const spy = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({ repairedParagraph: 'Tiêu Viêm trầm giọng nói.' }),
      successKeyIndex: 0,
    });

    const groupedResult = await repairChapterCriticalIssuesDirect({
      sourceText,
      translatedText,
      issues: [
        { type: 'pronoun', severity: 'critical', targetText: 'Tiêu Viêm nói.', description: 'Sai xưng hô', paragraphIndex: 0 },
        { type: 'omission', severity: 'critical', targetText: 'Tiêu Viêm nói.', description: 'Thiếu sắc thái', paragraphIndex: 0 },
      ],
      glossary: [],
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      apiKeys: ['TEST_KEY'],
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(groupedResult.repairedParagraphIndices).toEqual([0]);

    const abortController = new AbortController();
    abortController.abort();
    const abortedResult = await repairChapterCriticalIssuesDirect({
      sourceText,
      translatedText,
      issues: [
        { type: 'pronoun', severity: 'critical', targetText: 'Vân Vận gật đầu.', description: 'Sai xưng hô', paragraphIndex: 1 },
      ],
      glossary: [],
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      apiKeys: ['TEST_KEY'],
      signal: abortController.signal,
    });
    expect(abortedResult.repairedTranslatedText).toBe(translatedText);
    expect(abortedResult.rejectedParagraphIndices).toEqual([1]);
  });

  it('auto targeted repair in executeSingleChapterTranslation is opt-in (off by default) and capped at 1 pass when enabled', async () => {
    vi.spyOn(db, 'getChapterFromDB').mockResolvedValue({
      id: 'chap_repair',
      title: 'Chương 1',
      sourceText: '第一章 启程\n\n萧炎手持玄重尺。',
      rawTranslation: '',
      polishedTranslation: '',
      paragraphs: [],
      translatedLines: [],
      status: 'pending',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any);
    vi.spyOn(db, 'saveChapterToDB').mockResolvedValue(undefined as any);

    vi.spyOn(directEngine, 'translateRawDirect').mockResolvedValue({
      rawTranslation: 'Chương 1: Khởi hành\n\nTiêu Viêm tay cầm thanh thước đen.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });
    vi.spyOn(directEngine, 'polishTranslationDirect').mockResolvedValue({
      polishedTranslation: 'Chương 1: Khởi hành\n\nTiêu Viêm tay cầm thanh thước đen.',
      discoveredEntities: [],
      successKeyIndex: 0,
    });
    vi.spyOn(directEngine, 'qaCritiqueDirect').mockResolvedValue({
      isValid: false,
      issues: [],
      successKeyIndex: 0,
    });
    const repairSpy = vi.spyOn(directEngine, 'repairChapterCriticalIssuesDirect').mockResolvedValue({
      repairedTranslatedText: 'Chương 1: Khởi hành\n\nTiêu Viêm tay cầm Huyền Trọng Xích.',
      updatedIssues: [
        {
          type: 'terminology',
          severity: 'critical',
          targetText: 'Tiêu Viêm tay cầm thanh thước đen.',
          description: 'Thiếu thuật ngữ Huyền Trọng Xích',
          paragraphIndex: 1,
          source: 'deterministic',
          repaired: true,
        },
      ],
      repairedParagraphIndices: [1],
      rejectedParagraphIndices: [],
      successKeyIndex: 0,
    });

    const glossary = [
      {
        id: 'g1',
        chinese: '玄重尺',
        pinyin: 'Huyền Trọng Xích',
        vietnamese: 'Huyền Trọng Xích',
        type: 'term' as const,
        note: '',
        origin: 'manual' as const,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    const chapterMeta = {
      id: 'chap_repair',
      title: 'Chương 1',
      status: 'not_started' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    // 1. Default (opt-out): does NOT trigger targeted repair
    await executeSingleChapterTranslation({
      chapterMeta,
      glossarySnapshot: glossary,
      signal: new AbortController().signal,
      logPrefix: '[Test-Off]',
      startKeyIndex: 0,
      projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
      apiKeys: ['AQ_USER_KEY_123'],
      selectedModel: 'gemini-2.5-flash',
      polishCycles: 1,
      autoTranslateMode: 'from_scratch',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      enableAiQaCritique: true,
      enableSegmentTranslation: false,
      addLog: () => {},
    });
    expect(repairSpy).not.toHaveBeenCalled();

    const logs: string[] = [];
    // 2. Opt-in enabled: triggers at most 1 repair pass and persists repaired output
    const resEnabled = await executeSingleChapterTranslation({
      chapterMeta,
      glossarySnapshot: [
        ...glossary,
        {
          id: 'g_conflict',
          chinese: '玄重尺',
          pinyin: 'Thước Đen',
          vietnamese: 'Thước Đen',
          type: 'term' as const,
          note: '',
          origin: 'scanned' as const,
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
      signal: new AbortController().signal,
      logPrefix: '[Test-On]',
      startKeyIndex: 0,
      projState: { genre: 'Tiên Hiệp', tone: 'Trang nghiêm', description: '' },
      apiKeys: ['AQ_USER_KEY_123'],
      selectedModel: 'gemini-2.5-flash',
      polishCycles: 1,
      autoTranslateMode: 'from_scratch',
      additionalInstructions: '',
      isExtractionDuringTranslationEnabled: false,
      enableAiQaCritique: true,
      enableSegmentTranslation: false,
      enableAutoTargetedRepair: true,
      addLog: (msg) => logs.push(msg),
    });
    expect(repairSpy).toHaveBeenCalledTimes(1);
    expect(resEnabled.updatedChapter?.polishedTranslation).toContain('Huyền Trọng Xích');
    expect(resEnabled.updatedChapter?.qaIssues?.[0]?.repaired).toBe(true);
    expect(logs.some((msg) => msg.includes('[Cảnh báo Từ điển]'))).toBe(true);
    expect(logs.some((msg) => msg.includes('[Kiểm tra tuân thủ GĐ1]'))).toBe(true);
    expect(logs.some((msg) => msg.includes('[Kiểm tra tuân thủ GĐ2]'))).toBe(true);
  });

  it('maps repaired QA issues to resolved status in UnifiedAuditPanel and restores audit score', () => {
    const pendingIssue = mapQaIssueToUnified({
      type: 'terminology',
      severity: 'critical',
      targetText: 'thanh thước đen',
      description: 'Thiếu thuật ngữ Huyền Trọng Xích',
      paragraphIndex: 1,
      source: 'deterministic',
    });
    const resolvedIssue = mapQaIssueToUnified({
      type: 'terminology',
      severity: 'critical',
      targetText: 'thanh thước đen',
      description: 'Thiếu thuật ngữ Huyền Trọng Xích',
      paragraphIndex: 1,
      source: 'deterministic',
      repaired: true,
    });

    expect(pendingIssue.status).toBe('pending');
    expect(resolvedIssue.status).toBe('resolved');
    expect(calculateAuditScore([pendingIssue])).toBe(92);
    expect(calculateAuditScore([resolvedIssue])).toBe(100);
  });

  it('injects genre style guide, tone style guide, and priority hierarchy into targeted repair instructions', async () => {
    let capturedSystem = '';
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      capturedSystem = args.systemInstruction || '';
      return {
        text: JSON.stringify({
          repairedParagraph: 'Bản cung nói lời giữ lời.',
        }),
        successKeyIndex: 0,
      };
    });

    const genre = 'Cung Đấu / Gia Đấu';
    const tone = 'Sắc sảo cung đấu';

    await repairChapterCriticalIssuesDirect({
      sourceText: '本宫一言既出。',
      translatedText: 'Tôi nói lời giữ lời.',
      issues: [
        {
          type: 'pronoun',
          severity: 'critical',
          targetText: 'Tôi nói lời giữ lời.',
          description: 'Sai xưng hô hoàng hậu',
          paragraphIndex: 0,
          source: 'ai_critique',
        },
      ],
      glossary: [],
      genre,
      tone,
      description: 'Hoàng hậu luôn tự xưng Bản cung.',
      apiKeys: ['TEST_KEY'],
    });

    expect(capturedSystem).toContain(getGenreStyleGuide(genre));
    expect(capturedSystem).toContain(getToneStyleGuide(tone));
    expect(capturedSystem).toContain('Hoàng hậu luôn tự xưng Bản cung.');
    expect(capturedSystem).toContain('Quy tắc dịch riêng của dự án > Quy chuẩn Tông giọng biên tập > Chỉ dẫn Thể loại chính');
  });

  it('retries once with explicit constraint feedback for transient quote loss, logs rejectionReasons, and recovers omitted paragraph', async () => {
    const sourceText = [
      '第一章 深夜',
      '千江月推门走了进来。',
      '“你们到底在找什么？”钱仓一问道。',
      '众人沉默不语。',
    ].join('\n\n');

    // Bản dịch ban đầu: thiếu mất đoạn 3 (lời thoại Tiền Thương Nhất)
    const translatedMissing = [
      'Chương 1: Đêm Khuya',
      'Thiên Giang Nguyệt đẩy cửa bước vào.',
      'Mọi người đều im lặng không nói.',
    ].join('\n\n');

    let quoteRetryCalls = 0;
    const spyQuote = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
      quoteRetryCalls++;
      if (quoteRetryCalls === 1) {
        return {
          text: JSON.stringify({
            repairedParagraph: 'Các ngươi rốt cuộc đang tìm gì vậy? Tiền Thương Nhất hỏi.', // quên ngoặc thoại lần 1
          }),
          successKeyIndex: 0,
        };
      }
      expect(args.prompt).toContain('PHẢN HỒI SỬA LẠI BẮT BUỘC');
      return {
        text: JSON.stringify({
          repairedParagraph: '"Các ngươi rốt cuộc đang tìm gì vậy?" Tiền Thương Nhất hỏi.',
        }),
        successKeyIndex: 0,
      };
    });

    const quoteRes = await repairChapterCriticalIssuesDirect({
      sourceText: '“你们到底在找什么？”钱仓一问道。',
      translatedText: 'Các ngươi rốt cuộc đang tìm gì? Tiền Thương Nhất hỏi.',
      issues: [
        {
          type: 'other',
          severity: 'critical',
          targetText: 'Các ngươi rốt cuộc đang tìm gì? Tiền Thương Nhất hỏi.',
          description: '[Cấu trúc 1-1] Đoạn 1 làm mất dấu ngoặc lời thoại trực tiếp.',
          paragraphIndex: 0,
        },
      ],
      glossary: [],
      genre: 'Kinh Dị',
      tone: 'U ám',
      apiKeys: ['KEY_1'],
    });
    expect(spyQuote).toHaveBeenCalledTimes(2);
    expect(quoteRes.repairedParagraphIndices).toEqual([0]);
    expect(quoteRes.repairedTranslatedText).toContain('"Các ngươi rốt cuộc đang tìm gì vậy?"');

    // Kiểm tra rejectionReasons chi tiết khi cả 2 lần sửa vẫn vi phạm
    vi.restoreAllMocks();
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({ repairedParagraph: 'Vẫn quên ngoặc thoại.' }),
      successKeyIndex: 0,
    });
    const rejectRes = await repairChapterCriticalIssuesDirect({
      sourceText: '“你们到底在找什么？”钱仓一问道。',
      translatedText: 'Các ngươi đang tìm gì.',
      issues: [
        {
          type: 'other',
          severity: 'critical',
          targetText: 'Các ngươi đang tìm gì.',
          description: 'Mất ngoặc thoại',
          paragraphIndex: 0,
        },
      ],
      glossary: [],
      genre: 'Kinh Dị',
      tone: 'U ám',
      apiKeys: ['KEY_1'],
    });
    expect(rejectRes.rejectedParagraphIndices).toEqual([0]);
    expect(rejectRes.rejectionReasons?.[0]).toContain('ngoặc lời thoại');

    // Kiểm tra pha 2 phục hồi đoạn văn gốc bị bỏ sót
    vi.restoreAllMocks();
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        repairedParagraph: '"Các ngươi rốt cuộc đang tìm gì?" Tiền Thương Nhất hỏi.',
      }),
      successKeyIndex: 0,
    });
    const omissionRes = await repairChapterCriticalIssuesDirect({
      sourceText,
      translatedText: translatedMissing,
      issues: [
        {
          type: 'omission',
          severity: 'critical',
          targetText: '',
          description: `Bản dịch bị bỏ sót hoàn toàn đoạn văn gốc tiếng Trung: '“你们到底在找什么？”钱仓一问道。' ngay sau đoạn 'Thiên Giang Nguyệt đẩy cửa bước vào.'`,
          source: 'ai_critique',
        },
        {
          type: 'omission',
          severity: 'critical',
          targetText: translatedMissing.split('\n\n')[1],
          description: '[Cấu trúc 1-1] Số đoạn/dòng thân bài bị lệch so với bản gốc (2 đoạn so với 3 đoạn gốc).',
          source: 'deterministic',
        },
      ],
      glossary: [],
      genre: 'Kinh Dị',
      tone: 'U ám',
      apiKeys: ['KEY_1'],
    });
    expect(omissionRes.recoveredOmissionCount).toBe(1);
    expect(omissionRes.updatedIssues[0].repaired).toBe(true);
    expect(omissionRes.updatedIssues[1].repaired).toBe(true);
    expect(omissionRes.repairedTranslatedText.split('\n\n')).toEqual([
      'Chương 1: Đêm Khuya',
      'Thiên Giang Nguyệt đẩy cửa bước vào.',
      '"Các ngươi rốt cuộc đang tìm gì?" Tiền Thương Nhất hỏi.',
      'Mọi người đều im lặng không nói.',
    ]);
  });
});

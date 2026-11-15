import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repairChapterCriticalIssuesDirect } from '../targetedRepair';
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
});

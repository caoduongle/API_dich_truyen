import { describe, it, expect, vi, beforeEach } from 'vitest';
import { qaCritiqueDirect } from '../qaCritique';
import { mergeAndDeduplicateQaIssues } from '../translationValidation';
import { buildQaCritiquePayload } from '../../ai/prompts';
import * as directGeminiClient from '../../directGeminiClient';

describe('qaCritiqueDirect Service Tests (Spec 157)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects empty object {} response from Gemini and throws schema error instead of false pass', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: '{}',
      successKeyIndex: 0,
    });

    await expect(
      qaCritiqueDirect({
        sourceText: '原文',
        translatedText: 'Bản dịch',
        apiKeys: ['TEST_KEY'],
        model: 'gemini-2.5-flash',
      })
    ).rejects.toThrow(/không thỏa mãn cấu trúc yêu cầu/);
  });

  it('rejects payload missing isValid or issues from Gemini', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({ isValid: true }),
      successKeyIndex: 0,
    });

    await expect(
      qaCritiqueDirect({
        sourceText: '原文',
        translatedText: 'Bản dịch',
        apiKeys: ['TEST_KEY'],
        model: 'gemini-2.5-flash',
      })
    ).rejects.toThrow(/không thỏa mãn cấu trúc yêu cầu/);
  });

  it('filters out malformed issue items (primitives, empty dicts, invalid severity) and preserves valid issues', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: false,
        issues: [
          123,
          {},
          { severity: false },
          { description: '   ' },
          {
            type: 'omission',
            severity: 'critical',
            targetText: '',
            description: 'Thiếu đoạn văn kết chương',
          },
          {
            type: 'addition',
            severity: 'warning',
            targetText: 'Thần tiên hạ phàm',
            description: 'Bản gốc không có chi tiết này',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await qaCritiqueDirect({
      sourceText: '原文',
      translatedText: 'Bản dịch',
      apiKeys: ['TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(res.isValid).toBe(false);
    expect(res.issues).toHaveLength(2);
    expect(res.issues[0]).toEqual({
      type: 'omission',
      severity: 'critical',
      targetText: '',
      description: 'Thiếu đoạn văn kết chương',
    });
    expect(res.issues[1]).toEqual({
      type: 'addition',
      severity: 'warning',
      targetText: 'Thần tiên hạ phàm',
      description: 'Bản gốc không có chi tiết này',
    });
  });

  it('strictly drops incomplete issues missing type, severity, or targetText rather than coercing to defaults', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: false,
        issues: [
          { description: 'Có lỗi dịch nhưng thiếu type, severity, targetText' },
          { type: 'omission', description: 'Thiếu type và targetText' },
          { severity: 'critical', description: 'Thiếu type và targetText' },
          { type: 'omission', severity: 'critical', description: 'Thiếu targetText' },
          {
            type: 'terminology',
            severity: 'info',
            targetText: 'Đan điền',
            description: 'Nên dịch chuẩn thuật ngữ tiên hiệp',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await qaCritiqueDirect({
      sourceText: '原文',
      translatedText: 'Bản dịch',
      apiKeys: ['TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(res.isValid).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0]).toEqual({
      type: 'terminology',
      severity: 'info',
      targetText: 'Đan điền',
      description: 'Nên dịch chuẩn thuật ngữ tiên hiệp',
    });
  });

  it('returns clean critique result when Gemini returns valid clean report', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: true,
        issues: [],
      }),
      successKeyIndex: 1,
    });

    const res = await qaCritiqueDirect({
      sourceText: '原文',
      translatedText: 'Bản dịch hoàn hảo',
      apiKeys: ['TEST_KEY_1', 'TEST_KEY_2'],
      model: 'gemini-2.5-flash',
      startKeyIndex: 1,
    });

    expect(res.isValid).toBe(true);
    expect(res.issues).toEqual([]);
    expect(res.successKeyIndex).toBe(1);
  });

  it('accepts extended QA issue taxonomy (mistranslation, pronoun, raw_leak)', async () => {
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        isValid: false,
        issues: [
          {
            type: 'mistranslation',
            severity: 'critical',
            targetText: 'Hắn uống chén độc dược',
            description: 'Nguyên tác là "giải dược", dịch thành "độc dược" là đảo ngược nghĩa.',
          },
          {
            type: 'pronoun',
            severity: 'warning',
            targetText: 'Hắn khẽ mỉm cười',
            description: 'Nhân vật Lâm Tĩnh là nữ, nên dùng "nàng".',
          },
          {
            type: 'raw_leak',
            severity: 'critical',
            targetText: 'Cảnh giới đột phá [Chưa dịch]',
            description: 'Còn sót ngoặc vuông nháp trong bản chuốt.',
          },
        ],
      }),
      successKeyIndex: 0,
    });

    const res = await qaCritiqueDirect({
      sourceText: '原文',
      translatedText: 'Hắn uống chén độc dược\n\nHắn khẽ mỉm cười\n\nCảnh giới đột phá [Chưa dịch]',
      apiKeys: ['TEST_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(res.isValid).toBe(false);
    expect(res.issues.map((i) => i.type)).toEqual(['mistranslation', 'pronoun', 'raw_leak']);
  });

  it('mergeAndDeduplicateQaIssues deduplicates overlapping type+paragraphIndex while preserving exact shape of unmatched AI issues', () => {
    const translatedText = 'Chương 1: Khởi đầu\n\nĐoạn hai sai thuật ngữ.\n\nĐoạn ba thiếu ý.';
    const detIssues = [
      {
        type: 'terminology' as const,
        severity: 'critical' as const,
        targetText: 'Đoạn hai sai thuật ngữ.',
        description: 'Thiếu thuật ngữ Kiếm Đan',
        paragraphIndex: 1,
        source: 'deterministic' as const,
        expectedTerm: { chinese: '剑丹', vietnamese: 'Kiếm Đan' },
      },
    ];
    const aiIssues = [
      {
        type: 'terminology' as const,
        severity: 'warning' as const,
        targetText: 'sai thuật ngữ',
        description: 'AI trùng lỗi thuật ngữ ở đoạn hai',
      },
      {
        type: 'omission' as const,
        severity: 'warning' as const,
        targetText: 'câu không có trong bản dịch',
        description: 'Lỗi chưa định vị đoạn',
      },
    ];

    const merged = mergeAndDeduplicateQaIssues({
      deterministicIssues: detIssues,
      aiIssues,
      translatedText,
    });

    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('deterministic');
    expect(merged[0].expectedTerm).toEqual({ chinese: '剑丹', vietnamese: 'Kiếm Đan' });
    // Unmatched AI issue preserves exact own keys without extra undefined properties
    expect(merged[1]).toEqual(aiIssues[1]);
    expect(Object.keys(merged[1])).toEqual(['type', 'severity', 'targetText', 'description']);
  });

  it('buildQaCritiquePayload serializes character gender and relation pronoun rules for QA comparison', () => {
    const { prompt } = buildQaCritiquePayload({
      sourceText: '萧炎看着云韵。',
      translatedText: 'Tiêu Viêm nhìn Vân Vận.',
      genre: 'Tiên Hiệp',
      tone: 'Trang nghiêm',
      glossary: [
        {
          id: 'g1',
          chinese: '萧炎',
          pinyin: 'Tiêu Viêm',
          vietnamese: 'Tiêu Viêm',
          type: 'character',
          note: '',
          characterProfile: {
            gender: 'male',
            defaultNarrativePronoun: 'hắn',
            relations: [{ targetName: 'Vân Vận', selfPronoun: 'ta', targetPronoun: 'nàng' }],
          },
          origin: 'manual',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(prompt).toContain('Giới tính: Nam');
    expect(prompt).toContain('Đại từ tự sự (ngôi thứ 3): "hắn"');
    expect(prompt).toContain('với Vân Vận (xưng "ta" - gọi "nàng")');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { qaCritiqueDirect } from '../qaCritique';
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
});

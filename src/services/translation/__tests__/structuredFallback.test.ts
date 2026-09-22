import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../../directGeminiClient';
import { translateRawDirect } from '../rawTranslation';
import { polishTranslationDirect } from '../polishTranslation';

describe('Structured Response Fallback & Schema Bypass Prevention (US1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('translateRawDirect', () => {
    it('throws structural error and DOES NOT fallback to raw JSON when response is valid JSON with invalid schema', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          foo: 'Đây là một chuỗi văn bản khá dài vượt quá 30 ký tự nhưng không có trường rawTranslation hay translation.',
          status: 'error_or_random',
        }),
        successKeyIndex: 0,
      });

      await expect(
        translateRawDirect({
          text: '第一章 萧炎\n这是第一段。',
          genre: 'Tiên Hiệp',
          tone: 'Cổ phong',
          glossary: [],
          apiKeys: ['TEST_API_KEY'],
        })
      ).rejects.toThrow(/không thỏa mãn cấu trúc yêu cầu/);
    });

    it('successfully extracts valid raw translation when schema is compliant', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          rawTranslation: 'Chương 1 Tiêu Viêm\n\nĐây là đoạn đầu tiên.',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      });

      const result = await translateRawDirect({
        text: '第一章 萧炎\n\n这是第一段。',
        genre: 'Tiên Hiệp',
        tone: 'Cổ phong',
        glossary: [],
        apiKeys: ['TEST_API_KEY'],
      });

      expect(result.rawTranslation).toContain('Chương 1 Tiêu Viêm');
      expect(result.successKeyIndex).toBe(0);
    });
  });

  describe('polishTranslationDirect', () => {
    it('throws structural error and DOES NOT fallback to raw JSON when polish response has invalid schema', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          notes: 'Đây là phần ghi chú dài hơn 30 ký tự từ AI thay vì trả về trường polishedTranslation chuẩn.',
          version: 2,
        }),
        successKeyIndex: 0,
      });

      await expect(
        polishTranslationDirect({
          sourceText: '第一章 萧炎\n\n这是第一段。',
          rawTranslation: 'Chương 1 Tiêu Viêm\n\nĐây là đoạn đầu tiên.',
          genre: 'Tiên Hiệp',
          tone: 'Cổ phong',
          glossary: [],
          apiKeys: ['TEST_API_KEY'],
        })
      ).rejects.toThrow(/không thỏa mãn cấu trúc yêu cầu/);
    });

    it('successfully extracts valid polish translation when schema is compliant', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          polishedTranslation: 'Chương 1: Tiêu Viêm\n\nĐây là đoạn mở đầu câu chuyện mượt mà.',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      });

      const result = await polishTranslationDirect({
        sourceText: '第一章 萧炎\n\n这是第一段。',
        rawTranslation: 'Chương 1 Tiêu Viêm\n\nĐây là đoạn đầu tiên.',
        genre: 'Tiên Hiệp',
        tone: 'Cổ phong',
        glossary: [],
        apiKeys: ['TEST_API_KEY'],
      });

      expect(result.polishedTranslation).toContain('Chương 1: Tiêu Viêm');
      expect(result.successKeyIndex).toBe(0);
    });
  });
});

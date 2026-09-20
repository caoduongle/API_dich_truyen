import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../../directGeminiClient';
import { rewriteSentenceDirect } from '../sentenceRewrite';

describe('src/services/translation/sentenceRewrite.ts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input Sanitization (T004 & T005)', () => {
    it('sanitizes zero-width and unicode tag characters from targetText, context, and issueMessage', async () => {
      let capturedPrompt = '';
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (params: any) => {
        capturedPrompt = params.prompt;
        return {
          text: JSON.stringify({ rewrittenSentence: 'Gió nhẹ thổi qua hàng liễu ven hồ.' }),
          successKeyIndex: 0,
        };
      });

      const dirtyTargetText = 'Gió\u200B thổi\uFEFF qua\u{E0001} hàng liễu.';
      const dirtyContext = 'Bên hồ\u200C liễu rủ\u200D bóng xanh mát.';
      const dirtyIssueMessage = 'Câu văn\u202A hơi gượng\u202C gạo.';

      const result = await rewriteSentenceDirect({
        targetText: dirtyTargetText,
        context: dirtyContext,
        issueMessage: dirtyIssueMessage,
        apiKeys: ['TEST_API_KEY'],
      });

      expect(result.rewrittenSentence).toBe('Gió nhẹ thổi qua hàng liễu ven hồ.');
      expect(result.successKeyIndex).toBe(0);

      // Verify prompt has no zero-width characters or unicode tag characters
      expect(capturedPrompt).not.toContain('\u200B');
      expect(capturedPrompt).not.toContain('\uFEFF');
      expect(capturedPrompt).not.toContain('\u{E0001}');
      expect(capturedPrompt).not.toContain('\u200C');
      expect(capturedPrompt).not.toContain('\u200D');
      expect(capturedPrompt).not.toContain('\u202A');
      expect(capturedPrompt).not.toContain('\u202C');

      // Verify cleaned text content is present
      expect(capturedPrompt).toContain('Gió thổi qua hàng liễu.');
      expect(capturedPrompt).toContain('Bên hồ liễu rủ bóng xanh mát.');
      expect(capturedPrompt).toContain('Câu văn hơi gượng gạo.');
    });

    it('handles empty optional context and issueMessage gracefully', async () => {
      let capturedPrompt = '';
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (params: any) => {
        capturedPrompt = params.prompt;
        return {
          text: JSON.stringify({ rewrittenSentence: 'Bản dịch mới.' }),
          successKeyIndex: 1,
        };
      });

      const result = await rewriteSentenceDirect({
        targetText: 'Bản dịch cũ.',
        apiKeys: ['TEST_KEY_1', 'TEST_KEY_2'],
        startKeyIndex: 1,
      });

      expect(result.rewrittenSentence).toBe('Bản dịch mới.');
      expect(result.successKeyIndex).toBe(1);
      expect(capturedPrompt).not.toContain('Ngữ cảnh xung quanh');
      expect(capturedPrompt).not.toContain('Vấn đề cần khắc phục');
    });
  });

  describe('Structured Response Validation (T006 & T011)', () => {
    it('successfully parses valid JSON response and returns trimmed sentence', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          rewrittenSentence: '   Kiếm khí tung hoành ba vạn dặm.   ',
        }),
        successKeyIndex: 0,
      });

      const result = await rewriteSentenceDirect({
        targetText: 'Kiếm khí bay khắp nơi.',
        apiKeys: ['TEST_API_KEY'],
      });

      expect(result.rewrittenSentence).toBe('Kiếm khí tung hoành ba vạn dặm.');
    });

    it('throws structured parsing error when AI response is not valid JSON', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: 'Chỉ là một câu trả lời thuần văn bản không có JSON',
        successKeyIndex: 0,
      });

      await expect(
        rewriteSentenceDirect({
          targetText: 'Câu cũ.',
          apiKeys: ['TEST_KEY'],
        })
      ).rejects.toThrow(/ngữ cảnh \[sentenceRewrite\]/);
    });

    it('throws validation error when rewrittenSentence is missing from JSON', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          differentField: 'Giá trị khác',
        }),
        successKeyIndex: 0,
      });

      await expect(
        rewriteSentenceDirect({
          targetText: 'Câu cũ.',
          apiKeys: ['TEST_KEY'],
        })
      ).rejects.toThrow(/không thỏa mãn cấu trúc yêu cầu/);
    });

    it('throws validation error when rewrittenSentence is a non-string type (e.g. number)', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          rewrittenSentence: 12345,
        }),
        successKeyIndex: 0,
      });

      await expect(
        rewriteSentenceDirect({
          targetText: 'Câu cũ.',
          apiKeys: ['TEST_KEY'],
        })
      ).rejects.toThrow(/không thỏa mãn cấu trúc yêu cầu/);
    });

    it('throws error when rewrittenSentence is an empty string', async () => {
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          rewrittenSentence: '   ',
        }),
        successKeyIndex: 0,
      });

      await expect(
        rewriteSentenceDirect({
          targetText: 'Câu cũ.',
          apiKeys: ['TEST_KEY'],
        })
      ).rejects.toThrow('AI không trả về câu viết lại hợp lệ.');
    });
  });
});

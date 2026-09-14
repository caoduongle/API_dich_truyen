/**
 * Targeted AI Sentence Rewriting
 * Viết lại một câu/cụm từ cụ thể theo góp ý biên tập và ngữ cảnh văn học
 */

import { callGeminiDirect } from '../directGeminiClient';
import { safeParseJson } from '../../lib/text';

export interface DirectRewriteSentenceParams {
  /** Đoạn trích văn bản cần viết lại */
  targetText: string;
  /** Ngữ cảnh các câu/đoạn xung quanh để AI hiểu ngữ cảnh (tùy chọn) */
  context?: string;
  /** Hướng dẫn/vấn đề cần khắc phục lấy từ issue.message */
  issueMessage?: string;
  /** Thể loại tiểu thuyết để giữ phong cách văn học */
  genre?: string;
  /** Tông giọng biên dịch của tác phẩm */
  tone?: string;
  /** Danh sách API Keys cá nhân của người dùng */
  apiKeys: string[];
  /** Mã mô hình Gemini được chọn */
  model?: string;
  /** Chỉ số API Key bắt đầu xoay vòng */
  startKeyIndex?: number;
  /** Tín hiệu hủy yêu cầu mạng nếu người dùng chuyển trang */
  signal?: AbortSignal;
}

export interface DirectRewriteSentenceResult {
  /** Câu/đoạn trích đã được viết lại hoàn chỉnh */
  rewrittenSentence: string;
  /** Chỉ số API key thành công */
  successKeyIndex: number;
}

export async function rewriteSentenceDirect(
  params: DirectRewriteSentenceParams
): Promise<DirectRewriteSentenceResult> {
  const {
    targetText,
    context = '',
    issueMessage = '',
    genre = '',
    tone = '',
    apiKeys,
    model,
    startKeyIndex = 0,
    signal,
  } = params;

  const genrePart = genre ? ` Thể loại truyện: ${genre}.` : '';
  const tonePart = tone ? ` Tông giọng: ${tone}.` : '';

  const systemInstruction =
    'Bạn là biên tập viên tiểu thuyết dịch Trung-Việt chuyên nghiệp. ' +
    'Nhiệm vụ duy nhất: viết lại câu/cụm từ được cung cấp cho mượt mà, ' +
    'tự nhiên hơn trong tiếng Việt, giữ đúng ý nghĩa gốc và phong cách ' +
    'văn phong tiểu thuyết.' + genrePart + tonePart + ' Không giải thích, chỉ trả về câu đã viết lại.';

  const contextPart = context
    ? `\n\nNgữ cảnh xung quanh (để hiểu mạch văn):\n"${context}"`
    : '';

  const issuePart = issueMessage
    ? `\n\nVấn đề cần khắc phục: ${issueMessage}`
    : '';

  const prompt =
    `Viết lại câu/cụm từ sau cho mượt mà, tự nhiên hơn trong tiếng Việt:` +
    `\n\nCâu cần viết lại:\n"${targetText}"` +
    contextPart +
    issuePart +
    `\n\nYêu cầu:` +
    `\n- Giữ nguyên ý nghĩa gốc` +
    `\n- Phong cách văn phong tiểu thuyết` +
    `\n- Chỉ trả về câu đã viết lại, không giải thích`;

  const schema = {
    type: 'OBJECT' as const,
    properties: {
      rewrittenSentence: {
        type: 'STRING' as const,
        description: 'Câu/cụm từ đã được viết lại hoàn chỉnh theo góp ý biên tập',
      },
    },
    required: ['rewrittenSentence'],
  };

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.4,
    startKeyIndex,
    signal,
  });

  const parsed = safeParseJson(response.text);
  const rewrittenSentence = parsed?.rewrittenSentence || '';

  if (!rewrittenSentence.trim()) {
    throw new Error('AI không trả về câu viết lại hợp lệ.');
  }

  return {
    rewrittenSentence: rewrittenSentence.trim(),
    successKeyIndex: response.successKeyIndex,
  };
}

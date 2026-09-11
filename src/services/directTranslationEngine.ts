import { callGeminiDirect } from './directGeminiClient';
import {
  buildRawTranslationPayload,
  buildPolishTranslationPayload,
  buildQaCritiquePayload,
} from './ai/prompts';
import {
  safeParseJson,
  separateChapterTitleAndBody,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  splitTextAdaptively,
  estimateTokenCount,
} from '../lib/text';
import { validateAndSnapBackEntities } from '../lib/sinoNormalize';
import { GlossaryItem } from '../types';

export interface DirectRawTranslationParams {
  text: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
}

export interface DirectRawTranslationResult {
  rawTranslation: string;
  discoveredEntities: any[];
  successKeyIndex: number;
}

export interface DirectPolishTranslationParams {
  sourceText: string;
  rawTranslation: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  additionalInstructions?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  isExtractionEnabled?: boolean;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
}

export interface DirectPolishTranslationResult {
  polishedTranslation: string;
  discoveredEntities?: any[];
  successKeyIndex: number;
}

export interface DirectQaCritiqueParams {
  sourceText: string;
  translatedText: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export interface DirectQaCritiqueIssue {
  type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
  severity: 'critical' | 'warning' | 'info';
  targetText: string;
  description: string;
}

export interface DirectQaCritiqueResult {
  isValid: boolean;
  issues: DirectQaCritiqueIssue[];
  successKeyIndex: number;
}

/**
 * Thực thi dịch thô Giai đoạn 1 trực tiếp từ trình duyệt
 */
export async function translateRawDirect(
  params: DirectRawTranslationParams
): Promise<DirectRawTranslationResult> {
  const {
    text,
    genre,
    tone,
    glossary,
    apiKeys,
    model,
    startKeyIndex = 0,
    description,
    enableSegmentTranslation,
    signal,
  } = params;

  if (!text || !text.trim()) {
    throw new Error('Văn bản cần dịch không được để trống.');
  }

  // Chế độ dịch theo từng câu/dòng độc lập
  if (enableSegmentTranslation) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const translatedParagraphs: string[] = [];
    let currentKeyIdx = startKeyIndex;
    const discoveredEntitiesAll: any[] = [];

    for (const line of lines) {
      if (!line) continue;
      const res = await translateRawDirect({
        ...params,
        text: line,
        enableSegmentTranslation: false,
        startKeyIndex: currentKeyIdx,
      });
      translatedParagraphs.push(res.rawTranslation);
      currentKeyIdx = res.successKeyIndex;
      if (Array.isArray(res.discoveredEntities)) {
        discoveredEntitiesAll.push(...res.discoveredEntities);
      }
    }

    return {
      rawTranslation: translatedParagraphs.join('\n\n'),
      discoveredEntities: discoveredEntitiesAll,
      successKeyIndex: currentKeyIdx,
    };
  }

  // Nếu văn bản quá dài (> 2000 token), phân đoạn thích ứng để tránh tràn token hoặc vi phạm filter
  if (estimateTokenCount(text) > 2000) {
    const chunks = splitTextAdaptively(text, 2);
    if (chunks.length > 1) {
      const translatedChunks: string[] = [];
      let currentKeyIdx = startKeyIndex;
      const discoveredEntitiesAll: any[] = [];

      for (const chunk of chunks) {
        const res = await translateRawDirect({
          ...params,
          text: chunk,
          startKeyIndex: currentKeyIdx,
        });
        translatedChunks.push(res.rawTranslation);
        currentKeyIdx = res.successKeyIndex;
        if (Array.isArray(res.discoveredEntities)) {
          discoveredEntitiesAll.push(...res.discoveredEntities);
        }
      }

      return {
        rawTranslation: translatedChunks.join('\n\n'),
        discoveredEntities: discoveredEntitiesAll,
        successKeyIndex: currentKeyIdx,
      };
    }
  }

  const { systemInstruction, prompt, schema } = buildRawTranslationPayload({
    text,
    genre,
    tone,
    description,
    glossary,
  });

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.3,
    startKeyIndex,
    signal,
  });

  const parsed = safeParseJson(response.text);
  let finalRawTranslation = parsed?.rawTranslation || '';

  if (!finalRawTranslation || finalRawTranslation.trim() === '') {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.raw_translation;
    if (altKey && altKey.trim() !== '') {
      finalRawTranslation = altKey;
    } else if (response.text && response.text.trim().length > 30) {
      if (!response.text.includes('"rawTranslation"') && !response.text.includes('"translation"')) {
        finalRawTranslation = response.text;
      }
    }
  }

  let finalDiscoveredEntities = Array.isArray(parsed?.discoveredEntities) ? parsed.discoveredEntities : [];
  finalDiscoveredEntities = validateAndSnapBackEntities(finalDiscoveredEntities, text);

  finalRawTranslation = separateChapterTitleAndBody(finalRawTranslation);
  validateTranslationOutput(finalRawTranslation);

  return {
    rawTranslation: finalRawTranslation,
    discoveredEntities: finalDiscoveredEntities,
    successKeyIndex: response.successKeyIndex,
  };
}

/**
 * Thực thi chuốt văn phong Giai đoạn 2 trực tiếp từ trình duyệt
 */
export async function polishTranslationDirect(
  params: DirectPolishTranslationParams
): Promise<DirectPolishTranslationResult> {
  const {
    sourceText,
    rawTranslation,
    genre,
    tone,
    glossary,
    additionalInstructions,
    apiKeys,
    model,
    startKeyIndex = 0,
    description,
    isExtractionEnabled = false,
    signal,
  } = params;

  const { systemInstruction, prompt, schema } = buildPolishTranslationPayload({
    sourceText,
    rawTranslation,
    genre,
    tone,
    description,
    glossary,
    additionalInstructions,
    isExtractionEnabled,
  });

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.45,
    startKeyIndex,
    signal,
  });

  const parsed = safeParseJson(response.text);
  let finalPolishedTranslation = parsed?.polishedTranslation || '';

  if (!finalPolishedTranslation || finalPolishedTranslation.trim() === '') {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.polished_translation;
    if (altKey && altKey.trim() !== '') {
      finalPolishedTranslation = altKey;
    } else if (response.text && response.text.trim().length > 30) {
      if (!response.text.includes('"polishedTranslation"') && !response.text.includes('"translation"')) {
        finalPolishedTranslation = response.text;
      }
    }
  }

  finalPolishedTranslation = ensureChapterTitlePreserved(rawTranslation, finalPolishedTranslation);
  validateTranslationOutput(finalPolishedTranslation);

  const discoveredEntities = isExtractionEnabled && Array.isArray(parsed?.discoveredEntities)
    ? validateAndSnapBackEntities(parsed.discoveredEntities, sourceText)
    : [];

  return {
    polishedTranslation: finalPolishedTranslation,
    discoveredEntities,
    successKeyIndex: response.successKeyIndex,
  };
}

/**
 * Thực thi kiểm duyệt chất lượng Giai đoạn 3 (QA Critique) trực tiếp từ trình duyệt
 */
export async function qaCritiqueDirect(
  params: DirectQaCritiqueParams
): Promise<DirectQaCritiqueResult> {
  const { sourceText, translatedText, apiKeys, model, startKeyIndex = 0, signal } = params;

  const { systemInstruction, prompt, schema } = buildQaCritiquePayload({
    sourceText,
    translatedText,
  });

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.15,
    startKeyIndex,
    signal,
  });

  const parsed = safeParseJson(response.text);
  return {
    isValid: parsed?.isValid ?? true,
    issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
    successKeyIndex: response.successKeyIndex,
  };
}

// ─── Targeted AI Sentence Rewriting (Feature 104) ───────────────────────────

export interface DirectRewriteSentenceParams {
  /** Đoạn trích văn bản cần viết lại */
  targetText: string;
  /** Ngữ cảnh các câu/đoạn xung quanh để AI hiểu ngữ cảnh (tùy chọn) */
  context?: string;
  /** Hướng dẫn/vấn đề cần khắc phục lấy từ issue.message */
  issueMessage?: string;
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

/**
 * Viết lại một câu/cụm từ cụ thể cho mượt hơn/đúng ngữ cảnh hơn.
 * Chỉ gửi targetText + context nhỏ, KHÔNG gửi toàn bộ chương.
 */
export async function rewriteSentenceDirect(
  params: DirectRewriteSentenceParams
): Promise<DirectRewriteSentenceResult> {
  const {
    targetText,
    context = '',
    issueMessage = '',
    apiKeys,
    model,
    startKeyIndex = 0,
    signal,
  } = params;

  const systemInstruction =
    'Bạn là biên tập viên tiểu thuyết dịch Trung-Việt chuyên nghiệp. ' +
    'Nhiệm vụ duy nhất: viết lại câu/cụm từ được cung cấp cho mượt mà, ' +
    'tự nhiên hơn trong tiếng Việt, giữ đúng ý nghĩa gốc và phong cách ' +
    'văn phong tiểu thuyết. Không giải thích, chỉ trả về câu đã viết lại.';

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

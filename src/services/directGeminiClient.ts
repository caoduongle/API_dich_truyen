import { DEFAULT_MODEL_ID } from '../config/models';
import { LITERARY_TRANSLATION_FRAMING, sanitizePromptInput, parseGeminiStructuredResponse } from '../lib/text';
import { GlossaryType } from '../types';
import { getStoredCustomLimits } from '../utils/customLimitsStorage';

export { getStoredCustomLimits };

export interface DirectGeminiRequestOptions {
  apiKeys: string[];
  model?: string;
  prompt: string;
  systemInstruction?: string;
  schema?: Record<string, any>;
  temperature?: number;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export interface DirectGeminiResponse {
  text: string;
  successKeyIndex: number;
}

import { formatGeminiNetworkError } from './gemini/geminiTransport';
import { callGemini } from './gemini/geminiClient';

export { formatGeminiNetworkError };

/**
 * Gọi trực tiếp REST API của Google Gemini từ trình duyệt người dùng với API key cá nhân
 * (Facade chuyển tiếp tới mô-đun hóa src/services/gemini/geminiClient.ts)
 */
export async function callGeminiDirect(
  options: DirectGeminiRequestOptions
): Promise<DirectGeminiResponse> {
  return callGemini(options);
}

export interface ListModelsOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Tra cứu danh sách models trực tiếp từ Google Gemini API bằng API key cá nhân kèm timeout bảo vệ 15s.
 */
export async function listModelsDirect(
  apiKey: string,
  options?: ListModelsOptions
): Promise<Array<{
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}>> {
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!cleanKey) {
    throw new Error('API key không hợp lệ.');
  }

  const timeoutMs = options?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Quá thời gian kết nối (timeout ${timeoutMs / 1000}s) khi tải danh sách models từ Google Gemini API.`));
  }, timeoutMs);

  let onCallerAbort: (() => void) | undefined;
  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(options.signal.reason);
    } else {
      onCallerAbort = () => {
        controller.abort(options.signal?.reason);
      };
      options.signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': cleanKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`Gemini API Error: ${errMsg}`);
    }

    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return models.map((m: any) => ({
      name: m.name,
      displayName: m.displayName || m.name,
      description: m.description || '',
      supportedGenerationMethods: m.supportedGenerationMethods || [],
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
    }));
  } catch (err: any) {
    throw formatGeminiNetworkError(err);
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal && onCallerAbort) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

/**
 * Xác minh tính hợp lệ và khả năng kết nối của một model trực tiếp từ browser tới Gemini API.
 */
export async function verifyModelDirect(apiKey: string, modelId: string): Promise<{
  success: boolean;
  verified: boolean;
  error?: string;
  errorCode?: string;
  checkedAt: string;
}> {
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!cleanKey) {
    return {
      success: false,
      verified: false,
      error: 'Vui lòng cung cấp API key cá nhân.',
      errorCode: 'NO_KEY',
      checkedAt: new Date().toISOString(),
    };
  }

  let cleanModel = modelId?.trim() || DEFAULT_MODEL_ID;
  if (cleanModel.startsWith('models/')) {
    cleanModel = cleanModel.replace(/^models\//, '');
  }

  try {
    const res = await callGeminiDirect({
      apiKeys: [cleanKey],
      model: cleanModel,
      prompt: 'Ping',
      temperature: 0.1,
    });

    if (res && res.text) {
      return {
        success: true,
        verified: true,
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      verified: false,
      error: 'Mô hình không trả về phản hồi hợp lệ.',
      errorCode: 'EMPTY_RESPONSE',
      checkedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    const formatted = formatGeminiNetworkError(err);
    const isNetworkOrCsp = formatted.message.includes('chính sách CSP');
    return {
      success: false,
      verified: false,
      error: formatted.message || 'Lỗi xác minh mô hình qua Gemini API.',
      errorCode: isNetworkOrCsp ? 'CSP_OR_NETWORK_ERROR' : 'API_ERROR',
      checkedAt: new Date().toISOString(),
    };
  }
}

export interface QuickTermResult {
  chinese: string;
  pinyin: string;
  vietnamese: string;
  type: GlossaryType;
  note: string;
}

/**
 * Phân tích và dịch nhanh cụm từ bôi đen với ngữ cảnh trực tiếp từ browser tới Gemini (Client-Direct).
 */
export async function quickTranslateTermDirect(options: {
  apiKeys: string[];
  model?: string;
  term: string;
  contextText?: string;
  genre?: string;
}): Promise<QuickTermResult> {
  const sanitizedTerm = sanitizePromptInput(options.term);
  const sanitizedContext = sanitizePromptInput(options.contextText || '');
  const genreNote = options.genre ? `\nBộ truyện thuộc thể loại: ${options.genre}. Hãy ưu tiên từ ngữ và cách dịch phù hợp với phong cách thể loại này.` : '';

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là trợ lý dịch thuật Trung - Việt lão luyện tinh thông Hán học và văn học mạng (tiên hiệp, võ hiệp, ngôn tình, huyền huyễn, đô thị).\n" +
    (genreNote ? `${genreNote}\n` : "") +
    "Nhiệm vụ của bạn là phân tích từ hoặc cụm từ tiếng Trung được bôi đen và ngữ cảnh xung quanh của nó (nếu có), từ đó đề xuất định nghĩa từ điển phù hợp gồm:\n" +
    "1. chinese: giữ nguyên từ tiếng Trung gốc.\n" +
    "2. pinyin: phiên âm Hán-Việt chuẩn xác của cụm từ (ví dụ: '萧炎' -> 'Tiêu Viêm', '斗罗大陆' -> 'Đấu La Đại Lục', '斗破苍穹' -> 'Đấu Phá Thương Khung').\n" +
    "3. vietnamese: gợi ý dịch thuần Việt hay hoặc giữ nguyên nghĩa Hán-Việt (ví dụ với nhân vật/địa danh).\n" +
    "4. type: loại thuật ngữ ('character' nếu là tên người/nhân vật, 'location' nếu là địa danh/nơi chốn, 'term' nếu là chiêu thức/bí kíp/vật phẩm, 'phrase' nếu là thành ngữ/cụm từ phổ biến, 'other' cho loại khác).\n" +
    "5. note: giải nghĩa ngắn gọn hoặc ghi chú vai trò của từ này trong ngữ cảnh.";

  const schema = {
    type: 'object',
    properties: {
      chinese: { type: 'string' },
      pinyin: { type: 'string' },
      vietnamese: { type: 'string' },
      type: {
        type: 'string',
        enum: ['character', 'location', 'term', 'phrase', 'other'],
      },
      note: { type: 'string' },
    },
    required: ['chinese', 'pinyin', 'vietnamese', 'type', 'note'],
  };

  const prompt = `Cụm từ bôi đen: "${sanitizedTerm.trim()}"\n${sanitizedContext ? `Ngữ cảnh xung quanh: "... ${sanitizedContext.trim()} ..."` : ''}`;

  const res = await callGeminiDirect({
    apiKeys: options.apiKeys,
    model: options.model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.1,
  });

  const parsed = parseGeminiStructuredResponse<any>(res.text, {
    contextName: 'generateQuickTermDetailsDirect',
    fallback: {
      chinese: sanitizedTerm.trim(),
      pinyin: '',
      vietnamese: '',
      type: 'character',
      note: '',
    },
  });
  return {
    chinese: parsed.chinese || sanitizedTerm.trim(),
    pinyin: parsed.pinyin || '',
    vietnamese: parsed.vietnamese || '',
    type: (parsed.type as GlossaryType) || 'character',
    note: parsed.note || '',
  };
}

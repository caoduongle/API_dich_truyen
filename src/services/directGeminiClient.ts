import { DEFAULT_MODEL_ID } from '@shared/models';
import { LITERARY_TRANSLATION_FRAMING, sanitizePromptInput } from '@shared/text';
import { GlossaryType } from '../types';
import { localQuotaTracker } from './localQuotaTracker';

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

export function formatGeminiNetworkError(err: any): Error {
  const msg = err?.message || '';
  if (
    err?.name === 'TypeError' ||
    err?.name === 'SecurityError' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('SecurityError')
  ) {
    return new Error('Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP).');
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Gọi trực tiếp REST API của Google Gemini từ trình duyệt người dùng với API key cá nhân
 */
export async function callGeminiDirect(options: DirectGeminiRequestOptions): Promise<DirectGeminiResponse> {
  const rawKeys = Array.isArray(options.apiKeys)
    ? options.apiKeys.map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean)
    : [];

  if (rawKeys.length === 0) {
    throw new Error('Không tìm thấy API Key nào. Vui lòng cấu hình API Key cá nhân trong phần Cấu hình AI.');
  }

  let modelName = (options.model || DEFAULT_MODEL_ID).trim();
  if (modelName.startsWith('models/')) {
    modelName = modelName.replace(/^models\//, '');
  }

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;

  const payload: Record<string, any> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: options.prompt }],
      },
    ],
    generationConfig: {
      temperature: typeof options.temperature === 'number' ? options.temperature : 0.3,
    },
  };

  if (options.systemInstruction && options.systemInstruction.trim()) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction.trim() }],
    };
  }

  if (options.schema) {
    payload.generationConfig.responseMimeType = 'application/json';
    payload.generationConfig.responseSchema = options.schema;
  }

  const startIdx = options.startKeyIndex && options.startKeyIndex >= 0 ? options.startKeyIndex % rawKeys.length : 0;
  let lastError: any = null;

  localQuotaTracker.recordLogicalStart();

  for (let attempt = 0; attempt < rawKeys.length; attempt++) {
    const currentKeyIdx = (startIdx + attempt) % rawKeys.length;
    const currentKey = rawKeys[currentKeyIdx];
    const callStartTime = Date.now();

    localQuotaTracker.recordProviderAttempt(currentKey, modelName, callStartTime);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': currentKey,
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        const errStatus = errJson?.error?.status || '';

        // Ghi nhận lỗi vào local quota tracker
        localQuotaTracker.recordFailure(currentKey, modelName, {
          status: response.status,
          message: errMsg,
          isRateLimit: response.status === 429 || errStatus === 'RESOURCE_EXHAUSTED',
          isAuthError: response.status === 401 || response.status === 403,
          isOverload: response.status === 503 || response.status === 500,
        });

        // Phân loại lỗi rate limit / overload để thử key kế tiếp
        const isRateLimitOrOverload =
          response.status === 429 ||
          response.status === 503 ||
          response.status === 500 ||
          errStatus === 'RESOURCE_EXHAUSTED' ||
          errStatus === 'UNAVAILABLE';

        lastError = new Error(`Gemini API Error [Key #${currentKeyIdx + 1}]: ${errMsg}`);

        if (isRateLimitOrOverload && attempt < rawKeys.length - 1) {
          // Xoay vòng sang key tiếp theo
          continue;
        }

        if (attempt === rawKeys.length - 1) {
          if (response.status === 429 || errStatus === 'RESOURCE_EXHAUSTED') {
            throw new Error(`Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ${errMsg}`);
          }
          throw lastError;
        }
        continue;
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';

      if (!text || text.trim().length === 0) {
        const finishReason = candidate?.finishReason || '';
        if (finishReason === 'SAFETY') {
          throw new Error('Nội dung văn bản bị bộ lọc an toàn của AI từ chối.');
        }
        throw new Error('AI trả về phản hồi rỗng.');
      }

      const latencyMs = Date.now() - callStartTime;
      const promptTokens = data?.usageMetadata?.promptTokenCount || Math.ceil(options.prompt.length / 4);
      const outputTokens = data?.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4);

      localQuotaTracker.recordSuccess(
        currentKey,
        modelName,
        {
          promptTokens,
          outputTokens,
          totalTokens: data?.usageMetadata?.totalTokenCount || promptTokens + outputTokens,
        },
        latencyMs
      );

      return {
        text,
        successKeyIndex: currentKeyIdx,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      localQuotaTracker.recordFailure(currentKey, modelName, {
        message: err?.message,
      });
      lastError = formatGeminiNetworkError(err);
      if (attempt === rawKeys.length - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP).');
}

/**
 * Tra cứu danh sách models trực tiếp từ Google Gemini API bằng API key cá nhân.
 */
export async function listModelsDirect(apiKey: string): Promise<Array<{
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

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': cleanKey,
      },
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
}): Promise<QuickTermResult> {
  const sanitizedTerm = sanitizePromptInput(options.term);
  const sanitizedContext = sanitizePromptInput(options.contextText || '');

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là trợ lý dịch thuật Trung - Việt lão luyện tinh thông Hán học và văn học mạng (tiên hiệp, võ hiệp, ngôn tình, huyền huyễn, đô thị).\n" +
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

  const parsed = JSON.parse(res.text);
  return {
    chinese: parsed.chinese || sanitizedTerm.trim(),
    pinyin: parsed.pinyin || '',
    vietnamese: parsed.vietnamese || '',
    type: (parsed.type as GlossaryType) || 'character',
    note: parsed.note || '',
  };
}

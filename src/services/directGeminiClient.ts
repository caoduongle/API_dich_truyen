import { DEFAULT_MODEL_ID } from '@shared/models';

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

  for (let attempt = 0; attempt < rawKeys.length; attempt++) {
    const currentKeyIdx = (startIdx + attempt) % rawKeys.length;
    const currentKey = rawKeys[currentKeyIdx];

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

      return {
        text,
        successKeyIndex: currentKeyIdx,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      lastError = err;
      if (attempt === rawKeys.length - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini API.');
}

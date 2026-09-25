/**
 * Gemini Request Builder
 * Chuẩn hóa tên model, tạo endpoint URL và cấu trúc payload JSON theo quy cách Gemini API
 */

import { DEFAULT_MODEL_ID } from '../../config/models';
import {
  DirectGeminiRequestOptions,
  GeminiSafetySetting,
  HarmCategory,
  HarmBlockThreshold,
} from './types';

/**
 * Cấu hình an toàn tối đa cho tiểu thuyết mạng:
 * Hạ mức kiểm duyệt xuống thấp nhất để tránh chặn nhầm văn cảnh kiếm hiệp/huyền huyễn.
 */
export function getPermissiveSafetySettings(): GeminiSafetySetting[] {
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];
}

export function normalizeModelName(model?: string): string {
  let modelName = (model || DEFAULT_MODEL_ID).trim();
  if (modelName.startsWith('models/')) {
    modelName = modelName.replace(/^models\//, '');
  }
  return modelName;
}

export function buildEndpointUrl(model: string): string {
  const normalized = normalizeModelName(model);
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalized)}:generateContent`;
}

export function buildPayload(options: DirectGeminiRequestOptions & { schema?: Record<string, any> }): Record<string, any> {
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
    safetySettings: Array.isArray(options.safetySettings) && options.safetySettings.length > 0
      ? options.safetySettings
      : getPermissiveSafetySettings(),
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

  return payload;
}

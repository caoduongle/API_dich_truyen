/**
 * Gemini Request Builder
 * Chuẩn hóa tên model, tạo endpoint URL và cấu trúc payload JSON theo quy cách Gemini API
 */

import { DEFAULT_MODEL_ID } from '../../config/models';
import { DirectGeminiRequestOptions } from './types';

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

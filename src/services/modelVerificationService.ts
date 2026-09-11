import { listModelsDirect, verifyModelDirect } from './directGeminiClient';
import type { ModelsForKeyResponse, VerifyModelResponse } from '../types/quota';

/**
 * Tính toán mã băm SHA-256 (dạng hex 64 ký tự thường) của chuỗi văn bản bằng Web Crypto API.
 */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Kiểm tra danh sách mô hình thực tế mà một API key có quyền truy cập (Client-Direct).
 */
export async function fetchModelsForKey(keyIndex: number, keys?: string[]): Promise<ModelsForKeyResponse> {
  const cleanKeys = (keys || []).filter(k => typeof k === 'string' && k.trim().length > 0);
  const targetKey = cleanKeys[keyIndex] || cleanKeys[0];
  if (!targetKey) {
    throw new Error('Không tìm thấy API Key để tra cứu danh sách mô hình.');
  }

  const hash = await sha256Hex(targetKey);
  const models = await listModelsDirect(targetKey);

  return {
    keyHash: hash,
    maskedKey: `${targetKey.slice(0, 6)}...${targetKey.slice(-4)}`,
    cached: false,
    models,
  };
}

/**
 * Xác minh tính hợp lệ và khả năng dịch thuật của 1 model trực tiếp với Google Gemini (Client-Direct).
 */
export async function verifyModel(modelId: string, _label?: string, keys?: string[]): Promise<VerifyModelResponse> {
  const cleanKeys = (keys || []).filter(k => typeof k === 'string' && k.trim().length > 0);
  const targetKey = cleanKeys[0];
  if (!targetKey) {
    return {
      success: false,
      verified: false,
      error: 'Vui lòng cung cấp API key để xác minh.',
      errorCode: 'NO_KEY',
      checkedAt: new Date().toISOString(),
    };
  }

  const res = await verifyModelDirect(targetKey, modelId);
  return {
    success: res.success,
    verified: res.verified,
    error: res.error,
    errorCode: res.errorCode,
    checkedAt: res.checkedAt,
  };
}

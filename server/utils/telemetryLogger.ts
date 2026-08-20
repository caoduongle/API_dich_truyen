import { Logger } from './logger';

export interface TelemetryAttemptLogPayload {
  requestId: string;
  modelId: string;
  keyIdentifier: string; // Masked key (e.g. "AIzaSy...ABCD") or hash
  keyIndex: number;
  attempt: number;
  status: 'success' | 'failure';
  errorCode: string | null;
  latencyMs: number;
  queueWaitMs: number;
  timestamp: number;
}

const logger = new Logger('Telemetry');

/**
 * Mask an API key string for safe logging
 */
export function maskKeyForLog(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 10) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/**
 * Ghi log telemetry chuẩn hóa cho mỗi attempt gọi upstream API
 * Tuyệt đối không log raw API key, token hay nội dung prompt.
 */
export function logAttemptTelemetry(payload: TelemetryAttemptLogPayload): void {
  const maskedKey = maskKeyForLog(payload.keyIdentifier);
  const safePayload = {
    ...payload,
    keyIdentifier: maskedKey,
  };

  if (payload.status === 'success') {
    logger.info(
      `[req:${safePayload.requestId}] Attempt ${safePayload.attempt} (Key ${safePayload.keyIndex + 1}: ${safePayload.keyIdentifier}, Model: ${safePayload.modelId}) -> SUCCESS (${safePayload.latencyMs}ms, QueueWait: ${safePayload.queueWaitMs}ms)`,
      safePayload
    );
  } else {
    logger.warn(
      `[req:${safePayload.requestId}] Attempt ${safePayload.attempt} (Key ${safePayload.keyIndex + 1}: ${safePayload.keyIdentifier}, Model: ${safePayload.modelId}) -> FAILED [${safePayload.errorCode || 'UNKNOWN'}] (${safePayload.latencyMs}ms, QueueWait: ${safePayload.queueWaitMs}ms)`,
      safePayload
    );
  }
}

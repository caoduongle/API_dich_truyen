/**
 * Modular Gemini Client Orchestrator
 * Bộ điều phối thực thi yêu cầu gọi API Gemini kèm xoay vòng khóa tự động và xử lý thử lại
 */

import { localQuotaTracker } from '../localQuotaTracker';
import { DirectGeminiRequestOptions, DirectGeminiResponse } from './types';
import { normalizeModelName, buildEndpointUrl, buildPayload } from './geminiRequestBuilder';
import { executeGeminiFetch, formatGeminiNetworkError } from './geminiTransport';
import { classifyGeminiError } from './geminiErrorClassifier';
import { initKeySchedule, isKeyAvailable, findNextKey } from './geminiKeyScheduler';

export async function callGemini(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> }
): Promise<DirectGeminiResponse> {
  localQuotaTracker.recordLogicalStart();

  try {
    return await executeLogicalGeminiCall(options);
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      localQuotaTracker.recordLogicalFailure();
    }
    throw err;
  }
}

async function executeLogicalGeminiCall(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> }
): Promise<DirectGeminiResponse> {
  const schedule = initKeySchedule(options.apiKeys || [], options.startKeyIndex);
  const { rawKeys, customLimits } = schedule;
  let { currentKeyIdx, attemptsCount } = schedule;

  const modelName = normalizeModelName(options.model);
  const endpointUrl = buildEndpointUrl(modelName);
  const payload = buildPayload({ ...options, model: modelName });

  let lastError: any = null;

  while (attemptsCount < rawKeys.length) {
    const currentKey = rawKeys[currentKeyIdx];

    if (!isKeyAvailable(currentKey, customLimits)) {
      const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits);
      if (nextIdx === -1 || (nextIdx === schedule.currentKeyIdx && attemptsCount > 0)) {
        break;
      }
      currentKeyIdx = nextIdx;
      attemptsCount++;
      continue;
    }

    const callStartTime = Date.now();
    localQuotaTracker.recordProviderAttempt(currentKey, modelName, callStartTime);
    let attemptFailureRecorded = false;

    try {
      const response = await executeGeminiFetch(endpointUrl, currentKey, payload, options.signal);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        const classified = classifyGeminiError(response.status, errJson);
        lastError = new Error(`Gemini API Error [Key #${currentKeyIdx + 1}]: ${errMsg}`);

        if (response.status === 404 || classified.category === 'RESOURCE_NOT_FOUND') {
          (lastError as any).code = 'RESOURCE_NOT_FOUND';
          (lastError as any).status = 404;
          throw lastError;
        }

        if (response.status === 400) {
          (lastError as any).code = 'BAD_REQUEST';
          (lastError as any).status = 400;
          throw lastError;
        }

        localQuotaTracker.recordFailure(currentKey, modelName, {
          status: response.status,
          message: errMsg,
          details: errJson?.error?.details,
          rawResponse: errJson,
          isRateLimit: classified.category === 'RATE_LIMIT_RPM' || classified.category === 'QUOTA_EXHAUSTED_RPD' || response.status === 429,
          isAuthError: classified.category === 'AUTH_FAILURE' || response.status === 401 || response.status === 403,
          isOverload: classified.category === 'SERVICE_OVERLOAD' || response.status === 503 || response.status === 500,
        });
        attemptFailureRecorded = true;

        const isRateLimitOrOverload =
          classified.isRetryable &&
          (classified.category === 'RATE_LIMIT_RPM' ||
            classified.category === 'QUOTA_EXHAUSTED_RPD' ||
            classified.category === 'SERVICE_OVERLOAD' ||
            response.status === 429 ||
            response.status === 503 ||
            response.status === 500);

        if (isRateLimitOrOverload) {
          const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits);
          if (nextIdx === -1 || attemptsCount >= rawKeys.length - 1) {
            if (classified.category === 'QUOTA_EXHAUSTED_RPD' || classified.category === 'RATE_LIMIT_RPM' || response.status === 429) {
              const quotaErr = new Error(`Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ${errMsg}`);
              (quotaErr as any).code = 'ALL_KEYS_EXHAUSTED';
              throw quotaErr;
            }
            throw lastError;
          }
          localQuotaTracker.recordRetry(currentKey);
          currentKeyIdx = nextIdx;
          attemptsCount++;
          continue;
        }

        if (attemptsCount === rawKeys.length - 1) {
          throw lastError;
        }
        if (response.status === 400) {
          throw lastError;
        }
        const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits);
        if (nextIdx === -1) {
          throw lastError;
        }
        localQuotaTracker.recordRetry(currentKey);
        currentKeyIdx = nextIdx;
        attemptsCount++;
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
      if (
        err.name === 'AbortError' ||
        err.code === 'ALL_KEYS_EXHAUSTED' ||
        err.code === 'RESOURCE_NOT_FOUND' ||
        err.code === 'BAD_REQUEST' ||
        err.status === 404 ||
        err.status === 400
      ) {
        throw err;
      }
      if (!attemptFailureRecorded) {
        localQuotaTracker.recordFailure(currentKey, modelName, {
          message: err?.message,
        });
        attemptFailureRecorded = true;
      }
      lastError = formatGeminiNetworkError(err);
      if (attemptsCount === rawKeys.length - 1) {
        throw lastError;
      }
      const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits);
      if (nextIdx === -1) {
        throw lastError;
      }
      localQuotaTracker.recordRetry(currentKey);
      currentKeyIdx = nextIdx;
      attemptsCount++;
    }
  }

  if (lastError) {
    throw lastError;
  }

  const allExhausted = new Error('Toàn bộ API Key đã hết hạn mức (hoặc đã chạm ngưỡng cá nhân).');
  (allExhausted as any).code = 'ALL_KEYS_EXHAUSTED';
  throw allExhausted;
}

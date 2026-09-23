/**
 * Modular Gemini Client Orchestrator
 * Bộ điều phối thực thi yêu cầu gọi API Gemini kèm xoay vòng khóa tự động và xử lý thử lại
 */

import { localQuotaTracker } from '../localQuotaTracker';
import { DirectGeminiRequestOptions, DirectGeminiResponse, GeminiRequestError } from './types';
import { normalizeModelName, buildEndpointUrl, buildPayload } from './geminiRequestBuilder';
import { executeGeminiFetch, formatGeminiNetworkError } from './geminiTransport';
import { classifyGeminiError, getErrorMessage } from './geminiErrorClassifier';
import { initKeySchedule, isKeyAvailable, findNextKey } from './geminiKeyScheduler';

export async function callGemini(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> }
): Promise<DirectGeminiResponse> {
  localQuotaTracker.recordLogicalStart();

  try {
    return await executeLogicalGeminiCall(options);
  } catch (err: unknown) {
    const isAbort = (err as { name?: string })?.name === 'AbortError';
    if (!isAbort) {
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

  const logicalStartTime = Date.now();
  const overallDeadlineMs = options.timeoutMs ?? 60_000;

  let lastError: GeminiRequestError | Error | null = null;

  while (attemptsCount < rawKeys.length) {
    const elapsedMs = Date.now() - logicalStartTime;
    const remainingMs = overallDeadlineMs - elapsedMs;

    if (remainingMs <= 50) {
      const deadlineError = new GeminiRequestError(
        `Quá hạn thời gian yêu cầu Gemini API (Cumulative Deadline: ${Math.round(overallDeadlineMs / 1000)}s).`,
        {
          code: 'ETIMEDOUT',
          category: 'NETWORK_FAILURE',
          isRetryable: true,
        }
      );
      throw deadlineError;
    }

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

    const attemptTimeoutMs = Math.min(remainingMs, 60_000);

    try {
      const response = await executeGeminiFetch(endpointUrl, currentKey, payload, options.signal, attemptTimeoutMs);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        const classified = classifyGeminiError(response.status, errJson);
        lastError = new Error(`Gemini API Error [Key #${currentKeyIdx + 1}]: ${errMsg}`);

        if (response.status === 404 || classified.category === 'RESOURCE_NOT_FOUND') {
          throw new GeminiRequestError(
            `Gemini API Error [Key #${currentKeyIdx + 1}]: ${errMsg}`,
            {
              code: 'RESOURCE_NOT_FOUND',
              category: 'RESOURCE_NOT_FOUND',
              status: 404,
              isRetryable: false,
            }
          );
        }

        if (classified.category === 'CONTENT_BLOCKED') {
          throw new GeminiRequestError(errMsg || 'Nội dung văn bản bị bộ lọc an toàn của AI từ chối.', {
            code: 'CONTENT_BLOCKED',
            category: 'CONTENT_BLOCKED',
            status: response.status,
            isRetryable: false,
          });
        }

        if (response.status === 400) {
          throw new GeminiRequestError(
            `Gemini API Error [Key #${currentKeyIdx + 1}]: ${errMsg}`,
            {
              code: 'BAD_REQUEST',
              category: 'UNRECOGNIZED',
              status: 400,
              isRetryable: false,
            }
          );
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
              throw new GeminiRequestError(
                `Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ${errMsg}`,
                {
                  code: 'ALL_KEYS_EXHAUSTED',
                  category: 'QUOTA_EXHAUSTED_RPD',
                  status: 429,
                  isRetryable: false,
                }
              );
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
        const blockReason = data?.promptFeedback?.blockReason || '';
        if (finishReason === 'SAFETY' || blockReason === 'SAFETY') {
          throw new GeminiRequestError('Nội dung văn bản bị bộ lọc an toàn của AI từ chối.', {
            code: 'CONTENT_BLOCKED',
            category: 'CONTENT_BLOCKED',
            status: 200,
            isRetryable: false,
          });
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
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as {
        name?: string;
        code?: string;
        category?: string;
        message?: string;
        status?: number;
      };
      const msg = getErrorMessage(err);
      if (
        errObj.code === 'CONTENT_BLOCKED' ||
        errObj.category === 'CONTENT_BLOCKED' ||
        msg.includes('bộ lọc an toàn') ||
        msg.includes('SAFETY')
      ) {
        throw err instanceof GeminiRequestError
          ? err
          : new GeminiRequestError(msg, {
              code: 'CONTENT_BLOCKED',
              category: 'CONTENT_BLOCKED',
              isRetryable: false,
              cause: err,
            });
      }

      if (
        errObj.name === 'AbortError' ||
        errObj.code === 'ALL_KEYS_EXHAUSTED' ||
        errObj.code === 'RESOURCE_NOT_FOUND' ||
        errObj.code === 'BAD_REQUEST' ||
        errObj.status === 404 ||
        errObj.status === 400
      ) {
        throw err;
      }

      if (errObj.name === 'TimeoutError' || errObj.code === 'ETIMEDOUT') {
        const currentElapsed = Date.now() - logicalStartTime;
        if (overallDeadlineMs - currentElapsed <= 50) {
          throw err instanceof GeminiRequestError
            ? err
            : new GeminiRequestError(
                `Quá hạn thời gian yêu cầu Gemini API (Cumulative Deadline: ${Math.round(overallDeadlineMs / 1000)}s).`,
                {
                  code: 'ETIMEDOUT',
                  category: 'NETWORK_FAILURE',
                  isRetryable: true,
                  cause: err,
                }
              );
        }
      }
      if (!attemptFailureRecorded) {
        localQuotaTracker.recordFailure(currentKey, modelName, {
          message: msg,
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

  throw new GeminiRequestError('Toàn bộ API Key đã hết hạn mức (hoặc đã chạm ngưỡng cá nhân).', {
    code: 'ALL_KEYS_EXHAUSTED',
    category: 'QUOTA_EXHAUSTED_RPD',
    isRetryable: false,
  });
}

/**
 * Modular Gemini Client Orchestrator
 * Bộ điều phối thực thi yêu cầu gọi API Gemini kèm xoay vòng khóa tự động và xử lý thử lại
 */

import { localQuotaTracker, type KeyHealthOptions } from '../localQuotaTracker';
import { AI_SERVICE_CONFIG, RATE_LIMIT_RECOVERY_CONFIG } from '../../config/constants';
import { getStoredCustomLimits } from '../../utils/customLimitsStorage';
import { DirectGeminiRequestOptions, DirectGeminiResponse, GeminiRequestError } from './types';
import { normalizeModelName, buildEndpointUrl, buildPayload } from './geminiRequestBuilder';
import { executeGeminiFetch, formatGeminiNetworkError } from './geminiTransport';
import { classifyGeminiError, getErrorMessage } from './geminiErrorClassifier';
import {
  initKeySchedule,
  isKeyAvailable,
  findNextKey,
  buildAllKeysUnavailableError,
  inspectKeyPoolCooldown,
  waitWithAbort,
  createServiceOverloadError,
} from './geminiKeyScheduler';

export async function callGemini(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> }
): Promise<DirectGeminiResponse> {
  localQuotaTracker.recordLogicalStart();

  try {
    return await executeLogicalGeminiCallWithRecovery(options);
  } catch (err: unknown) {
    const isAbort = (err as { name?: string })?.name === 'AbortError';
    if (!isAbort) {
      localQuotaTracker.recordLogicalFailure();
    }
    throw err;
  }
}

async function executeLogicalGeminiCallWithRecovery(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> }
): Promise<DirectGeminiResponse> {
  const modelName = normalizeModelName(options.model);
  const useProactivePacing = Boolean(options.enableProactivePacing);
  const autoWait = Boolean(options.autoWaitForCooldown);
  const keyHealthOptions: KeyHealthOptions = {
    model: modelName,
    ...(useProactivePacing ? { enforceProactiveLimits: true } : {}),
  };

  const maxCooldownWaits = options.maxCooldownWaits ?? RATE_LIMIT_RECOVERY_CONFIG.MAX_COOLDOWN_WAITS_PER_CHAPTER;
  const maxOverloadRetries = options.maxOverloadRetries ?? AI_SERVICE_CONFIG.MAX_OVERLOAD_RETRIES;

  let proactiveWaitCount = 0;
  let passiveCooldownWaits = 0;
  let overloadRetries = 0;

  while (true) {
    if (options.signal?.aborted) {
      const abortErr = new Error('Quá trình đã bị hủy bởi người dùng.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      return await executeLogicalGeminiCallAttempt(options, keyHealthOptions);
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as {
        name?: string;
        code?: string;
        category?: string;
        message?: string;
      };
      if (errObj.name === 'AbortError') {
        throw err;
      }

      if (err instanceof GeminiRequestError && err.code === 'ALL_KEYS_EXHAUSTED' && err.category === 'RATE_LIMIT_RPM') {
        const cleanKeys = (options.apiKeys || []).map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
        const customLimits = getStoredCustomLimits(cleanKeys);
        const pool = inspectKeyPoolCooldown(cleanKeys, customLimits, Date.now(), keyHealthOptions);

        // Nếu có khóa vừa mở lại tức thì (ví dụ trong cuộc gọi song song), thử lại ngay không tốn budget
        if (pool.availableKeyIndex !== -1) {
          continue;
        }

        // Nhịp chờ chủ động cửa sổ 60s (Proactive Pacing): tách riêng và không giới hạn số lần chờ
        if (pool.isProactivePacingOnly && (useProactivePacing || autoWait)) {
          const waitMs = Math.max(250, pool.minCooldownRemainingMs);
          proactiveWaitCount++;
          options.onWaitStatus?.({
            kind: 'proactive_pacing',
            waitMs,
            attempt: proactiveWaitCount,
            reason: err.message,
            nextKeyIndex: pool.nextRecoveringKeyIndex >= 0 ? pool.nextRecoveringKeyIndex : undefined,
          });
          await waitWithAbort(waitMs, options.signal);
          continue;
        }

        // Nhịp chờ bị động sau khi thực sự chạm cooldown 429 RPM từ nhà cung cấp: có trần an toàn
        if (autoWait && pool.hasRecoverableCooldown && pool.minCooldownRemainingMs > 0) {
          if (passiveCooldownWaits >= maxCooldownWaits) {
            throw err;
          }
          passiveCooldownWaits++;
          const waitMs = pool.minCooldownRemainingMs;
          options.onWaitStatus?.({
            kind: 'rate_limit_cooldown',
            waitMs,
            attempt: passiveCooldownWaits,
            maxAttempts: maxCooldownWaits,
            reason: err.message,
            nextKeyIndex: pool.nextRecoveringKeyIndex >= 0 ? pool.nextRecoveringKeyIndex : undefined,
          });
          await waitWithAbort(waitMs, options.signal);
          continue;
        }

        throw err;
      }

      if (err instanceof GeminiRequestError && err.category === 'SERVICE_OVERLOAD') {
        if (!autoWait || overloadRetries >= maxOverloadRetries) {
          throw err;
        }
        overloadRetries++;
        const cleanKeys = (options.apiKeys || []).map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
        const customLimits = getStoredCustomLimits(cleanKeys);
        const pool = inspectKeyPoolCooldown(cleanKeys, customLimits, Date.now(), keyHealthOptions);
        const expBackoffMs = 3_000 * Math.pow(2, overloadRetries - 1);
        const minWaitForOpenKey =
          pool.availableKeyIndex === -1 && pool.minCooldownRemainingMs > 0
            ? pool.minCooldownRemainingMs + 100
            : 0;
        const backoffMs = Math.min(20_000, Math.max(expBackoffMs, minWaitForOpenKey));
        options.onWaitStatus?.({
          kind: 'service_overload',
          waitMs: backoffMs,
          attempt: overloadRetries,
          maxAttempts: maxOverloadRetries,
          reason: err.message,
          ...(pool.nextRecoveringKeyIndex >= 0 ? { nextKeyIndex: pool.nextRecoveringKeyIndex } : {}),
        });
        await waitWithAbort(backoffMs, options.signal);
        continue;
      }

      throw err;
    }
  }
}

async function executeLogicalGeminiCallAttempt(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> },
  keyHealthOptions?: KeyHealthOptions
): Promise<DirectGeminiResponse> {
  const schedule = initKeySchedule(options.apiKeys || [], options.startKeyIndex, keyHealthOptions);
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

    if (!isKeyAvailable(currentKey, customLimits, keyHealthOptions)) {
      const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits, keyHealthOptions);
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
        const retryAfterHeader = response.headers?.get?.('retry-after') ?? null;
        const classified = classifyGeminiError(response.status, errJson, undefined, retryAfterHeader);
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
          retryAfterMs: classified.recommendedCooldownMs > 0 ? classified.recommendedCooldownMs : undefined,
          retryAfterHeader,
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
          const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits, keyHealthOptions);
          if (nextIdx === -1 || attemptsCount >= rawKeys.length - 1) {
            if (classified.category === 'QUOTA_EXHAUSTED_RPD' || classified.category === 'RATE_LIMIT_RPM' || response.status === 429) {
              throw buildAllKeysUnavailableError(rawKeys, customLimits, errMsg, keyHealthOptions);
            }
            if (classified.category === 'SERVICE_OVERLOAD' || response.status === 503 || response.status === 500) {
              throw createServiceOverloadError(lastError?.message || errMsg, classified.recommendedCooldownMs);
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
        const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits, keyHealthOptions);
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
      const nextIdx = findNextKey(rawKeys, currentKeyIdx, customLimits, keyHealthOptions);
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

  throw buildAllKeysUnavailableError(rawKeys, customLimits, undefined, keyHealthOptions);
}

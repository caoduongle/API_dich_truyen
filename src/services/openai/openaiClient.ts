/**
 * Client-Side OpenAI-Compatible Adapter (/v1/chat/completions & /v1/models)
 * Hỗ trợ DeepSeek, Qwen, Groq, NVIDIA NIM, Ollama, LM Studio và Custom Base URL.
 */

import {
  buildOpenAICompatibleEndpoint,
  OPENAI_COMPATIBLE_PRESETS,
  validateProviderBaseUrl,
} from '../../config/aiProviders';
import { AI_SERVICE_CONFIG, RATE_LIMIT_RECOVERY_CONFIG } from '../../config/constants';
import { stripModelThinkingBlocks } from '../../lib/text';
import type { OpenAICompatibleConfig, OpenAIResponseFormatTier } from '../../types/aiProvider';
import type { ModelInfoItem } from '../../types/quota';
import { getStoredAIProviderConfig, loadOpenAIApiKeys } from '../../utils/aiProviderStorage';
import { extractRetryDelayMs } from '../gemini/geminiErrorClassifier';
import { buildAllKeysUnavailableError, findNextKey, initKeySchedule, inspectKeyPoolCooldown, isKeyAvailable, waitWithAbort } from '../gemini/geminiKeyScheduler';
import { DirectGeminiRequestOptions, DirectGeminiResponse, GeminiRequestError } from '../gemini/types';
import { localQuotaTracker, type KeyHealthOptions } from '../localQuotaTracker';
import {
  buildJsonInstructionHint,
  canUseOpenAIJsonSchema,
  convertGeminiSchemaToJsonSchema,
} from './openaiSchemaAdapter';

export interface OpenAIConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  modelCount?: number;
  message: string;
  isCorsSuspected?: boolean;
}

const LOCAL_CORS_GUIDANCE =
  'Không thể kết nối tới máy chủ cục bộ (nghi ngờ trình duyệt chặn CORS). Hãy bật CORS: với Ollama đặt biến môi trường OLLAMA_ORIGINS=* rồi khởi động lại; với LM Studio bật "Enable CORS" trong Server Settings.';

// Cache bậc response_format tương thích cao nhất trong phiên theo (normalizedBaseUrl::model)
const sessionFormatTierCache = new Map<string, OpenAIResponseFormatTier>();

export function clearOpenAIResponseFormatCache(): void {
  sessionFormatTierCache.clear();
}

function getTierCacheKey(normalizedBaseUrl: string, model: string): string {
  return `${normalizedBaseUrl}::${model}`;
}

function redactSecretFromMessage(message: string, secrets: string[]): string {
  let out = message || '';
  for (const s of secrets) {
    const clean = typeof s === 'string' ? s.trim() : '';
    if (clean.length >= 4 && out.includes(clean)) {
      out = out.split(clean).join('***');
    }
  }
  return out;
}

function isNetworkFetchError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const errObj = err as { name?: string; message?: string };
  const msg = errObj.message || '';
  return (
    errObj.name === 'TypeError' ||
    errObj.name === 'SecurityError' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed')
  );
}

function formatOpenAINetworkError(err: unknown, isLocal: boolean, secrets: string[]): Error {
  if (isNetworkFetchError(err)) {
    return new Error(
      isLocal
        ? LOCAL_CORS_GUIDANCE
        : 'Không thể kết nối tới máy chủ OpenAI-compatible. Vui lòng kiểm tra Base URL, kết nối mạng hoặc chính sách CORS của máy chủ.'
    );
  }
  const msg = err instanceof Error ? err.message : String(err || 'Lỗi kết nối OpenAI-compatible.');
  return new Error(redactSecretFromMessage(msg, secrets));
}

function extractOpenAIContentText(data: any): string {
  const choice = data?.choices?.[0];
  const rawContent = choice?.message?.content;

  if (typeof rawContent === 'string') {
    return stripModelThinkingBlocks(rawContent);
  }

  if (Array.isArray(rawContent)) {
    const joined = rawContent
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
    return stripModelThinkingBlocks(joined);
  }

  return '';
}

function extractErrorMessageFromBody(errBody: any, status: number, statusText: string): string {
  if (errBody && typeof errBody === 'object') {
    if (typeof errBody?.error?.message === 'string' && errBody.error.message.trim()) {
      return errBody.error.message.trim();
    }
    if (typeof errBody?.message === 'string' && errBody.message.trim()) {
      return errBody.message.trim();
    }
    if (typeof errBody?.detail === 'string' && errBody.detail.trim()) {
      return errBody.detail.trim();
    }
  }
  return `HTTP ${status} ${statusText || ''}`.trim();
}

function isResponseFormatRejection(status: number, errMessage: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lower = (errMessage || '').toLowerCase();
  return (
    lower.includes('response_format') ||
    lower.includes('json_schema') ||
    lower.includes('json_object') ||
    lower.includes('structured output') ||
    lower.includes('additionalproperties') ||
    (lower.includes('schema') && (lower.includes('unsupported') || lower.includes('invalid') || lower.includes('not support')))
  );
}

function getNextDowngradeTier(current: OpenAIResponseFormatTier): OpenAIResponseFormatTier | null {
  if (current === 'json_schema') return 'json_object';
  if (current === 'json_object') return 'prompt_only';
  return null;
}

function buildOpenAIRequestBody(
  model: string,
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> },
  tier: OpenAIResponseFormatTier
): Record<string, any> {
  const baseSystem = (options.systemInstruction || '').trim();
  const needsHint = Boolean(options.schema) && (tier === 'json_object' || tier === 'prompt_only');
  const systemText = needsHint ? `${baseSystem}${buildJsonInstructionHint(options.schema)}`.trim() : baseSystem;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemText) {
    messages.push({ role: 'system', content: systemText });
  }
  messages.push({ role: 'user', content: options.prompt });

  const body: Record<string, any> = {
    model,
    messages,
  };

  if (typeof options.temperature === 'number' && Number.isFinite(options.temperature)) {
    body.temperature = options.temperature;
  }
  if (typeof options.topP === 'number' && Number.isFinite(options.topP)) {
    body.top_p = options.topP;
  }

  if (options.schema) {
    if (tier === 'json_schema' && canUseOpenAIJsonSchema(options.schema)) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'translation_response',
          strict: false,
          schema: convertGeminiSchemaToJsonSchema(options.schema),
        },
      };
    } else if (tier === 'json_object') {
      body.response_format = { type: 'json_object' };
    }
  }

  return body;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  timeoutMs: number = 60_000,
  timeoutLabel: string = 'máy chủ OpenAI-compatible'
): Promise<Response> {
  const controller = new AbortController();
  let isTimedOut = false;

  const timerId = setTimeout(() => {
    isTimedOut = true;
    controller.abort(
      new Error(`Yêu cầu tới ${timeoutLabel} đã quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`)
    );
  }, timeoutMs);

  const onCallerAbort = () => {
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timerId);
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (isTimedOut) {
      const timeoutError = new GeminiRequestError(
        `Yêu cầu tới ${timeoutLabel} đã quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`,
        {
          code: 'ETIMEDOUT',
          category: 'NETWORK_FAILURE',
          isRetryable: true,
          cause: err,
        }
      );
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timerId);
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
  }
}

function buildNamespacedKey(host: string, rawKey: string): string {
  return `openai:${host}:${rawKey}`;
}

function classifyOpenAIHttpError(
  status: number,
  errMsg: string,
  retryAfterHeader: string | null,
  keyLabel: string,
  secrets: string[]
): {
  error: GeminiRequestError;
  isRateLimit: boolean;
  isDailyQuota: boolean;
  isAuthError: boolean;
  isOverload: boolean;
  retryAfterMs?: number;
} {
  const safeMsg = redactSecretFromMessage(errMsg, secrets);
  const lower = safeMsg.toLowerCase();
  const retryAfterMs = extractRetryDelayMs(safeMsg, undefined, retryAfterHeader);

  if (status === 401 || status === 403) {
    return {
      error: new GeminiRequestError(
        `Xác thực OpenAI-compatible thất bại [${keyLabel}] (${status}): API Key không hợp lệ hoặc không đủ quyền. Chi tiết: ${safeMsg}`,
        {
          code: 'AUTH_FAILURE',
          category: 'AUTH_FAILURE',
          status,
          isRetryable: false,
        }
      ),
      isRateLimit: false,
      isDailyQuota: false,
      isAuthError: true,
      isOverload: false,
    };
  }

  if (status === 404) {
    return {
      error: new GeminiRequestError(
        `Không tìm thấy mô hình hoặc endpoint /v1/chat/completions (404). Hãy kiểm tra lại Base URL và tên Model. Chi tiết: ${safeMsg}`,
        {
          code: 'RESOURCE_NOT_FOUND',
          category: 'RESOURCE_NOT_FOUND',
          status: 404,
          isRetryable: false,
        }
      ),
      isRateLimit: false,
      isDailyQuota: false,
      isAuthError: false,
      isOverload: false,
    };
  }

  if (status === 429 || status === 402 || lower.includes('insufficient_quota') || lower.includes('credit')) {
    const isDailyOrCredit =
      status === 402 ||
      lower.includes('insufficient_quota') ||
      lower.includes('credit') ||
      lower.includes('billing') ||
      lower.includes('daily') ||
      lower.includes('per day');
    return {
      error: new GeminiRequestError(
        isDailyOrCredit
          ? `Tài khoản/Khóa OpenAI-compatible đã hết tín dụng hoặc hạn mức ngày [${keyLabel}]: ${safeMsg}`
          : `Chạm giới hạn tốc độ 429 trên [${keyLabel}]: ${safeMsg}`,
        {
          code: 'ALL_KEYS_EXHAUSTED',
          category: isDailyOrCredit ? 'QUOTA_EXHAUSTED_RPD' : 'RATE_LIMIT_RPM',
          status: status === 402 ? 429 : status,
          isRetryable: !isDailyOrCredit,
          retryAfterMs,
        }
      ),
      isRateLimit: true,
      isDailyQuota: isDailyOrCredit,
      isAuthError: false,
      isOverload: false,
      retryAfterMs,
    };
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return {
      error: new GeminiRequestError(
        `Máy chủ OpenAI-compatible đang quá tải tạm thời (${status}): ${safeMsg}`,
        {
          code: 'UNRECOGNIZED',
          category: 'SERVICE_OVERLOAD',
          status,
          isRetryable: true,
          retryAfterMs: retryAfterMs ?? 10_000,
        }
      ),
      isRateLimit: false,
      isDailyQuota: false,
      isAuthError: false,
      isOverload: true,
      retryAfterMs: retryAfterMs ?? 10_000,
    };
  }

  return {
    error: new GeminiRequestError(`Lỗi OpenAI-compatible (${status}): ${safeMsg}`, {
      code: status === 400 || status === 422 ? 'BAD_REQUEST' : 'UNRECOGNIZED',
      category: 'UNRECOGNIZED',
      status,
      isRetryable: false,
    }),
    isRateLimit: false,
    isDailyQuota: false,
    isAuthError: false,
    isOverload: false,
  };
}

/**
 * Thực thi gọi `/v1/chat/completions` theo đúng hợp đồng DirectGeminiRequestOptions / DirectGeminiResponse.
 * INVARIANT: Tuyệt đối KHÔNG sử dụng `options.apiKeys` hay `options.model` từ caller Gemini — luôn đọc từ
 * cấu hình OpenAI-compatible riêng (`getStoredAIProviderConfig()` + `loadOpenAIApiKeys()`), trừ khi truyền `overrideConfig`.
 */
export async function callOpenAICompatible(
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> },
  overrideConfig?: Partial<OpenAICompatibleConfig> & { apiKeys?: string[] }
): Promise<DirectGeminiResponse> {
  const storedConfig = getStoredAIProviderConfig();
  const rawBaseUrl = (overrideConfig?.baseUrl ?? storedConfig.baseUrl).trim();
  const presetFallback = OPENAI_COMPATIBLE_PRESETS[overrideConfig?.presetId ?? storedConfig.presetId];
  const resolvedModel = (overrideConfig?.model ?? storedConfig.model ?? presetFallback?.defaultModel ?? '').trim();

  const urlCheck = validateProviderBaseUrl(rawBaseUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    throw new GeminiRequestError(urlCheck.error || 'Base URL OpenAI-compatible không hợp lệ.', {
      code: 'BAD_REQUEST',
      category: 'UNRECOGNIZED',
      isRetryable: false,
    });
  }

  if (!resolvedModel) {
    throw new GeminiRequestError('Chưa cấu hình tên mô hình cho nhà cung cấp OpenAI-compatible.', {
      code: 'BAD_REQUEST',
      category: 'RESOURCE_NOT_FOUND',
      isRetryable: false,
    });
  }

  const normalizedUrl = urlCheck.normalizedUrl;
  const isLocal = Boolean(urlCheck.isLocal);
  const endpointUrl = buildOpenAICompatibleEndpoint(normalizedUrl, '/chat/completions');
  const hostKey = new URL(normalizedUrl).host;

  const rawApiKeys = (overrideConfig?.apiKeys ?? loadOpenAIApiKeys())
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim())
    .filter(Boolean);

  if (!isLocal && rawApiKeys.length === 0) {
    throw new GeminiRequestError(
      'Nhà cung cấp OpenAI-compatible từ xa yêu cầu ít nhất một API Key hợp lệ.',
      {
        code: 'AUTH_FAILURE',
        category: 'AUTH_FAILURE',
        isRetryable: false,
      }
    );
  }

  const initialTier: OpenAIResponseFormatTier = !options.schema
    ? 'prompt_only'
    : sessionFormatTierCache.get(getTierCacheKey(normalizedUrl, resolvedModel)) ??
      (canUseOpenAIJsonSchema(options.schema) ? 'json_schema' : 'prompt_only');

  const autoWait = Boolean(options.autoWaitForCooldown);
  const maxCooldownWaits = options.maxCooldownWaits ?? RATE_LIMIT_RECOVERY_CONFIG.MAX_COOLDOWN_WAITS_PER_CHAPTER;
  const maxOverloadRetries = options.maxOverloadRetries ?? AI_SERVICE_CONFIG.MAX_OVERLOAD_RETRIES;

  let passiveCooldownWaits = 0;
  let overloadRetries = 0;

  // Nhánh chạy cục bộ không cần khóa API (keyless local Ollama / LM Studio)
  if (isLocal && rawApiKeys.length === 0) {
    return executeSingleOpenAIRequest({
      endpointUrl,
      normalizedUrl,
      model: resolvedModel,
      options,
      initialTier,
      apiKey: undefined,
      keyIndex: 0,
      isLocal: true,
      secrets: [],
    });
  }

  // Nhánh xoay vòng nhiều API key (độc lập hoàn toàn với key Google Gemini qua tiền tố `openai:${host}:`)
  const namespacedKeys = rawApiKeys.map((k) => buildNamespacedKey(hostKey, k));
  const rawKeyByNamespaced = new Map<string, string>(
    namespacedKeys.map((nsKey, idx) => [nsKey, rawApiKeys[idx]])
  );
  const keyHealthOptions: KeyHealthOptions = { model: `openai:${resolvedModel}` };

  while (true) {
    if (options.signal?.aborted) {
      const abortErr = new Error('Quá trình đã bị hủy bởi người dùng.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      return await attemptOpenAIWithKeyPool({
        endpointUrl,
        normalizedUrl,
        model: resolvedModel,
        options,
        initialTier,
        namespacedKeys,
        rawKeyByNamespaced,
        rawSecrets: rawApiKeys,
        keyHealthOptions,
        isLocal,
      });
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as { name?: string };
      if (errObj.name === 'AbortError') {
        throw err;
      }

      if (err instanceof GeminiRequestError && err.code === 'ALL_KEYS_EXHAUSTED' && err.category === 'RATE_LIMIT_RPM') {
        const pool = inspectKeyPoolCooldown(namespacedKeys, {}, Date.now(), keyHealthOptions);
        if (pool.availableKeyIndex !== -1) {
          continue;
        }
        if (autoWait && pool.hasRecoverableCooldown && pool.minCooldownRemainingMs > 0) {
          if (passiveCooldownWaits >= maxCooldownWaits) {
            throw err;
          }
          passiveCooldownWaits++;
          options.onWaitStatus?.({
            kind: 'rate_limit_cooldown',
            waitMs: pool.minCooldownRemainingMs,
            attempt: passiveCooldownWaits,
            maxAttempts: maxCooldownWaits,
            reason: err.message,
            nextKeyIndex: pool.nextRecoveringKeyIndex >= 0 ? pool.nextRecoveringKeyIndex : undefined,
          });
          await waitWithAbort(pool.minCooldownRemainingMs, options.signal);
          continue;
        }
      }

      if (err instanceof GeminiRequestError && err.category === 'SERVICE_OVERLOAD') {
        if (!autoWait || overloadRetries >= maxOverloadRetries) {
          throw err;
        }
        overloadRetries++;
        const backoffMs = Math.min(20_000, 3_000 * Math.pow(2, overloadRetries - 1));
        options.onWaitStatus?.({
          kind: 'service_overload',
          waitMs: backoffMs,
          attempt: overloadRetries,
          maxAttempts: maxOverloadRetries,
          reason: err.message,
        });
        await waitWithAbort(backoffMs, options.signal);
        continue;
      }

      throw err;
    }
  }
}

async function executeSingleOpenAIRequest(params: {
  endpointUrl: string;
  normalizedUrl: string;
  model: string;
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> };
  initialTier: OpenAIResponseFormatTier;
  apiKey?: string;
  keyIndex: number;
  isLocal: boolean;
  secrets: string[];
  attemptTimeoutMs?: number;
}): Promise<DirectGeminiResponse> {
  const { endpointUrl, normalizedUrl, model, options, apiKey, keyIndex, isLocal, secrets } = params;
  const timeoutMs = params.attemptTimeoutMs ?? options.timeoutMs ?? 60_000;
  let currentTier: OpenAIResponseFormatTier = params.initialTier;

  while (true) {
    const body = buildOpenAIRequestBody(model, options, currentTier);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        endpointUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        options.signal,
        timeoutMs,
        isLocal ? 'máy chủ OpenAI cục bộ' : 'OpenAI-compatible API'
      );
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError' || (err as { name?: string })?.name === 'TimeoutError') {
        throw err;
      }
      throw formatOpenAINetworkError(err, isLocal, secrets);
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = extractErrorMessageFromBody(errBody, response.status, response.statusText);

      if (options.schema && isResponseFormatRejection(response.status, errMsg)) {
        const nextTier = getNextDowngradeTier(currentTier);
        if (nextTier) {
          sessionFormatTierCache.set(getTierCacheKey(normalizedUrl, model), nextTier);
          currentTier = nextTier;
          continue;
        }
      }

      const retryAfterHeader = response.headers?.get?.('retry-after') ?? null;
      const classified = classifyOpenAIHttpError(
        response.status,
        errMsg,
        retryAfterHeader,
        `Key #${keyIndex + 1}`,
        secrets
      );
      throw classified.error;
    }

    if (options.schema) {
      sessionFormatTierCache.set(getTierCacheKey(normalizedUrl, model), currentTier);
    }

    const data = await response.json();
    const cleanText = extractOpenAIContentText(data);
    if (!cleanText || cleanText.trim().length === 0) {
      throw new Error('Mô hình OpenAI-compatible trả về phản hồi rỗng.');
    }

    return {
      text: cleanText,
      successKeyIndex: keyIndex,
    };
  }
}

async function attemptOpenAIWithKeyPool(params: {
  endpointUrl: string;
  normalizedUrl: string;
  model: string;
  options: DirectGeminiRequestOptions & { schema?: Record<string, any> };
  initialTier: OpenAIResponseFormatTier;
  namespacedKeys: string[];
  rawKeyByNamespaced: Map<string, string>;
  rawSecrets: string[];
  keyHealthOptions: KeyHealthOptions;
  isLocal: boolean;
}): Promise<DirectGeminiResponse> {
  const {
    endpointUrl,
    normalizedUrl,
    model,
    options,
    initialTier,
    namespacedKeys,
    rawKeyByNamespaced,
    rawSecrets,
    keyHealthOptions,
    isLocal,
  } = params;

  const schedule = initKeySchedule(namespacedKeys, options.startKeyIndex, keyHealthOptions);
  const { rawKeys: scheduledNsKeys, customLimits } = schedule;
  let { currentKeyIdx, attemptsCount } = schedule;

  const logicalStartTime = Date.now();
  const overallDeadlineMs = options.timeoutMs ?? 60_000;
  let lastError: Error | null = null;

  while (attemptsCount < scheduledNsKeys.length) {
    const elapsedMs = Date.now() - logicalStartTime;
    const remainingMs = overallDeadlineMs - elapsedMs;
    if (remainingMs <= 50) {
      throw new GeminiRequestError(
        `Quá hạn thời gian yêu cầu OpenAI-compatible API (${Math.round(overallDeadlineMs / 1000)}s).`,
        {
          code: 'ETIMEDOUT',
          category: 'NETWORK_FAILURE',
          isRetryable: true,
        }
      );
    }

    const nsKey = scheduledNsKeys[currentKeyIdx];
    const actualKey = rawKeyByNamespaced.get(nsKey) || '';

    if (!isKeyAvailable(nsKey, customLimits, keyHealthOptions)) {
      const nextIdx = findNextKey(scheduledNsKeys, currentKeyIdx, customLimits, keyHealthOptions);
      if (nextIdx === -1 || (nextIdx === schedule.currentKeyIdx && attemptsCount > 0)) {
        break;
      }
      currentKeyIdx = nextIdx;
      attemptsCount++;
      continue;
    }

    const callStartTime = Date.now();
    const attemptTimeoutMs = Math.min(remainingMs, 60_000);
    const effectiveTier = options.schema
      ? sessionFormatTierCache.get(getTierCacheKey(normalizedUrl, model)) ?? initialTier
      : 'prompt_only';

    localQuotaTracker.recordProviderAttempt(nsKey, keyHealthOptions.model || model, callStartTime);

    try {
      const res = await executeSingleOpenAIRequest({
        endpointUrl,
        normalizedUrl,
        model,
        options,
        initialTier: effectiveTier,
        apiKey: actualKey,
        keyIndex: currentKeyIdx,
        isLocal,
        secrets: rawSecrets,
        attemptTimeoutMs,
      });

      localQuotaTracker.recordSuccess(
        nsKey,
        keyHealthOptions.model || model,
        {
          promptTokens: Math.ceil(options.prompt.length / 4),
          outputTokens: Math.ceil(res.text.length / 4),
        },
        Date.now() - callStartTime
      );
      return res;
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as {
        name?: string;
        code?: string;
        category?: string;
        status?: number;
        retryAfterMs?: number;
        message?: string;
      };
      if (errObj.name === 'AbortError') {
        throw err;
      }
      if (errObj.code === 'RESOURCE_NOT_FOUND' || errObj.code === 'BAD_REQUEST' || errObj.status === 404 || errObj.status === 400) {
        throw err;
      }

      const isRateLimit = errObj.category === 'RATE_LIMIT_RPM' || errObj.category === 'QUOTA_EXHAUSTED_RPD' || errObj.status === 429;
      const isAuth = errObj.category === 'AUTH_FAILURE' || errObj.status === 401 || errObj.status === 403;
      const isOverload = errObj.category === 'SERVICE_OVERLOAD' || errObj.status === 500 || errObj.status === 502 || errObj.status === 503;

      localQuotaTracker.recordFailure(nsKey, keyHealthOptions.model || model, {
        status: errObj.status,
        message: redactSecretFromMessage(errObj.message || '', rawSecrets),
        retryAfterMs: errObj.retryAfterMs,
        isRateLimit,
        isAuthError: isAuth,
        isOverload,
      });

      lastError = err instanceof Error ? err : new Error(redactSecretFromMessage(String(err), rawSecrets));

      const nextIdx = findNextKey(scheduledNsKeys, currentKeyIdx, customLimits, keyHealthOptions);
      if (nextIdx === -1 || attemptsCount >= scheduledNsKeys.length - 1) {
        if (isRateLimit) {
          throw buildAllKeysUnavailableError(scheduledNsKeys, customLimits, lastError.message, keyHealthOptions);
        }
        throw lastError;
      }

      localQuotaTracker.recordRetry(nsKey);
      currentKeyIdx = nextIdx;
      attemptsCount++;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw buildAllKeysUnavailableError(scheduledNsKeys, customLimits, undefined, keyHealthOptions);
}

/**
 * Truy vấn danh sách mô hình từ cổng chuẩn `/v1/models`.
 * Hỗ trợ bỏ trống API key đối với máy chủ cục bộ (`localhost` / `127.0.0.1` / `[::1]`).
 */
export async function listOpenAIModels(
  baseUrl: string,
  apiKey?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<ModelInfoItem[]> {
  const urlCheck = validateProviderBaseUrl(baseUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    throw new Error(urlCheck.error || 'Base URL OpenAI-compatible không hợp lệ.');
  }

  const endpointUrl = buildOpenAICompatibleEndpoint(urlCheck.normalizedUrl, '/models');
  const isLocal = Boolean(urlCheck.isLocal);
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (!isLocal && !cleanKey) {
    throw new Error('Vui lòng nhập ít nhất một API Key để tải danh sách model từ máy chủ từ xa.');
  }

  const headers: Record<string, string> = {};
  if (cleanKey) {
    headers['Authorization'] = `Bearer ${cleanKey}`;
  }

  try {
    const response = await fetchWithTimeout(
      endpointUrl,
      { method: 'GET', headers },
      options?.signal,
      options?.timeoutMs ?? 15_000,
      isLocal ? 'máy chủ OpenAI cục bộ' : 'OpenAI-compatible API'
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = extractErrorMessageFromBody(errBody, response.status, response.statusText);
      const classified = classifyOpenAIHttpError(response.status, errMsg, null, 'API Key', cleanKey ? [cleanKey] : []);
      throw classified.error;
    }

    const data = await response.json();
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];

    return list
      .filter((m: any) => m && typeof m.id === 'string' && m.id.trim().length > 0)
      .map((m: any) => ({
        name: String(m.id).trim(),
        displayName: typeof m.display_name === 'string' && m.display_name.trim() ? m.display_name.trim() : String(m.id).trim(),
        description: typeof m.owned_by === 'string' ? `Provider: ${m.owned_by}` : undefined,
        inputTokenLimit: typeof m.context_window === 'number' ? m.context_window : typeof m.max_context_length === 'number' ? m.max_context_length : undefined,
      }));
  } catch (err: unknown) {
    if ((err as { name?: string })?.name === 'AbortError' || (err as { name?: string })?.name === 'TimeoutError') {
      throw err;
    }
    throw formatOpenAINetworkError(err, isLocal, cleanKey ? [cleanKey] : []);
  }
}

/**
 * Kiểm tra kết nối tới cổng chuẩn OpenAI (/v1/models trước, hoặc ping nhẹ /v1/chat/completions nếu cần).
 */
export async function testOpenAIConnection(
  baseUrl: string,
  model: string,
  apiKey?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<OpenAIConnectionTestResult> {
  const startTime = Date.now();
  const urlCheck = validateProviderBaseUrl(baseUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return {
      ok: false,
      latencyMs: Date.now() - startTime,
      message: urlCheck.error || 'Base URL không hợp lệ.',
    };
  }

  const isLocal = Boolean(urlCheck.isLocal);
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const cleanModel = (model || '').trim();

  if (!isLocal && !cleanKey) {
    return {
      ok: false,
      latencyMs: Date.now() - startTime,
      message: 'Máy chủ từ xa yêu cầu nhập ít nhất một API Key trước khi kiểm tra kết nối.',
    };
  }

  try {
    const models = await listOpenAIModels(urlCheck.normalizedUrl, cleanKey || undefined, {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs ?? 15_000,
    });
    const latencyMs = Date.now() - startTime;
    const matched = cleanModel ? models.some((m) => m.name === cleanModel) : true;
    const modelNote = cleanModel
      ? matched
        ? `Model "${cleanModel}" sẵn sàng.`
        : `Tìm thấy ${models.length} model (chưa thấy "${cleanModel}" trong /v1/models).`
      : `Tìm thấy ${models.length} model khả dụng.`;

    return {
      ok: true,
      latencyMs,
      modelCount: models.length,
      message: `Kết nối thành công (${latencyMs}ms). ${modelNote}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err || 'Lỗi kết nối.');
    const isCorsSuspected =
      isLocal && (msg.includes('CORS') || msg.includes('Failed to fetch') || isNetworkFetchError(err));

    // Một số endpoint proxy tùy chỉnh chỉ mở /chat/completions mà không mở /models (404/405)
    if (cleanModel && (msg.includes('404') || msg.includes('405'))) {
      try {
        await callOpenAICompatible(
          {
            prompt: 'Reply OK',
            temperature: 0.1,
            signal: options?.signal,
            timeoutMs: options?.timeoutMs ?? 15_000,
          },
          {
            baseUrl: urlCheck.normalizedUrl,
            model: cleanModel,
            apiKeys: cleanKey ? [cleanKey] : [],
          }
        );
        const latencyMs = Date.now() - startTime;
        return {
          ok: true,
          latencyMs,
          message: `Kết nối trực tiếp /chat/completions thành công (${latencyMs}ms) với model "${cleanModel}".`,
        };
      } catch (fallbackErr: unknown) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          isCorsSuspected: isLocal && fbMsg.includes('CORS'),
          message: redactSecretFromMessage(fbMsg, cleanKey ? [cleanKey] : []),
        };
      }
    }

    return {
      ok: false,
      latencyMs: Date.now() - startTime,
      isCorsSuspected,
      message: redactSecretFromMessage(msg, cleanKey ? [cleanKey] : []),
    };
  }
}

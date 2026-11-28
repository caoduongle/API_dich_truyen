/**
 * Client-Side Storage & Credential Helpers for AI Provider Config, OpenAI Keys & Glossary Filter Prefs.
 * Note: Intentionally independent of src/utils/modelRegistry.ts to avoid circular dependencies or heavy test mocks.
 */

import { isLocalProviderUrl, OPENAI_COMPATIBLE_PRESETS, validateProviderBaseUrl } from '../config/aiProviders';
import type { AIProviderConfig, OpenAICompatiblePresetId } from '../types/aiProvider';

const PROVIDER_CONFIG_STORAGE_KEY = 'ai_provider_config_v1';
const OPENAI_KEYS_STORAGE_KEY = 'openai_api_keys';
const UI_PREFS_STORAGE_KEY = 'app_ui_prefs';
const INCLUDE_PINNED_GLOSSARY_KEY = 'include_pinned_glossary_in_prompt';

const DEFAULT_PRESET = OPENAI_COMPATIBLE_PRESETS.deepseek;

export const DEFAULT_AI_PROVIDER_CONFIG: AIProviderConfig = {
  providerMode: 'gemini',
  presetId: DEFAULT_PRESET.id,
  baseUrl: DEFAULT_PRESET.baseUrl,
  model: DEFAULT_PRESET.defaultModel,
};

function sanitizePresetId(value: unknown): OpenAICompatiblePresetId {
  if (typeof value === 'string' && value in OPENAI_COMPATIBLE_PRESETS) {
    return value as OpenAICompatiblePresetId;
  }
  return DEFAULT_PRESET.id;
}

export function getStoredAIProviderConfig(): AIProviderConfig {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_AI_PROVIDER_CONFIG };
    }
    const raw = localStorage.getItem(PROVIDER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AI_PROVIDER_CONFIG };
    }
    const parsed = JSON.parse(raw) as Partial<AIProviderConfig> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_AI_PROVIDER_CONFIG };
    }

    const providerMode = parsed.providerMode === 'openai-compatible' ? 'openai-compatible' : 'gemini';
    const presetId = sanitizePresetId(parsed.presetId);
    const presetFallback = OPENAI_COMPATIBLE_PRESETS[presetId];
    const baseUrl =
      typeof parsed.baseUrl === 'string'
        ? parsed.baseUrl.trim()
        : presetFallback.baseUrl;
    const model =
      typeof parsed.model === 'string'
        ? parsed.model.trim()
        : presetFallback.defaultModel;

    return {
      providerMode,
      presetId,
      baseUrl,
      model,
    };
  } catch {
    return { ...DEFAULT_AI_PROVIDER_CONFIG };
  }
}

export function saveStoredAIProviderConfig(config: AIProviderConfig): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const sanitized: AIProviderConfig = {
      providerMode: config.providerMode === 'openai-compatible' ? 'openai-compatible' : 'gemini',
      presetId: sanitizePresetId(config.presetId),
      baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '',
      model: typeof config.model === 'string' ? config.model.trim() : '',
    };
    localStorage.setItem(PROVIDER_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota/security failures gracefully
  }
}

function cleanKeysList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Đọc khóa OpenAI từ sessionStorage và opt-in app_ui_prefs.savedOpenAIKeys.
 * Tự động xóa sạch savedOpenAIKeys nếu rememberKeys === false hoặc phát hiện dữ liệu thừa ở localStorage.
 */
export function loadOpenAIApiKeys(): string[] {
  // 1. Check sessionStorage first
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sessionRaw = sessionStorage.getItem(OPENAI_KEYS_STORAGE_KEY);
      if (sessionRaw) {
        const clean = cleanKeysList(JSON.parse(sessionRaw));
        if (clean.length > 0) {
          return clean;
        }
      }
    }
  } catch {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(OPENAI_KEYS_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  // 2. Scrub any legacy plaintext localStorage['openai_api_keys'] if present
  try {
    if (typeof localStorage !== 'undefined') {
      const legacyRaw = localStorage.getItem(OPENAI_KEYS_STORAGE_KEY);
      if (legacyRaw) {
        localStorage.removeItem(OPENAI_KEYS_STORAGE_KEY);
        const clean = cleanKeysList(JSON.parse(legacyRaw));
        if (clean.length > 0) {
          try {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem(OPENAI_KEYS_STORAGE_KEY, JSON.stringify(clean));
            }
          } catch {
            // ignore
          }
          return clean;
        }
      }
    }
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(OPENAI_KEYS_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  // 3. Check app_ui_prefs.savedOpenAIKeys when rememberKeys is true; scrub when false
  try {
    if (typeof localStorage !== 'undefined') {
      const prefsRaw = localStorage.getItem(UI_PREFS_STORAGE_KEY);
      if (prefsRaw) {
        const prefs = JSON.parse(prefsRaw) as Record<string, unknown> | null;
        if (prefs && typeof prefs === 'object') {
          if (prefs.rememberKeys === false) {
            if (Array.isArray(prefs.savedOpenAIKeys) && prefs.savedOpenAIKeys.length > 0) {
              prefs.savedOpenAIKeys = [];
              localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(prefs));
            }
          } else if (prefs.rememberKeys === true && Array.isArray(prefs.savedOpenAIKeys)) {
            const clean = cleanKeysList(prefs.savedOpenAIKeys);
            if (clean.length > 0) {
              try {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem(OPENAI_KEYS_STORAGE_KEY, JSON.stringify(clean));
                }
              } catch {
                // ignore
              }
              return clean;
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Lưu khóa OpenAI vào sessionStorage; chỉ đồng bộ sang app_ui_prefs.savedOpenAIKeys khi rememberKeys = true,
 * ngược lại xóa sạch savedOpenAIKeys trong app_ui_prefs.
 */
export function saveOpenAIApiKeys(keys: string[], rememberKeys: boolean): void {
  const cleanKeys = cleanKeysList(keys);
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (cleanKeys.length > 0) {
        sessionStorage.setItem(OPENAI_KEYS_STORAGE_KEY, JSON.stringify(cleanKeys));
      } else {
        sessionStorage.removeItem(OPENAI_KEYS_STORAGE_KEY);
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const currentPrefsRaw = localStorage.getItem(UI_PREFS_STORAGE_KEY);
      const currentPrefs = currentPrefsRaw ? JSON.parse(currentPrefsRaw) : {};
      const safePrefs = currentPrefs && typeof currentPrefs === 'object' ? currentPrefs : {};
      const updatedPrefs = {
        ...safePrefs,
        rememberKeys,
        savedOpenAIKeys: rememberKeys ? cleanKeys : [],
      };
      localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(updatedPrefs));
    }
  } catch {
    // ignore
  }
}

export function getIncludePinnedGlossaryPreference(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(INCLUDE_PINNED_GLOSSARY_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setIncludePinnedGlossaryPreference(enabled: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(INCLUDE_PINNED_GLOSSARY_KEY, String(Boolean(enabled)));
  } catch {
    // ignore
  }
}

/**
 * Kiểm tra thống nhất xem nhà cung cấp AI hiện hành đã đủ điều kiện gọi API hay chưa:
 * - Chế độ Gemini: bắt buộc có ít nhất 1 Gemini API Key hợp lệ.
 * - Chế độ OpenAI-compatible: Base URL hợp lệ, đồng thời hoặc là máy chủ local (cho phép không cần key)
 *   hoặc có ít nhất 1 OpenAI API Key hợp lệ.
 */
export function hasActiveAICredentials(geminiApiKeys: string[] = []): boolean {
  const config = getStoredAIProviderConfig();
  if (config.providerMode === 'openai-compatible') {
    const urlCheck = validateProviderBaseUrl(config.baseUrl);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      return false;
    }
    if (isLocalProviderUrl(urlCheck.normalizedUrl)) {
      return true;
    }
    return loadOpenAIApiKeys().length > 0;
  }

  return Array.isArray(geminiApiKeys) && geminiApiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
}

/**
 * Che khóa API an toàn trước khi hiển thị UI hoặc ghi log (SC-006).
 */
export function maskSecretKey(rawKey: string): string {
  const trimmed = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!trimmed) return '';
  if (trimmed.length <= 8) {
    return '****';
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

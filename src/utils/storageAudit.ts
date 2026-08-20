/**
 * Storage Audit & Source of Truth Invariant Enforcement
 * 
 * Defines the definitive ownership boundaries across all storage tiers:
 * - IndexedDB: Sole authoritative store for projects, chapters, split paragraphs, glossaries
 * - Server SessionStore: Sole authoritative store for API keys and runtime credentials
 * - Server QuotaService: Sole authoritative store for RPM/TPM/RPD and key health states
 * - LocalStorage: Strictly restricted to UI preferences and short-lived caches with TTL
 */

export type StorageDomain =
  | 'PROJECTS_CONTENT'
  | 'API_CREDENTIALS'
  | 'AUTH_CREDENTIALS'
  | 'SELECTED_MODEL'
  | 'DISCOVERED_MODELS'
  | 'QUOTA_USAGE'
  | 'KEY_HEALTH'
  | 'CHUNK_CACHE'
  | 'IDEMPOTENCY'
  | 'UI_PREFERENCES';

export interface StorageTierContract {
  domain: StorageDomain;
  sourceOfTruth:
    | 'IndexedDB'
    | 'ServerSession'
    | 'ServerAuth'
    | 'ServerQuota'
    | 'ServerModelRegistry'
    | 'ServerCache'
    | 'LocalStorage';
  cacheLayer: 'None' | 'ReactMemory' | 'LocalStorage' | 'ServerMemory';
  ttlMs?: number;
  evictionStrategy: 'None' | 'LRU' | 'FixedTTL' | 'DailyPSTMidnight' | 'ManualUserWipe';
  migrationStrategy: 'None' | 'IndexedDBVersionMigration' | 'SessionReSync' | 'DefaultFallbackOnDeprecation';
  allowedKeys: string[];
}

/**
 * Danh sách đăng ký phân định quyền sở hữu dữ liệu (Source of Truth Matrix)
 */
export const STORAGE_TIER_REGISTRY: Record<StorageDomain, StorageTierContract> = {
  PROJECTS_CONTENT: {
    domain: 'PROJECTS_CONTENT',
    sourceOfTruth: 'IndexedDB',
    cacheLayer: 'ReactMemory',
    evictionStrategy: 'ManualUserWipe',
    migrationStrategy: 'IndexedDBVersionMigration',
    allowedKeys: ['projects', 'chapters'],
  },
  API_CREDENTIALS: {
    domain: 'API_CREDENTIALS',
    sourceOfTruth: 'ServerSession',
    cacheLayer: 'ReactMemory',
    ttlMs: 24 * 60 * 60 * 1000,
    evictionStrategy: 'FixedTTL',
    migrationStrategy: 'SessionReSync',
    allowedKeys: ['gemini_session_token'],
  },
  AUTH_CREDENTIALS: {
    domain: 'AUTH_CREDENTIALS',
    sourceOfTruth: 'ServerAuth',
    cacheLayer: 'LocalStorage',
    ttlMs: 24 * 60 * 60 * 1000,
    evictionStrategy: 'FixedTTL',
    migrationStrategy: 'SessionReSync',
    allowedKeys: ['gemini_auth_token'],
  },
  SELECTED_MODEL: {
    domain: 'SELECTED_MODEL',
    sourceOfTruth: 'LocalStorage',
    cacheLayer: 'ReactMemory',
    evictionStrategy: 'None',
    migrationStrategy: 'DefaultFallbackOnDeprecation',
    allowedKeys: ['gemini_selected_model'],
  },
  DISCOVERED_MODELS: {
    domain: 'DISCOVERED_MODELS',
    sourceOfTruth: 'ServerModelRegistry',
    cacheLayer: 'LocalStorage',
    ttlMs: 60 * 60 * 1000, // 1 hour TTL
    evictionStrategy: 'FixedTTL',
    migrationStrategy: 'DefaultFallbackOnDeprecation',
    allowedKeys: ['gemini_discovered_models'],
  },
  QUOTA_USAGE: {
    domain: 'QUOTA_USAGE',
    sourceOfTruth: 'ServerQuota',
    cacheLayer: 'ReactMemory',
    evictionStrategy: 'DailyPSTMidnight',
    migrationStrategy: 'None',
    allowedKeys: ['gemini_quota_custom_limits'],
  },
  KEY_HEALTH: {
    domain: 'KEY_HEALTH',
    sourceOfTruth: 'ServerQuota',
    cacheLayer: 'ReactMemory',
    evictionStrategy: 'FixedTTL',
    migrationStrategy: 'None',
    allowedKeys: [],
  },
  CHUNK_CACHE: {
    domain: 'CHUNK_CACHE',
    sourceOfTruth: 'ServerCache',
    cacheLayer: 'ServerMemory',
    ttlMs: 2 * 60 * 60 * 1000, // 2 hours
    evictionStrategy: 'LRU',
    migrationStrategy: 'None',
    allowedKeys: [],
  },
  IDEMPOTENCY: {
    domain: 'IDEMPOTENCY',
    sourceOfTruth: 'ServerCache',
    cacheLayer: 'ServerMemory',
    ttlMs: 10 * 60 * 1000, // 10 minutes
    evictionStrategy: 'FixedTTL',
    migrationStrategy: 'None',
    allowedKeys: [],
  },
  UI_PREFERENCES: {
    domain: 'UI_PREFERENCES',
    sourceOfTruth: 'LocalStorage',
    cacheLayer: 'ReactMemory',
    evictionStrategy: 'None',
    migrationStrategy: 'None',
    allowedKeys: [
      'warning_paragraph_mismatch',
      'enable_ai_qa_critique',
      'enable_segment_translation',
      'app_locale',
      'i18n_locale',
      'app_ui_prefs',
    ],
  },
};

/**
 * Danh sách toàn bộ các key hợp lệ được phép xuất hiện trong localStorage
 */
export const ALLOWED_LOCAL_STORAGE_KEYS = new Set<string>([
  'gemini_session_token',
  'gemini_auth_token',
  'gemini_selected_model',
  'gemini_discovered_models',
  'gemini_quota_custom_limits',
  'warning_paragraph_mismatch',
  'enable_ai_qa_critique',
  'enable_segment_translation',
  'app_locale',
  'i18n_locale',
  'app_ui_prefs',
]);

export interface StorageIntegrityReport {
  isValid: boolean;
  violations: string[];
  auditedKeysCount: number;
  forbiddenKeysFound: string[];
}

/**
 * Kiểm tra tính toàn vẹn của bộ nhớ trình duyệt (localStorage):
 * 1. Không chứa API key dạng plaintext (`gemini_api_keys`)
 * 2. Không chứa dữ liệu bản thảo / chương truyện (`sourceText`, `rawTranslation`, v.v.)
 * 3. Không vượt quá giới hạn kích thước cho từng key UI (tối đa 500KB)
 */
export function verifyStorageIntegrity(storage?: Storage): StorageIntegrityReport {
  const targetStorage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const violations: string[] = [];
  const forbiddenKeysFound: string[] = [];

  if (!targetStorage) {
    return {
      isValid: true,
      violations: [],
      auditedKeysCount: 0,
      forbiddenKeysFound: [],
    };
  }

  const keys: string[] = [];
  for (let i = 0; i < targetStorage.length; i++) {
    const key = targetStorage.key(i);
    if (key) keys.push(key);
  }

  for (const key of keys) {
    const value = targetStorage.getItem(key) || '';

    // 1. Kiểm tra cấm lưu trữ plaintext API keys
    if (key === 'gemini_api_keys') {
      violations.push(`Phát hiện khóa nhạy cảm bị cấm trong localStorage: "${key}". API key phải được lưu trong Server SessionStore hoặc sessionStorage.`);
      forbiddenKeysFound.push(key);
    }

    // 2. Kiểm tra cấm lưu trữ manuscript / chương truyện trong localStorage
    if (
      key === 'projects' ||
      key === 'chapters' ||
      key.startsWith('chapter_') ||
      key.startsWith('project_') ||
      value.includes('"sourceText"') ||
      value.includes('"rawTranslation"') ||
      value.includes('"polishedTranslation"')
    ) {
      violations.push(`Phát hiện dữ liệu chương truyện / bản thảo trong localStorage: "${key}". Toàn bộ nội dung truyện phải được lưu trữ độc quyền trong IndexedDB.`);
      forbiddenKeysFound.push(key);
    }

    // 3. Kiểm tra kích thước bất thường (> 500KB cho 1 key UI preference)
    if (value.length > 500 * 1024) {
      violations.push(`Khóa "${key}" trong localStorage có kích thước bất thường (${Math.round(value.length / 1024)} KB), vượt quá giới hạn 500KB cho UI preferences.`);
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    auditedKeysCount: keys.length,
    forbiddenKeysFound,
  };
}

/**
 * Tự động dọn dẹp các key vi phạm hoặc dữ liệu legacy khỏi localStorage
 */
export function sanitizeLocalStorage(storage?: Storage): number {
  const targetStorage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!targetStorage) return 0;

  const report = verifyStorageIntegrity(targetStorage);
  let cleanedCount = 0;

  for (const forbiddenKey of report.forbiddenKeysFound) {
    targetStorage.removeItem(forbiddenKey);
    cleanedCount++;
  }

  return cleanedCount;
}

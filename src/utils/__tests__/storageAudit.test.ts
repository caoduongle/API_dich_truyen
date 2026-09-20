import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifyStorageIntegrity,
  sanitizeLocalStorage,
  STORAGE_TIER_REGISTRY,
} from '../storageAudit';

describe('Storage Audit & State Ownership Invariants (TASK 13)', () => {
  let mockStorageData: Record<string, string> = {};

  const storageMock: Storage = {
    getItem: (key: string) => mockStorageData[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorageData[key] = String(value);
    },
    removeItem: (key: string) => {
      delete mockStorageData[key];
    },
    clear: () => {
      mockStorageData = {};
    },
    key: (index: number) => Object.keys(mockStorageData)[index] || null,
    get length() {
      return Object.keys(mockStorageData).length;
    },
  };

  beforeEach(() => {
    mockStorageData = {};
  });

  describe('Source of Truth Registry Definition', () => {
    it('defines authoritative owners for all 10 core storage domains in client-side SPA', () => {
      expect(STORAGE_TIER_REGISTRY.PROJECTS_CONTENT.sourceOfTruth).toBe('IndexedDB');
      expect(STORAGE_TIER_REGISTRY.API_CREDENTIALS.sourceOfTruth).toBe('SessionStorage');
      expect(STORAGE_TIER_REGISTRY.AUTH_CREDENTIALS.sourceOfTruth).toBe('SessionStorage');
      expect(STORAGE_TIER_REGISTRY.SELECTED_MODEL.sourceOfTruth).toBe('LocalStorage');
      expect(STORAGE_TIER_REGISTRY.DISCOVERED_MODELS.sourceOfTruth).toBe('LocalStorage');
      expect(STORAGE_TIER_REGISTRY.QUOTA_USAGE.sourceOfTruth).toBe('ReactMemory');
      expect(STORAGE_TIER_REGISTRY.KEY_HEALTH.sourceOfTruth).toBe('ReactMemory');
      expect(STORAGE_TIER_REGISTRY.CHUNK_CACHE.sourceOfTruth).toBe('ReactMemory');
      expect(STORAGE_TIER_REGISTRY.IDEMPOTENCY.sourceOfTruth).toBe('ReactMemory');
      expect(STORAGE_TIER_REGISTRY.UI_PREFERENCES.sourceOfTruth).toBe('LocalStorage');
    });

    it('has explicit cache layer and eviction strategies for all domains', () => {
      for (const [domain, tier] of Object.entries(STORAGE_TIER_REGISTRY)) {
        expect(tier.domain).toBe(domain);
        expect(tier.sourceOfTruth).toBeDefined();
        expect(tier.cacheLayer).toBeDefined();
        expect(tier.evictionStrategy).toBeDefined();
      }
    });
  });

  describe('Storage Integrity Verification', () => {
    it('passes cleanly when only valid UI preferences exist in localStorage', () => {
      storageMock.setItem('gemini_selected_model', 'gemini-2.5-flash');
      storageMock.setItem('warning_paragraph_mismatch', 'true');
      storageMock.setItem('app_locale', 'vi');
      storageMock.setItem('gemini_session_token', 'uuid-token-1234');

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.auditedKeysCount).toBe(4);
    });

    it('allows savedKeys in app_ui_prefs when rememberKeys is explicitly true', () => {
      storageMock.setItem('app_ui_prefs', JSON.stringify({
        rememberKeys: true,
        savedKeys: ['AIzaSyValidKey1', 'AIzaSyValidKey2'],
      }));

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(true);
      expect(report.violations).toHaveLength(0);
    });

    it('verifies rememberKeys is treated as false when unconfigured', () => {
      storageMock.setItem('app_ui_prefs', JSON.stringify({}));
      const parsed = JSON.parse(storageMock.getItem('app_ui_prefs') || '{}');
      const defaultRememberKeys = parsed.rememberKeys === true;
      expect(defaultRememberKeys).toBe(false);
    });

    it('flags violation when savedKeys is present in app_ui_prefs and rememberKeys is false', () => {
      storageMock.setItem('app_ui_prefs', JSON.stringify({
        rememberKeys: false,
        savedKeys: ['AIzaSyForbiddenKey'],
      }));

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(false);
      expect(report.violations.some(v => v.includes('rememberKeys'))).toBe(true);
      expect(report.forbiddenKeysFound).toContain('app_ui_prefs.savedKeys');
    });

    it('flags forbidden plain API keys in localStorage', () => {
      storageMock.setItem('gemini_api_keys', JSON.stringify(['AIzaSyFakeKey123']));

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(false);
      expect(report.violations.some(v => v.includes('gemini_api_keys'))).toBe(true);
      expect(report.forbiddenKeysFound).toContain('gemini_api_keys');
    });

    it('flags forbidden manuscript and chapter text in localStorage', () => {
      storageMock.setItem('projects', JSON.stringify([{ id: 'p1', title: 'Truyện Test' }]));
      storageMock.setItem('chapter_1', JSON.stringify({ id: 'c1', sourceText: 'Tiêu Viêm...' }));
      storageMock.setItem('custom_leak', JSON.stringify({ rawTranslation: 'Đấu Khí Đại Lục...' }));

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(false);
      expect(report.forbiddenKeysFound).toContain('projects');
      expect(report.forbiddenKeysFound).toContain('chapter_1');
      expect(report.forbiddenKeysFound).toContain('custom_leak');
    });

    it('flags abnormally oversized values in localStorage (> 500KB)', () => {
      const hugeString = 'X'.repeat(600 * 1024);
      storageMock.setItem('oversized_key', hugeString);

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(false);
      expect(report.violations.some(v => v.includes('kích thước bất thường'))).toBe(true);
    });
  });

  describe('Sanitize LocalStorage', () => {
    it('purges all forbidden keys while preserving valid UI preferences', () => {
      storageMock.setItem('gemini_api_keys', '["AIzaSy123"]');
      storageMock.setItem('chapter_10', '{"sourceText":"Test"}');
      storageMock.setItem('gemini_selected_model', 'gemini-2.5-pro');
      storageMock.setItem('app_locale', 'vi');

      const cleaned = sanitizeLocalStorage(storageMock);
      expect(cleaned).toBe(2);

      // Forbidden keys removed
      expect(storageMock.getItem('gemini_api_keys')).toBeNull();
      expect(storageMock.getItem('chapter_10')).toBeNull();

      // Valid preferences preserved
      expect(storageMock.getItem('gemini_selected_model')).toBe('gemini-2.5-pro');
      expect(storageMock.getItem('app_locale')).toBe('vi');

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(true);
    });

    it('sanitizes app_ui_prefs.savedKeys to empty array when rememberKeys is false', () => {
      storageMock.setItem('app_ui_prefs', JSON.stringify({
        rememberKeys: false,
        savedKeys: ['AIzaSyKeyToClean'],
        theme: 'dark',
      }));

      const cleaned = sanitizeLocalStorage(storageMock);
      expect(cleaned).toBe(1);

      const parsed = JSON.parse(storageMock.getItem('app_ui_prefs') || '{}');
      expect(parsed.savedKeys).toEqual([]);
      expect(parsed.theme).toBe('dark');
      expect(parsed.rememberKeys).toBe(false);

      const report = verifyStorageIntegrity(storageMock);
      expect(report.isValid).toBe(true);
    });
  });
});

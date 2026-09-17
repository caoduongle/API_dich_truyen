import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { migrateAndLoadApiKeys } from '../../hooks/useAIConfig';
import { sanitizeSecretString, sanitizeValue, redactApiKey } from '../../lib/text';
import { maskApiKey, hashApiKey } from '../../services/localQuotaTracker';
import { legacyHashApiKey } from '../apiKeyHash';
import { CUSTOM_LIMITS_STORAGE_KEY } from '../customLimitsStorage';
import { verifyStorageIntegrity } from '../storageAudit';

describe('Credential Storage & Lifecycle Security', () => {
  let mockLocalStorage: Record<string, string> = {};
  let mockSessionStorage: Record<string, string> = {};
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};

    const localStorageMock = {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
      removeItem: (key: string) => { delete mockLocalStorage[key]; },
      clear: () => { mockLocalStorage = {}; },
    };

    const sessionStorageMock = {
      getItem: (key: string) => mockSessionStorage[key] || null,
      setItem: (key: string, value: string) => { mockSessionStorage[key] = value; },
      removeItem: (key: string) => { delete mockSessionStorage[key]; },
      clear: () => { mockSessionStorage = {}; },
    };

    (global as any).localStorage = localStorageMock;
    (global as any).sessionStorage = sessionStorageMock;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('migrateAndLoadApiKeys (Safe Migration & Ephemeral Storage)', () => {
    it('should return empty array when both sessionStorage and localStorage are empty', () => {
      const keys = migrateAndLoadApiKeys();
      expect(keys).toEqual([]);
      expect(mockLocalStorage['gemini_api_keys']).toBeUndefined();
      expect(mockSessionStorage['gemini_api_keys']).toBeUndefined();
    });

    it('should read keys directly from sessionStorage if already populated', () => {
      mockSessionStorage['gemini_api_keys'] = JSON.stringify(['AIzaSySessionKey1', 'AIzaSySessionKey2']);
      const keys = migrateAndLoadApiKeys();
      expect(keys).toEqual(['AIzaSySessionKey1', 'AIzaSySessionKey2']);
      expect(mockLocalStorage['gemini_api_keys']).toBeUndefined();
    });

    it('should migrate legacy keys from localStorage to sessionStorage and purge localStorage immediately', () => {
      mockLocalStorage['gemini_api_keys'] = JSON.stringify(['AIzaSyLegacyKey1', 'AIzaSyLegacyKey2']);
      
      const keys = migrateAndLoadApiKeys();
      
      expect(keys).toEqual(['AIzaSyLegacyKey1', 'AIzaSyLegacyKey2']);
      // Verify legacy localStorage is purged
      expect(mockLocalStorage['gemini_api_keys']).toBeUndefined();
      // Verify sessionStorage has the migrated keys
      expect(JSON.parse(mockSessionStorage['gemini_api_keys'])).toEqual(['AIzaSyLegacyKey1', 'AIzaSyLegacyKey2']);
      
      // Verify localStorage passes integrity check
      const report = verifyStorageIntegrity(global.localStorage);
      expect(report.isValid).toBe(true);
    });

    it('should filter out blank strings, non-string entries, and whitespace keys during migration', () => {
      mockLocalStorage['gemini_api_keys'] = JSON.stringify(['  ', 'AIzaSyValidKey', '', null, 123, 'AIzaSyValidKey2']);
      
      const keys = migrateAndLoadApiKeys();
      
      expect(keys).toEqual(['AIzaSyValidKey', 'AIzaSyValidKey2']);
      expect(mockLocalStorage['gemini_api_keys']).toBeUndefined();
    });

    it('should gracefully handle malformed/corrupted JSON in localStorage without throwing', () => {
      mockLocalStorage['gemini_api_keys'] = '{CORRUPTED_JSON_STRING: [invalid';
      
      const keys = migrateAndLoadApiKeys();
      
      expect(keys).toEqual([]);
      // Should clean up the corrupted key to avoid future crashes
      expect(mockLocalStorage['gemini_api_keys']).toBeUndefined();
    });

    it('should gracefully handle malformed JSON in sessionStorage without throwing', () => {
      mockSessionStorage['gemini_api_keys'] = 'CORRUPTED_SESSION_JSON';
      
      const keys = migrateAndLoadApiKeys();
      
      expect(keys).toEqual([]);
      expect(mockSessionStorage['gemini_api_keys']).toBeUndefined();
    });

    it('should automatically trigger migrateCustomLimits when loading valid API keys', () => {
      const validKey = 'AIzaSyAutoMigrateKey123';
      const legacyHash = legacyHashApiKey(validKey);
      const newHash = hashApiKey(validKey);

      // Setup legacy custom limit in localStorage
      mockLocalStorage[CUSTOM_LIMITS_STORAGE_KEY] = JSON.stringify({
        [legacyHash]: { maxRpd: 1234, maxRpm: 15 },
      });

      // Keys in localStorage ready to migrate
      mockLocalStorage['gemini_api_keys'] = JSON.stringify([validKey]);

      const keys = migrateAndLoadApiKeys();
      expect(keys).toEqual([validKey]);

      // Verify custom limits storage was migrated
      const updatedLimits = JSON.parse(mockLocalStorage[CUSTOM_LIMITS_STORAGE_KEY]);
      expect(updatedLimits[newHash]).toEqual({ maxRpd: 1234, maxRpm: 15 });
      expect(updatedLimits[legacyHash]).toBeUndefined();
    });
  });

  describe('Secret Redaction & Logging Guarantees', () => {
    it('sanitizeSecretString should redact Google Gemini API key patterns', () => {
      const logMessage = 'Calling Gemini API with key AIzaSyD1234567890abcdef1234567890abcde for translation';
      const sanitized = sanitizeSecretString(logMessage);
      
      expect(sanitized).not.toContain('AIzaSyD1234567890abcdef1234567890abcde');
      expect(sanitized).toContain('AIza***[REDACTED]');
    });

    it('sanitizeSecretString should redact API keys and tokens in query parameters', () => {
      const urlLog = 'Failed to fetch https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD1234567890abcdef1234567890abcde&apiKey=secretKey123';
      const sanitized = sanitizeSecretString(urlLog);
      
      expect(sanitized).not.toContain('AIzaSyD1234567890abcdef1234567890abcde');
      expect(sanitized).not.toContain('secretKey123');
      expect(sanitized).toContain('key=[REDACTED]');
      expect(sanitized).toContain('apiKey=[REDACTED]');
    });

    it('sanitizeValue should redact key-value fields in metadata objects', () => {
      const meta = {
        userId: 'user_123',
        apiKey: 'AIzaSySecretLongKey987654321',
        token: 'secret-session-token',
        nested: {
          password: 'myPassword123',
        },
      };

      const sanitized = sanitizeValue(meta);
      expect(sanitized.apiKey).toContain('...[REDACTED]');
      expect(sanitized.token).toContain('...[REDACTED]');
      expect(sanitized.nested.password).toContain('...[REDACTED]');
      expect(sanitized.userId).toBe('user_123');
    });

    it('redactApiKey should replace occurrences of given keys in error strings', () => {
      const errorMsg = 'Google GenerativeAI Error with key AIzaSySecretKeyXYZ: Model quota exceeded';
      const redacted = redactApiKey(errorMsg, ['AIzaSySecretKeyXYZ']);
      
      expect(redacted).not.toContain('AIzaSySecretKeyXYZ');
      expect(redacted).toBe('Google GenerativeAI Error with key ***REDACTED***: Model quota exceeded');
    });

    it('maskApiKey and hashApiKey should never reveal full key in quota projections', () => {
      const rawKey = 'AIzaSyAbcdef1234567890ghijklmnopqr';
      const masked = maskApiKey(rawKey);
      const hashed = hashApiKey(rawKey);

      expect(masked).toBe('AIzaSy...opqr');
      expect(masked).not.toContain('1234567890');
      expect(hashed).toHaveLength(64); // SHA-256 hex string
      expect(hashed).toMatch(/^[0-9a-f]{64}$/);
      expect(hashed).not.toContain(rawKey);
    });

    it('hashApiKey should produce unique collision-resistant SHA-256 digests matching Node crypto', async () => {
      const { hashApiKeyAsync } = await import('../../services/localQuotaTracker');
      const crypto = await import('crypto');

      const keyA = 'AIzaSyKeyAlpha123456789';
      const keyB = 'AIzaSyKeyAlpha123456788'; // 1 character difference

      const hashA = hashApiKey(keyA);
      const hashB = hashApiKey(keyB);

      expect(hashA).not.toBe(hashB);
      expect(hashA).toMatch(/^[0-9a-f]{64}$/);
      expect(hashB).toMatch(/^[0-9a-f]{64}$/);

      const expectedA = crypto.createHash('sha256').update(keyA).digest('hex');
      expect(hashA).toBe(expectedA);

      const asyncHashA = await hashApiKeyAsync(keyA);
      expect(asyncHashA).toBe(hashA);
    });
  });
});

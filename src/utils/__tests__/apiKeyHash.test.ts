import { describe, it, expect, beforeEach } from 'vitest';
import { hashApiKey, hashApiKeyAsync, sha256Sync, keyHashCache, legacyHashApiKey, isLegacyHash } from '../apiKeyHash';

describe('apiKeyHash Security & Hashing Tests', () => {
  beforeEach(() => {
    keyHashCache.clear();
  });

  it('generates consistent 64-character SHA-256 hex digest', () => {
    const rawKey = 'AIzaSyExampleSecretKey1234567890abcdef';
    const digest = hashApiKey(rawKey);

    expect(digest).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(digest)).toBe(true);
    expect(hashApiKey(rawKey)).toBe(digest);
  });

  it('matches synchronous pure TS sha256Sync implementation', () => {
    const rawKey = 'AIzaSyAnotherKeyForTesting';
    expect(hashApiKey(rawKey)).toBe(sha256Sync(rawKey));
  });

  it('matches async subtle crypto hashing', async () => {
    const rawKey = 'AIzaSyAsyncKeyVerification999';
    const syncDigest = hashApiKey(rawKey);
    const asyncDigest = await hashApiKeyAsync(rawKey);
    expect(asyncDigest).toBe(syncDigest);
  });

  it('handles empty or whitespace keys safely', () => {
    expect(hashApiKey('')).toBe('');
    expect(hashApiKey('   ')).toBe('');
  });

  it('is idempotent when already passed a 64-char hex digest', () => {
    const validDigest = 'a'.repeat(64);
    expect(hashApiKey(validDigest)).toBe(validDigest);
  });

  it('MUST NOT retain raw secret keys in keyHashCache heap memory', () => {
    const secretKey1 = 'AIzaSySecretDoNotCache111';
    const secretKey2 = 'AIzaSySecretDoNotCache222';

    hashApiKey(secretKey1);
    hashApiKey(secretKey2);

    expect(keyHashCache.has(secretKey1)).toBe(false);
    expect(keyHashCache.has(secretKey2)).toBe(false);
    expect(keyHashCache.size).toBe(0);
  });

  it('preserves legacyHashApiKey and isLegacyHash detection for migration', () => {
    const legacy = legacyHashApiKey('legacyKey');
    expect(isLegacyHash(legacy)).toBe(true);
    expect(isLegacyHash('not_a_valid_hash')).toBe(true);
    const standardSha256 = hashApiKey('standard_key_for_hash_test');
    expect(isLegacyHash(standardSha256)).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { sessionStore } from '../sessionStore';
import { hashApiKey, maskApiKey } from '../quotaService';
import { redactApiKey } from '../../utils/text';

const SAMPLE_RAW_KEYS = [
  'AIzaSyTestKeyAlpha111222333444555666',
  'AIzaSyTestKeyBeta999888777666555444',
];

describe('API Key Zero-Knowledge Storage & Lifecycle (060)', () => {
  beforeEach(() => {
    sessionStore.clearAllForTesting();
  });

  it('hashApiKey: produces consistent 64-char SHA-256 hex string and is idempotent', () => {
    const key = SAMPLE_RAW_KEYS[0];
    const hash = hashApiKey(key);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key);

    // Idempotent test
    const doubleHashed = hashApiKey(hash);
    expect(doubleHashed).toBe(hash);
  });

  it('maskApiKey: safely masks raw keys and key hashes', () => {
    const raw = SAMPLE_RAW_KEYS[0];
    expect(maskApiKey(raw)).toBe('AIzaSy...5666');

    const hash = hashApiKey(raw);
    expect(maskApiKey(hash)).toBe(`${hash.slice(0, 6)}...${hash.slice(-4)}`);
  });

  it('sessionStore: stores keyHashes directly and retrieves them reliably', async () => {
    const keyHashes = SAMPLE_RAW_KEYS.map(hashApiKey);
    const { sessionToken, keyCount } = await sessionStore.createSession(keyHashes);

    expect(sessionToken).toMatch(/^session_[a-f0-9-]+$/);
    expect(keyCount).toBe(2);

    const retrievedHashes = await sessionStore.getSessionKeyHashes(sessionToken);
    expect(retrievedHashes).toEqual(keyHashes);
    // Plaintext keys must never be stored
    for (const raw of SAMPLE_RAW_KEYS) {
      expect(retrievedHashes).not.toContain(raw);
    }
  });

  it('sessionStore: strictly rejects raw API keys or invalid hash formats', async () => {
    await expect(
      sessionStore.createSession(['AIzaSyRawKeyShouldBeRejected'])
    ).rejects.toThrow('Mã băm API key không hợp lệ');
  });

  it('redactApiKey: redacts multi-provider API keys from logs and messages', () => {
    const log = 'Requests sent with key AIzaSyTestKeyAlpha111222333444555666 and anthropic sk-ant-api03-12345678901234567890 and openai sk-proj-12345678901234567890';
    const redacted = redactApiKey(log, SAMPLE_RAW_KEYS);

    expect(redacted).not.toContain('AIzaSyTestKeyAlpha111222333444555666');
    expect(redacted).not.toContain('sk-ant-api03-12345678901234567890');
    expect(redacted).not.toContain('sk-proj-12345678901234567890');
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sessionStore,
  encryptApiKeys,
  decryptApiKeys,
  getEncryptionKey,
} from "../sessionStore";
import {
  TEST_API_KEYS,
  createTamperedEncryptedPayload,
} from "./encryptionTestFixtures";

describe("SessionStore AES-256-GCM Encryption & Lifecycle", () => {
  beforeEach(() => {
    sessionStore.clearAllForTesting();
  });

  afterEach(() => {
    sessionStore.clearAllForTesting();
  });

  it("should encrypt and decrypt API keys accurately via AES-256-GCM", () => {
    const encrypted = encryptApiKeys(TEST_API_KEYS);
    expect(typeof encrypted).toBe("string");

    const parts = encrypted.split(":");
    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(parts).toHaveLength(5); // enc:v1:iv:authTag:ciphertext

    // Ciphertext must NOT contain plaintext keys
    for (const key of TEST_API_KEYS) {
      expect(encrypted).not.toContain(key);
    }

    const decrypted = decryptApiKeys(encrypted);
    expect(decrypted).toEqual(TEST_API_KEYS);
  });

  it("should reject tampered ciphertext with an authentication error", () => {
    const validEncrypted = encryptApiKeys(TEST_API_KEYS);
    const tampered = createTamperedEncryptedPayload(validEncrypted);

    expect(() => decryptApiKeys(tampered)).toThrow();
  });

  it("should create session with encrypted storage and retrieve decrypted keys", async () => {
    const { sessionToken, keyCount, expiresAt } = await sessionStore.createSession(
      TEST_API_KEYS,
      60000
    );

    expect(sessionToken).toMatch(/^session_[a-f0-9-]+$/);
    expect(keyCount).toBe(2);
    expect(expiresAt).toBeDefined();

    const retrievedKeys = await sessionStore.getSessionKeys(sessionToken);
    expect(retrievedKeys).toEqual(TEST_API_KEYS);

    const info = await sessionStore.getSessionInfo(sessionToken);
    expect(info.valid).toBe(true);
    expect(info.keyCount).toBe(2);
  });

  it("should extend session expiration on access (sliding window)", async () => {
    const { sessionToken } = await sessionStore.createSession(TEST_API_KEYS, 10000);
    const retrieved = await sessionStore.getSessionKeys(sessionToken, 20000);
    expect(retrieved).toEqual(TEST_API_KEYS);

    const info = await sessionStore.getSessionInfo(sessionToken);
    expect(info.valid).toBe(true);
  });

  it("should delete session cleanly", async () => {
    const { sessionToken } = await sessionStore.createSession(TEST_API_KEYS);
    const deleted = await sessionStore.deleteSession(sessionToken);
    expect(deleted).toBe(true);

    const keys = await sessionStore.getSessionKeys(sessionToken);
    expect(keys).toBeNull();
  });
});

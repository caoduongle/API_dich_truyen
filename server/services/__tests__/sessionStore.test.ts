import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sessionStore } from "../sessionStore";

const TEST_KEY_HASHES = [
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
];

describe("SessionStore Zero-Knowledge Hash Storage & Lifecycle", () => {
  beforeEach(() => {
    sessionStore.clearAllForTesting();
  });

  afterEach(() => {
    sessionStore.clearAllForTesting();
  });

  it("should create session with keyHashes and return sessionToken", async () => {
    const { sessionToken, keyCount, expiresAt } = await sessionStore.createSession(
      TEST_KEY_HASHES,
      60000
    );

    expect(sessionToken).toMatch(/^session_[a-f0-9-]+$/);
    expect(keyCount).toBe(2);
    expect(expiresAt).toBeDefined();

    const retrievedHashes = await sessionStore.getSessionKeyHashes(sessionToken);
    expect(retrievedHashes).toEqual(TEST_KEY_HASHES);

    const info = await sessionStore.getSessionInfo(sessionToken);
    expect(info.valid).toBe(true);
    expect(info.keyCount).toBe(2);
  });

  it("should reject non-hex64 strings with an error", async () => {
    await expect(
      sessionStore.createSession(["AIzaSyPlaintextKeyInvalidFormat"])
    ).rejects.toThrow("Mã băm API key không hợp lệ");
  });

  it("should extend session expiration on access (sliding window)", async () => {
    const { sessionToken } = await sessionStore.createSession(TEST_KEY_HASHES, 10000);
    const retrieved = await sessionStore.getSessionKeyHashes(sessionToken, 20000);
    expect(retrieved).toEqual(TEST_KEY_HASHES);

    const info = await sessionStore.getSessionInfo(sessionToken);
    expect(info.valid).toBe(true);
  });

  it("should delete session cleanly", async () => {
    const { sessionToken } = await sessionStore.createSession(TEST_KEY_HASHES);
    const deleted = await sessionStore.deleteSession(sessionToken);
    expect(deleted).toBe(true);

    const hashes = await sessionStore.getSessionKeyHashes(sessionToken);
    expect(hashes).toBeNull();
  });
});

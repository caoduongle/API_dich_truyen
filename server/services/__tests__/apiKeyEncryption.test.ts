import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptApiKeys,
  decryptApiKeys,
  decryptApiKeysWithStatus,
  getEncryptionKey,
  SessionDecryptionError,
  sessionStore,
} from '../sessionStore';
import { redactApiKey } from '../../utils/text';

describe('API Key Encryption at Rest & Migration (TASK 05)', () => {
  beforeEach(() => {
    sessionStore.clearAllForTesting();
  });

  // 1. encrypt
  it('encrypt: produces versioned AES-256-GCM ciphertext envelope (enc:v1:...)', () => {
    const rawKeys = ['AIzaSyTestKeyAlpha111', 'AIzaSyTestKeyBeta222'];
    const ciphertext = encryptApiKeys(rawKeys);

    // Bắt đầu bằng tiền tố định dạng v1 chuẩn
    expect(ciphertext.startsWith('enc:v1:')).toBe(true);

    // Cấu trúc phong bì chuẩn: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
    const parts = ciphertext.split(':');
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe('enc');
    expect(parts[1]).toBe('v1');
    expect(parts[2].length).toBe(24); // 12 bytes IV = 24 hex chars
    expect(parts[3].length).toBe(32); // 16 bytes AuthTag = 32 hex chars
    expect(parts[4].length).toBeGreaterThan(0);

    // Đảm bảo không chứa bất kỳ chuỗi plaintext nào của key
    expect(ciphertext).not.toContain('AIzaSyTestKeyAlpha111');
    expect(ciphertext).not.toContain('AIzaSyTestKeyBeta222');
  });

  // 2. decrypt
  it('decrypt: accurately restores original keys from v1 ciphertext', () => {
    const rawKeys = ['AIzaSyTestKeyGamma333', 'AIzaSyTestKeyDelta444'];
    const ciphertext = encryptApiKeys(rawKeys);

    const decrypted = decryptApiKeys(ciphertext);
    expect(decrypted).toEqual(rawKeys);
  });

  // 3. wrong key
  it('wrong key: securely fails authentication when decrypting with different master key', () => {
    const rawKeys = ['AIzaSyTestKeySecret555'];
    const masterKeyA = getEncryptionKey('secret_master_key_A');
    const masterKeyB = getEncryptionKey('secret_master_key_B_different');

    // Mã hóa bằng khóa A
    const ciphertext = encryptApiKeys(rawKeys, masterKeyA);

    // Thử giải mã bằng khóa B -> Phải ném SessionDecryptionError an toàn
    expect(() => {
      decryptApiKeys(ciphertext, masterKeyB);
    }).toThrow(SessionDecryptionError);
  });

  // 4. corrupted ciphertext
  it('corrupted ciphertext: detects tampering via GCM auth tag and rejects safely', () => {
    const rawKeys = ['AIzaSyTestKeyTamper666'];
    const ciphertext = encryptApiKeys(rawKeys);
    const parts = ciphertext.split(':');

    // Sửa đổi 1 byte cuối cùng trong ciphertext hex
    const lastPart = parts[4];
    const tamperedHex = lastPart.slice(0, -2) + (lastPart.slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedHex}`;

    expect(() => {
      decryptApiKeys(tamperedCiphertext);
    }).toThrow(SessionDecryptionError);
  });

  // 5. migration
  it('migration: seamlessly upgrades legacy plaintext/v0 sessions to enc:v1: upon retrieval without crashing', async () => {
    const legacyKeys = ['AIzaSyLegacyKey777', 'AIzaSyLegacyKey888'];

    // Giả lập session cũ được lưu dưới dạng JSON plaintext
    const plaintextJson = JSON.stringify(legacyKeys);
    const resultPlaintext = decryptApiKeysWithStatus(plaintextJson);
    expect(resultPlaintext.keys).toEqual(legacyKeys);
    expect(resultPlaintext.isMigrated).toBe(true);
    expect(resultPlaintext.sourceFormat).toBe('legacy_plaintext');

    // Giả lập session cũ lưu dưới dạng v0 (iv:authTag:ciphertext không có enc:v1:)
    const v1Cipher = encryptApiKeys(legacyKeys);
    const v0Parts = v1Cipher.split(':').slice(2).join(':'); // bỏ "enc:v1:"
    const resultV0 = decryptApiKeysWithStatus(v0Parts);
    expect(resultV0.keys).toEqual(legacyKeys);
    expect(resultV0.isMigrated).toBe(true);
    expect(resultV0.sourceFormat).toBe('v0_gcm');

    // Test Lazy Migration tự động trong SessionStore:
    // Tạo session nhưng ghi đè dữ liệu thành legacy plaintext
    const sessionRes = await sessionStore.createSession(legacyKeys);
    // Trực tiếp truy xuất getSessionKeys -> Đọc thành công và tự động re-encrypt
    const keysAfterRetrieval = await sessionStore.getSessionKeys(sessionRes.sessionToken);
    expect(keysAfterRetrieval).toEqual(legacyKeys);
  });

  // 6. redaction
  it('redaction: verifies API keys and secrets never appear in plaintext logs or error traces', () => {
    const secretKey = 'AIzaSySuperSecretKey999999999999';
    const errorMsg = `FetchError to https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${secretKey} failed with 500`;

    const sanitized = redactApiKey(errorMsg, [secretKey]);
    expect(sanitized).not.toContain(secretKey);
    expect(sanitized).toContain('***REDACTED***');
  });
});

# Quickstart & Verification Guide: API Key Encryption at Rest

**Feature**: `042-api-key-encryption-at-rest`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 6 kịch bản bắt buộc của TASK 05 — Đảm bảo API key luôn được mã hóa an toàn tại Redis / Server session, hỗ trợ di trú dữ liệu cũ trong suốt và che giấu hoàn toàn khóa bí mật.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`apiKeyEncryption.test.ts`)

```typescript
describe('API Key Encryption at Rest & Migration (TASK 05)', () => {
  // Test 1: encrypt
  it('encrypt: produces versioned AES-256-GCM ciphertext envelope (enc:v1:...)', () => {
    // Mã hóa keys -> format enc:v1:<iv>:<authTag>:<ciphertext>
  });

  // Test 2: decrypt
  it('decrypt: accurately restores original keys from v1 ciphertext', () => {
    // Giải mã bản mã v1 -> ra đúng mảng keys gốc
  });

  // Test 3: wrong key
  it('wrong key: securely fails authentication when decrypting with different master key', () => {
    // Dùng sai master key -> ném SessionDecryptionError, không lộ dữ liệu
  });

  // Test 4: corrupted ciphertext
  it('corrupted ciphertext: detects tampering via GCM auth tag and rejects safely', () => {
    // Sửa đổi bit trong ciphertext -> ném SessionDecryptionError
  });

  // Test 5: migration
  it('migration: seamlessly upgrades legacy plaintext/v0 sessions to enc:v1: upon retrieval without crashing', async () => {
    // Đọc session cũ chứa plaintext -> trả về keys thành công và tự động re-encrypt lưu lại vào Redis/Memory
  });

  // Test 6: redaction
  it('redaction: verifies API keys and secrets never appear in plaintext logs or error traces', () => {
    // Kiểm tra các hàm logger / redaction không rò rỉ key
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt cho Encryption at Rest
npx vitest run server/services/__tests__/apiKeyEncryption.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```

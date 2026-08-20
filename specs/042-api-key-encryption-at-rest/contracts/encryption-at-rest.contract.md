# API & Service Contract: API Key Encryption at Rest

**Feature**: `042-api-key-encryption-at-rest`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Hàm Mật Mã Trong `sessionStore.ts`

```typescript
/**
 * Lấy khóa mã hóa 32 bytes từ biến môi trường ENCRYPTION_MASTER_KEY hoặc SESSION_SECRET
 */
export function getEncryptionKey(overrideSecret?: string): Buffer;

/**
 * Mã hóa danh sách API keys thành chuỗi định dạng AES-256-GCM v1
 * Trả về: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptApiKeys(apiKeys: string[], masterKeyBuffer?: Buffer): string;

/**
 * Giải mã chuỗi phong bì bản mã thành mảng API keys và cờ báo di trú
 */
export function decryptApiKeysWithStatus(
  encryptedPayload: string,
  masterKeyBuffer?: Buffer
): DecryptedKeysResult;

/**
 * Giải mã chuỗi phong bì bản mã thành mảng API keys
 */
export function decryptApiKeys(
  encryptedPayload: string,
  masterKeyBuffer?: Buffer
): string[];
```

---

## 2. Hợp Đồng API Endpoint: `POST /api/session-keys`

```json
// Request Body
{
  "apiKeys": ["AIzaSyKey1...", "AIzaSyKey2..."],
  "ttlMs": 86400000
}

// Response Body (200 OK)
{
  "sessionToken": "session_8f3d1b82-...",
  "keyCount": 2,
  "expiresAt": "2026-08-21T10:45:00.000Z",
  "message": "Đã tạo phiên làm việc bảo mật thành công."
}
```
*(Tuyệt đối không phản hồi danh sách key thô ra ngoài)*.

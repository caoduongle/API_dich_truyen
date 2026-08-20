# Data Model & Encryption Envelope Specifications

**Feature**: `042-api-key-encryption-at-rest`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Dữ Liệu TypeScript

### 1.1 Bản Ghi Phiên Làm Việc Trong Redis (`SessionData`)
```typescript
export interface SessionData {
  encryptedKeys: string; // Định dạng "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
}
```

### 1.2 Kết Quả Giải Mã Kèm Trạng Thái Di Trú (`DecryptedKeysResult`)
```typescript
export interface DecryptedKeysResult {
  keys: string[];
  isMigrated: boolean;
  sourceFormat: 'v1_gcm' | 'v0_gcm' | 'legacy_plaintext';
}
```

### 1.3 Lớp Ngoại Lệ Giải Mã Chuẩn Hóa (`SessionDecryptionError`)
```typescript
export class SessionDecryptionError extends Error {
  readonly isDecryptionError = true;
  constructor(message: string = 'Không thể giải mã dữ liệu khóa phiên: tính toàn vẹn bị vi phạm hoặc sai khóa bảo mật.') {
    super(message);
    this.name = 'SessionDecryptionError';
  }
}
```

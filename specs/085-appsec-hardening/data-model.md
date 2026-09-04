# Phase 1 Data Model: Security Entities & Access Control Models

**Feature**: `085-appsec-hardening`  
**Date**: 2026-09-05  

---

## 1. Authentication & Session Entities

### `AuthSession` (Phiên xác thực người dùng máy chủ)

Quản lý vòng đời của phiên làm việc an toàn:

```typescript
export interface AuthSession {
  /**
   * Mã định danh phiên ngẫu nhiên (32 bytes hex = 64 ký tự)
   */
  token: string;

  /**
   * Thời điểm khởi tạo phiên (Unix timestamp ms)
   */
  createdAt: number;

  /**
   * Thời điểm hết hạn của phiên (Unix timestamp ms)
   */
  expiresAt: number;

  /**
   * Địa chỉ IP khởi tạo phiên
   */
  clientIp?: string;

  /**
   * Chuỗi nhận diện User-Agent của trình duyệt
   */
  userAgent?: string;

  /**
   * Trạng thái thu hồi phiên thủ công (Logout)
   */
  isRevoked: boolean;
}
```

---

## 2. Cryptographic & Secret Storage Entities

### `EncryptedPayload` (Cấu trúc mã hóa AES-256-GCM)

Sử dụng cho toàn bộ khóa API Gemini và token lưu tạm thời trong RAM / Redis:

```typescript
export interface EncryptedPayload {
  /**
   * Chuỗi dữ liệu sau khi mã hóa (Hex-encoded)
   */
  ciphertext: string;

  /**
   * Vector khởi tạo ngẫu nhiên 96-bit (12 bytes, Hex-encoded)
   */
  iv: string;

  /**
   * Chuỗi thẻ xác thực tính toàn vẹn 128-bit (16 bytes, Hex-encoded)
   */
  authTag: string;

  /**
   * Thuật toán mã hóa chuẩn
   */
  algorithm: 'aes-256-gcm';

  /**
   * Phiên bản khóa dẫn xuất (hỗ trợ key rotation)
   */
  keyVersion: number;
}
```

---

## 3. Distributed Rate Limiting & Banlist Entities

### `SecurityRateLimitRecord` (Bản ghi giới hạn tốc độ và danh sách cấm)

Lưu trữ trong Redis với cấu trúc hash hoặc chuỗi đếm:

```typescript
export interface SecurityRateLimitRecord {
  /**
   * Khóa định danh (ví dụ: ratelimit:login:192.168.1.1)
   */
  key: string;

  /**
   * Số lượng yêu cầu đã gửi trong cửa sổ hiện tại
   */
  hits: number;

  /**
   * Thời điểm cửa sổ đếm được đặt lại (Unix timestamp ms)
   */
  resetTime: number;

  /**
   * Trạng thái IP có đang bị tạm khóa do vi phạm liên tục hay không
   */
  isBlocked: boolean;

  /**
   * Thời điểm hết hạn khóa tạm thời (nếu bị block)
   */
  blockExpiresAt?: number;
}
```

---

## 4. Access Control & Authorization Entities (IDOR Prevention)

### `ProjectAccessPolicy` (Chính sách phân quyền dự án dịch thuật)

Sử dụng tại WebSocket Relay `/ws/sync` và kịch bản di trú RLS:

```typescript
export type AccessRole = 'owner' | 'editor' | 'viewer';

export interface ProjectCollaborator {
  email: string;
  role: AccessRole;
  addedAt: number;
}

export interface ProjectAccessPolicy {
  /**
   * Mã định danh dự án duy nhất
   */
  projectId: string;

  /**
   * Email của chủ sở hữu dự án (Owner)
   */
  ownerEmail: string;

  /**
   * Danh sách cộng tác viên hợp lệ có quyền truy cập
   */
  collaborators: ProjectCollaborator[];

  /**
   * Trạng thái dự án công khai hoặc riêng tư
   */
  isPublic: boolean;
}
```

---

## 5. Security Audit Log Entity

### `SecurityAuditLogEntry` (Nhật ký an ninh hệ thống)

Ghi nhận các sự kiện vi phạm an ninh với thông tin nhạy cảm đã được làm sạch:

```typescript
export type SecurityEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_LOGOUT'
  | 'IP_RATE_LIMITED'
  | 'IP_TEMPORARILY_BLOCKED'
  | 'BOT_HONEYPOT_TRIGGERED'
  | 'IDOR_ACCESS_DENIED'
  | 'INVALID_INPUT_SCHEMA'
  | 'MALICIOUS_FILE_BLOCKED';

export interface SecurityAuditLogEntry {
  timestamp: string; // ISO 8601
  requestId: string;
  eventType: SecurityEventType;
  clientIp: string;
  requestPath: string;
  httpMethod: string;
  details?: Record<string, unknown>; // Đã chạy qua sanitizeValue()
}
```

---

## 6. Safe File Upload Entity

### `FileUploadValidationRecord` (Thực thể kiểm định tệp tin tải lên)

```typescript
export interface FileUploadValidationRecord {
  filename: string;
  sanitizedFilename: string; // Đã loại bỏ ..\ và ký tự lạ
  sizeBytes: number;
  mimeType: string;
  magicBytesHex: string;
  isValidExtension: boolean;
  isValidMagicBytes: boolean;
  sha256Checksum: string;
}
```

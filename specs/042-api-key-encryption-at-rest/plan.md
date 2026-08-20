# Implementation Plan: API Key Encryption at Rest (Mã Hóa Khóa API Khi Lưu Trữ)

**Feature**: `042-api-key-encryption-at-rest`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/042-api-key-encryption-at-rest/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/042-api-key-encryption-at-rest/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Zero-Plaintext at Rest Invariant**:
> Mọi API key lưu trong Redis hoặc Server Memory PHẢI mang định dạng bản mã xác thực `enc:v1:<iv>:<authTag>:<ciphertext>`.
> Khóa chính Master Encryption Key tuyệt đối không bao giờ được lưu vào Redis.
> Quá trình di trú tự động (Lazy Migration) nâng cấp các phiên cũ trong suốt mà không làm gián đoạn hay crash bất kỳ active session nào.

---

## Proposed Changes

### Layer 1: Cryptographic Primitives & Envelope Management (`server/services/sessionStore.ts`)
- Nâng cấp `encryptApiKeys` xuất ra tiền tố chuẩn `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
- Cài đặt `decryptApiKeysWithStatus` hỗ trợ đa định dạng: `enc:v1:`, `v0`, và `legacy_plaintext`.
- Tạo lớp ngoại lệ chuẩn hóa `SessionDecryptionError`.
- Tích hợp tự động lưu đè bản mã `enc:v1:` khi phát hiện session cũ trong `getSessionKeys`.

### Layer 2: Integration & Controller Security (`server/controllers/sessionController.ts`)
- Xác nhận endpoint `POST /api/session-keys` và `GET /api/session-keys/status` bảo vệ tuyệt đối không rò rỉ key ra payload hoặc query params.

### Layer 3: Comprehensive Test Suite (`server/services/__tests__/apiKeyEncryption.test.ts`)
- Cài đặt đầy đủ 6 ca kiểm thử:
  1. `encrypt`
  2. `decrypt`
  3. `wrong key`
  4. `corrupted ciphertext`
  5. `migration`
  6. `redaction`

### Layer 4: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc bảo mật trong `docs/security-and-credentials.md` hoặc `docs/quota-and-scheduling.md`.
- Vượt qua toàn diện các Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/apiKeyEncryption.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Kiểm tra Redis key bằng `SCAN session_keys:*` và `GET session_keys:...` $\to$ chỉ thấy ciphertext `enc:v1:...`, 0% plaintext.

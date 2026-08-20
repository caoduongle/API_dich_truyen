# Implementation Plan: Model Verification Unknown != True (Xác Thực Năng Lực Mô Hình)

**Feature**: `043-model-verification-unknown-not-true`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/043-model-verification-unknown-not-true/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/043-model-verification-unknown-not-true/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Tri-State Capability & Unknown ≠ True Invariant**:
> Metadata thiếu hoặc rỗng (`supportedGenerationMethods === undefined / []`) PHẢI được đánh giá là `unknown`, tuyệt đối không được tự động coi là `supported` hoặc `verified = true`.
> Khi một mô hình ở trạng thái `unknown`, hệ thống PHẢI thực hiện Explicit Verification Probe để kiểm chứng khả năng sinh nội dung thực tế trước khi xác nhận `verified = true`.

---

## Proposed Changes

### Layer 1: Core Capability Evaluation & Explicit Probe (`server/services/modelInfoService.ts`)
- Thêm `evaluateModelGenerationCapability(supportedMethods: unknown): ModelCapabilityState`.
- Cập nhật `fetchModelsFromGoogle` để chỉ trả về các model có năng lực `'supported'`.
- Nâng cấp `verifySingleModel` với quy trình 3 nhánh (`supported` $\to$ approve, `unsupported` $\to$ reject, `unknown` $\to$ probe).
- Cài đặt hàm `probeModelGeneration(modelId: string, apiKey: string): Promise<boolean>`.

### Layer 2: API & Controller Synchronization (`server/controllers/quotaController.ts`)
- Đồng bộ handler `/api/verify-model` và `/api/models-for-key` xử lý lỗi chuẩn hóa `UNSUPPORTED_METHODS`.

### Layer 3: Comprehensive Test Suite (`server/services/__tests__/modelVerification.test.ts`)
- Cài đặt đầy đủ 6 ca kiểm thử:
  1. `capability present`
  2. `capability absent`
  3. `capability missing`
  4. `malformed metadata`
  5. `verification success`
  6. `verification failure`

### Layer 4: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc xác thực mô hình trong `docs/quota-and-scheduling.md`.
- Vượt qua toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/modelVerification.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Gọi API `/api/verify-model` với một model embedding (ví dụ `text-embedding-004`) $\to$ nhận thông báo từ chối `UNSUPPORTED_METHODS`.

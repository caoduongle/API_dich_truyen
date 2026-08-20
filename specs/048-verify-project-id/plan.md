# Implementation Plan: Verify Project ID (Xác Nhận projectId Thay Vì Tin Tuyệt Đối)

**Feature**: `048-verify-project-id`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/048-verify-project-id/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/048-verify-project-id/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Project Binding Invariant**:
> 1. `userDeclaredProject` (`source: 'user'`, `status: 'declared'`): Scheduler **không tự ý coi là Same Provider Quota Bucket**, trừ khi người dùng đã explicitly gom các keys vào cùng một Quota Group.
> 2. `providerVerifiedProject` (`source: 'provider'`, `status: 'verified'`): Đảm bảo các keys thuộc cùng một Provider Quota Bucket thực tế phía Google.
> 3. `unknownProject` (`source: 'inferred'`, `status: 'unknown'`): Cô lập an toàn mặc định.

---

## Proposed Changes

### Layer 1: Data Contracts (`shared/models.ts`)
- Định nghĩa `ProjectBindingSource`, `ProjectVerificationStatus`, `ProjectMetadata`.
- Bổ sung `projectMetadata?: ProjectMetadata` vào `QuotaGroup` và `QuotaGroupConfigInput`.

### Layer 2: Service Architecture (`server/services/quotaService.ts`)
- Cập nhật `registerQuotaGroup` tự động gán metadata chuẩn xác theo nguồn gốc.
- Bổ sung phương thức `verifyGroupProject(groupId: string, verifiedProjectId: string)` để nâng cấp trạng thái thành `verified`.
- Bổ sung phương thức `areKeysInSameVerifiedBucket(keyA: string, keyB: string)` và tích hợp an toàn vào Scheduler.

### Layer 3: Comprehensive Test Suite (`server/services/__tests__/projectVerification.test.ts`)
- Cài đặt đầy đủ 4 ca kiểm thử:
  1. `same declared project`
  2. `different declared project`
  3. `provider verified project`
  4. `unknown project`

### Layer 4: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc trong `docs/quota-and-scheduling.md` (mục Project ID Verification & Metadata Tracking).
- Vượt qua toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/projectVerification.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Gọi API `/api/quota/groups` $\to$ kiểm tra JSON payload trả về đầy đủ `projectMetadata` với `source` và `status`.

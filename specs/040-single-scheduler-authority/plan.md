# Implementation Plan: Single Scheduler Authority (Cơ Quan Điều Phối Hạn Ngạch Duy Nhất)

**Feature**: `040-single-scheduler-authority`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/040-single-scheduler-authority/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/040-single-scheduler-authority/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Single Authority Invariant**:
> Toàn bộ logic đánh giá QuotaGroup, tính toán pacing delay, chọn key và quản lý cooldown được tập trung hóa hoàn toàn bên trong `quotaService`.
> `geminiService` được chuyển đổi thành Stateless Executor: chỉ hỏi Scheduler $\to$ sleep đúng 1 lần nếu có `delayMs` $\to$ gọi API $\to$ báo cáo kết quả.
> Xóa bỏ toàn bộ các biến map `nextAllowedTimeByKey`, `nextAllowedTimeByGroup` và biến `overloadCooldownUntil` phân tán trong `geminiService.ts`.

---

## Proposed Changes

### Layer 1: Data Contracts & Types (`shared/models.ts`)
- Thêm interface `ScheduleLease` định nghĩa hợp đồng cấp phép điều phối.

### Layer 2: Core Authority Implementation (`server/services/quotaService.ts`)
- Cài đặt phương thức `scheduleAttempt(candidateKeys, modelName, estimatedTokens, now): ScheduleLease`.
- Đảm bảo tính nguyên tử khi tính toán `delayMs` và cập nhật `group.nextAllowedTimeMs`.
- Tập trung hóa toàn bộ việc cập nhật Cooldown khi có lỗi từ `geminiService`.

### Layer 3: Stateless Executor Refactor (`server/services/geminiService.ts`)
- Xóa bỏ `nextAllowedTimeByKey`, `nextAllowedTimeByGroup`, `overloadCooldownUntil`.
- Tái cấu trúc `generateWithRotation` gọi `quotaService.scheduleAttempt(...)` và chỉ thực hiện `sleep(lease.delayMs)` duy nhất một lần.

### Layer 4: Comprehensive Test Suite (`server/services/__tests__/quotaScheduler.test.ts`)
- Cài đặt 5 kịch bản kiểm thử bắt buộc:
  1. `group pacing`
  2. `multiple keys same group`
  3. `multiple groups`
  4. `parallel requests`
  5. `no double sleep`

### Layer 5: Documentation & Quality Gates
- Cập nhật kiến trúc Single Scheduler Authority trong `docs/quota-and-scheduling.md`.
- Vượt qua `npm run lint`, `npm test`, và `npm run build`.

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/quotaScheduler.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Xác minh không còn bất kỳ biến pacing nào bị phân tán giữa `geminiService` và `quotaService`.

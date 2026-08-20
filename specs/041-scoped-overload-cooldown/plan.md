# Implementation Plan: Scoped Overload Cooldown (Phân Vùng Phạm Vi Cooldown Quá Tải)

**Feature**: `041-scoped-overload-cooldown`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/041-scoped-overload-cooldown/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/041-scoped-overload-cooldown/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Scoped Failure Domain Invariant**:
> Lỗi quá tải HTTP 503 của một mô hình cụ thể (`Model A`) chỉ kích hoạt Cooldown cho Model đó, không chặn các Model khác (`Model B`, `Model C`).
> Lỗi quá tải/hạn ngạch của một dự án (`Project A`) chỉ kích hoạt Cooldown cho Project đó, không chặn các Project khác (`Project B`).
> Cooldown toàn nhà cung cấp (`Provider-Wide Outage`) chỉ kích hoạt khi có sự cố diện rộng thực tế ($\ge 2$ models VÀ $\ge 2$ groups đồng thời lỗi trong 5 giây).

---

## Proposed Changes

### Layer 1: Core Scoped Cooldown Engine (`server/services/quotaService.ts`)
- Thêm `modelCooldownsMap: Map<string, ModelCooldownRecord>`.
- Thêm `providerOutageTracker: { outageUntilMs: number; recentErrors: Array<{ modelName: string; groupId: string; timestamp: number }> }`.
- Cài đặt các phương thức: `triggerModelCooldown`, `getModelCooldownStatus`, `recordUpstreamFailureEvent`, `getProviderOutageStatus`.
- Tích hợp kiểm tra 4 tầng trong `scheduleAttempt`:
  1. Provider Outage Check
  2. Model Cooldown Check
  3. Group Cooldown Check
  4. Key Health Check

### Layer 2: Telemetry & API Snapshot Integration (`server/services/quotaService.ts` & `server/controllers/quotaController.ts`)
- Mở rộng `getSchedulerTelemetry()` với `activeModelCooldowns`, `activeGroupCooldowns`, và `isProviderOutage`.
- Phản ánh chi tiết qua `/api/quota-status`.

### Layer 3: Comprehensive Test Suite (`server/services/__tests__/scopedOverloadCooldown.test.ts`)
- Cài đặt toàn diện 6 bài test kịch bản:
  1. `model A overloaded`
  2. `model B remains usable`
  3. `project A overloaded`
  4. `project B remains usable`
  5. `provider-wide outage`
  6. `recovery`

### Layer 4: Documentation & Quality Gates
- Cập nhật kiến trúc Scoped Cooldown trong `docs/quota-and-scheduling.md`.
- Vượt qua `npm run lint`, `npm test`, và `npm run build`.

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/scopedOverloadCooldown.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Xác minh khi `gemini-2.5-pro` gặp 503 thì `gemini-2.5-flash` vẫn nhận `delayMs = 0` và chạy bình thường.

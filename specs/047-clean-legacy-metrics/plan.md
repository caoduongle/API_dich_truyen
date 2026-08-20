# Implementation Plan: Clean Legacy Metrics (Dọn Dẹp Số Liệu Di Sản & Chuẩn Tắc Hóa)

**Feature**: `047-clean-legacy-metrics`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/047-clean-legacy-metrics/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/047-clean-legacy-metrics/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Canonical Metrics Invariant**:
> Hệ thống phân định rành mạch 3 tầng metrics:
> 1. **Logical**: `logicalRequests`, `successfulRequests`, `failedRequests`.
> 2. **Provider**: `providerAttempts`, `retries`, `providerFailures`.
> 3. **Key Activity**: `keyAttempts`, `keyFailures`, `keyCooldowns`.
> Các trường di sản (`requestsTotal`, `providerAttemptsTotal`) được giữ lại dưới dạng compatibility alias và đánh dấu `@deprecated` trong TypeScript definitions để ngăn ngừa breaking change ngầm.

---

## Proposed Changes

### Layer 1: Data Contracts (`shared/models.ts`)
- Thêm `KeyActivityMetrics`, `ProviderUsageStats` và cập nhật `LogicalUsageStats`.
- Cập nhật `KeyQuotaSnapshot` bổ sung `keyAttempts`, `keyFailures`, `keyCooldowns`.
- Đánh dấu `@deprecated` cho `requestsTotal`, `requestsToday`, `requestsThisMinute`, `providerAttemptsTotal`, v.v.

### Layer 2: Service Implementation (`server/services/quotaService.ts`)
- Đảm bảo `recordLogicalRequest` cập nhật chuẩn xác `logicalRequests`, `successfulRequests`, `failedRequests`, `providerAttempts`, `retries`, `providerFailures`.
- Cập nhật `getQuotaSnapshot` điền đầy đủ cả canonical metrics lẫn compatibility aliases.

### Layer 3: Comprehensive Test Suite (`server/services/__tests__/canonicalMetrics.test.ts`)
- Cài đặt đầy đủ 4 ca kiểm thử:
  1. `1 request / 1 attempt`
  2. `1 request / 3 attempts`
  3. `multiple logical requests`
  4. `all retries fail`

### Layer 4: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc trong `docs/quota-and-scheduling.md` (mục Canonical Metrics Hierarchy & Deprecation).
- Vượt qua toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/canonicalMetrics.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Gọi API `/api/quota/snapshot` $\to$ kiểm tra JSON payload có cả `keyAttempts` và `requestsTotal` với giá trị đồng nhất.

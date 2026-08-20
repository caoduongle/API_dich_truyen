# Implementation Plan: Model Discovery SingleFlight (Gộp Yêu Cầu Đồng Thời)

**Feature**: `045-model-discovery-singleflight`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/045-model-discovery-singleflight/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/045-model-discovery-singleflight/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **SingleFlight & Bounded Memory Invariant**:
> 20 (hoặc nhiều hơn) yêu cầu đồng thời cho cùng một API key khi cache miss CHỈ ĐƯỢC PHÉP tạo duy nhất 1 cuộc gọi HTTP thực tế lên Google.
> Tất cả các in-flight promises PHẢI được dọn dẹp sạch sẽ trong khối `finally` để ngăn ngừa memory leaks.
> Short failure cache (30s) bảo vệ upstream khỏi thundering herd khi key bị lỗi.

---

## Proposed Changes

### Layer 1: SingleFlight Deduplicator & Dual-Tier Cache (`server/services/modelInfoService.ts`)
- Thêm `inFlightDiscovery = new Map<string, Promise<DiscoveryResult>>()` và `failureCache = new Map<string, FailureCacheEntry>()`.
- Tái cấu trúc `listModelsForKey`:
  - Bước 1: Kiểm tra Fresh Cache (TTL 15m) $\to$ trả về cache nếu hợp lệ.
  - Bước 2: Kiểm tra Short Failure Cache (TTL 30s) $\to$ ném lỗi cached nếu chưa hết hạn và không `forceRefresh`.
  - Bước 3: Kiểm tra `inFlightDiscovery` $\to$ await promise đang chạy nếu có request cùng key.
  - Bước 4: Tạo mới in-flight promise gửi 1 HTTP request lên Google API, ghi đè cache và dọn dẹp in-flight map trong `finally`.
- Bổ sung `cleanupInterval` tự động dọn dẹp bộ nhớ định kỳ.

### Layer 2: Comprehensive Test Suite (`server/services/__tests__/modelDiscoverySingleflight.test.ts`)
- Cài đặt đầy đủ 6 ca kiểm thử:
  1. `single request`
  2. `20 concurrent cache miss`
  3. `cache hit`
  4. `failure`
  5. `timeout`
  6. `recovery`

### Layer 3: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc trong `docs/quota-and-scheduling.md` (mục SingleFlight Discovery & Dual-Tier Cache).
- Vượt qua toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/modelDiscoverySingleflight.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Chạy 20 requests đồng thời tới `/api/models-for-key` trong kịch bản benchmark $\to$ chỉ có 1 request outbound tới Google.

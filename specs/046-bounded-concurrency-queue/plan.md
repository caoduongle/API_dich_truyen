# Implementation Plan: Bounded Concurrency Queue (Cổng Đồng Thời Kèm Hàng Đợi Có Giới Hạn)

**Feature**: `046-bounded-concurrency-queue`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/046-bounded-concurrency-queue/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/046-bounded-concurrency-queue/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Bounded Concurrency & Backpressure Invariant**:
> Hệ thống cho phép tối đa 50 tác vụ dịch thuật chạy song song với Google Gemini API.
> Yêu cầu thứ 51 KHÔNG BỊ TỪ CHỐI NGAY mà được xếp hàng chờ (tối đa 100 tác vụ chờ).
> Tuyệt đối không cho phép hàng đợi phình to vô hạn: Yêu cầu thứ 151 trở đi sẽ bị chặn bởi cơ chế Backpressure (`QUEUE_FULL`).
> Mọi tác vụ đều được bảo vệ bởi timeout (30s), hủy an toàn (AbortSignal) và giải phóng slot trong khối `finally`.

---

## Proposed Changes

### Layer 1: Core Engine (`server/services/concurrencyGate.ts`)
- Xây dựng lớp `BoundedConcurrencyQueue`:
  - Quản lý `activeCount`, `queue: QueuedTask[]`, `maxConcurrent = 50`, `maxDepth = 100`, `queueTimeoutMs = 30000`.
  - Phương thức `execute(fn, { signal, timeoutMs })`: Cấp slot ngay nếu còn trống, đưa vào hàng đợi nếu bận, từ chối nếu queue đầy (`QUEUE_FULL`).
  - Phương thức `drainNext()`: Chuyển tiếp khe chạy cho task chờ tiếp theo khi 1 task hoàn tất (hoặc bị throw Error).
  - Phương thức `getMetrics()`: Cung cấp thông số giám sát hệ thống.

### Layer 2: Integration (`server/services/geminiService.ts`)
- Thay thế biến đếm `activeConcurrentRequests` thô bằng thể hiện `geminiConcurrencyGate` từ `concurrencyGate.ts`.
- Bọc toàn bộ lời gọi thực thi `callGeminiApi` qua `geminiConcurrencyGate.execute(...)`.

### Layer 3: Comprehensive Test Suite (`server/services/__tests__/boundedConcurrencyQueue.test.ts`)
- Cài đặt đầy đủ 6 ca kiểm thử:
  1. `50 concurrent`
  2. `51st behavior`
  3. `queue full`
  4. `timeout`
  5. `cancel`
  6. `failure`

### Layer 4: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc trong `docs/quota-and-scheduling.md` (mục Bounded Concurrency Queue & Backpressure).
- Vượt qua toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/boundedConcurrencyQueue.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Thực hiện batch test với 60 chapter translations $\to$ 50 chapters chạy song song, 10 chapters xếp hàng chờ và hoàn tất tuần tự không có lỗi reject.

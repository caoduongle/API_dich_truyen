# Phase 0 Research: Bounded Concurrency Queue & Backpressure Architecture

**Feature**: `046-bounded-concurrency-queue`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Phân Tích Hiện Trạng & Sai Lệch Ngữ Nghĩa (Semantics Audit)

### Vấn Đề
Trong `server/services/geminiService.ts`:
```typescript
let activeConcurrentRequests = 0;
const MAX_CONCURRENT_REQUESTS = 50;

if (activeConcurrentRequests >= MAX_CONCURRENT_REQUESTS) {
  throw new Error('Hệ thống dịch thuật hiện đang quá tải số lượng yêu cầu đồng thời. Vui lòng thử lại sau giây lát.');
}
activeConcurrentRequests++;
```
- Logic này là một **Zero-Wait Concurrency Gate** (cổng từ chối ngay lập tức khi chạm mốc 50 requests).
- Khi người dùng thực hiện dịch hàng loạt (Batch Chapter Translation, ví dụ 100 chương), việc từ chối request thứ 51 ngay lập tức khiến các chương bị lỗi fail đột ngột, làm gián đoạn luồng tự động dịch.

---

## 2. Kiến Trúc Hàng Đợi Có Giới Hạn (Bounded Concurrency Queue)

```
                            Request Mới Đến
                                  │
                                  ▼
                     ┌───────────────────────────┐
                     │ activeCount < maxConcurrent? (50)
                     └─────────────┬─────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ YES                         │ NO
                    ▼                             ▼
        ┌───────────────────────┐   ┌───────────────────────────┐
        │ activeCount++         │   │ queuedCount < maxDepth? (100)
        │ Thực thi ngay lập tức │   └─────────────┬─────────────┘
        └───────────┬───────────┘                 │
                    │              ┌──────────────┴──────────────┐
                    │              │ YES                         │ NO
                    │              ▼                             ▼
                    │  ┌───────────────────────┐   ┌───────────────────────────┐
                    │  │ Đưa vào hàng đợi      │   │ Ném lỗi Backpressure      │
                    │  │ Cài đặt timeout 30s   │   │ QUEUE_FULL (Từ chối ngay) │
                    │  │ Lắng nghe AbortSignal │   └───────────────────────────┘
                    │  └───────────┬───────────┘
                    │              │
                    │              ▼ (Khi có slot trống giải phóng)
                    │  ┌───────────────────────┐
                    │  │ drainNext()           │
                    │  │ activeCount++         │
                    │  │ Thực thi task         │
                    │  └───────────┬───────────┘
                    │              │
                    ▼              ▼
        ┌───────────────────────────────────────┐
        │              finally {                │
        │   activeCount--;                      │
        │   drainNext(); // Kích hoạt waiter    │
        │ }                                     │
        └───────────────────────────────────────┘
```

---

## 3. Kịch Bản Kiểm Thử Bắt Buộc

1. `50 concurrent`: 50 tasks chạy song song ngay lập tức (`queueWaitMs = 0`).
2. `51st behavior`: Task thứ 51 chờ trong queue và tự động thực thi ngay khi 1 task trước đó hoàn tất.
3. `queue full`: 50 active + 100 queued $\to$ task 151 bị ném lỗi `QUEUE_FULL` ngay lập tức.
4. `timeout`: Task chờ quá 30s $\to$ ném lỗi `QUEUE_TIMEOUT` và tự động rút khỏi queue.
5. `cancel`: Task đang chờ bị hủy qua `AbortSignal` $\to$ ném lỗi `ABORTED` và giải phóng timer.
6. `failure`: Task ném Error $\to$ slot vẫn được giải phóng trong `finally` cho task tiếp theo.

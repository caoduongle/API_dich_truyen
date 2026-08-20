# Quickstart & Verification Guide: Bounded Concurrency Queue

**Feature**: `046-bounded-concurrency-queue`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 6 kịch bản bắt buộc của TASK 09 — Đảm bảo 50 requests đồng thời chạy ngay, request thứ 51 xếp hàng chờ và thực thi khi có slot trống, backpressure kích hoạt khi queue đầy, timeout và cancel hoạt động chuẩn xác 100%.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`boundedConcurrencyQueue.test.ts`)

```typescript
describe('Bounded Concurrency Queue & Backpressure (TASK 09)', () => {
  // Test 1: 50 concurrent
  it('50 concurrent: allows 50 simultaneous tasks to execute immediately without queue wait', async () => {
    // 50 tasks -> activeCount = 50, queuedCount = 0
  });

  // Test 2: 51st behavior
  it('51st behavior: enqueues 51st task and drains it immediately when a slot is released', async () => {
    // 50 running, 51st waits, 1 finishes -> 51st runs and completes
  });

  // Test 3: queue full
  it('queue full: rejects 151st request immediately with QUEUE_FULL backpressure error', async () => {
    // 50 active + 100 queued -> 151st rejected immediately
  });

  // Test 4: timeout
  it('timeout: rejects task waiting longer than queueTimeoutMs and cleans queue state', async () => {
    // Slots busy -> waiter times out after timeoutMs, queue length restored to 0
  });

  // Test 5: cancel
  it('cancel: immediately aborts queued task upon AbortSignal and removes it from queue', async () => {
    // Task aborted -> rejects with AbortError, queue length restored to 0
  });

  // Test 6: failure
  it('failure: releases slot safely in finally block on task exception so next queued task runs', async () => {
    // Active task throws -> slot freed, next queued task acquires slot and completes
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt cho Bounded Concurrency Queue
npx vitest run server/services/__tests__/boundedConcurrencyQueue.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```

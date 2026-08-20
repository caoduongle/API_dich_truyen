# API & Service Contract: Bounded Concurrency Queue

**Feature**: `046-bounded-concurrency-queue`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Service Trong `concurrencyGate.ts`

```typescript
export interface IBoundedConcurrencyQueue {
  /**
   * Thực thi một tác vụ async với giới hạn đồng thời và hàng đợi có giới hạn
   */
  execute<T>(
    fn: () => Promise<T>,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<T>;

  /**
   * Đọc thông số viễn trắc hiện thời của hàng đợi
   */
  getMetrics(): QueueMetrics;

  /**
   * Xóa hàng đợi và reset metrics (dùng cho testing)
   */
  resetForTesting(): void;
}
```

---

## 2. Hằng Số Mặc Định

```typescript
export const DEFAULT_MAX_CONCURRENT = 50;
export const DEFAULT_MAX_DEPTH = 100;
export const DEFAULT_QUEUE_TIMEOUT_MS = 30000;
```

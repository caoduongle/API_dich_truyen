# Data Model & Queue State Specifications

**Feature**: `046-bounded-concurrency-queue`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Dữ Liệu TypeScript

### 1.1 Cấu Hình Hàng Đợi (`BoundedConcurrencyQueueConfig`)
```typescript
export interface BoundedConcurrencyQueueConfig {
  maxConcurrent?: number;      // Mặc định: 50
  maxDepth?: number;           // Mặc định: 100
  queueTimeoutMs?: number;     // Mặc định: 30000 (30 giây)
}
```

### 1.2 Phần Tử Hàng Đợi Chờ (`QueuedTask<T>`)
```typescript
interface QueuedTask<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  enqueueTime: number;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  abortListener?: () => void;
}
```

### 1.3 Thông Số Viễn Trắc Hàng Đợi (`QueueMetrics`)
```typescript
export interface QueueMetrics {
  activeCount: number;
  queuedCount: number;
  maxConcurrent: number;
  maxDepth: number;
  totalExecuted: number;
  totalRejected: number;
  totalTimeouts: number;
  totalCancelled: number;
}
```

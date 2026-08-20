# API & Service Contract: SingleFlight Model Discovery

**Feature**: `045-model-discovery-singleflight`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Service Trong `modelInfoService.ts`

```typescript
export interface IModelInfoService {
  /**
   * Tra cứu danh sách mô hình cho một API key với cơ chế SingleFlight Coalescing
   * - Nếu có cache fresh: trả về ngay (0 HTTP request).
   * - Nếu có request in-flight: await chung promise đang chạy (0 request mới).
   * - Nếu chưa có: gửi 1 HTTP request và chia sẻ cho tất cả requests đồng thời.
   */
  listModelsForKey(
    apiKey: string,
    forceRefresh?: boolean
  ): Promise<DiscoveryResult>;

  /**
   * Dọn dẹp toàn bộ bộ nhớ đệm và các in-flight promises
   */
  clearCache(): void;
}
```

---

## 2. Hằng Số Cấu Hình Bộ Nhớ Đệm & Timeout

```typescript
export const DISCOVERY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 phút
export const FAILURE_CACHE_TTL_MS = 30 * 1000;         // 30 giây
export const REQUEST_TIMEOUT_MS = 15 * 1000;           // 15 giây
export const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;     // 10 phút
```

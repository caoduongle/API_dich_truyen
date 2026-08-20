# API & Service Contract: Canonical Metrics & Deprecation

**Feature**: `047-clean-legacy-metrics`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Service Trong `quotaService.ts`

```typescript
export interface IQuotaMetricsService {
  /**
   * Ghi nhận 1 logical request kết thúc (cùng số provider attempts và retries)
   */
  recordLogicalRequest(
    modelId: string,
    status: 'success' | 'failure',
    providerAttempts?: number,
    retries?: number
  ): void;

  /**
   * Đọc thống kê Logical metrics chuẩn tắc
   */
  getLogicalStats(): LogicalUsageStats;

  /**
   * Đọc snapshot của các API keys kèm canonical và backward-compatibility fields
   */
  getQuotaSnapshot(keys: string[], timestamp?: number): KeyQuotaSnapshot[];
}
```

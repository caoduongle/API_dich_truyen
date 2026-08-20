# Data Model & In-Flight State Specifications

**Feature**: `045-model-discovery-singleflight`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Dữ Liệu TypeScript

### 1.1 Bản Ghi Kết Quả Khám Phá (`DiscoveryResult`)
```typescript
export interface DiscoveryResult {
  keyHash: string;
  maskedKey: string;
  cached: boolean;
  stale?: boolean;
  models: ModelInfo[];
}
```

### 1.2 Bản Ghi Bộ Nhớ Đệm Thất Bại (`FailureCacheEntry`)
```typescript
interface FailureCacheEntry {
  timestamp: number;
  error: Error;
}
```

### 1.3 Cấu Trúc Hàng Đợi In-Flight Trong `ModelInfoService`
```typescript
class ModelInfoService {
  private cache = new Map<string, CachedModels>();
  private failureCache = new Map<string, FailureCacheEntry>();
  private inFlightDiscovery = new Map<string, Promise<DiscoveryResult>>();
  private inFlightRevalidation = new Map<string, Promise<ModelInfo[]>>();
  private verifiedModelsCache = new Map<string, CachedVerifiedModel>();
  private inFlightVerifications = new Map<string, Promise<ModelDefinition>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
}
```

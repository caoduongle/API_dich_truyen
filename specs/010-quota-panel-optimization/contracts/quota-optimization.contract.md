# Interface Contract: Performance Optimized Quota Observability

**Feature**: `010-quota-panel-optimization`  
**Created**: 2026-08-19  

---

## 1. Observability Hook Contract (`useModelObservability`)

```typescript
export interface ModelObservabilityState {
  snapshotKeys: KeyQuotaFullSnapshot[];
  loadingQuota: boolean;
  quotaError: string | null;
  inspectResults: Record<number, ModelInfoItem[]>;
  inspectLoadingKeyIndex: number | null;
  inspectErrors: Record<number, string>;
  timezone: string;
  currentDayPST: string;
  lastUpdated: Date | null;
  /** Tải lại thông tin quota; forceRefresh=true sẽ bỏ qua bộ đệm cache 30s */
  loadQuotaStatus: (forceRefresh?: boolean) => Promise<void>;
  inspectKeyModels: (keyIndex: number) => Promise<void>;
  clearInspectResult: (keyIndex: number) => void;
}
```

---

## 2. Dynamic Discovery Registration Contract (`useAIConfig`)

```typescript
export interface AIConfigContextType {
  // ... other properties
  /**
   * Đăng ký danh sách model tìm thấy. 
   * Đảm bảo không kích hoạt context re-render nếu danh sách model giống nhau.
   */
  registerDiscoveredModels: (models: ModelInfoItem[]) => void;
}
```

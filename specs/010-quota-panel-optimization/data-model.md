# Data Model: Quota Panel Performance Optimization

**Feature**: `010-quota-panel-optimization`  
**Created**: 2026-08-19  

---

## 1. UI Component Props & State Models

```typescript
export interface CountdownBadgeProps {
  /** Số mili-giây còn lại được trả về từ snapshot server */
  remainingMs: number;
  /** Loại countdown: ngắt mạch (blacklist) hoặc hoãn do rate limit (rateLimit) */
  type: 'blacklist' | 'rateLimit';
  /** Callback khi đếm lùi về 0 */
  onExpire?: () => void;
  className?: string;
}

export interface KeyCardItemProps {
  item: KeyQuotaFullSnapshot;
  idx: number;
  selectedModel: string;
  normSelected: string;
  isInspecting: boolean;
  inspectData?: ModelInfoItem[];
  inspectErr?: string;
  isExpanded: boolean;
  onInspect: (idx: number) => void;
  onClearInspect: (idx: number) => void;
  onToggleExpand: (idx: number) => void;
  onSelectModel?: (model: string) => void;
}

export interface QuotaCacheEntry {
  data: QuotaStatusResponse;
  timestamp: number;
  keysKey: string;
}
```

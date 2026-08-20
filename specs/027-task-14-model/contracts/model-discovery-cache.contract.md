# Interface Contract: Model Discovery Cache & SWR Lifecycle

**Feature**: Model Discovery Cache & SWR Lifecycle  
**Branch**: `027-task-14-model` | **Date**: 2026-08-20  

---

## 1. TypeScript Client Module Contract (`src/utils/modelRegistry.ts`)

```typescript
import { ModelInfoItem } from './apiClient';
import { RegisteredModelDef } from '@shared/models';

export const DISCOVERED_MODELS_STORAGE_KEY = 'gemini_discovered_models';
export const DISCOVERED_MODELS_TTL_MS = 60 * 60 * 1000; // 1 hour
export const DISCOVERY_COOLDOWN_MS = 60 * 1000; // 60 seconds

export interface DiscoveredCacheMeta {
  isStale: boolean;
  timestamp: number;
  lastRefreshedAt: string;
  count: number;
  lastError?: string;
}

/**
 * Lấy thông tin metadata của cache khám phá model (kiểm tra stale/fresh)
 */
export function getDiscoveredCacheMeta(): DiscoveredCacheMeta | null;

/**
 * Lấy danh sách model đã khám phá từ cache (trả về ngay kể cả khi stale)
 */
export function getDiscoveredModels(): RegisteredModelDef[];

/**
 * Lưu danh sách model mới nhận được từ Google API vào cache (kèm timestamp)
 */
export function saveDiscoveredModels(models: ModelInfoItem[], sourceKeyHash?: string): RegisteredModelDef[];

/**
 * Ghi nhận lỗi refresh vào cache mà KHÔNG xóa các model đã có
 */
export function recordDiscoveryError(errorMessage: string): void;

/**
 * Khám phá hoặc làm mới danh sách model có cơ chế SWR, Deduplication và Error Resilience
 */
export function fetchAndCacheDiscoveredModels(
  apiFetchFn: () => Promise<ModelInfoItem[]>,
  options?: { force?: boolean }
): Promise<RegisteredModelDef[]>;
```

---

## 2. React Hook Contract (`src/hooks/useModelDiscovery.ts`)

```typescript
import { RegisteredModelDef } from '../utils/modelRegistry';

export interface UseModelDiscoveryResult {
  /** Danh sách toàn bộ model sẵn sàng sử dụng (Presets + Discovered + Custom) */
  models: RegisteredModelDef[];
  /** Danh sách riêng các model được khám phá từ API */
  discoveredModels: RegisteredModelDef[];
  /** Đang tải lần đầu (chưa có bất kỳ cache nào) */
  isLoading: boolean;
  /** Đang làm mới chạy ngầm hoặc người dùng nhấn nút làm mới */
  isRefreshing: boolean;
  /** Cờ cho biết dữ liệu cache hiện tại đã cũ (> 1h TTL) */
  isStale: boolean;
  /** Thời điểm làm mới thành công gần nhất */
  lastRefreshedAt: Date | null;
  /** Thông điệp lỗi nếu lần làm mới gần nhất gặp sự cố */
  error: string | null;
  /** Hàm kích hoạt làm mới danh sách model */
  refresh: (force?: boolean) => Promise<RegisteredModelDef[]>;
}

export function useModelDiscovery(options?: {
  autoBackgroundRefresh?: boolean;
  sessionToken?: string | null;
}): UseModelDiscoveryResult;
```

---

## 3. Server Model Registry Cache Contract (`server/services/modelInfoService.ts`)

```typescript
export interface ServerModelCacheEntry {
  timestamp: number;
  models: ModelInfoItem[];
  keyHash: string;
}

/**
 * Truy vấn danh sách model từ Google Gemini API có cache 15 phút và deduplication in-flight
 */
export async function getOrFetchDiscoveredModels(apiKey: string): Promise<ModelInfoItem[]>;
```

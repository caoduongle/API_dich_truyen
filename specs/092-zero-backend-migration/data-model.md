# Data Model & State Specifications: Zero Backend Architecture

**Feature**: `092-zero-backend-migration`  
**Date**: 2026-09-05  
**Spec**: [spec.md](./spec.md)

---

## 1. Client-Side Quota Entities (`src/services/localQuotaTracker.ts`)

### 1.1 `CallLogEntry`
Lưu trữ thông tin chi tiết của một lần gọi API trong cửa sổ trượt 60 giây.
```typescript
export interface CallLogEntry {
  timestamp: number; // Mốc thời gian gọi (epoch ms)
  tokens: number;    // Số token tiêu thụ
}
```

### 1.2 `InternalModelStats`
Thống kê mức tiêu thụ theo từng model của một API Key cụ thể.
```typescript
export interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  tokensTotal: number;
  tokensToday: number;
  totalLatencyMs: number;
  recentCalls: CallLogEntry[];
  lastResetDay: string; // Định dạng YYYY-MM-DD theo giờ PST
}
```

### 1.3 `InternalKeyStats`
Thống kê mức tiêu thụ tổng thể của một API Key.
```typescript
export interface InternalKeyStats {
  keyHash: string;                  // SHA-256 hex string (64 ký tự)
  maskedKey: string;                // Ví dụ: "AIzaSy...opqr"
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  consecutiveErrors: number;
  tokensTotal: number;
  tokensToday: number;
  recentCalls: CallLogEntry[];
  byModel: Map<string, InternalModelStats>;
  lastResetDay: string;             // Định dạng YYYY-MM-DD theo giờ PST
}
```

### 1.4 `CircuitBreakerStatus` & `KeyHealthState`
Máy trạng thái sức khỏe của từng khóa API:
```typescript
export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';

export interface KeyRuntimeStatus {
  isBlacklisted: boolean;
  blacklistRemainingMs: number;
  isRateLimited: boolean;
  nextAllowedRemainingMs: number;
  healthState?: KeyHealthState;
  transitionReason?: string;
}
```

### 1.5 `KeyQuotaFullSnapshot`
Snapshot dữ liệu toàn diện phản chiếu lên giao diện QuotaPanel:
```typescript
export interface KeyQuotaFullSnapshot {
  keyHash: string;
  maskedKey: string;
  isAvailable: boolean;
  healthState: KeyHealthState;
  requestsToday: number;
  requestsThisMinute: number;
  tokensToday: number;
  tokensThisMinute: number;
  totalErrors: number;
  consecutiveErrors: number;
  cooldownRemainingMs: number;
  byModel: Record<string, ModelUsageStats>;
  runtime: KeyRuntimeStatus;
}
```

---

## 2. CRDT Document State (`src/services/crdtDocManager.ts`)

### 2.1 `CRDTRoomStatus`
Trạng thái kết nối phòng chương tài liệu (đã chuyển về local-only / offline):
```typescript
export type CRDTRoomStatus = 'connecting' | 'connected' | 'offline' | 'error';
```
- Giá trị mặc định khi mở chương: `'offline'`.
- Lưu trữ tài liệu: `y-indexeddb` với IndexedDB database mang tên room chương truyện.
- Đồng bộ đa thiết bị: Snapshot nhị phân được xuất và đồng bộ thông qua Google Drive API (`driveGranularSync.ts`).

---

## 3. Storage Hierarchy & Mapping

| Vùng dữ liệu | Cơ chế lưu trữ | Cơ chế đồng bộ | Vòng đời |
|:---|:---|:---|:---|
| **Dự án & Bản thảo** | IndexedDB (`db.ts`) | Google Drive (`driveBundleSync.ts`) | Vĩnh viễn (Client-owned) |
| **API Keys** | `sessionStorage` (hoặc IndexedDB mã hóa) | Client-side only | Session trình duyệt / Tự xóa khi logout |
| **Quota Metrics** | `localQuotaTracker` (In-memory) | Cập nhật theo từng request | Chu kỳ ngày PST (RPD) & Cửa sổ 60s (RPM/TPM) |
| **Model Catalog** | `localStorage` (`ai_discovered_models_v2`) | SWR Client Revalidation | 24 giờ |
| **Giao diện & Theme** | `localStorage` (`theme-preference`) | `theme-init.js` | Vĩnh viễn |

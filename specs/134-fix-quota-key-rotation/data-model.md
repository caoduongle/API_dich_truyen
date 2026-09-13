# Data Model: Sửa Cơ Chế Xoay Vòng API Key Khi Chạm Quota & Tránh Kẹt Khóa Lỗi

**Feature**: `134-fix-quota-key-rotation`  
**Date**: 2026-09-13  
**Status**: Completed  

---

## 1. Entities & Data Structures

### 1.1 `KeyHealthState` & Runtime Status
(Đã có trong [`src/types/quota.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/types/quota.ts), giữ nguyên không biến đổi schema)

```typescript
export type KeyHealthState =
  | 'Healthy'
  | 'Degraded'
  | 'RateLimited'
  | 'QuotaExhausted'
  | 'AuthFailed'
  | 'Cooldown'
  | 'Disabled';

export type CircuitBreakerStatus = 'Closed' | 'Open' | 'HalfOpen';

export interface KeyHealthResult {
  state: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  transitionReason?: string;
  isAvailable: boolean;
  isCustomLimitReached?: boolean;
}
```

### 1.2 `SingleChapterResult`
Kết quả sau khi biên dịch một chương qua tầng `chapterTranslationService.ts`.

```typescript
export interface SingleChapterResult {
  success: boolean;
  chapterId: string;
  isOverload?: boolean;
  newGlossaryItems: GlossaryItem[];
  newPendingItems: PendingGlossaryItem[];
  updatedChapter: Chapter | null;
  lastKeyIndex: number; // Chỉ số khóa API đã thực thi thành công chương này (0-indexed)
}
```

### 1.3 `AllKeysExhaustedError`
Ngoại lệ chuẩn hóa đại diện cho trường hợp toàn bộ khóa API đều cạn kiệt hoặc vi phạm ngưỡng cá nhân.

```typescript
export interface AllKeysExhaustedError extends Error {
  code: 'ALL_KEYS_EXHAUSTED';
  message: string;
}
```

---

## 2. State Transitions & Lifecycle

### 2.1 Key Pointer Lifecycle in `useTranslationProcess`

```
[Khởi động dịch hoặc Dịch lại lỗi]
             │
             ▼
  Tìm khóa khả dụng đầu tiên qua findNextAvailableKeyIndex()
  Gán vào currentApiKeyIndexRef.current (ví dụ: Key 0)
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│                    VÒNG LẶP CHƯƠNG                         │
│                                                            │
│  baseKeyIndex = currentApiKeyIndexRef.current              │
│  startKey = resolveOptimalKey(baseKeyIndex)                │
│                                                            │
│  Thực thi dịch chương...                                   │
│    ├── Trường hợp 1: Thành công với khóa K                 │
│    │     └─► lastSuccessKeyIndex = K                       │
│    │     └─► Con trỏ tiếp theo = (K + 1) % keyCount        │
│    │                                                       │
│    ├── Trường hợp 2: Thất bại với lỗi thường / 429 đơn lẻ  │
│    │     └─► Con trỏ tiếp theo = (baseKeyIndex + 1) % keyCount
│    │     └─► Bỏ qua chương lỗi và tiếp tục với khóa mới    │
│    │                                                       │
│    └── Trường hợp 3: Thất bại với ALL_KEYS_EXHAUSTED       │
│          └─► allKeysExhausted = true                       │
│          └─► Ghi log dừng khẩn cấp                         │
│          └─► BREAK vòng lặp ngay lập tức                   │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Key Health State Machine Transitions in `localQuotaTracker`

```
[Healthy] ─────────── (HTTP 429 Quota/Daily) ────────────► [QuotaExhausted] (Cooldown ~4h / 00:00 PST)
    ▲                                                             │
    │                                                             ▼
    │ ◄────────── (Sang ngày mới theo giờ PST) ───────────────────┘
    │
    ├──────────── (HTTP 429 RPM/TPM Rate Limit) ─────────► [RateLimited] (Cooldown 45s)
    │                                                             │
    │ ◄─── (2 request thành công liên tiếp) ─── [HalfOpen] ◄──────┘ (Hết 45s cooldown)
    │                                              │
    ├──────────── (HTTP 503 / 500 Overload) ───────┼─────► [Cooldown] (Cooldown 15s)
    │                                              │              │
    │ ◄────────────────────────────────────────────┴──────────────┘ (Hết 15s cooldown)
    │
    └──────────── (HTTP 401 / 403 Auth Error) ───────────► [AuthFailed] (Vô hiệu hóa vĩnh viễn)
```

---

## 3. Validation Rules

1. **Không bao giờ lặp lại khóa vừa kiệt sức**:
   - Nếu Khóa $K$ vừa trả về `QuotaExhausted`, `RateLimited`, hoặc lỗi, con trỏ cho chương kế tiếp MUST nhảy sang `(K + 1) % keyCount` và được lọc qua `findNextAvailableKeyIndex()`.
2. **Bảo toàn mã lỗi**:
   - Mọi ngoại lệ có thuộc tính `code === 'ALL_KEYS_EXHAUSTED'` đi qua `chapterTranslationService` MUST giữ nguyên `code === 'ALL_KEYS_EXHAUSTED'`.
3. **Phân biệt rạch ròi giữa Overload và AllKeysExhausted**:
   - `isOverload = true` chỉ áp dụng cho lỗi quá tải tạm thời của một chương riêng lẻ khi VẪN CÒN khóa khác khả dụng.
   - Khi không còn khóa nào khả dụng, trạng thái bắt buộc là `allKeysExhausted = true` và tiến trình phải dừng khẩn cấp.

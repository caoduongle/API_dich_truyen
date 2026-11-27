# Data Model: Feature 168 — RPM Cooldown Wait & Bulk Glossary Scan Recovery

**Feature**: `specs/168-rate-limit-cooldown-wait-recovery`  
**Date**: 2026-11-27  
**Schema Impact**: Không thay đổi `StoryProject` (`src/types.ts`) hoặc schema IndexedDB. Mọi cấu trúc dưới đây là runtime/service models.

---

## 1. Runtime Models

### 1.1 `PoolCooldownAnalysis` (`src/services/localQuotaTracker.ts`)

```ts
export interface PoolCooldownAnalysis {
  /** Index key khả dụng ngay lập tức, hoặc -1 nếu toàn bộ key đang bận/hết hạn */
  availableKeyIndex: number;
  /** Số ms ngắn nhất để ít nhất 1 key đang tạm nghỉ RPM/Overload hồi phục (> 0 nếu có) */
  minCooldownRemainingMs: number;
  /** Index của key sẽ hồi phục sớm nhất, hoặc -1 nếu không có */
  nextRecoveringKeyIndex: number;
  /** true khi toàn bộ key tạm ngừng chỉ do RPM/Cooldown ngắn hạn có thể tự hồi phục */
  hasRecoverableCooldown: boolean;
  /** true khi tất cả key đều ở trạng thái dài hạn (AuthFailed, QuotaExhausted PST, CustomLimit) */
  allPermanentlyExhausted: boolean;
}
```

### 1.2 Mở rộng `ClassifiedGeminiError` & `GeminiRequestError` (`src/services/gemini/types.ts`)

- `GeminiRequestError` bổ sung thuộc tính chỉ đọc tùy chọn:
  - `retryAfterMs?: number` — thời gian chờ hồi phục ngắn nhất (ms) khi lỗi thuộc nhóm tạm nghỉ RPM/Cooldown.
- Quy ước phân biệt lỗi toàn pool (`code === 'ALL_KEYS_EXHAUSTED'`):
  - **Tạm nghỉ có thể hồi phục**: `category: 'RATE_LIMIT_RPM'`, `isRetryable: true`, `retryAfterMs: minCooldownRemainingMs`.
  - **Hết hạn mức thực sự / dài hạn**: `category: 'QUOTA_EXHAUSTED_RPD'`, `isRetryable: false`, `retryAfterMs: undefined`.

### 1.3 `RATE_LIMIT_RECOVERY_CONFIG` (`src/config/constants.ts`)

```ts
export const RATE_LIMIT_RECOVERY_CONFIG = {
  /** Ngưỡng tối đa tự động chờ hồi phục RPM cho 1 lần tạm nghỉ (120 giây) */
  MAX_AUTO_WAIT_COOLDOWN_MS: 120_000,
  /** Số lần tự động chờ hồi phục RPM tối đa trên cùng một chương trước khi dừng */
  MAX_COOLDOWN_WAITS_PER_CHAPTER: 2,
  /** Khoảng đệm cộng thêm vào retryDelay do Google trả về để tránh chạm mép (1.5 giây) */
  RETRY_DELAY_SAFETY_BUFFER_MS: 1_500,
} as const;
```

---

## 2. State Transitions (`KeyHealthState` & `useGlossaryScan`)

1. **Key RPM Rate Limit (`429` có chỉ dấu phút hoặc `retryDelay <= 120s`)**:
   - `Healthy` / `Degraded` → `RateLimited` với `cooldownUntil = now + (recommendedCooldownMs || 45_000)`.
   - Khi hết `cooldownUntil` (`now >= cooldownUntil`): `RateLimited` → `Degraded` (`HalfOpen`), `isAvailable = true`.
   - Khi gọi lại thành công 2 lần liên tiếp: `HalfOpen` → `Healthy` (`Closed`).
2. **Key Daily Limit / Auth Failure**:
   - `QUOTA_EXHAUSTED_RPD` → `QuotaExhausted` với `cooldownUntil = getNextPstMidnight(now)` (`hasRecoverableCooldown = false`).
   - `AUTH_FAILURE` → `AuthFailed` với `cooldownUntil = MAX_SAFE_INTEGER`.
3. **Bulk Glossary Scan Loop**:
   - `Scanning(chapter[i])` + gặp `ALL_KEYS_EXHAUSTED` với `retryAfterMs <= 120_000` và `waits < 2` → `WaitingCooldown(waitMs)` (hủy tức thì nếu `AbortSignal`) → retry `Scanning(chapter[i])`.
   - `Scanning(chapter[i])` + gặp `ALL_KEYS_EXHAUSTED` không thể hồi phục (hoặc `waits >= 2`) → ghi `[i..end]` vào `failedIds` → `StoppedDueToQuota` (break cả vòng lặp chương và `extractionLoops`, giữ nguyên dữ liệu đã quét trước đó).

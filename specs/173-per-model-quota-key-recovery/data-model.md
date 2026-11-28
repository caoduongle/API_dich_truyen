# Data Model: Cô lập Hạn mức theo Mô hình, Khôi phục Trạng thái Khóa & Minh bạch Nguyên nhân Cạn Quota

**Feature**: `173-per-model-quota-key-recovery`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/spec.md)  
**Note**: Không thay đổi `src/types.ts` và schema IndexedDB (`src/services/db.ts`). Chỉ mở rộng cấu trúc theo dõi quota cục bộ (`src/types/quota.ts`, `LocalQuotaTracker` + `sessionStorage`) với tương thích ngược 100%.

---

## 1. Entities & Updated Fields

### 1.1 `InternalModelStats` (trong `src/services/localQuotaTracker.ts`)

Lưu thống kê và **trạng thái sức khỏe riêng cho từng cặp `(Key, NormalizedModelId)`**:

| Field | Type | Default / Legacy Migration | Description |
|-------|------|----------------------------|-------------|
| `requestsTotal` | `number` | `0` | Tổng lượt gọi từ trước tới nay của model trên key |
| `requestsToday` | `number` | `0` | Lượt gọi trong ngày PST hiện tại của model trên key |
| `errorsTotal` | `number` | `0` | Tổng lỗi của model |
| `errorsToday` | `number` | `0` | Lỗi trong ngày PST hiện tại của model |
| `tokensTotal` | `number` | `0` | Tổng token của model |
| `tokensToday` | `number` | `0` | Token ngày PST của model |
| `totalLatencyMs` | `number` | `0` | Tổng độ trễ phản hồi |
| `recentAttempts` | `CallAttemptEntry[]` | `[]` | Cửa sổ trượt 60s cho RPM |
| `recentTokens` | `CallTokenEntry[]` | `[]` | Cửa sổ trượt 60s cho TPM |
| `lastResetDay` | `string` | `currentDay` | Ngày PST (`YYYY-MM-DD`) gần nhất |
| `healthState` *(NEW)* | `KeyHealthState` | `'Healthy'` (nếu bản lưu cũ chưa có) | Trạng thái riêng của model trên key (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `Cooldown`) |
| `circuitBreakerStatus` *(NEW)* | `CircuitBreakerStatus` | `'Closed'` | Trạng thái CB riêng của model (`Closed`, `Open`, `HalfOpen`) |
| `cooldownUntil` *(NEW)* | `number` | `0` | Mốc epoch (ms) hết tạm dừng / mở lại ngày của model |
| `transitionReason` *(NEW)* | `string \| undefined` | `undefined` | Lý do chuyển trạng thái gần nhất của model |
| `lastTransitionAt` *(NEW)* | `number` | `now` | Mốc thời gian chuyển trạng thái gần nhất |
| `consecutiveErrors` *(NEW)* | `number` | `0` | Số lỗi liên tiếp của model |
| `consecutiveSuccesses` *(NEW)* | `number` | `0` | Số thành công liên tiếp (phục vụ phục hồi `HalfOpen -> Closed`) |
| `consecutiveAmbiguous429` *(NEW)* | `number` | `0` | Đếm lỗi `429` mơ hồ liên tiếp trên model |
| `isLowUsageDailyExhaustion` *(NEW)* | `boolean` | `false` | `true` khi model nhận lỗi cạn ngày tường minh lúc lượt đếm ngày `< 25%` ngưỡng tham chiếu |

---

### 1.2 `InternalKeyStats` (trong `src/services/localQuotaTracker.ts`)

Giữ nguyên toàn bộ trường thống kê tổng hợp trên key để không phá vỡ snapshot cũ, trong đó:
- `AuthFailed` (`401/403`) tiếp tục lưu ở cấp `InternalKeyStats.healthState = 'AuthFailed'` để chặn key sai trên **mọi model**.
- Khi một request có truyền `model`: mọi cập nhật RPM/RPD cooldown (`RateLimited`, `Cooldown`, `QuotaExhausted`, `Degraded`, `HalfOpen`) chỉ ghi vào `byModel.get(normalizedModel)` tương ứng, không làm bẩn trạng thái của các model khác trên cùng key.
- Khi gọi API ở chế độ tương thích ngược **không** truyền `model`, `getKeyHealth` vẫn kiểm tra trạng thái cấp `InternalKeyStats`.

---

### 1.3 `ModelUsageStats` (trong `src/types/quota.ts`)

Mở rộng bằng các trường tùy chọn để UI thẻ khóa hiển thị badge trạng thái từng model trong accordion `byModel`:

| Field | Type | Description |
|-------|------|-------------|
| `requestsTotal`..`tokensThisMinute` | *(giữ nguyên)* | Số liệu thống kê hiện hành |
| `healthState?` | `KeyHealthState` | Trạng thái hiện tại của riêng model này |
| `circuitBreakerState?` | `string` | Trạng thái Circuit Breaker của model |
| `cooldownRemainingMs?` | `number` | Thời gian chờ còn lại (ms) của riêng model |
| `transitionReason?` | `string` | Lý do trạng thái/khóa chi tiết của model |
| `isLowUsageDailyExhaustion?` | `boolean` | Cờ nhận lỗi cạn ngày tường minh khi lượt cục bộ `< 25%` |

---

### 1.4 `KeyRuntimeStatus` & `KeyQuotaFullSnapshot` (trong `src/types/quota.ts`)

Khi `getQuotaStatus(keys, now, customLimits, selectedModel)` được gọi với `selectedModel`:
- `runtime`, `healthState`, `transitionReason`, `isCustomLimitReached`, `cooldownRemainingMs` trên thẻ `KeyQuotaFullSnapshot` phản ánh **trực tiếp sức khỏe của `(Key, selectedModel)`** (hoặc `AuthFailed` nếu khóa sai toàn cục).
- Bổ sung tùy chọn `isLowUsageDailyExhaustion?: boolean` trên `KeyRuntimeStatus` để UI hiển thị cảnh báo phân biệt rõ ràng theo `SC-003`.

---

### 1.5 `ModelReferenceLimits` (trong `src/utils/modelRegistry.ts`)

Ánh xạ ngưỡng tham chiếu chuẩn (`CustomLimit`) theo dòng model:
- `*flash-lite*` (vd: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`): `{ maxRpm: 15, maxTpm: 250_000, maxRpd: 500 }`
- `*2.5-flash*` / `*flash*` (khác lite): `{ maxRpm: 15, maxTpm: 250_000, maxRpd: 500 }`
- `*pro*`: `{ maxRpm: 10, maxTpm: 250_000, maxRpd: 100 }`
- Fallback theo `modelDefinition.limits` hoặc `DEFAULT_CUSTOM_LIMIT`.

---

## 2. State Transitions (`LocalQuotaTracker`)

| Current State (`Key, Model`) | Trigger Event | Guard Condition | Next State (`Key, Model`) | Cooldown (`cooldownUntil`) |
|-------------------------------|---------------|-----------------|----------------------------|----------------------------|
| Any (except `AuthFailed`) | `recordFailure(401/403)` | — | Key-level `AuthFailed` (`Open`) | `Number.MAX_SAFE_INTEGER` |
| `Healthy` / `Degraded` | `recordFailure` (`RATE_LIMIT_RPM`) | — | `RateLimited` (`Open`) | `now + (dynamicCooldownMs ?? 45_000)` |
| `Healthy` / `Degraded` / `RateLimited` | `recordFailure` (`MessageFallback_AmbiguousQuota`) | `requestsToday < dailyRef` | `RateLimited` (`Open`) — **KHÔNG leo thang `QuotaExhausted`** | 1st: `50s` (hoặc provider retryDelay); 2nd: `>= 60s`; 3rd+: `min(120s, max(..., 120s))` |
| `Healthy` / `Degraded` / `RateLimited` | `recordFailure` (`MessageFallback_AmbiguousQuota`) | `requestsToday >= dailyRef` | `QuotaExhausted` (`Open`) | `getNextPstMidnight(now)` |
| `Healthy` / `Degraded` / `RateLimited` | `recordFailure` (`QUOTA_EXHAUSTED_RPD`) | `60s < dynamicCooldownMs <= 48h` | `QuotaExhausted` (`Open`); gắn cờ `isLowUsageDailyExhaustion` nếu `requestsToday < 0.25 * dailyRef` | `now + dynamicCooldownMs` |
| `Healthy` / `Degraded` / `RateLimited` | `recordFailure` (`QUOTA_EXHAUSTED_RPD`) | Không có retryDelay dài hợp lệ | `QuotaExhausted` (`Open`); gắn cờ `isLowUsageDailyExhaustion` nếu `< 0.25 * dailyRef` | `getNextPstMidnight(now)` |
| `RateLimited` / `Cooldown` | `getKeyHealth(..., model)` | `now >= cooldownUntil` | `Degraded` (`HalfOpen`) | `0` |
| `Degraded` (`HalfOpen`) | `recordSuccess` | `consecutiveSuccesses >= 2` | `Healthy` (`Closed`), `consecutiveAmbiguous429 = 0` | `0` |
| `QuotaExhausted` / `RateLimited` / `Degraded` | `unlockKey(key, model)` | Không chạm custom `maxRpd` | `Healthy` (`Closed`), giữ nguyên `requestsToday` | `0` |
| `QuotaExhausted` (custom `maxRpd`) | `unlockKey` (mặc định) | `requestsToday >= customLimit.maxRpd` | Vẫn báo không khả dụng do chạm ngưỡng tự đặt (`FR-005`), trừ khi người dùng tăng `maxRpd` hoặc xác nhận reset | `0` |
| `QuotaExhausted` / bất kỳ | Sang ngày PST mới (`lastResetDay !== currentDay`) | `stats.healthState !== 'AuthFailed'` | `Healthy` (`Closed`), reset `requestsToday = 0`, `consecutiveAmbiguous429 = 0` | `0` |

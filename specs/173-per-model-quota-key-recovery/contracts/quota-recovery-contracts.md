# Interface Contracts: Feature 173 Quota Isolation, Recovery & RPD Guard

**Feature**: `173-per-model-quota-key-recovery`  
**Date**: 2026-11-28

---

## 1. Service Contracts

### 1.1 `LocalQuotaTracker` (`src/services/localQuotaTracker.ts`)

```ts
export interface KeyHealthOptions {
  enforceProactiveLimits?: boolean;
  model?: string; // Khi truyền model, kiểm tra sức khỏe và cửa sổ theo (Key, normalizedModel)
}

export interface KeyHealthResult {
  state: KeyHealthState;
  circuitBreaker: CircuitBreakerStatus;
  cooldownRemainingMs: number;
  transitionReason?: string;
  isAvailable: boolean;
  isCustomLimitReached?: boolean;
  isProactivePacing?: boolean;
  isLowUsageDailyExhaustion?: boolean;
}

export interface UnlockKeyResult {
  unlocked: boolean;
  blockedByCustomLimit?: boolean;
  remainingCustomCooldownReason?: string;
}
```

- `getKeyHealth(key, now = Date.now(), customLimit?, options?): KeyHealthResult`
  - Nếu `stats.healthState === 'AuthFailed'`, trả `AuthFailed` cho mọi model.
  - Nếu `options?.model` được cung cấp: đọc `InternalModelStats` cho model đó; kiểm tra `mStats.requestsToday >= customLimit.maxRpd`, trạng thái khóa của model, hết hạn `cooldownUntil` của model (`-> HalfOpen/Degraded`), và cửa sổ RPM/TPM của model (hoặc key).
  - Nếu `options?.model` bỏ trống: giữ nguyên hành vi cấp `InternalKeyStats` để bảo đảm tương thích ngược.
- `findNextAvailableKeyIndex(keys, startIndex = 0, customLimits?, now = Date.now(), options?): number`
  - Truyền nguyên `options` (gồm `options.model`) vào `getKeyHealth`.
- `getPoolCooldownAnalysis(keys, customLimits?, now = Date.now(), options?): PoolCooldownAnalysis`
  - Đánh giá khả năng hồi phục trên từng khóa cho `options?.model`.
- `getQuotaStatus(keys, now = Date.now(), customLimits?, selectedModel?: string): QuotaStatusResponse`
  - Khi có `selectedModel`: `snapshot.runtime`, `snapshot.healthState`, `snapshot.cooldownRemainingMs`, `snapshot.transitionReason` phản ánh đúng trạng thái của `(Key, selectedModel)`, đồng thời `byModel[mName]` luôn chứa `healthState`, `cooldownRemainingMs`, `transitionReason`, `isLowUsageDailyExhaustion`.
- `unlockKey(key: string, model?: string, options?: { customLimit?: CustomLimit; now?: number }): UnlockKeyResult`
  - Mở khóa trạng thái lỗi (`QuotaExhausted`, `RateLimited`, `Cooldown`, `Degraded`) của cặp `(key, model)` (hoặc toàn bộ model của key nếu `model` rỗng) và gọi `flushToStorage`.
  - Bảo toàn `requestsToday`; nếu `effectiveRequestsToday >= customLimit.maxRpd`, trả `{ unlocked: true, blockedByCustomLimit: true }` để UI nhắc người dùng điều chỉnh `Ngưỡng cá nhân` (`FR-005`).
- `unlockAllKeys(keys: string[], model?: string, customLimits?: Record<string, CustomLimit>, now?: number): { unlockedCount: number; customBlockedCount: number }`
  - Mở khóa hàng loạt toàn bộ key trong danh sách và flush storage một lần.

---

### 1.2 `geminiErrorClassifier` (`src/services/gemini/geminiErrorClassifier.ts`)

- `extractRetryDelayMs(message, details?, retryAfterHeader?): number | undefined`
  - Hỗ trợ đầy đủ thời lượng ghép có giờ (`12h5m53.421929668s`, `2h30m`, `1h5s`, `5m20s`, `36.5s`, `500ms`).
  - Với delay dài từ `> 60s`, giữ chính xác mili-giây (+ safety buffer `1_500ms`) và trả về trên `ClassifiedGeminiError.recommendedCooldownMs` kể cả khi `category === 'QUOTA_EXHAUSTED_RPD'`.
- Giữ nguyên phân tách:
  - Chỉ trả `QUOTA_EXHAUSTED_RPD` khi có tín hiệu ngày tường minh (`day`, `daily`, `per day`, `requestsperday`, `rpd`) trong `details`, `ErrorInfo`, hoặc `message`.
  - Lỗi `429` có `quota`/`exhausted` nhưng không có tín hiệu ngày trả `RATE_LIMIT_RPM` với `reason: 'MessageFallback_AmbiguousQuota'`.

---

### 1.3 `geminiKeyScheduler.ts` & `geminiClient.ts`

- `initKeySchedule`, `isKeyAvailable`, `findNextKey`, `inspectKeyPoolCooldown`, `buildAllKeysUnavailableError` chấp nhận `options?: KeyHealthOptions` đã chứa `model`.
- `executeLogicalGeminiCallAttempt` và các nhánh recovery trong `executeLogicalGeminiCallWithRecovery` (`src/services/gemini/geminiClient.ts`) truyền `model: modelName` vào `keyHealthOptions` để mọi bước kiểm tra trước gọi, xoay key khi lỗi, và phân tích cooldown pool đều cô lập theo đúng model đang dịch.

---

### 1.4 `modelRegistry` (`src/utils/modelRegistry.ts`)

```ts
export function getModelReferenceLimits(modelId?: string): CustomLimit;
```

- Trả về bộ ngưỡng chuẩn sát thực tế cho `modelId` (ví dụ `gemini-3.5-flash-lite` -> `{ maxRpm: 15, maxTpm: 250_000, maxRpd: 500 }`).
- `computeModelStatsSummary(selectedModelId, snapshotKeys, inspectResults, totalKeysCount)` bổ sung đánh giá khóa khả dụng tại runtime (`runtimeAvailableKeyCount`, `runtimeBlockedKeyCount`) từ `snapshotKeys` (trạng thái `runtime.healthState` và `runtime.isBlacklisted` của model đang chọn) bên cạnh `inspectResults`.

---

## 2. Controller & View Contracts

### 2.1 `useModelObservability` (`src/hooks/useModelObservability.ts`)

```ts
export function useModelObservability(
  apiKeys: string[],
  onModelsDiscovered?: (models: ModelInfoItem[]) => void,
  options?: { enabled?: boolean; selectedModel?: string }
): ModelObservabilityState
```

Mở rộng `ModelObservabilityState`:
- `unlockKey: (keyIndex: number, modelId?: string) => UnlockKeyResult`
- `unlockAllKeys: (modelId?: string) => { unlockedCount: number; customBlockedCount: number }`
- Tự động gọi `loadQuotaStatus(true)` khi `selectedModel` thay đổi hoặc ngay sau khi gọi `unlockKey`/`unlockAllKeys`, và phát cảnh báo nếu vẫn bị chặn do ngưỡng cá nhân `maxRpd` (`FR-005`).

---

### 2.2 `QuotaPanel.tsx`, `KeyCardItem.tsx`, `CustomLimitsPanel.tsx`

- **Props mở rộng**:
  - `QuotaPanel` truyền `selectedModel` xuống `useModelObservability` (hoặc nhận `unlockKey`/`unlockAllKeys` từ `observability` của `ApiSettings.tsx`).
  - `KeyCardItemProps` nhận thêm `onUnlockKey?: (idx: number) => void`.
  - `CustomLimitsPanelProps` nhận `selectedModel?: string` để dùng `getModelReferenceLimits(selectedModel)` làm giá trị hiển thị mặc định khi người dùng chưa tùy chỉnh.
- **UI & Design System ("Mực & Chu Sa")**:
  - Header Bảng điều khiển Quota hiển thị nút `Button` (`variant="outline"`, `size="sm"`) **"Mở khóa tất cả"** khi có `>= 1` khóa không ở trạng thái `Healthy` trên `selectedModel`.
  - Trên mỗi `KeyCardItem`:
    - Khi `healthState` thuộc `{ 'QuotaExhausted', 'RateLimited', 'Cooldown', 'Degraded' }`: hiển thị nút **"Mở khóa"** (`Unlock` icon từ `lucide-react`) và dải thông báo lý do khóa tường minh (`bg-amber-950/30 border-amber-800/60 text-amber-300 rounded-[2px]`): phân biệt giữa **chạm giới hạn tự đặt**, **cạn ngày tường minh từ Google kèm đếm ngược**, **lưu ý kiểm tra nguồn dùng ngoài/dự án chung khi `< 25%` ngưỡng ngày**, hoặc **tạm nghỉ tốc độ RPM**.
    - Trong accordion `byModel`: hiển thị badge nhỏ trạng thái sức khỏe riêng cho từng model (ví dụ `Hết ngày` / `Tạm nghỉ` / `Hoạt động`).
  - Banner tổng quan trên `QuotaPanel` hiển thị rõ số khóa khả dụng thực tế trên `selectedModel` (`X / N key khả dụng`), cảnh báo rõ khi `0 / N` kèm gợi ý chuyển model khác hoặc mở khóa nếu vừa đổi key/nâng cấp billing.
- **Security Guarantee (`SC-006`)**: Không hiển thị hay ghi log raw API key; chỉ dùng `Khóa #N` và `formatClientMaskedKey`.

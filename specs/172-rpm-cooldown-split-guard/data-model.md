# Data Model: Bảo vệ Hạn mức RPM, Chặn Bão Chia Nhỏ & Đánh giá Chính xác Trạng thái Phục hồi

**Feature**: `172-rpm-cooldown-split-guard` | **Date**: 2026-11-28

> **Bất biến Storage Schema (Constitution Principle IV)**: Không sửa đổi bất kỳ interface nào trong `src/types.ts` và không nâng phiên bản hoặc thay đổi schema IndexedDB trong `src/services/db.ts`. Toàn bộ thực thể dưới đây là mô hình trạng thái trong bộ nhớ (runtime) và mở rộng tương thích ngược trong `src/types/quota.ts` / `src/services/`.

## 1. Key Health & Proactive Pacing (`src/types/quota.ts`, `src/services/localQuotaTracker.ts`)

### `KeyHealthResult` (mở rộng tương thích ngược)

| Trường | Kiểu | Mô tả & Quy tắc mới |
|---|---|---|
| `state` | `KeyHealthState` | Giữ nguyên `'Healthy'` khi chỉ bị chặn bởi `Proactive Pacing` (tuyệt đối không gán `'RateLimited'` để tránh báo đỏ giả trên UI); giữ tập giá trị cũ (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`) |
| `circuitBreaker` | `CircuitBreakerStatus` | `Closed` \| `Open` \| `HalfOpen` |
| `cooldownRemainingMs` | `number` | Nếu bị chặn bởi cooldown lỗi thực tế **hoặc** bởi cửa sổ trượt 60s chủ động (`Proactive Pacing`), chứa số mili-giây còn lại để khóa này sẵn sàng |
| `isAvailable` | `boolean` | `false` nếu chạm `maxRpd`, đang `Open` cooldown lỗi, hoặc (khi kích hoạt cổng chủ động) đã chạm `maxRpm`/`maxTpm` trong cửa sổ trượt 60s gần nhất; **không** chặn cứng `MIN_REQUEST_INTERVAL` trong `getKeyHealth()` |
| `isProactivePacing` *(mới, optional)* | `boolean` | `true` khi khóa thực chất vẫn khỏe (chưa dính lỗi 429/503 hay Auth/RPD), chỉ đang tạm nhường/chờ cửa sổ trượt 60s mở lại theo `maxRpm`/`maxTpm` |
| `isCustomLimitReached` *(hiện có)* | `boolean` | `true` khi chạm ngưỡng `maxRpd` do người dùng cài đặt |

### `InternalKeyStats` (mở rộng runtime trong `localQuotaTracker.ts`)

| Trường bổ sung | Kiểu | Mô tả |
|---|---|---|
| `consecutiveAmbiguous429` | `number` | Số lần liên tiếp khóa này gặp lỗi `429` mơ hồ (`MessageFallback_AmbiguousQuota`) mà chưa có `recordSuccess()` xen giữa. Reset về `0` mỗi khi `recordSuccess()` chạy hoặc qua ngày PST mới. Khi `>= 2`, nâng lên `QuotaExhausted` |

### `PoolCooldownAnalysis` (mở rộng tương thích ngược)

| Trường bổ sung | Kiểu | Mô tả |
|---|---|---|
| `availableKeyIndex` | `number` | Index khóa khả dụng tốt nhất ngay lúc kiểm tra (ưu tiên khóa rảnh có `lastRequestTimestamp` nhỏ nhất / nguội nhất), hoặc `-1` nếu tất cả đang bận/chờ |
| `hasRecoverableCooldown` | `boolean` | `true` nếu có khóa sẽ mở lại trong `<= MAX_AUTO_WAIT_COOLDOWN_MS` (cả cooldown lỗi lẫn pacing chủ động) |
| `isProactivePacingOnly` *(mới, optional)* | `boolean` | `true` khi **không** cần chờ lỗi 429/503 từ nhà cung cấp, mọi khóa bận đều là do tự hãm `RPM`/`TPM` chủ động và sẽ mở lại tự nhiên trong cửa sổ 60s |
| `minCooldownRemainingMs` | `number` | Thời gian chờ ngắn nhất (ms) tới thời điểm một khóa trong pool sẵn sàng trở lại |
| `allPermanentlyExhausted` | `boolean` | Chỉ `true` khi toàn bộ khóa đều `AuthFailed`, `QuotaExhausted` thật sự, `isCustomLimitReached` (`maxRpd`), hoặc có cooldown vượt `MAX_AUTO_WAIT_COOLDOWN_MS` |

---

## 2. State Machine Chuyển Trạng Thái Khóa API

```text
  [Healthy]
     │
     ├─(Pre-flight: RPM/TPM 60s >= limit)──► Tạm ẩn qua Proactive Pacing (isProactivePacing=true)
     │                                       └─► Tự mở lại khi entry cũ nhất rời cửa sổ 60s (0 lỗi, unlimited wait)
     │
     ├─(429 explicit per-minute / 1st ambiguous 429 while today << maxRpd)
     │                                       ──► [RateLimited] (cooldown 45–60s hoặc retryDelay)
     │
     ├─(503 SERVICE_OVERLOAD)                ──► [Cooldown] (cooldown 5–15s, tăng nhẹ theo retry)
     │
     ├─(429 explicit RPD / maxRpd reached / 2nd consecutive ambiguous 429)
     │                                       ──► [QuotaExhausted] (tới 00:00 PST)
     │
     ▼
  [RateLimited / Cooldown] ──(hết cooldownUntil)──► [HalfOpen / Degraded]
                                                      ├─(recordSuccess)──► [Healthy] (reset consecutiveAmbiguous429=0)
                                                      └─(429 ambiguous lần 2)──► [QuotaExhausted]
```

---

## 3. Phân Loại Kết Quả Dịch & Nhãn Chẩn Đoán (`translationValidation.ts`)

### `ClassifiedTranslationOutcome`

| Nguồn lỗi | `type` | `isRetryable` | `canSplitRetry` | Nhãn chẩn đoán chuẩn |
|---|---|---|---|---|
| `RATE_LIMIT_RPM` | `RETRYABLE` | `true` | **`false`** | Chạm hạn mức tốc độ 429 RPM |
| `SERVICE_OVERLOAD` | `RETRYABLE` | `true` | **`false`** | Máy chủ AI quá tải tạm thời (503) |
| `NETWORK_FAILURE` | `RETRYABLE` | `true` | **`false`** | Lỗi kết nối / quá hạn thời gian mạng |
| `QUOTA_EXHAUSTED_RPD` / `AUTH_FAILURE` | `TERMINAL` | `false` | **`false`** | Cạn hạn mức ngày / Lỗi xác thực |
| `CONTENT_BLOCKED` | `TERMINAL` | `false` | `true` | Vi phạm bộ lọc an toàn |
| `UNTRANSLATED_CHINESE_LEFTOVER` | `RETRYABLE` | `true` | `true` | Bản dịch sót nhiều chữ Hán |
| `PARAGRAPH_STRUCTURE_DIVERGENCE` | `RETRYABLE` | `true` | `true` | Lệch cấu trúc đoạn 1-1 |
| `POLISH_TRUNCATION_DETECTED` | `RETRYABLE` | `true` | `true` | Bản chuốt văn bị cắt cụt |
| Empty string / `EMPTY_RESPONSE` | `RETRYABLE` | `true` | `true` | Phản hồi rỗng |

---

## 4. Đánh Giá Toàn Vẹn Bản Dịch Cuối (`FinalFallbackEvaluation`)

Đánh giá sau cùng tại cuối `translateSingleChapter()` (`chapterTranslationService.ts`) trên văn bản cuối `finalText = cleanPolished || cleanRaw`:

- **Đầu vào**:
  - `hadRawOrPolishPartialFlag`: `Boolean(rawHasPartialFallback || lastPolishIsPartial)`
  - `finalText`: Văn bản cuối cùng chuẩn bị lưu xuống DB
  - `sourceText`: Văn bản gốc tiếng Trung
  - `qaRunSucceeded`: `boolean`
  - `unresolvedCriticals`: Danh sách lỗi `critical` còn lại sau GĐ3 + Sửa đoạn QA
- **Quy tắc suy diễn `finalHasPartialFallback`**:
  1. Nếu `!hadRawOrPolishPartialFlag` → `false`.
  2. Nếu `finalText` rỗng hoặc chưa qua GĐ2 (`!cleanPolished`) và GĐ1 đã đánh dấu `rawHasPartialFallback` → `true`.
  3. Chạy kiểm tra tất định sạch trên `finalText` (không bỏ qua kiểm tra như khi truyền cờ `isPartialFallback: true`):
     - Nếu `finalText` còn ký tự Hán sót nghiêm trọng (`raw_leak`) hoặc còn câu lỗi `raw_leak` / `omission` trong `unresolvedCriticals` → **`true`**.
     - Ngược lại, nếu GĐ2 đã chuốt ra bản sạch chữ Hán (`raw_leak === 0`), cấu trúc đoạn khớp hợp lệ và (`!qaRunSucceeded` nhưng bản cuối sạch hoặc `qaRunSucceeded && unresolvedCriticals` không có `raw_leak`/`omission`) → **`false`** (xóa bỏ cảnh báo giả).

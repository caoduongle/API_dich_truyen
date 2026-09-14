# Data Model & State Transitions: Ổn Định Hóa Pipeline Dịch Thuật (137-pipeline-stabilization-refactor)

**Date**: 2026-09-14  
**Status**: Completed  
**Spec**: [spec.md](./spec.md)

---

## 1. Mô Hình Thực Thể Quota Tracker (Local Quota Entities)

### 1.1 `InternalKeyStats` (Mở Rộng Quản Lý Lưu Lượng & Sức Khỏe Khóa)

```ts
export type KeyHealthState =
  | 'Healthy'          // Khóa hoạt động bình thường
  | 'Degraded'         // Gặp lỗi liên tiếp hoặc đang thử nghiệm phục hồi
  | 'RateLimited'      // Chạm ngưỡng tốc độ tức thời (RPM/TPM)
  | 'QuotaExhausted'   // Hết hạn ngạch ngày (RPD) - chờ đến 00:00 PST
  | 'Cooldown'         // Máy chủ quá tải tạm thời (503)
  | 'AuthFailed';      // Sai khóa hoặc bị từ chối xác thực (401/403)

export interface CallAttemptEntry {
  timestamp: number;
}

export interface CallTokenEntry {
  timestamp: number;
  tokens: number;
}

export interface InternalKeyStats {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  consecutiveErrors: number;
  tokensTotal: number;
  tokensToday: number;
  // Hai cửa sổ trượt 60 giây phân lập
  recentAttempts: CallAttemptEntry[];
  recentTokens: CallTokenEntry[];
  byModel: Map<string, InternalModelStats>;
  lastResetDay: string;            // Định dạng YYYY-MM-DD theo giờ Los Angeles
  lastRequestTimestamp?: number;
  healthState: KeyHealthState;
  transitionReason?: string;
  lastTransitionAt: number;
  consecutiveSuccesses: number;
  circuitBreakerStatus: 'Closed' | 'Open' | 'HalfOpen';
  cooldownUntil: number;           // Epoch millisecond kết thúc làm nguội
}

export interface InternalModelStats {
  requestsTotal: number;
  requestsToday: number;
  errorsTotal: number;
  errorsToday: number;
  tokensTotal: number;
  tokensToday: number;
  totalLatencyMs: number;
  recentAttempts: CallAttemptEntry[];
  recentTokens: CallTokenEntry[];
  lastResetDay: string;
}
```

### 1.2 Máy Trạng Thái Sức Khỏe Khóa (Key Health State Machine)

```text
               ┌────────────────────────────────────────────────────────┐
               │                                                        │
               ▼                                                        │ Success >= 2
       [ Healthy ] ──(429 RPM/TPM)──> [ RateLimited ] (45s)             │ (HalfOpen -> Closed)
         │   ▲                              │                           │
         │   │ (Success)                    │ (Cooldown expires)        │
         │   │                              ▼                           │
         │   └── [ Degraded ] <──────── [ HalfOpen ] ───────────────────┘
         │          ▲                       ▲
         │          │ (Cooldown expires)    │ (00:00 PST resets day)
         │          ├───────────────────────┴───────────────────────────┐
         │          │                                                   │
         ├─(503)──> [ Cooldown ] (15s)                                  │
         │                                                              │
         ├─(429 RPD Exhausted)──────────────────────────────> [ QuotaExhausted ]
         │                                                                (Until next 00:00 PST)
         └─(401/403)────────────────────────────────────────> [ AuthFailed ]
                                                                  (cooldownUntil = MAX_SAFE_INTEGER)
```

---

## 2. Mô Hình Phân Đoạn Song Ngữ Đồng Bộ (Bilingual Chunking Model)

### 2.1 `TranslationChunk`

Đại diện cho một cặp khối văn bản nguồn (Trung) và văn bản thô (Việt) được cắt ghép chuẩn xác theo ranh giới đoạn văn.

```ts
export interface TranslationChunk {
  chunkIndex: number;
  totalChunks: number;
  sourceText: string;
  rawText: string;
  sourceParagraphRange: {
    start: number; // 0-indexed
    end: number;
  };
  rawParagraphRange: {
    start: number;
    end: number;
  };
  estimatedTokens: number;
}
```

### 2.2 Quy Tắc Ánh Xạ Phân Đoạn

1. **Parity Mapping**: Nếu `sourceParagraphs.length === rawParagraphs.length`:
   - Phân đoạn thứ $k$: `sourceParagraphs[start..end]` tương ứng chính xác với `rawParagraphs[start..end]`.
2. **Proportional Mapping**: Nếu số lượng đoạn lệch nhau:
   - Tính hệ số tỷ lệ: $R = \frac{N_{\text{raw}}}{N_{\text{source}}}$.
   - Đoạn nguồn thứ $i$ ánh xạ với đoạn thô $\text{round}(i \times R)$.
   - Đảm bảo $100\%$ không có đoạn văn nào bị bỏ sót hoặc bị nhân đôi giữa các khối liên kề.

---

## 3. Mô Hình Kết Quả Lưu Trữ An Toàn (Storage Result Model)

### 3.1 `StorageResult<T>`

Giải quyết dứt điểm vấn đề nuốt lỗi trong tầng lưu trữ IndexedDB (`src/services/db.ts`):

```ts
export type StorageErrorCode =
  | 'NOT_FOUND'
  | 'STORAGE_BLOCKED'
  | 'QUOTA_EXCEEDED'
  | 'VERSION_ERROR'
  | 'TRANSACTION_ABORTED'
  | 'CORRUPTED_DATA'
  | 'UNKNOWN_ERROR';

export interface StorageError {
  code: StorageErrorCode;
  message: string;
  cause?: unknown;
}

export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: StorageError };
```

---

## 4. Mô Hình Phân Loại Lỗi Kỹ Thuật (Error Classification Model)

### 4.1 `ClassifiedGeminiError`

```ts
export type ClassifiedErrorCategory =
  | 'RATE_LIMIT_RPM'       // Giới hạn tần suất 15 RPM
  | 'QUOTA_EXHAUSTED_RPD'  // Hết hạn mức 1,500 RPD trong ngày
  | 'AUTH_FAILURE'         // Khóa không hợp lệ, không có quyền
  | 'SERVICE_OVERLOAD'     // 503 / 500 Gemini backend quá tải
  | 'CONTENT_BLOCKED'      // Bộ lọc an toàn (Safety Filter)
  | 'NETWORK_FAILURE'      // Mất mạng, timeout, chặn CORS/CSP
  | 'UNRECOGNIZED';

export interface ClassifiedGeminiError {
  category: ClassifiedErrorCategory;
  httpStatus: number;
  rpcStatus?: string;
  reason?: string;
  details?: unknown[];
  recommendedCooldownMs: number;
  isRetryable: boolean;
  message: string;
}
```

# Data Model & State Specifications: Khắc Phục Kiểm Toán & Gia Cố Tính Nhất Quán (138-audit-remediation-hardening)

## 1. SerializableKeyStats (SessionStorage Schema)

Lưu trữ trạng thái sức khỏe, hạn ngạch và ngắt mạch của từng khóa API trong `sessionStorage` để bảo toàn khi reload trang.

```typescript
export interface SerializableKeyStats {
  keyHash: string;                  // SHA-256 hex digest (64 ký tự)
  maskedKey: string;                // Khóa đã được che (vd: AIzaSy...1234)
  requestsTotal: number;            // Tổng số yêu cầu gửi tới nhà cung cấp
  requestsToday: number;            // Số yêu cầu trong ngày hiện tại (PST)
  errorsTotal: number;              // Tổng số lỗi phát sinh (đếm chính xác 1x)
  consecutiveErrors: number;        // Số lỗi liên tiếp
  consecutiveSuccesses: number;     // Số lần thành công liên tiếp
  tokensTotal: number;              // Tổng số token tích lũy
  tokensToday: number;              // Số token trong ngày hiện tại (PST)
  lastResetDay: string;             // Ngày đặt lại gần nhất theo định dạng YYYY-MM-DD (PST)
  healthState: KeyHealthState;      // 'Healthy' | 'Degraded' | 'RateLimited' | 'Cooldown' | 'QuotaExhausted' | 'AuthFailed'
  circuitBreakerStatus: CircuitBreakerStatus; // 'Closed' | 'Open' | 'HalfOpen'
  cooldownUntil: number;            // Timestamp hết hạn cooldown (0 nếu không có)
  transitionReason?: string;        // Lý do chuyển trạng thái gần nhất
  lastTransitionAt: number;         // Timestamp chuyển trạng thái gần nhất
  byModel: Record<string, {
    requestsTotal: number;
    requestsToday: number;
    errorsTotal: number;
    errorsToday: number;
    tokensTotal: number;
    tokensToday: number;
    totalLatencyMs: number;
    lastResetDay: string;
  }>;
}

export interface SerializableQuotaStorageSnapshot {
  summaryStats: LogicalSummaryStats;
  keyStats: SerializableKeyStats[];
  savedAt: number;
}
```

### Quy tắc chuyển trạng thái khi Rehydrate (Tải lại trang)
```text
Item từ Storage
      │
      ├── lastResetDay != currentDay (Sang ngày mới theo giờ PST)
      │     ├── requestsToday = 0, errorsToday = 0, tokensToday = 0
      │     ├── QuotaExhausted ──► Healthy (circuitBreakerStatus: Closed, cooldownUntil: 0)
      │     └── Các model: reset bộ đếm ngày
      │
      └── lastResetDay == currentDay (Cùng ngày)
            ├── QuotaExhausted ──► Giữ nguyên QuotaExhausted (cooldownUntil = nextPstMidnight)
            ├── RateLimited / Cooldown
            │     ├── now < cooldownUntil  ──► Giữ nguyên trạng thái & cooldownUntil
            │     └── now >= cooldownUntil ──► Healthy (circuitBreakerStatus: Closed, cooldownUntil: 0)
            ├── AuthFailed ──► Giữ nguyên AuthFailed
            └── Healthy / Degraded ──► Giữ nguyên trạng thái
```

---

## 2. Project Write Queue Model

Mô hình điều phối hàng đợi ghi tuần tự vào IndexedDB để loại bỏ tranh chấp tương tranh dữ liệu dự án.

```typescript
export interface ProjectWriteTask {
  id: string;                       // Định danh tác vụ (vd: write_1726400000000_abc)
  projectId: string;                // ID của dự án cần lưu
  projectSnapshot: StoryProject;    // Dữ liệu dự án mới nhất cần lưu
  enqueuedAt: number;               // Thời điểm đưa vào hàng đợi
  resolve: () => void;              // Hàm hoàn thành Promise
  reject: (err: any) => void;       // Hàm xử lý lỗi
}
```

### Sơ đồ luồng hàng đợi (Sequential Promise Chain)
```text
User Actions:
[Thêm từ 1] ──► enqueueProjectSave(proj1) ──┐
[Thêm từ 2] ──► enqueueProjectSave(proj2) ──┼──► [ Sequential Promise Chain ] ──► IndexedDB (saveProjectToDB)
[Sửa thẻ]   ──► enqueueProjectSave(proj3) ──┘        (FIFO: Task 1 -> Task 2 -> Task 3)
```

---

## 3. Bilingual Split Model & Unified Options

Cấu trúc tham số và khối phân đoạn song ngữ chuẩn hóa:

```typescript
export interface TranslationChunk {
  chunkIndex: number;               // Thứ tự phân đoạn (0-based)
  totalChunks: number;              // Tổng số phân đoạn
  sourceText: string;               // Văn bản nguồn tiếng Trung nguyên vẹn
  rawText: string;                  // Bản dịch thô tiếng Việt nguyên vẹn
  sourceParagraphRange: {
    start: number;
    end: number;
  };
  rawParagraphRange: {
    start: number;
    end: number;
  };
  estimatedTokens: number;          // Ước tính số token văn bản nguồn
}

export interface BilingualSplitOptions {
  sourceText: string;               // Văn bản nguồn tiếng Trung
  rawText: string;                  // Bản dịch thô tiếng Việt
  targetParts?: number;             // Số lượng phần mong muốn (mặc định: 2)
  maxTokensPerChunk?: number;       // Giới hạn token tối đa cho mỗi chunk (tùy chọn)
}
```

---

## 4. Key Hash Cache Record

Cấu trúc lưu đệm mã băm khóa API SHA-256 64-hex ký tự:

```typescript
// Bộ nhớ đệm toàn cục trong tiến trình trình duyệt
const keyHashCache = new Map<string, string>(); // Raw API Key -> 64 hex SHA-256 string
```

### Thuộc tính kiểm tra:
- Khóa đầu vào có độ dài bất kỳ (ví dụ: `AIzaSy...`) -> Băm ra đúng 64 ký tự `[0-9a-f]{64}`.
- Kết quả băm trên môi trường Node.js (kiểm thử Vitest) và môi trường Trình duyệt (Web Crypto / thuần JS) phải cho ra cùng 1 chuỗi giá trị bit-for-bit.

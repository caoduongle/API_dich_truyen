# Data Model: Adaptive Content Split Retry for UNTRANSLATED_CHINESE_LEFTOVER

**Feature**: `123-adaptive-split-untranslated-retry`  
**Date**: 2026-09-12  
**Status**: Completed

## 1. Entities & Data Structures

Dưới đây là các thực thể dữ liệu tham gia vào quá trình phân đoạn thích ứng và cứu nguy bản dịch. Tất cả cấu trúc này hoạt động hoàn toàn ở bộ nhớ client (in-memory) hoặc mở rộng tham số gọi hàm mà không làm thay đổi lược đồ cơ sở dữ liệu IndexedDB (`src/services/db.ts`) hay các interface cốt lõi của `src/types.ts` (tuân thủ Nguyên tắc IV của Hiến pháp).

### 1.1. `SplitRetryEventInfo`

Cấu trúc sự kiện chẩn đoán được phát ra khi hệ thống kích hoạt thử lại phân đoạn thích ứng:

```typescript
export interface SplitRetryEventInfo {
  /** Giai đoạn kích hoạt: Dịch thô (GĐ1) hoặc Chuốt văn phong (GĐ2) */
  stage: 'raw' | 'polish';
  /** Cấp độ sâu phân đoạn hiện tại (0: lần chia đầu tiên, 1: lần chia thứ hai) */
  depth: number;
  /** Số lượng phân đoạn con được cắt chia (2 hoặc 3 phần) */
  partsCount: number;
  /** Lý do hoặc thông điệp lỗi gốc (ví dụ: chuỗi UNTRANSLATED_CHINESE_LEFTOVER) */
  reason: string;
}
```

### 1.2. Mở rộng `DirectRawTranslationParams` và `DirectPolishTranslationParams`

Thêm trường callback tùy chọn vào các interface tham số dịch trực tiếp trong `src/services/directTranslationEngine.ts`:

```typescript
export interface DirectRawTranslationParams {
  text: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
  /** Callback thông báo khi phân đoạn thích ứng được kích hoạt do lỗi */
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
}

export interface DirectPolishTranslationParams {
  sourceText: string;
  rawTranslation: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  additionalInstructions?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  isExtractionEnabled?: boolean;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
  roundIndex?: number;
  totalRounds?: number;
  temperature?: number;
  /** Callback thông báo khi phân đoạn thích ứng được kích hoạt do lỗi */
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
}
```

### 1.3. `AdaptiveContentSegment` (Logic phân đoạn nội bộ)

Biểu diễn phân đoạn văn bản được cắt nhỏ thích ứng bởi `splitTextAdaptively`:

| Thuộc tính | Kiểu dữ liệu | Mô tả |
|---|---|---|
| `index` | `number` | Thứ tự phân đoạn trong khối cha (0-indexed) |
| `sourceText` | `string` | Đoạn văn bản tiếng Trung nguồn tương ứng |
| `rawTranslation` | `string` | Đoạn văn bản dịch thô tiếng Việt tương ứng (chỉ dùng trong GĐ2) |
| `depth` | `number` | Cấp độ sâu phân đoạn (0, 1, 2) |
| `staggeredKeyIndex` | `number` | Vị trí API key được phân bổ so le để thực hiện request |

---

## 2. State Transitions & Lifecycle

### 2.1. Chu trình thử lại phân đoạn Giai đoạn 1 (Dịch thô)

```
[Bắt đầu dịch thô toàn văn bản]
           │
           ▼
[Gọi Gemini API (callRawDirectCore)]
           │
           ├─► Thành công (Tỉ lệ chữ Hán <= 10%) ──► [Hoàn tất GĐ1]
           │
           └─► Lỗi (UNTRANSLATED_CHINESE_LEFTOVER hoặc rỗng/safety)
                     │
                     ▼
           [Kiểm tra depth < 2 && văn bản có thể chia nhỏ?]
                     │
                     ├─► CÓ: 
                     │    ├── Phát sự kiện onSplitRetry(stage: 'raw', depth, parts)
                     │    ├── Chia nguồn thành 2 hoặc 3 phần (splitTextAdaptively)
                     │    ├── Dịch tuần tự từng phần với staggeredKeyIndex
                     │    ├── Ghép nối kết quả (separateChapterTitleAndBody)
                     │    └── Chuyển tiếp thành công sang GĐ2
                     │
                     └─► KHÔNG:
                          └── Ném lỗi chẩn đoán (Bảo toàn nguyên tắc: không lưu chữ Hán)
```

### 2.2. Chu trình thử lại phân đoạn Giai đoạn 2 (Chuốt văn phong)

```
[Bắt đầu chuốt văn toàn văn bản]
           │
           ▼
[Gọi Gemini API (callPolishDirectCore)]
           │
           ├─► Thành công (Tỉ lệ chữ Hán <= 10%) ──► [Hoàn tất lượt chuốt]
           │
           └─► Lỗi (UNTRANSLATED_CHINESE_LEFTOVER hoặc rỗng/safety)
                     │
                     ▼
           [Kiểm tra depth < 2 && văn bản có thể chia nhỏ?]
                     │
                     ├─► CÓ:
                     │    ├── Phát sự kiện onSplitRetry(stage: 'polish', depth, parts)
                     │    ├── Chia đồng bộ sourceParts & rawParts (splitTextAdaptively)
                     │    ├── Chuốt song song từng cặp phân đoạn với Promise.all
                     │    └── Ghép nối kết quả (ensureChapterTitlePreserved)
                     │
                     └─► KHÔNG:
                          └── Cứu nguy: Fallback về rawTranslation của đoạn tương ứng (isPartial: true)
```

---

## 3. Validation Rules

1. **Ngưỡng kiểm tra chữ Hán**: Ký tự chữ Hán được tính bằng biểu thức `getChineseCharacterRatio(text)`. Nếu văn bản có độ dài `>= 50 tokens` và tỉ lệ `ratio > 0.1` (10%), hàm `validateTranslationOutput` ném lỗi tiền tố `UNTRANSLATED_CHINESE_LEFTOVER:`.
2. **Ngưỡng phân đoạn tối thiểu**: Không chia nhỏ văn bản nếu tổng token của đoạn `< 60 tokens` hoặc không tìm được điểm ngắt phù hợp (`chunks.length <= 1`).
3. **Bảo toàn định dạng tiêu đề**: Mọi kết quả sau khi ghép nối các phân đoạn con đều phải chạy qua hàm định dạng tiêu đề (`separateChapterTitleAndBody` cho GĐ1 và `ensureChapterTitlePreserved` cho GĐ2).

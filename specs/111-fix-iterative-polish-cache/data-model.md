# Data Model: Fix Iterative Polish Cache Bypass

**Feature**: `111-fix-iterative-polish-cache`  
**Date**: 2026-09-12

## 1. Entities & Data Structures

### PolishRoundStrategy
Đại diện cho chiến lược biên tập phân tầng theo từng vòng lặp chuốt văn.

```typescript
export interface PolishRoundStrategy {
  /** Chỉ số vòng lặp (1-indexed, ví dụ 1, 2, 3, 4, 5) */
  round: number;
  /** Tên định danh giai đoạn (vd: 'Cơ bản', 'Nhịp điệu', 'Nhân vật', 'Chi tiết', 'Xuất bản') */
  stageName: string;
  /** Tiêu đề nhãn đầu vào đặt trong prompt (vd: '[BẢN DỊCH THÔ BAN ĐẦU]' hay '[BẢN DỊCH ĐÃ BIÊN TẬP LƯỢT 1]') */
  inputLabel: string;
  /** Hướng dẫn trọng tâm bổ sung trong system instruction cho vòng này */
  directive: string;
  /** Mức temperature tối ưu cho vòng này (tăng dần 0.40 -> 0.65) */
  temperature: number;
}
```

### ConvergenceResult
Đại diện cho kết quả đo đạc độ tương đồng giữa 2 bản dịch liên tiếp và quyết định hội tụ.

```typescript
export interface ConvergenceResult {
  /** Tỷ lệ tương đồng giữa hai chuỗi văn bản (từ 0.0 đến 1.0) */
  similarity: number;
  /** Phần trăm khác biệt làm tròn (ví dụ 4.2%) */
  diffPercentage: number;
  /** Số từ thay đổi ước tính */
  changedWordsCount: number;
  /** Cờ xác định chu trình đã hội tụ hay chưa (similarity >= ngưỡng) */
  isConverged: boolean;
  /** Thông điệp giải thích kết quả hội tụ */
  reason?: string;
}
```

### DirectPolishTranslationParams (Mở rộng tương thích ngược)
Tham số gọi `polishTranslationDirect` và `buildPolishTranslationPayload` được mở rộng thêm các trường ngữ cảnh vòng lặp:

```typescript
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
  
  // === CÁC TRƯỜNG BỔ SUNG MỚI (TÙY CHỌN, TƯƠNG THÍCH NGƯỢC) ===
  /** Chỉ số vòng chuốt hiện tại (1-indexed, mặc định 1) */
  roundIndex?: number;
  /** Tổng số vòng chuốt dự kiến (mặc định 1) */
  totalRounds?: number;
  /** Cấu hình temperature tùy biến (nếu không truyền, tự tính theo roundStrategy) */
  customTemperature?: number;
}
```

### ProgressiveScanContext (Mở rộng cho Phân tích Thuật ngữ)
Tham số gọi `analyzeGlossaryDirect` và `buildAnalyzeGlossaryPayload` được mở rộng:

```typescript
export interface AnalyzeGlossaryDirectParams extends DirectGlossaryCommonParams {
  text: string;
  chapterId?: string;
  sourceChapterId?: string;
  
  // === CÁC TRƯỜNG BỔ SUNG MỚI (TÙY CHỌN, TƯƠNG THÍCH NGƯỢC) ===
  /** Danh sách chữ Hán của các thuật ngữ đã biết/đã quét được cần loại trừ */
  knownChineseTerms?: string[];
  /** Chỉ số vòng quét hiện tại (1-indexed, mặc định 1) */
  loopIndex?: number;
  /** Tổng số vòng quét dự kiến (mặc định 1) */
  totalLoops?: number;
}
```

---

## 2. Validation & Boundary Rules

1. **Ngưỡng hội tụ (Convergence Threshold)**:
   - Mặc định: `CONVERGENCE_THRESHOLD = 0.96` (tức tương đồng $\ge 96\%$).
   - Vòng 1 luôn thực thi (không kiểm tra hội tụ vì là bản chuốt đầu tiên so với bản dịch thô).
   - Kiểm tra hội tụ bắt đầu kích hoạt từ vòng 2 trở đi ($j \ge 2$).
2. **Khoảng giá trị Temperature**:
   - Vòng 1: `0.40`
   - Vòng 2: `0.50`
   - Vòng 3: `0.55`
   - Vòng 4: `0.60`
   - Vòng 5: `0.65`
   - Giới hạn cứng: $0.2 \le \text{temperature} \le 0.70$ để ngăn ngừa AI hallucination / thêm thắt tình tiết.
3. **Giới hạn danh sách loại trừ thuật ngữ**:
   - Nếu `knownChineseTerms` quá dài (> 200 từ), chỉ lấy tối đa 150 từ xuất hiện nhiều nhất hoặc gần nhất để không làm phình prompt token quá mức.

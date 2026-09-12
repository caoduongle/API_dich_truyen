# Interface Contract: Translation Structure & Truncation Parity Guard

**Feature**: `125-polish-structure-parity-guard`
**Date**: 2026-09-13

## 1. Module: `src/lib/text.ts`

### `countParagraphs`
```typescript
/**
 * Đếm số lượng đoạn văn hợp lệ trong văn bản.
 * Mỗi khối văn bản không rỗng được phân tách bởi ít nhất một ký tự xuống dòng (\n+) được tính là 1 đoạn.
 */
export function countParagraphs(text: string): number;
```

### `validatePolishIntegrity`
```typescript
/**
 * Kiểm tra tính toàn vẹn và chống cắt cụt của bản chuốt văn GĐ2 so với bản dịch thô GĐ1.
 * 
 * @param rawText - Bản dịch thô gốc GĐ1 dùng làm mốc so sánh
 * @param polishedText - Bản chuốt văn GĐ2 do AI tạo ra
 * @param minRawLength - Chiều dài tối thiểu của bản thô để bắt đầu áp dụng kiểm tra tỉ lệ (mặc định: 300)
 * @param minRatio - Tỉ lệ độ dài tối thiểu được chấp nhận (mặc định: 0.80 = 80%)
 * 
 * @throws Error("POLISH_TRUNCATION_DETECTED: ...") nếu độ dài hoặc số đoạn bị sụt giảm bất thường
 */
export function validatePolishIntegrity(
  rawText: string,
  polishedText: string,
  minRawLength?: number,
  minRatio?: number
): void;
```

### `validateParagraphParity`
```typescript
/**
 * Kiểm định độ lệch số lượng đoạn văn giữa 2 bản văn bản.
 * 
 * @param referenceText - Văn bản mốc (Bản gốc hoặc Bản thô)
 * @param targetText - Văn bản cần kiểm tra (Bản thô hoặc Bản chuốt)
 * @param maxDivergenceRatio - Tỉ lệ lệch đoạn tối đa cho phép (mặc định: 0.20 = 20%)
 * @param minParagraphs - Số đoạn tối thiểu của bản mốc để áp dụng kiểm tra (mặc định: 5)
 * 
 * @throws Error("PARAGRAPH_STRUCTURE_DIVERGENCE: ...") nếu số đoạn văn bị lệch vượt ngưỡng
 */
export function validateParagraphParity(
  referenceText: string,
  targetText: string,
  maxDivergenceRatio?: number,
  minParagraphs?: number
): void;
```

---

## 2. Module: `src/services/directTranslationEngine.ts`

### Error Classification Contract
```typescript
/**
 * Phân loại lỗi có thể kích hoạt cơ chế chia nhỏ đoạn văn bản thích ứng (Adaptive Split Retry)
 * Trả về true nếu lỗi thuộc các loại:
 * - Lọc an toàn (SAFETY, bộ lọc an toàn)
 * - Phản hồi rỗng (kết quả trả về trống)
 * - Sót chữ Hán (UNTRANSLATED_CHINESE_LEFTOVER, tỉ lệ chữ Hán bất thường)
 * - Cắt cụt bản chuốt văn (POLISH_TRUNCATION_DETECTED)
 * - Lệch cấu trúc đoạn nghiêm trọng (PARAGRAPH_STRUCTURE_DIVERGENCE)
 */
export function isAdaptiveSplitRetryableError(err: unknown): boolean;
```

### `polishTranslationDirect`
```typescript
export interface DirectPolishTranslationParams {
  sourceText: string;
  rawTranslation: string;
  genre?: string;
  tone?: string;
  glossary?: Array<{ chinese: string; vietnamese: string; variants?: string[] }>;
  additionalInstructions?: string;
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  isExtractionEnabled?: boolean;
  signal?: AbortSignal;
  roundIndex?: number;
  totalRounds?: number;
  temperature?: number;
  onSplitRetry?: (info: SplitRetryEvent) => void;
}

export async function polishTranslationDirect(
  params: DirectPolishTranslationParams
): Promise<DirectPolishTranslationResult>;
```

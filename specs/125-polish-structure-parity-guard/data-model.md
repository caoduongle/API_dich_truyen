# Data Model: Polish Truncation Prevention and 1:1 Paragraph Structure Parity

**Feature**: `125-polish-structure-parity-guard`
**Date**: 2026-09-13

## 1. Entities & Validation Types

### `TranslationIntegrityReport`
Represents the outcome of validating a polished draft against its raw and source baselines.

```typescript
export interface TranslationIntegrityReport {
  /** Cho biết bản dịch có vượt qua toàn bộ các bài kiểm định toàn vẹn hay không */
  isValid: boolean;
  /** Loại vi phạm nếu không hợp lệ */
  violationType?: 'POLISH_TRUNCATION_DETECTED' | 'PARAGRAPH_STRUCTURE_DIVERGENCE' | 'UNTRANSLATED_CHINESE_LEFTOVER';
  /** Tỉ lệ độ dài ký tự giữa bản chuốt và bản thô (ví dụ: 0.95 nghĩa là 95%) */
  lengthRatio: number;
  /** Số đoạn văn bản gốc */
  sourceParagraphCount: number;
  /** Số đoạn văn bản thô */
  rawParagraphCount: number;
  /** Số đoạn văn bản chuốt */
  polishedParagraphCount: number;
  /** Tỉ lệ sai lệch số đoạn văn so với bản đối chiếu (0.0 đến 1.0) */
  paragraphDivergenceRatio: number;
  /** Thông báo chi tiết phục vụ ghi log hoặc hiển thị cảnh báo */
  message?: string;
}
```

### `ParagraphMetrics`
Metrics computed on any text block for displaying structural metadata in UI headers and comparison panels.

```typescript
export interface ParagraphMetrics {
  /** Tổng số ký tự (bao gồm khoảng trắng) */
  totalChars: number;
  /** Tổng số ký tự không khoảng trắng */
  nonWhitespaceChars: number;
  /** Số đoạn văn bản hợp lệ (ngăn cách bởi \n+) */
  paragraphCount: number;
  /** Độ dài trung bình mỗi đoạn văn (ký tự) */
  averageParagraphLength: number;
}
```

### `StructuralParityStatus`
UI state for tracking parity across the three translation phases for a single chapter.

```typescript
export interface StructuralParityStatus {
  sourceMetrics: ParagraphMetrics;
  rawMetrics?: ParagraphMetrics;
  polishedMetrics?: ParagraphMetrics;
  /** Cờ cảnh báo lệch cấu trúc đoạn giữa bản chuốt và bản gốc (> 15%) */
  hasParagraphDivergence: boolean;
  /** Cờ cảnh báo bản chuốt bị hụt độ dài bất thường (< 80% bản thô) */
  hasLengthDeficit: boolean;
  /** Gợi ý hành động (ví dụ: 'Yêu cầu chuốt lại với phân đoạn thích ứng') */
  recommendation?: string;
}
```

---

## 2. Validation & Threshold Rules

| Metric | Condition | Action / Result |
|---|---|---|
| **Raw Character Length ($L_{\text{raw}}$)** | $< 300$ chars | Bypass truncation check (short announcement / title) |
| **Polish / Raw Length Ratio ($L_{\text{polish}} / L_{\text{raw}}$)** | $< 0.80$ | Throw `POLISH_TRUNCATION_DETECTED` $\rightarrow$ Trigger Adaptive Split Retry |
| **Source Paragraphs ($P_{\text{source}}$)** | $< 5$ paragraphs | Bypass paragraph divergence check |
| **Paragraph Count Divergence ($|P_{\text{polish}} - P_{\text{raw}}| / P_{\text{raw}}$)** | $> 0.20$ | Throw `PARAGRAPH_STRUCTURE_DIVERGENCE` $\rightarrow$ Trigger Adaptive Split Retry |
| **Pre-Split Token Threshold (Stage 2)** | Tokens $> 1500$ ($text_{\text{source}}$) or $> 1800$ ($text_{\text{raw}}$) | Pre-emptively split into $K=2$ synchronized parts before API call |

---

## 3. State Transitions in Polish Pipeline

```
[Raw Translation Ready]
         │
         ▼
[Pre-Split Check]
   ├── Tokens > 1800 ──► Split into K Synchronized Parts ──► Polish Chunks in Parallel ──┐
   └── Tokens <= 1800 ──► Call Single Polish API Direct Core                             │
                                  │                                                      │
                                  ▼                                                      │
                       [Dual-Metric Integrity Guard]                                    │
                                  ├── Passes All Guards ──► [Final Polished Result] ◄────┘
                                  │
                                  └── Fails (Length < 80% OR Divergence > 20%)
                                              │
                                              ▼
                                 Throws POLISH_TRUNCATION_DETECTED
                                              │
                                              ▼
                                [isAdaptiveSplitRetryableError]
                                              │
                                              ▼
                              [Trigger Divide & Conquer Split Retry]
                                 (Recursively polish smaller chunks)
```

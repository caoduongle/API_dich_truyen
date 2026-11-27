# Data Model: Cải thiện chất lượng dịch — Bảo toàn cấu trúc 1-1 với bản raw

**Feature**: `166-strict-raw-structure-parity` | **Date**: 2026-11-27

> **Bảo toàn Core Schema (Constitution Principle IV)**: Không sửa đổi `src/types.ts` hay bất kỳ object store nào của IndexedDB. Mọi cấu trúc dưới đây thuộc tầng nội bộ `src/services/translation/`.

## 1. `ParagraphStructuralSignature` (`src/services/translation/structureParity.ts`)

Biểu diễn đặc trưng cấu trúc 1-1 của một đơn vị đoạn/dòng (tiếng Trung gốc hoặc tiếng Việt dịch):

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `index` | `number` | Chỉ số đoạn (0-based) trong danh sách đoạn không rỗng |
| `isTitle` | `boolean` | Có phải dòng tiêu đề chương (`isChapterTitleLine`) |
| `isSceneDivider` | `boolean` | Có phải dòng phân cảnh (`***`, `---`, `~~~`, `===`, `···`) |
| `sentenceCount` | `number` | Số câu ước lượng theo ranh giới kết câu (`.`, `?`, `!`, `...` / `。`, `？`, `！`, `……`), có loại trừ số thập phân (`3.5`) và viết tắt |
| `questionCount` | `number` | Số dấu chấm hỏi (`？` / `?`) |
| `exclamationCount` | `number` | Số dấu chấm than (`！` / `!`) |
| `ellipsisCount` | `number` | Số cụm dấu ba chấm (`……` / `…` / `...`) |
| `dashCount` | `number` | Số dấu gạch ngang ngắt nhịp (`——` / `—`) |
| `dialogueQuoteCount` | `number` | Số cặp dấu ngoặc thoại trực tiếp (`“...”`, `「...」`, `『...』` hoặc `"..."`) |
| `hasDirectDialogue` | `boolean` | Đoạn có chứa lời thoại trực tiếp trong ngoặc hay không |
| `terminalKind` | `'period' \| 'question' \| 'exclamation' \| 'ellipsis' \| 'dash' \| 'colon' \| 'divider' \| 'other'` | Loại dấu kết thúc chủ đạo của đoạn (bỏ qua dấu đóng ngoặc kép/đơn phía sau cùng) |
| `cjkPunctuationCount` | `number` | Số ký tự dấu câu toàn giác tiếng Trung còn xuất hiện trong đoạn |

## 2. `StructureDiscrepancyKind` & `ParagraphParityDiscrepancy`

```ts
export type StructureDiscrepancyKind =
  | 'paragraph_count_mismatch'
  | 'cjk_punctuation_leak'
  | 'dialogue_quote_loss'
  | 'terminal_punctuation_mismatch'
  | 'expressive_punctuation_loss'
  | 'sentence_count_divergence';

export interface ParagraphParityDiscrepancy {
  paragraphIndex: number;
  sourceParagraphIndex?: number;
  kind: StructureDiscrepancyKind;
  severity: 'critical' | 'warning';
  description: string;
}
```

## 3. `StructureParityReport`

Kết quả đối chiếu tổng thể giữa văn bản gốc (hoặc bản thô mốc) và bản dịch đích:

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `sourceParagraphCount` | `number` | Tổng số đoạn không rỗng của văn bản gốc |
| `targetParagraphCount` | `number` | Tổng số đoạn không rỗng của văn bản đích |
| `sourceBodyCount` | `number` | Số đoạn thân bài gốc (đã tách dòng tiêu đề chương nếu có) |
| `targetBodyCount` | `number` | Số đoạn thân bài đích (đã tách dòng tiêu đề chương nếu có) |
| `isParagraphCountExact` | `boolean` | `true` khi `sourceBodyCount === targetBodyCount` (và dòng tiêu đề không bị gộp mất) |
| `paragraphCountDelta` | `number` | `Math.abs(sourceBodyCount - targetBodyCount)` |
| `leftoverCjkPunctuationCount` | `number` | Tổng số ký tự dấu câu toàn giác tiếng Trung còn sót trong bản đích |
| `discrepancies` | `ParagraphParityDiscrepancy[]` | Danh sách sai lệch chi tiết gắn với `paragraphIndex` |
| `penaltyScore` | `number` | Điểm phạt tổng hợp (dùng để so sánh chống thoái hóa giữa Lượt K và Lượt K−1 khi chuốt văn) |

## 4. Mở rộng tương thích ngược `PolishFidelityReport` (`src/services/translation/types.ts`)

Các trường hiện có (`isAcceptable`, `previousGlossaryViolations`, `candidateGlossaryViolations`, `ungroundedProperNouns`, `paragraphCountDelta`, `rejectionReason`) được giữ nguyên 100%; bổ sung các trường tùy chọn:
- `previousStructurePenalty?: number`
- `candidateStructurePenalty?: number`
- `structureDiscrepancyCount?: number`

# Feature Specification: Polish Truncation Prevention and 1:1 Paragraph Structure Parity

**Feature Branch**: `125-polish-structure-parity-guard`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "kiểm tra cơ chế biên tập; tại sao biên tập xong lại ngắn hơn dịch thô; và đảm bảo bản dịch thô và bản biên dịch giữ đúng cấu trúc dòng; cấu trúc đoạn y hệt bản gốc" kèm 2 ảnh chụp thực tế cho thấy bản dịch biên tập (GĐ2) ngắn hơn rõ rệt và bị cắt cụt đuôi so với bản dịch thô (GĐ1).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anti-Truncation & Completeness Guard for Polish Phase (Priority: P1)

As a translator running Chapter Translation, when I execute Stage 2 (Polish / Biên tập chuốt văn), I want the system to guarantee that the polished translation is complete, never truncated, and never omitted or summarized near the end of the chapter compared to Stage 1 (Raw translation).

**Why this priority**: Truncation in the polish phase destroys narrative continuity. When AI drops paragraphs or cuts off the latter half of a chapter, translators must manually detect the omission and retranslate, undermining trust in the 2-phase automated pipeline.

**Independent Test**: Provide a 1,500-word chapter with a valid raw translation. Simulate a Gemini response that only polishes the first 40% of the text. Verify that the system automatically detects the truncation anomaly (`POLISH_TRUNCATION_DETECTED`), triggers Adaptive Split Retry (Divide & Conquer) across smaller segments, and produces a complete, non-truncated polished translation.

**Acceptance Scenarios**:

1. **Given** a raw translation of length $L_{\text{raw}}$ (where $L_{\text{raw}} \ge 300$ characters), **When** the AI returns a polished translation whose character length is $< 80\%$ of $L_{\text{raw}}$, **Then** the system rejects the result and raises `POLISH_TRUNCATION_DETECTED`.
2. **Given** a `POLISH_TRUNCATION_DETECTED` error occurs during Stage 2, **When** the error classifier evaluates the error, **Then** `isAdaptiveSplitRetryableError` returns `true` and activates adaptive content splitting (Divide & Conquer) into smaller matched chunks.
3. **Given** a chapter whose source text or raw translation exceeds 2,000 estimated tokens, **When** Stage 2 begins, **Then** the system pre-emptively splits both the source text and raw translation into synchronized chunks before calling Gemini, preventing output token budget exhaustion.

---

### User Story 2 - 1:1 Paragraph and Line Structure Parity (Priority: P1)

As a reader and translator, when viewing either raw translation (Stage 1) or polished translation (Stage 2), I want each paragraph and line break to correspond 1:1 with the original Chinese text, so that the author's intended pacing, dialogue exchanges, and dramatic pauses are fully preserved without artificial paragraph collapsing.

**Why this priority**: Web novels rely heavily on short paragraphs and independent dialogue lines to create rhythm and tension. When AI merges 4–5 short paragraphs into a single dense wall of text, readability drops and comparing translation against the original becomes nearly impossible.

**Independent Test**: Translate and polish a chapter containing 20 distinct short paragraphs and dialogue lines. Verify that both the resulting raw translation and polished translation contain exactly 20 distinct paragraphs separated by double newlines (`\n\n`), with the chapter title strictly isolated on the first line.

**Acceptance Scenarios**:

1. **Given** a Chinese source text with $N$ non-empty paragraphs separated by newlines, **When** Stage 1 or Stage 2 prompt is generated, **Then** the system instruction and prompt explicitly enforce that the output MUST contain exactly $N$ corresponding paragraphs separated by `\n\n`, strictly prohibiting paragraph merging or collapsing.
2. **Given** a polished translation where the paragraph count deviates by more than $20\%$ from the source paragraph count (for texts with $\ge 5$ paragraphs), **When** structural parity validation runs, **Then** the system flags `PARAGRAPH_STRUCTURE_DIVERGENCE` and triggers split-retry or structural realignment.
3. **Given** any chapter translation, **When** formatting final raw or polished text, **Then** the chapter title is deterministically placed on line 1, separated from paragraph 1 by a blank line (`\n\n`), and never merged into the first sentence.

---

### User Story 3 - Visual Structure & Metrics Transparency in Workspace (Priority: P2)

As a translator reviewing chapters in the workspace editor or chapter history tabs (Source / Raw / Polish), I want to see clear paragraph count and character length indicators so I can verify at a glance that all three versions are structurally aligned.

**Why this priority**: Visual transparency provides immediate confidence that no content was omitted during polishing and that paragraph structure is preserved.

**Independent Test**: Open Chapter 92 in the workspace and toggle between "Bản gốc", "Dịch thô", and "Dịch biên tập". Verify that paragraph counts and character counts are displayed, and any severe discrepancy is visibly flagged.

**Acceptance Scenarios**:

1. **Given** a chapter with both raw and polished translations, **When** the user views the translation panels, **Then** metadata headers show character count and paragraph count for both drafts.
2. **Given** a polished draft with paragraph divergence $> 15\%$ compared to raw or source, **When** rendered in the editor, **Then** a warning badge indicates potential paragraph merging or truncation.

---

### Edge Cases

- **What happens when the source chapter has poetic verse or single-character dialogue lines?**: The system preserves single-line paragraphs by treating any non-empty line as a distinct paragraph unit during paragraph counting and validation.
- **What happens when an author uses inconsistent spacing (e.g. 3-4 consecutive blank lines)?**: The normalization parser collapses redundant whitespace and consecutive blank lines into canonical double newlines (`\n\n`) before counting paragraphs to avoid false-positive divergence.
- **What happens when Chinese text is very short (< 150 characters, e.g. volume announcements or author notes)?**: Minimum length thresholds bypass the strict 80% character ratio check to prevent false-positive truncation errors on short announcements.
- **What happens if a chapter is split into chunks during adaptive retry?**: Paragraph counts are validated and stitched per-chunk so that the stitched whole matches the total source paragraph count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI kiểm định độ dài và tính toàn vẹn của bản chuốt văn GĐ2 (`polishedTranslation`) so với bản dịch thô GĐ1 (`rawTranslation`). Nếu độ dài ký tự của bản chuốt văn $< 80\%$ độ dài bản thô (trên văn bản có bản thô $\ge 300$ ký tự), hệ thống PHẢI ném ngoại lệ `POLISH_TRUNCATION_DETECTED`.
- **FR-002**: Lỗi `POLISH_TRUNCATION_DETECTED` và `PARAGRAPH_STRUCTURE_DIVERGENCE` PHẢI được nhận diện bởi bộ phân loại lỗi `isAdaptiveSplitRetryableError` trong `directTranslationEngine.ts` để tự động kích hoạt đệ quy chia nhỏ thích ứng (Divide & Conquer).
- **FR-003**: Hệ thống PHẢI bổ sung cơ chế tiền phân đoạn (Pre-split) cho Giai đoạn 2 (`polishWithContentSplitDirect`): Nếu ước tính token của `rawTranslation` hoặc `sourceText` vượt quá 2000 token tại lượt đầu tiên (`retryDepth === 0`), hệ thống PHẢI tự động chia nhỏ cả văn bản gốc và văn bản thô thành các đoạn tương ứng trước khi gọi Gemini API để ngăn chặn chạm giới hạn output token.
- **FR-004**: Prompt của Giai đoạn 1 (`buildRawTranslationPayload`) và Giai đoạn 2 (`buildPolishTranslationPayload`) PHẢI được gia cố chỉ thị nghiêm ngặt:
  - Bắt buộc bảo toàn 100% cấu trúc phân đoạn 1:1 so với bản gốc.
  - Tuyệt đối cấm gộp nhiều đoạn ngắn thành một khối đoạn dài.
  - Mỗi đoạn văn bản gốc tương ứng chính xác với một đoạn văn bản dịch, phân cách bởi đúng 2 dấu xuống dòng (`\n\n`).
  - Tiêu đề chương luôn đứng độc lập ở dòng đầu tiên.
- **FR-005**: Hàm `validateParagraphParity(sourceText, targetText, maxDivergenceRatio = 0.20)` PHẢI so sánh số lượng đoạn văn hợp lệ giữa bản gốc và bản dịch. Nếu độ lệch số đoạn vượt quá $20\%$ trên văn bản có từ 5 đoạn trở lên, hàm PHẢI ném lỗi `PARAGRAPH_STRUCTURE_DIVERGENCE`.
- **FR-006**: Khi ghép nối các đoạn con sau khi phân chia thích ứng (`formattedPolished` và `formattedRaw`), hệ thống PHẢI sử dụng hàm chuẩn hóa phân đoạn để đảm bảo ranh giới giữa các khối ghép không bị mất dòng trống hoặc bị dính đoạn.
- **FR-007**: Giao diện Workspace Editor và Chapter History PHẢI hiển thị thông tin số đoạn văn (Paragraphs count) và số ký tự để người dùng kiểm chứng tính toàn vẹn cấu trúc giữa Bản gốc, Dịch thô và Dịch biên tập.

### Key Entities

- **TranslationParagraphMetrics**:
  - `sourceParagraphCount`: Số đoạn văn bản gốc tiếng Trung.
  - `rawParagraphCount`: Số đoạn văn bản dịch thô GĐ1.
  - `polishedParagraphCount`: Số đoạn văn bản chuốt văn GĐ2.
  - `isParityValid`: Cờ báo hiệu cấu trúc đoạn có khớp trong dung sai cho phép hay không.
  - `lengthRatio`: Tỉ lệ chiều dài ký tự giữa bản chuốt và bản thô ($L_{\text{polished}} / L_{\text{raw}}$).

- **AdaptiveSplitContext (Stage 2)**:
  - `sourceParts`: Các phần văn bản gốc tiếng Trung đã chia nhỏ đồng bộ.
  - `rawParts`: Các phần văn bản dịch thô tiếng Việt đã chia nhỏ tương ứng theo số lượng và ranh giới đoạn của `sourceParts`.
  - `depth`: Độ sâu đệ quy của phân đoạn (0, 1, 2).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các bản chuốt văn GĐ2 có độ dài ký tự đạt từ $85\%$ đến $125\%$ so với bản dịch thô GĐ1 trên các chương thông thường (triệt tiêu hoàn toàn hiện tượng biên dịch bị cụt đuôi / ngắn hơn một nửa như phản ánh ở Chương 92).
- **SC-002**: Tỉ lệ lệch số đoạn văn giữa bản dịch biên tập và bản gốc tiếng Trung không vượt quá $10\%$ trên 95% các chương truyện được dịch tự động.
- **SC-003**: Các chương dài (> 2,000 token) được tự động phân đoạn trước khi chuốt văn, đảm bảo tỉ lệ hoàn thành GĐ2 thành công không bị gián đoạn do cạn kiệt output token đạt 100%.
- **SC-004**: Toàn bộ kiểm thử tự động (`npm run lint`, `npm test`, `npm run build`) vượt qua 100% không có lỗi.

## Assumptions

- Bản dịch thô GĐ1 đã bao hàm đầy đủ tình tiết của bản gốc tiếng Trung; do đó bản thô là căn cứ đo lường chiều dài tin cậy để kiểm định bản chuốt văn GĐ2.
- Người dùng sử dụng các mô hình Gemini 2.5 Flash / Pro có khả năng tuân thủ nghiêm ngặt cấu trúc phân đoạn khi prompt được gia cố rõ ràng và văn bản được chia đoạn vừa phải (< 2,000 token).
- Cấu trúc đoạn văn được định nghĩa theo chuẩn văn học: các khối văn bản phân tách bởi ít nhất một ký tự xuống dòng (`\r?\n`), được chuẩn hóa thành `\n\n`.

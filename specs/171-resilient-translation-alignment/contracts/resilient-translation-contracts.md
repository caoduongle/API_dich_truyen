# Internal Module Contracts: Feature 171

**Feature**: `171-resilient-translation-alignment` | **Date**: 2026-11-28

---

## Contract 1: `src/services/translation/paragraphAnchor.ts`

```ts
export function encodeAnchoredParagraphs(text: string): {
  encodedText: string;
  sourceParagraphs: string[];
  expectedCount: number;
};

export function parseAnchoredParagraphs(
  aiOutput: string,
  expectedCount: number
): AnchoredParagraphParseResult;

export function stripParagraphAnchors(text: string): string;
```

- **Guarantees**:
  - Giữ nguyên cấu trúc văn bản khi `expectedCount <= 1` hoặc không tìm thấy thẻ `<<Pk>>` (`usedAnchors: false`).
  - Khi AI đảo lộn nhẹ hoặc tách dòng trong cùng một đoạn `<<Pk>>`, mọi nội dung trước thẻ `<<P{k+1}>>` thuộc về đoạn `k` được gom chuẩn vào phần tử `paragraphs[k - 1]`.
  - Mọi đầu ra qua `stripParagraphAnchors` sạch 100% nhãn `<<P\d+>>`.

---

## Contract 2: `src/services/ai/prompts.ts`

1. **`buildRawTranslationPayload(params)`**:
   - Hỗ trợ thêm tùy chọn `rawSourceText?: string` và `useParagraphAnchors?: boolean`.
   - `selectRelevantGlossary` ưu tiên khớp trên `rawSourceText || cleanText`, bảo đảm khi dịch từ `processedSourceText` vẫn truyền đủ từ điển và `CharacterProfile`.
   - Nếu `cleanText` đã chứa chú thích `[Tên_Việt]`, bỏ qua bước `substituteGlossaryTermsSafely` kép (tránh tạo chuỗi `Chữ_Hán[Tên_Việt]` dư chữ Hán khiến model nhẹ chép sót chữ Hán).
   - Khi `useParagraphAnchors === true` và có `>= 2` đoạn, mã hóa văn bản gửi kèm hướng dẫn giữ nguyên nhãn `<<P1>>`..`<<PN>>` ở đầu mỗi đoạn.

2. **`buildPolishTranslationPayload(params)`**:
   - Hỗ trợ thêm `complianceIssuesToFix?: DirectQaCritiqueIssue[]` và `useParagraphAnchors?: boolean`.
   - Khi `roundIndex === 1` và `complianceIssuesToFix.length > 0`, chèn mục `[DANH SÁCH LỖI CẦN SỬA NGAY TỪ DỊCH THÔ]` (tối đa 15 mục tiêu biểu) liệt kê rõ đoạn, từ điển bắt buộc (`chinese -> vietnamese`) và đại từ giới tính/sót chữ Hán để lượt chuốt đầu xử lý trực tiếp.

---

## Contract 3: `src/services/translation/rawTranslation.ts` & `polishTranslation.ts`

- **`rawWithContentSplitDirect` / `callRawDirectCore`**:
  - Giữ `validateStrictStructureParity` chạy trên cả nhánh retry con (`realignParagraphStructure` trước khi kiểm tra) nhằm chặn lệch đoạn ẩn khi chia nhỏ.
  - Trước khi chia đôi đệ quy toàn khối (`chunks = splitTextAdaptively(text, 2)`), nếu `callRawDirectCore` đã có bản dịch thô khớp 1-1 (`coreParagraphs.length === sourceParagraphs.length`) nhưng gặp sót chữ Hán cục bộ tại `1..4` đoạn, hoặc thiếu `1..3` đoạn xác định (`missingIndices`), cho phép tối đa **1 lượt sửa phẫu thuật cục bộ** các đoạn khiếm khuyết (`fallbackSinoVietnameseLine` / dịch lại đúng đoạn lỗi) để thu hồi chương mà không kích hoạt split đa tầng.
  - Theo dõi `isPartialFallback` rõ ràng: chỉ gán `isPartial: true` khi thực sự phải dùng nhánh dự phòng.

- **`polishWithContentSplitDirect` / `callPolishDirectCore`**:
  - Gỡ nhãn neo bằng `parseAnchoredParagraphs` -> lắp lại bản chuốt bảo toàn 1-1 trước khi chạy `validatePolishIntegrity` & `validateStrictStructureParity`.
  - Truyền xuyên suốt `complianceIssuesToFix` ở Lượt 1 (nếu có phân đoạn tiền xử lý, giữ nguyên định hướng sửa lỗi liên quan).

---

## Contract 4: `src/services/translation/translationValidation.ts`

```ts
export function evaluateAndMergePolishRound(params: {
  sourceText: string;
  previousDraft: string;
  candidatePolished: string;
  glossary: GlossaryItem[];
  roundIndex?: number;
}): PolishParagraphMergeResult;
```

- **Backward Compatibility**: Giữ nguyên chữ ký và hành vi của `evaluatePolishRoundFidelity(...)`.
- **Selective Merge Contract**:
  - Khi `previousDraft` và `candidatePolished` có thể gióng đoạn 1-1:
    - Chạy kiểm tra tuân thủ từng đoạn (`checkGlossaryCompliance` / `raw_leak` / `dialogue_quote_loss` / `cjk_punctuation_leak` / `detectUngroundedProperNouns` lượt `>= 2` / `penaltyScore` cấu trúc đoạn).
    - Nếu một đoạn suy giảm: giữ đoạn `previousDraft[i]` và ghi nhận `{ paragraphIndex: i, reasons: [...] }`.
    - Nếu tỷ lệ hoàn tác `<= 0.4` và không mất cấu trúc tổng thể → trả `isAcceptable: true`, `isCatastrophicRollback: false`, `mergedPolishedText` chứa bản hợp nhất, cùng `acceptedParagraphCount` và `revertedParagraphs`.
    - Nếu số đoạn lệch không gióng được hoặc tỷ lệ hoàn tác `> 0.4` (hoặc cắt cụt nặng) → trả `isAcceptable: false`, `isCatastrophicRollback: true`, `mergedPolishedText: previousDraft`.

---

## Contract 5: `src/services/translation/targetedRepair.ts`

- **`repairChapterCriticalIssuesDirect`**:
  - Cho phép **tối đa 1 lượt thử sửa bổ sung có phản hồi** cho mỗi đoạn nếu lần 1 thất bại ở kiểm tra an toàn cục bộ (vd: mất ngoặc thoại `"..."`, sót dấu câu CJK, phát sinh lỗi tất định mới, hoặc vẫn chưa khắc phục được lỗi `terminology` / `raw_leak` mục tiêu của đoạn).
  - Nếu lỗi nghiêm trọng có `type === 'omission'` mang ngữ cảnh câu/đoạn gốc tiếng Trung bị bỏ sót và `targetParas.length < sourceParas.length`, hỗ trợ khôi phục chèn đoạn dịch bổ sung ngay sau đoạn neo chỉ định khi đối chiếu khớp an toàn với `sourceParas`.
  - Trả về đầy đủ `rejectionReasons` (chi tiết tiếng Việt cho từng `paragraphIndex` bị từ chối) và `recoveredOmissionCount`.

---

## Contract 6: Orchestration (`chapterTranslationService.ts`, `useTranslationProcess.ts`, `useWorkspaceState.ts`)

1. **`chapterTranslationService.ts`**:
   - Truyền `rawSourceText: chapter.sourceText` khi gọi `translateRawDirect`.
   - Lưu `rawComplianceIssues` vào `complianceIssuesToFix` khi gọi `polishTranslationDirect` tại `j === 1`.
   - Dùng `evaluateAndMergePolishRound` sau mỗi lượt chuốt: chỉ `break` khi `isCatastrophicRollback`; nếu hợp nhất cục bộ vài đoạn thì cập nhật `currentTextToPolish = mergeResult.mergedPolishedText`, ghi log rõ số đoạn chấp nhận / giữ nguyên + lý do tiếng Việt, và tiếp tục chu trình chuốt bình thường.
   - Ghi nhận lý do từ chối cụ thể từ `repairRes.rejectionReasons` ở log `[Sửa đoạn QA]`.
   - Tính `unresolvedCriticalCount` & `unresolvedIssueSummary` dựa trên `detectedQaIssues` cuối cùng (loại trừ các issue `repaired === true`), trả về trong `ProcessChapterResult`.
2. **`useTranslationProcess.ts`**:
   - Đối chiếu `failedIds`: loại bỏ các chương có kết quả `completedClean` khỏi `failedIds`, chỉ giữ lại chương lỗi thực sự hoặc còn `unresolvedCriticalCount > 0` / `hasPartialFallback`.
3. **`useWorkspaceState.ts` (`handlePolishTranslation`)**:
   - Dùng `evaluateAndMergePolishRound` khi chuốt đơn chương để áp dụng lợi ích hợp nhất cấp đoạn đồng nhất với luồng hàng loạt.

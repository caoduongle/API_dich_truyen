# Research: Cải thiện chất lượng dịch — Bảo toàn cấu trúc 1-1 với bản raw

**Feature**: `166-strict-raw-structure-parity` | **Date**: 2026-11-27

## 1. Phân tích Hiện trạng & Root Causes trong Codebase

Qua rà soát trực tiếp tầng dịch thuật (`src/services/ai/prompts.ts`, `src/lib/text.ts`, `src/services/translation/*`, `src/services/chapterTranslationService.ts`), có 5 nguyên nhân gốc gây mất đối xứng cấu trúc 1-1 với bản raw:

1. **Giai đoạn 1 (`src/services/translation/rawTranslation.ts#L210-216`) hoàn toàn chưa kiểm tra đối xứng đoạn**:
   - `callRawDirectCore` chỉ gọi `separateChapterTitleAndBody`, `stripDuplicatedContinuityOverlap` và `validateTranslationOutput`, không kiểm tra số lượng đoạn so với `text` gốc. Nếu AI gộp 2–3 dòng thoại ngắn hoặc tách đoạn ngay ở GĐ1, sai lệch đi thẳng sang GĐ2.
2. **Ngưỡng kiểm tra đoạn ở GĐ2 quá lỏng và bỏ qua chương ngắn (`src/lib/text.ts#L173-194`)**:
   - `validateParagraphParity(referenceText, targetText, maxDivergenceRatio = 0.20, minParagraphs = 5)` cho phép lệch tới **20%** số đoạn (chương 40 đoạn được phép gộp mất 8 đoạn!) và bỏ qua hoàn toàn mọi văn bản dưới 5 đoạn.
   - Tương tự, `evaluatePolishRoundFidelity` (`src/services/translation/translationValidation.ts#L517`) cho phép lệch tới **35%** số đoạn (`Math.floor(prevCount * 0.35)`) và chỉ kiểm tra khi `roundIndex >= 2`.
3. **Thiếu hoàn toàn quy tắc & bộ chuẩn hóa dấu câu 1-1**:
   - Prompts GĐ1/GĐ2 chưa quy định ánh xạ dấu câu tiếng Trung (`。`, `，`, `、`, `；`, `：`, `？`, `！`, `……`, `——`, `“...”`, `「...」`, `『...』`, `（...）`, `《...》`) sang chuẩn tiếng Việt, cũng chưa có bước hậu xử lý tất định để quét sạch dấu câu toàn giác bị sót hoặc khôi phục dấu ngữ khí.
4. **Chỉ dẫn mặc định GĐ2 khuyến khích viết lại tự do làm vỡ ngắt câu**:
   - `src/services/ai/prompts.ts#L355` và `src/services/chapterTranslationService.ts#L298` đều dùng chuỗi mặc định `'Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết.'`, kết hợp với `getPolishStrategyForRound` (`src/lib/text.ts#L1199-1231`) ở lượt 2–5 khuyến khích viết lại nhịp câu mà không khóa cứng ranh giới câu (`sentence boundaries`), khiến AI gộp nhiều câu ngắn thành câu ghép dài hoặc biến thoại trực tiếp thành gián tiếp.
5. **Ghép nối phân đoạn & sửa cục bộ chưa có lớp đối chiếu chữ ký cấu trúc đoạn**:
   - Chưa có hàm trích xuất chữ ký cấu trúc từng đoạn (`ParagraphStructuralSignature`) để kiểm tra bảo toàn cặp ngoặc thoại, dấu kết câu (`?`, `!`, `...`, `—`) và độ lệch số câu trong `evaluatePolishRoundFidelity`, `targetedRepair.ts` và `runDeterministicTranslationChecks`.

## 2. Quyết định Thiết kế

### Decision 1: Tạo module thuần `src/services/translation/structureParity.ts`
- **Rationale**: Tuân thủ Constitution Principle III (MVC separation) và giữ `src/lib/text.ts` không phình thêm. Toàn bộ logic chuẩn hóa dấu câu CJK → Việt, chỉnh lại dòng an toàn, trích xuất chữ ký cấu trúc đoạn (`ParagraphStructuralSignature`), đối chiếu đối xứng 1-1 (`analyzeStructureParity`, `validateStrictStructureParity`) và sinh cảnh báo tất định (`checkStructureParityIssues`) nằm gọn trong một module thuần không phụ thuộc DOM/React/IndexedDB.
- **Alternatives considered**: Nhồi thêm vào `src/lib/text.ts` (đã 1.403 dòng) hoặc `translationValidation.ts` (đã 864 dòng) — bị loại vì giảm tính bảo trì và khó test độc lập.

### Decision 2: Chuẩn hóa dấu câu tất định + Khôi phục dòng an toàn trước khi kiểm định (Zero-Quota First)
- **Rationale**:
  - Mọi đầu ra của `callRawDirectCore`, `callPolishDirectCore` và `repairChapterCriticalIssuesDirect` đều đi qua `normalizeTranslatedPunctuation` để chuyển đổi 100% dấu câu toàn giác tiếng Trung sang chuẩn tiếng Việt (`。→.`, `，/、→,`, `；→;`, `：→:`, `？→?`, `！→!`, `……/…→...`, `——/──→—`, `「...」/『...』/“...”→"..."`, `（...）→(...)`, `《...》→«...»` — đồng bộ với `stripQuotedDialogue` hiện có tại `translationValidation.ts#L232`), bảo vệ số thập phân (`3.5`), dòng phân cảnh (`***`, `---`, `~~~`) và thẻ hệ thống `[...]`.
  - Trước khi ném lỗi chia nhỏ (tốn thêm lượt gọi AI), thực hiện khôi phục dòng tất định trong trường hợp an toàn rõ ràng: tách tiêu đề chương dính dòng đầu, khôi phục dòng phân cảnh bị rơi, tách 2 lượt thoại trực tiếp `"..." "..."` bị gộp chung trên 1 dòng khi bản gốc là 2 dòng thoại riêng biệt, hoặc gộp lại nếu nguồn chỉ có đúng 1 đoạn đơn nhưng AI tự ngắt thành nhiều dòng.
- **Alternatives considered**: Chỉ dựa vào retry AI khi sót dấu câu toàn giác hoặc lệch dòng đơn giản — bị loại vì lãng phí quota và tăng độ trễ (vi phạm FR-012 & SC-006).

### Decision 3: Tương thích ngược với các hàm & bộ test hiện có
- **Rationale**:
  - Giữ nguyên chữ ký và hành vi của `validateParagraphParity(referenceText, targetText, maxDivergenceRatio = 0.20, minParagraphs = 5)` trong `src/lib/text.ts` để không phá vỡ `src/lib/__tests__/text.test.ts#L301-323`; bổ sung `validateStrictStructureParity` mới trong `structureParity.ts` cho luồng dịch nghiêm ngặt.
  - Trong `buildRawTranslationPayload` (`src/services/ai/prompts.ts`), giữ nguyên danh sách mục đánh số `1.`..`10.` (đưa các quy tắc 1-1 dòng/ngắt câu/dấu câu vào mục `1.` dưới dạng gạch đầu dòng phụ `-`) và chỉ xuất văn bản nguồn đúng 1 lần để bảo toàn hợp đồng được kiểm tra tại `src/services/ai/__tests__/prompts.test.ts#L281-352`.
  - Cập nhật đồng bộ chỉ dẫn chuốt văn mặc định ở `prompts.ts#L355`, `chapterTranslationService.ts#L298` và test tương ứng tại `prompts.test.ts#L107` theo đúng yêu cầu nghiệp vụ FR-007.
  - Trong `validateStrictStructureParity` của luồng dịch/chuốt: chỉ kích hoạt ném `PARAGRAPH_STRUCTURE_DIVERGENCE` để chia nhỏ thích ứng khi văn bản nguồn thực sự là văn bản tiếng Trung (`countChineseCharacters(sourceText) > 0`) và số đoạn thân bài lệch với mốc tham chiếu, nhằm bảo toàn 100% các kịch bản mock tiếng Việt thuần trong `concurrencyResilience.test.ts` và `directTranslationEngine.test.ts#L671, #L721`.
  - Trong `evaluatePolishRoundFidelity`, so sánh số đoạn **thân bài** (đã tách riêng dòng tiêu đề chương qua `isChapterTitleLine`) giữa `candidatePolished` và `previousDraft` để bảo toàn trường hợp khôi phục tiêu đề hợp lệ (`polishFidelity.test.ts#L76`), đồng thời bác bỏ ngay từ Lượt 1 (`roundIndex >= 1`) nếu bất kỳ lượt chuốt nào làm lệch số đoạn thân bài hoặc làm tăng điểm phạt sai lệch cấu trúc (mất ngoặc thoại, mất `?`/`!`/`...`, gộp/tách câu quá ngưỡng) so với `previousDraft`.

### Decision 4: Không thay đổi `src/types.ts` và IndexedDB Schema
- **Rationale**: Constitution Principle IV cấm sửa `src/types.ts` và IndexedDB schema khi không được yêu cầu rõ ràng. Các cảnh báo sai lệch cấu trúc 1-1 từ `checkStructureParityIssues` tái sử dụng trực tiếp `QaIssueType` hiện có (`'raw_leak'` nếu còn dấu câu toàn giác bất thường; `'omission'` / `'addition'` cho thiếu/thừa đoạn hoặc câu; `'other'` kèm tiền tố mô tả rõ ràng `[Cấu trúc 1-1]` và `paragraphIndex` chính xác cho lệch dấu thoại/dấu ngữ khí/ngắt câu).
- **Alternatives considered**: Thêm giá trị mới vào union `QaIssueType` trong `src/types.ts` — bị loại để bảo vệ tuyệt đối tính bất biến của core schema và dữ liệu đã lưu trong IndexedDB/Google Drive.

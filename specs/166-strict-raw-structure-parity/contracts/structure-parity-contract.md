# Interface Contracts: 1-1 Raw Structure Parity

**Feature**: `166-strict-raw-structure-parity` | **Date**: 2026-11-27

## 1. Pure Structure Parity Module (`src/services/translation/structureParity.ts`)

### `normalizeTranslatedPunctuation(text: string): string`
- Chuyển đổi tất định 1-1 toàn bộ dấu câu toàn giác CJK sang chuẩn tiếng Việt:
  - `。{3,}` / `……` / `…+` → `...`, `。` → `.`, `，` / `、` → `,`, `；` → `;`, `：` → `:`, `？` → `?`, `！` → `!`, `——` / `──` → `—`
  - Ngoặc thoại ngoài `“` / `”` / `「` / `」` → `"` (chuẩn hóa ngoặc thoại đồng nhất)
  - Ngoặc lồng trong `‘` / `’` / `『` / `』` → `'` (tránh làm hỏng cân bằng ngoặc kép khi lồng thoại)
  - `（` → `(`, `）` → `)`, `《` → `«`, `》` → `»`, `【` → `[`, `】` → `]`, `～` → `~`
- Chuẩn hóa khoảng trắng quanh dấu câu tiếng Việt mà **không** chạm vào:
  - Dấu xuống dòng `\r?\n` (giữ nguyên cấu trúc dòng/đoạn).
  - Số thập phân (`3.5`, `10,5`), dấu chấm giữa tên (`·`), dòng phân cảnh (`***`, `---`, `~~~`), và ký hiệu giao diện hệ thống `[...]`.
- **Không** áp dụng `normalizeTranslatedPunctuation` lên nhánh cứu nguy phiên âm `fallbackSinoVietnameseLine`.

### `realignParagraphStructure(sourceText: string, translatedText: string): string`
- Thực hiện khôi phục phân dòng tất định **chỉ trong các trường hợp an toàn 100% không làm sai nghĩa**:
  1. Nếu `sourceBodyParas.length === 1` (không phải dòng phân cảnh) nhưng `transBodyParas.length > 1` (tối đa 4 đoạn ngắn và không có dòng phân cảnh): ghép các dòng thân bài bị AI tự ngắt bằng khoảng trắng `' '` để trả về đúng 1 đoạn tương ứng 1-1.
  2. Nếu `transBodyParas.length < sourceBodyParas.length`: chỉ tách dòng chứa nhiều cặp ngoặc thoại độc lập khi giữa các cặp ngoặc **không có từ dẫn truyện xen giữa** (`^"[^"\n]+"(?:\s+"[^"\n]+")+$`), hai dòng gốc tương ứng là thoại độc lập và phép tách đưa số đoạn khớp khít 1-1.
  3. Bảo toàn dòng phân cảnh (`***`, `---`, `~~~`) độc lập với đoạn văn xung quanh.

### `extractParagraphSignature(paragraph: string, lang: 'zh' | 'vi'): ParagraphStructuralSignature`
- Phân tích chữ ký cấu trúc của một đoạn đơn (số câu, dấu hỏi, cảm thán, ba chấm, gạch ngang, số cặp ngoặc thoại, dấu kết đoạn, số dấu câu CJK còn sót).

### `analyzeStructureParity(sourceText: string, translatedText: string): StructureParityReport`
- Đối chiếu 1-1 từng đoạn thân bài giữa `sourceText` và `translatedText` (có bù trừ dòng tiêu đề chương tương đồng `mapTranslatedParagraphToSourceWindow`).
- Phát hiện:
  - Lệch số đoạn thân bài (`paragraph_count_mismatch`, `severity: 'critical'`).
  - Sót dấu câu toàn giác tiếng Trung (`cjk_punctuation_leak`, `severity: 'critical'`).
  - Mất lời thoại trực tiếp: đoạn gốc có cặp dấu thoại (`hasDirectDialogue === true`) nhưng đoạn dịch mất sạch dấu ngoặc thoại (`dialogue_quote_loss`, `severity: 'critical'`).
  - Sai lệch dấu ngữ khí kết đoạn: đoạn gốc kết thúc bằng `？` / `！` / `……` / `——` nhưng đoạn dịch bị đổi thành dấu chấm thường `.` (`terminal_punctuation_mismatch`, `severity: 'warning'`).
  - Gộp/tách câu bất thường trong đoạn: `Math.abs(srcSig.sentenceCount - transSig.sentenceCount) > allowedDelta` (cho phép linh hoạt tối đa `±1` câu chỉ khi đoạn dài `>= 4` câu do khác biệt mệnh đề Trung–Việt; với đoạn ngắn `1–3` câu yêu cầu khớp chặt hoặc phạt cảnh báo khi gộp nhiều câu ngắn thành 1 câu).

### `validateStrictStructureParity(referenceText: string, targetText: string, options?: { requireChineseSource?: boolean; referenceRawText?: string }): void`
- Nếu `options?.requireChineseSource !== false` và `countChineseCharacters(referenceText) === 0`: bỏ qua ném ngoại lệ (tương thích ngược với các unit test dùng văn bản tiếng Việt giả lập).
- Khi có `referenceRawText` (ở GĐ2) mà số đoạn thân bài của `referenceText` và `referenceRawText` khác nhau (dữ liệu test nhân tạo), ưu tiên kiểm tra khớp chính xác 1-1 số đoạn thân bài với `referenceRawText`; trong luồng thực tế (`sourceBodyCount === rawBodyCount`), kiểm tra khớp chính xác **0% độ lệch số đoạn thân bài** (`targetBodyCount === expectedBodyCount`) cho mọi chương kể cả `< 5` đoạn.
- Nếu lệch số đoạn thân bài -> ném `Error('PARAGRAPH_STRUCTURE_DIVERGENCE: ...')` để bộ điều phối `classifyTranslationOutcome` kích hoạt chia nhỏ thích ứng (Divide & Conquer).

### `checkStructureParityIssues(params: { sourceText: string; translatedText: string; isPartialFallback?: boolean }): DirectQaCritiqueIssue[]`
- Chuyển các sai lệch cấu trúc từ `analyzeStructureParity` thành `DirectQaCritiqueIssue[]` (dùng `QaIssueType` hiện có: `'raw_leak'`, `'omission'`, `'addition'`, `'other'`) kèm `paragraphIndex` và `source: 'deterministic'`.

## 2. Prompt & Pipeline Integration Contracts

1. **`src/services/ai/prompts.ts` & `src/lib/text.ts` (`LITERARY_TRANSLATION_FRAMING`, `getPolishStrategyForRound`)**:
   - Gia cố quy tắc đối xứng 1-1 về **xuống dòng + cách ngắt câu + bảng ánh xạ dấu câu Trung → Việt + giữ lời thoại trực tiếp** trong GĐ1, GĐ2, GĐ3 và `targetedRepair.ts`.
   - Đính kèm thông tin định lượng `[BẢN ĐỒ CẤU TRÚC ĐOẠN BẮT BUỘC: Đúng N đoạn văn/dòng]` vào prompt để khóa số đoạn đầu ra của AI.
   - Thay thế câu mặc định khuyến khích viết bay bổng tự do ở `prompts.ts#L355` và `chapterTranslationService.ts#L298` bằng chỉ dẫn chuốt văn tự nhiên nhưng giữ nguyên tuyệt đối cấu trúc dòng, ngắt câu và dấu câu 1-1.
   - Bảo toàn quy tắc đánh số `1.`..`10.` và phát văn bản nguồn đúng 1 lần trong `buildRawTranslationPayload`.
2. **`src/services/translation/rawTranslation.ts` & `polishTranslation.ts` & `targetedRepair.ts`**:
   - Áp dụng `normalizeTranslatedPunctuation` + `realignParagraphStructure` + `validateStrictStructureParity` trong `callRawDirectCore` và `callPolishDirectCore`.
   - Áp dụng `normalizeTranslatedPunctuation` và kiểm tra không làm hỏng chữ ký cấu trúc đoạn trong `repairChapterCriticalIssuesDirect`.
3. **`src/services/translation/translationValidation.ts` & `qualityEvaluator.ts`**:
   - `evaluatePolishRoundFidelity`: áp dụng nguyên tắc **Non-Regression so với `previousDraft`** cho mọi lượt (`roundIndex >= 1`): từ chối lượt chuốt nếu làm lệch số đoạn thân bài so với `previousDraft` (`candBodyCount !== prevBodyCount`) hoặc làm phát sinh/tăng lỗi cấu trúc nghiêm trọng (`dialogue_quote_loss`, `cjk_punctuation_leak`, tăng `penaltyScore`) so với `previousDraft`.
   - `runDeterministicTranslationChecks`: thêm tùy chọn `includeStructureParity?: boolean` (mặc định `false` để không gây rollback nhầm khi `targetedRepair` sửa lỗi `omission`; bật `true` ở cấp chương trong `chapterTranslationService.ts` và `useWorkspaceState.ts`).
   - `targetedRepair.ts`: thực hiện hậu kiểm cục bộ riêng trên đoạn đã sửa (đúng 1 đoạn đơn, 0 dấu câu CJK, không làm mất cặp ngoặc thoại vốn có của `primarySourcePara`).
   - `qualityEvaluator.ts`: siết `checkParagraphParityPassed` sang khớp chính xác 1-1 số đoạn thân bài.

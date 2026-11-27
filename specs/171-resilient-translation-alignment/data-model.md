# Data Model: Ổn Định Dịch Thuật, Bảo Toàn Cấu Trúc Đoạn & Chống Hoàn Tác Toàn Chương

**Feature**: `171-resilient-translation-alignment` | **Date**: 2026-11-28

> **Nguyên tắc Hiến pháp IV**: Không thay đổi schema cốt lõi trong `src/types.ts` và IndexedDB `src/services/db.ts`. Toàn bộ cấu trúc dưới đây là các hợp đồng dữ liệu in-memory/bổ sung tùy chọn ở tầng service (`src/services/translation/`, `src/services/ai/`, `src/services/chapterTranslationService.ts`).

---

## 1. Anchored Paragraph Unit (`src/services/translation/paragraphAnchor.ts`)

| Field / Type | Kind | Description |
|---|---|---|
| `AnchoredParagraphEncoding` | Object | `{ encodedText: string; expectedCount: number; sourceParagraphs: string[] }` |
| `AnchoredParagraphParseResult` | Object | Kết quả giải mã phản hồi AI theo nhãn neo `<<Pk>>` |
| `paragraphs` | `string[]` | Danh sách đoạn đã tách sạch nhãn neo `<<Pk>>`, giữ đúng trật tự `0..N-1` khi khớp neo |
| `usedAnchors` | `boolean` | `true` nếu AI giữ lại ít nhất 1 thẻ `<<Pk>>` hợp lệ; `false` để fallback về tách dòng thông thường |
| `missingIndices` | `number[]` | Các chỉ số `0`-based (`1..N` ở nhãn) không tìm thấy trong phản hồi AI |
| `duplicateIndices` | `number[]` | Các chỉ số xuất hiện lặp lại từ 2 lần trở lên |
| `extraCount` | `number` | Số đoạn vượt ngoài khoảng `1..N` hoặc đoạn lạc ngoài thẻ neo |

**Validation & Invariants**:
- Nhãn neo dùng định dạng `<<P1>>`, `<<P2>>`, ..., `<<PN>>` ở đầu đoạn: không chứa ký tự Hán (`HAN_CHAR_RE`), không dùng dấu `[...]` (tránh đụng chú thích `[Tên_Việt]`).
- `stripParagraphAnchors(text)` phải bảo đảm trả về 0% ký tự thẻ `<<P\d+>>` trong bản dịch cuối cùng lưu xuống DB.

---

## 2. Paragraph-Level Polish Fidelity Merge (`src/services/translation/types.ts`)

| Entity / Field | Type | Description |
|---|---|---|
| `ParagraphMergeReversion` | Object | `{ paragraphIndex: number; reasons: string[] }` — ghi nhận đoạn cụ thể bị giữ nguyên từ lượt `K-1` cùng lý do tiếng Việt |
| `PolishParagraphMergeResult` | Interface (extends `PolishFidelityReport`) | Hợp nhất kết quả hậu kiểm từng đoạn: |
| `mergedPolishedText` | `string` | Văn bản sau hợp nhất cấp đoạn (nối giữ nguyên thứ tự đoạn `0..N-1`) |
| `acceptedParagraphCount` | `number` | Số đoạn được nhận bản chuốt mới từ lượt `K` |
| `revertedParagraphs` | `ParagraphMergeReversion[]` | Danh sách đoạn hoàn tác cục bộ về bản lượt `K-1` |
| `isCatastrophicRollback` | `boolean` | `true` khi sụp đổ cấu trúc toàn chương, cắt cụt hoặc `revertedParagraphs.length / totalParagraphs > 0.4` |

**State Transitions (Mỗi lượt chuốt văn `j`)**:
1. **Clean Accept (`isAcceptable === true`, `revertedParagraphs.length === 0`)**: Nhận 100% `candidatePolished`, tiếp tục lượt `j + 1` hoặc hội tụ.
2. **Selective Paragraph Merge (`isAcceptable === true`, `revertedParagraphs.length > 0`, `!isCatastrophicRollback`)**: Nhận `mergedPolishedText` (giữ mọi đoạn cải thiện đạt chuẩn, chỉ hoàn tác riêng các đoạn trong `revertedParagraphs` kèm log lý do tiếng Việt), tiếp tục lượt `j + 1` hoặc kiểm tra hội tụ trên `mergedPolishedText`.
3. **Catastrophic Whole-Chapter Rollback (`!isAcceptable`, `isCatastrophicRollback === true`)**: Khôi phục toàn bộ `previousDraft` và dừng sớm chu trình chuốt để bảo vệ tính toàn vẹn chương.

---

## 3. Stage Compliance Handoff & Context Extensions (`src/services/translation/types.ts`)

| Extension Target | Field | Type | Purpose |
|---|---|---|---|
| `DirectRawTranslationParams` | `rawSourceText` | `string?` | Chuỗi tiếng Trung gốc (`chapter.sourceText`) dùng cho `selectRelevantGlossary` khi `text` truyền vào là `processedSourceText` |
| `DirectRawTranslationParams` | `useParagraphAnchors` | `boolean?` | Bật/tắt đóng gói nhãn neo `<<Pk>>` (mặc định bật cho toàn khối >= 2 đoạn khi không ở chế độ segment đơn lẻ) |
| `DirectPolishTranslationParams` | `complianceIssuesToFix` | `DirectQaCritiqueIssue[]?` | Danh sách lỗi tuân thủ phát hiện sau GĐ1 (`terminology`, `pronoun`, `raw_leak`) bàn giao cho GĐ2 Lượt 1 sửa mục tiêu |
| `DirectPolishTranslationParams` | `useParagraphAnchors` | `boolean?` | Bật đóng gói cặp nhãn neo `<<Pk>>` khi chuốt văn |
| `TargetedParagraphRepairResult` | `rejectionReasons` | `Record<number, string>?` | Bản đồ `paragraphIndex -> lý do tiếng Việt cụ thể` cho mỗi đoạn bị từ chối sau tối đa 1 lượt thử lại |
| `TargetedParagraphRepairResult` | `recoveredOmissionCount` | `number?` | Số đoạn gốc bỏ sót được phục hồi thành công trong bước Sửa đoạn QA |

---

## 4. Chapter Failure & Queue Reconciliation (`src/services/chapterTranslationService.ts`, `src/hooks/useTranslationProcess.ts`)

| Field on `ProcessChapterResult` | Type | Semantics |
|---|---|---|
| `unresolvedCriticalCount` | `number?` | Tổng số lỗi `severity === 'critical'` và chưa `repaired` còn lại sau bước Sửa đoạn QA |
| `unresolvedIssueSummary` | `string?` | Chuỗi tóm tắt ngắn gọn theo nhóm lỗi còn tồn đọng (vd: `"2 thuật ngữ, 1 thiếu đoạn"`) |
| `hasPartialFallback` | `boolean?` | `true` nếu có đoạn rơi xuống `fallbackSinoVietnameseLine` / nhánh `isPartial` không khôi phục được |

**Failed Queue Reconciliation Rule**:
- `completedClean`: `result.success === true && (result.unresolvedCriticalCount ?? 0) === 0 && !result.hasPartialFallback` → loại bỏ `chapterId` khỏi `failedIds` của `translationQueueState`.
- `completedWithUnresolvedCritical`: giữ `chapterId` trong `failedIds` và ghi log tóm tắt `unresolvedIssueSummary` rõ ràng.
- `paused / aborted / quota exhausted / thrown error`: giữ nguyên hành vi lưu `failedIds` hiện có.

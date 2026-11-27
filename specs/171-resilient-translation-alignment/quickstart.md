# Quickstart Validation Guide: Feature 171

**Feature**: `171-resilient-translation-alignment` | **Date**: 2026-11-28

## Mục tiêu kiểm chứng

Xác nhận toàn bộ 5 nhóm nguyên nhân từ nhật ký dịch lỗi Chương 68–71 trên mô hình tốc độ cao đã được khắc phục mà không phát sinh lỗi hồi quy trên bộ test hiện có.

---

## 1. Kiểm thử đơn vị & tích hợp nhắm mục tiêu

Chạy bộ test dịch thuật cốt lõi (0 gọi API ngoài, chạy deterministic hoàn toàn):

```bash
npx vitest run \
  src/services/translation/__tests__/paragraphAnchor.test.ts \
  src/services/translation/__tests__/translationValidation.test.ts \
  src/services/translation/__tests__/targetedRepair.test.ts \
  src/services/translation/__tests__/bilingualSplit.test.ts \
  src/services/ai/__tests__/prompts.test.ts \
  src/services/__tests__/chapterTranslationService.test.ts \
  src/hooks/__tests__/useTranslationProcess.test.ts
```

### Các kịch bản bắt buộc xác nhận

1. **US1 — Neo đoạn 1-1 & Chặn bỏ sót/gộp đoạn**:
   - Đưa 40–60 đoạn nguồn qua `encodeAnchoredParagraphs` -> giả lập phản hồi AI chứa `<<P1>>`..`<<PN>>` (bao gồm 1–2 đoạn bị xuống dòng thừa bên trong) -> `parseAnchoredParagraphs` phục hồi đúng `N` đoạn và `stripParagraphAnchors` xóa sạch 100% nhãn neo.
   - Giả lập thiếu 1–2 nhãn (`missingIndices`) -> `rawTranslation` phát hiện đúng vị trí thiếu và khôi phục phẫu thuật thay vì trượt sang lệch `33/40`.
2. **US2 — Hợp nhất chuốt văn theo từng đoạn (Không hoàn tác oan toàn chương)**:
   - Đưa 40 đoạn chuốt lượt 2 có 38 đoạn mượt mà hơn và 2 đoạn suy giảm (1 đoạn mất ngoặc thoại, 1 đoạn sót thuật ngữ từ điển) qua `evaluateAndMergePolishRound`.
   - Xác nhận: `isAcceptable === true`, `isCatastrophicRollback === false`, `acceptedParagraphCount === 38`, `revertedParagraphs` dài `2` (đúng 2 chỉ số đoạn lỗi kèm lý do tiếng Việt), và `mergedPolishedText` giữ nguyên 38 đoạn mới + 2 đoạn cũ.
   - Xác nhận khi có suy giảm thảm họa (> 40% đoạn hỏng hoặc cắt cụt nặng), `isCatastrophicRollback === true` và hoàn tác toàn chương như cũ.
3. **US3 — Từ điển trên `processedSourceText` & Bàn giao lỗi GĐ1 → GĐ2**:
   - Kiểm chứng `buildRawTranslationPayload` với `processedSourceText` + `rawSourceText`: vẫn nạp đủ mục từ điển và `CharacterProfile` liên quan mà không tạo chú thích kép dư chữ Hán.
   - Kiểm chứng `buildPolishTranslationPayload` Lượt 1 nhận đầy đủ `complianceIssuesToFix` khi GĐ1 còn lỗi tuân thủ.
4. **US4 — Sửa đoạn QA có 1 lượt nhắc lại & phục hồi đoạn thiếu**:
   - Mô phỏng đoạn 39 bị mất ngoặc thoại: lần sửa 1 vẫn quên `"..."`, hệ thống tự gọi lại tối đa 1 lượt kèm phản hồi thiếu ngoặc thoại và sửa thành công.
   - Mô phỏng lỗi vẫn bị từ chối sau 1 lượt thử lại → `rejectionReasons[pIdx]` có lý do tiếng Việt rõ ràng thay vì thông báo chung chung.
   - Mô phỏng lỗi `omission` thiếu nguyên 1 đoạn gốc → phục hồi chèn đúng vị trí.
5. **US5 — Dọn hàng đợi chương lỗi (`failedIds`)**:
   - Chạy mô phỏng hàng đợi có 2 chương lỗi trước đó: 1 chương sửa sạch 0 critical sau QA, 1 chương vẫn còn critical. Xác nhận `translationQueueState.failedIds` chỉ còn đúng 1 chương chưa sạch.

---

## 2. Toàn bộ cổng chất lượng bắt buộc (Constitution I)

```bash
npm run lint
npm test
npm run build
```

Kiểm tra ranh giới schema cốt lõi sau khi hoàn tất:

```bash
git status -s -- src/
```

Xác nhận `src/types.ts` và `src/services/db.ts` hoàn toàn không thay đổi.

# Phase 0 Research: Ổn Định Dịch Thuật, Bảo Toàn Cấu Trúc Đoạn & Chống Hoàn Tác Toàn Chương

**Feature**: `171-resilient-translation-alignment` | **Date**: 2026-11-28

## Phân tích nguyên nhân gốc rễ từ nhật ký thực tế (`gemini-3.5-flash-lite`)

Từ nhật ký chạy lại 4 chương lỗi (Chương 68–71), kết hợp kiểm tra trực tiếp mã nguồn hiện hành:
1. `src/services/translation/rawTranslation.ts` & `src/services/translation/polishTranslation.ts`:
   - Dù prompt đã nhắc "Xuất đúng N đoạn văn", payload vẫn gửi văn bản phẳng không có mã neo đoạn (`<<P1>>`..`<<PN>>`), khiến mô hình nhẹ dễ gộp đoạn ngắn, tách câu thành dòng riêng (`56 vs 55`) hoặc bỏ sót nguyên đoạn dài (`33 vs 40`).
   - Khi `callRawDirectCore` / `callPolishDirectCore` gặp `UNTRANSLATED_CHINESE_LEFTOVER` hoặc `PARAGRAPH_STRUCTURE_DIVERGENCE`, chiến lược hiện tại lập tức **chia đôi toàn bộ đoạn/chương** tới `maxDepth = 3` (tới 7–15 lượt gọi API con) và khi retry (`isRetry = true`) lại bỏ qua `validateStrictStructureParity`, để lọt lệch đoạn tới tận QA cuối hoặc rơi vào `fallbackSinoVietnameseLine`.
2. `src/services/translation/translationValidation.ts` (`evaluatePolishRoundFidelity`) & `src/services/chapterTranslationService.ts`:
   - `evaluatePolishRoundFidelity` đánh giá theo kiểu all-or-nothing ở cấp toàn chương: chỉ cần 1–2 đoạn trong 55 đoạn có `GLOSSARY_REGRESSION`, `PARAGRAPH_STRUCTURE_DIVERGENCE`, hoặc `STRUCTURE_PARITY_REGRESSION`, toàn bộ bản chuốt lượt đó bị vứt bỏ và vòng lặp chuốt dừng sớm (`break`).
3. `src/services/ai/prompts.ts` & `src/services/chapterTranslationService.ts`:
   - Khi `chapter.processedSourceText` đã được thay sẵn dấu `[Tên_Việt]`, `selectRelevantGlossary(cleanText, sanitizedGlossary)` trong `buildRawTranslationPayload` quét trên chuỗi đã thay chữ Hán nên các mục đã thay thế không còn khớp chữ Hán gốc để nạp quy tắc đầy đủ (`pinyin`, `characterProfile`, `note`), còn trường hợp tên chưa xử lý sạch dễ làm model nhẹ chép sót chữ Hán cạnh tên Việt.
   - Sau GĐ1, `rawComplianceIssues` chỉ dùng để ghi 1 dòng log cảnh báo (`Phát hiện 13 điểm lệch...`), hoàn toàn **không được truyền** vào `polishTranslationDirect` ở GĐ2 Lượt 1.
4. `src/services/translation/targetedRepair.ts`:
   - Chỉ gọi AI đúng 1 lần cho mỗi đoạn lỗi nghiêm trọng; nếu bản sửa mắc một lỗi hình thức nhỏ (vd quên giữ ngoặc thoại `"` trong đoạn thoại) thì bị từ chối thẳng với thông báo chung chung `"không đạt kiểm tra an toàn"`. Ngoài ra chưa có đường phục hồi khi lỗi `omission` báo thiếu hẳn 1 đoạn văn gốc khiến tổng số đoạn bị lệch (`33/40`).
5. `src/hooks/useTranslationProcess.ts`:
   - Dòng 484–485 luôn lấy union `[...existingFailedIds, ...accumulatedFailedIds, ...batchFailedIds]` mà **không trừ** các chương đã xử lý thành công sạch trong `batchCompletedChapterIds`, khiến các chương đã được sửa hoàn chỉnh vẫn nằm vĩnh viễn trong `translationQueueState.failedIds` và cuối phiên vẫn báo `Có 4 chương lỗi`.

---

## 6 Quyết định kỹ thuật cốt lõi

### Decision 1: Mã neo đoạn tường minh `<<P1>>`..`<<PN>>` tương thích ngược schema JSON
- **Decision**: Tạo module thuần `src/services/translation/paragraphAnchor.ts` cung cấp `encodeAnchoredParagraphs`, `parseAnchoredParagraphs` và `stripParagraphAnchors`. Trước khi gửi GĐ1/GĐ2 (khi có từ 2 đoạn trở lên và bật chế độ neo), gắn nhãn `<<P1>>`, `<<P2>>`, ... ở đầu mỗi đoạn không rỗng; vẫn giữ nguyên schema JSON `rawTranslation: string` / `polishedTranslation: string`. Khi nhận phản hồi, phân tích ánh xạ theo đúng chỉ số `<<Pk>>` (`1..N`) và gỡ sạch toàn bộ marker `<<Pk>>` trước khi trả về.
- **Rationale**:
  - Giữ nguyên JSON schema giúp không phá vỡ toàn bộ mock/test hiện tại và nhẹ hơn đáng kể so với mảng object JSON với model `flash-lite`.
  - Dùng `<<Pk>>` (không dùng `[...]` để không đụng cú pháp chú thích từ điển `Chữ_Hán[Tên_Việt]`, và không chứa chữ Hán để không kích hoạt bộ đếm sót chữ Hán).
  - Nếu AI trả thiếu thẻ (vd thiếu `<<P24>>`), hệ thống biết chính xác chỉ số đoạn nào bị sót ngay lập tức; nếu model bỏ toàn bộ thẻ (hoặc test mock cũ không có thẻ), fallback liền mạch về `splitParagraphsPreservingOrder` + `realignParagraphStructure`.
- **Alternatives considered**: Đổi JSON schema sang `paragraphs: string[]` (bị loại vì làm thay đổi contract của mọi mock/service và dễ lỗi parse cắt cụt giữa chừng trên `flash-lite`).

### Decision 2: Sửa phẫu thuật theo đoạn ở GĐ1 trước khi chia đôi đệ quy & giữ Parity khi retry
- **Decision**: Trong `src/services/translation/rawTranslation.ts`, khi `callRawDirectCore` trả về bản dịch khớp số đoạn 1-1 nhưng ném lỗi `UNTRANSLATED_CHINESE_LEFTOVER` (do chỉ 1–4 đoạn còn sót chữ Hán) hoặc khi `parseAnchoredParagraphs` chỉ thiếu 1–3 đoạn xác định (`missingIndices`), thực hiện tối đa 1 lượt **sửa phẫu thuật cục bộ** cho đúng các đoạn thiếu/sót chữ Hán (đẩy lên `1–2` lượt API nhỏ thay vì chia đôi đệ quy 3 cấp `7–15` lượt gọi rồi tụt xuống phiên âm dự phòng). Đồng thời trên nhánh chia nhỏ retry (`isRetry = true`), vẫn chạy `validateStrictStructureParity` trên phần con sau khi `realignParagraphStructure` để không để lọt lệch đoạn.
- **Rationale**: Ngăn chặn triệt để chuỗi sự cố `Cứu nguy GĐ1 cấp 1 -> cấp 2 -> cấp 3 -> Phiên âm dự phòng` khi phần lớn chương đã dịch tốt.
- **Alternatives considered**: Tăng `maxDepth` lên 4–5 (bị loại vì làm nổ chi phí RPM và tăng nguy cơ timeout).

### Decision 3: Đánh giá và hợp nhất độ trung thành GĐ2 ở cấp độ từng đoạn (`evaluateAndMergePolishRound`)
- **Decision**: Bổ sung hàm `evaluateAndMergePolishRound` vào `src/services/translation/translationValidation.ts` (giữ nguyên `evaluatePolishRoundFidelity` cũ để tương thích ngược tuyệt đối). Khi bản chuốt `candidatePolished` căn chỉnh được 1-1 với `previousDraft` và `sourceText`:
  - Kiểm tra từng cặp đoạn `(sourcePara, prevPara, candPara)`: tuân thủ từ điển (`checkGlossaryCompliance`), tên riêng mới ngoài nguồn (`detectUngroundedProperNouns` từ lượt 2+), không sót dấu câu CJK, không mất dấu ngoặc thoại trực tiếp, và không suy giảm điểm phạt dấu câu so với bản trước.
  - Mọi đoạn đạt chuẩn → nhận bản chuốt mới; chỉ những đoạn suy giảm → giữ lại `prevPara` kèm lý do tiếng Việt cụ thể.
  - Chỉ đánh dấu `isCatastrophicRollback = true` (hoàn tác toàn chương và dừng sớm) khi: không thể căn chỉnh số đoạn với `previousDraft`, tỷ lệ đoạn bị hoàn tác vượt ngưỡng `> 40%`, không có đoạn nào được chấp nhận mà vẫn có suy giảm, hoặc suy giảm/cắt cụt nghiêm trọng.
- **Rationale**: Giải quyết tận gốc hiện tượng 1–2 đoạn sai dấu câu hoặc sót từ điển làm hỏng toàn bộ công sức chuốt của 40–55 đoạn còn lại ở Chương 68, 70, 71.
- **Alternatives considered**: Nới lỏng toàn bộ ngưỡng `evaluatePolishRoundFidelity` (bị loại vì sẽ để lọt các đoạn bịa tên hoặc mất ngoặc thoại vào bản cuối).

### Decision 4: Khớp từ điển trên `rawSourceText` & bàn giao danh sách lỗi GĐ1 → GĐ2
- **Decision**:
  - Thêm `rawSourceText?: string` vào `DirectRawTranslationParams` và `BuildRawTranslationPromptParams`: khi dịch từ `chapter.processedSourceText`, `selectRelevantGlossary` quét trên `rawSourceText` (`chapter.sourceText`) để bảo đảm mọi từ điển và `CharacterProfile` vẫn được nạp đầy đủ dù phần thân bài đã có dấu `[Tên_Việt]`, đồng thời không chèn chú thích kép `Chữ_Hán[Tên_Việt]` lên đoạn đã có ngoặc `[...]`.
  - Thêm `complianceIssuesToFix?: DirectQaCritiqueIssue[]` vào `DirectPolishTranslationParams` và `BuildPolishTranslationPromptParams`: GĐ1 vừa chạy `runDeterministicTranslationChecks` xong, `chapterTranslationService.ts` truyền trực tiếp các lỗi `terminology` / `pronoun` / `raw_leak` (kèm cặp `[chinese] -> [vietnamese]`) vào GĐ2 Lượt 1.
- **Rationale**: Biến bước `[Kiểm tra tuân thủ GĐ1]` từ log thụ động thành chỉ dẫn sửa có mục tiêu cho GĐ2, cắt giảm mạnh chuỗi 8–13 lỗi lặp lại ở GĐ3.
- **Alternatives considered**: Thực hiện thay thế chuỗi thô từ điển bằng regex sau GĐ2 (bị loại vì phá vỡ ngữ pháp tiếng Việt và ngữ cảnh xưng hô).

### Decision 5: Tự động sửa đoạn QA có 1 lượt nhắc lại, phục hồi đoạn thiếu & lý do từ chối cụ thể
- **Decision**: Nâng cấp `repairChapterCriticalIssuesDirect` trong `src/services/translation/targetedRepair.ts`:
  - Khi bản sửa lần 1 của đoạn bị rớt kiểm tra cục bộ (mất ngoặc thoại, sót dấu câu CJK, hoặc còn thiếu thuật ngữ bắt buộc / sót chữ Hán mới), gọi thêm tối đa 1 lượt sửa phản hồi ghi rõ đúng ràng buộc vừa trượt.
  - Với lỗi `omission` nghiêm trọng mô tả đoạn văn gốc bị bỏ sót (`expectedParagraph` hoặc câu gốc trong nháy đơn ở `description`) khi `sourceParas.length > transParas.length`, hỗ trợ bước dịch chèn đoạn gốc bị bỏ sót vào đúng khe hở tương ứng nếu có thể xác định an toàn vị trí.
  - Trả về `rejectionReasons: Record<number, string>` giải thích rõ từng đoạn bị hoàn tác để `chapterTranslationService.ts` ghi log tường minh.
- **Rationale**: Cứu được các lỗi dễ sửa như Chương 69 Đoạn 39 (mất dấu ngoặc thoại) và Chương 70 (sót 1 đoạn văn gốc) mà trước đó bị hoàn tác mù mờ.
- **Alternatives considered**: Tăng lên 3–5 lượt sửa cho mỗi đoạn (bị loại vì tốn quota trên mô hình `flash-lite`).

### Decision 6: Đánh giá lại trạng thái chương lỗi chính xác sau QA & dọn `failedIds`
- **Decision**: Mở rộng `ProcessChapterResult` thêm `unresolvedCriticalCount?: number` và `hasPartialFallback?: boolean` (giữ `success: boolean` tương thích ngược), truyền xuống từ `chapterTranslationService.ts` dựa trên `detectedQaIssues` *sau khi đã chạy* `repairChapterCriticalIssuesDirect`. Tại `src/hooks/useTranslationProcess.ts`:
  - Chương hoàn tất mà `unresolvedCriticalCount === 0` và `!hasPartialFallback` → xóa ID khỏi `failedIds` của hàng đợi (`translationQueueState`).
  - Chương vẫn còn `unresolvedCriticalCount > 0` hoặc `hasPartialFallback === true` → giữ lại trong `failedIds` kèm log tóm tắt ngắn gọn số lỗi nghiêm trọng còn lại theo nhóm (`terminology`, `omission`/`addition`, `raw_leak`, `other`).
- **Rationale**: Khắc phục lỗi logic tích lũy `failedIds` một chiều trong `useTranslationProcess.ts` khiến người dùng chạy lại xong vẫn bị kẹt đúng danh sách `"Có 4 chương lỗi"`.
- **Alternatives considered**: Chỉ dựa vào trạng thái HTTP thành công để xóa khỏi `failedIds` (bị loại vì sẽ bỏ sót các chương thực sự còn lỗi nghiêm trọng không sửa được).

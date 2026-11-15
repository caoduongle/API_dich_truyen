# Repo Review: Chất lượng dịch truyện (đầu vào cho spec 163)

**Ngày rà soát**: 2026-11-15
**Phạm vi**: luồng dịch 3 giai đoạn (Dịch thô → Chuốt văn → QA) ở `src/services/ai/prompts.ts`, `src/services/translation/*`, `src/services/chapterTranslationService.ts`, `src/hooks/useTranslationProcess.ts`, `src/hooks/useWorkspaceState.ts`, `src/lib/text.ts`.

> Tài liệu này ghi lại **bằng chứng trong code** (fact đã đọc trực tiếp) làm cơ sở cho spec. Spec ([spec.md](./spec.md)) chỉ mô tả WHAT/WHY; chi tiết HOW để dành cho `/speckit-plan`.

Các nỗ lực trước (spec 113, 125, 157, 159, 162) tập trung vào **độ bền** (split/retry, chống cắt cụt, parity đoạn văn, validate schema). Chưa có spec nào nhắm vào **chất lượng ngữ nghĩa**: nhất quán xưng hô, ngữ cảnh liên tục, độ trung thành khi chuốt văn, độ phủ loại lỗi của QA.

## F1. Thay thế cứng từ điển có thể làm hỏng văn bản gốc (Fact)

- [prompts.ts#L81-L127](../../src/services/ai/prompts.ts#L81-L127): regex `terms.join('|')` thay mọi chuỗi con khớp bằng `[Tên_Việt]`, **không có ranh giới từ và không có ngưỡng độ dài tối thiểu**. Mục từ điển 1 ký tự (ví dụ họ `林` → "Lâm") sẽ thay vào giữa từ ghép (`森林` → `森[Lâm]`).
- Bước canonical (phồn/giản) ở L118-L126 cũng thay thế toàn cục không ranh giới.
- [rawTranslation.ts#L39-L64](../../src/services/translation/rawTranslation.ts#L39-L64) `fallbackSinoVietnameseLine` dùng `replaceAll` với cùng rủi ro.

## F2. Toàn bộ từ điển bị nhồi vào prompt dịch thô; QA cắt cứng 150 mục đầu (Fact)

- [prompts.ts#L62-L79](../../src/services/ai/prompts.ts#L62-L79): Giai đoạn 1 liệt kê **mọi** mục từ điển, kể cả mục không xuất hiện trong đoạn đang dịch → loãng sự chú ý, tốn hạn mức.
- [prompts.ts#L394-L397](../../src/services/ai/prompts.ts#L394-L397): QA lấy `slice(0, 150)` theo thứ tự lưu, **không theo mức liên quan** → với dự án lớn, thuật ngữ thực sự có trong chương có thể bị loại khỏi QA.
- Giai đoạn 2 thì đã lọc theo thuật ngữ xuất hiện (L325-L333) → hành vi không đồng nhất giữa các giai đoạn.

## F3. Gửi trùng văn bản nguồn & logic nhánh khó hiểu (Fact)

- [prompts.ts#L152-L168](../../src/services/ai/prompts.ts#L152-L168): `hasBrackets` kiểm tra trên văn bản **gốc** chứ không phải bản đã thay. Khi gốc không có ngoặc nhưng có thuật ngữ được thay, prompt gửi **cả bản gốc lẫn bản đã đánh dấu** → gấp đôi lượng văn bản nguồn.

## F4. Chỉ dẫn hệ thống Giai đoạn 1 bị lỗi cấu trúc (Fact)

- [prompts.ts#L138-L145](../../src/services/ai/prompts.ts#L138-L145): mục "6. Phong cách thể loại" bị chèn **giữa** nội dung của mục 5 (phần "Trích xuất chúng và điền vào trường 'vietnamese'..." là hướng dẫn của mục 5); mục 7, 8, 9 bị nối liền không xuống dòng → chỉ dẫn mơ hồ cho model.

## F5. Không có ngữ cảnh liên tục giữa các phân đoạn và giữa các chương (Fact)

- [rawTranslation.ts#L215-L250](../../src/services/translation/rawTranslation.ts#L215-L250) và [polishTranslation.ts#L173-L221](../../src/services/translation/polishTranslation.ts#L173-L221): chương dài bị tách và mỗi phân đoạn được dịch **độc lập** (song song tối đa 2), không có đoạn ngữ cảnh trước/sau → dễ lệch xưng hô, ngôi kể ở ranh giới.
- [chapterTranslationService.ts#L146-L156](../../src/services/chapterTranslationService.ts#L146-L156): mỗi chương chỉ nhận `genre/tone/description/glossary`; **không có** thông tin chương trước (đoạn kết, ai đang nói chuyện với ai, cách xưng hô đã thiết lập).

## F6. Không có hồ sơ nhân vật (giới tính, xưng hô) (Fact)

- `GlossaryItem` ([types.ts](../../src/types.ts)) chỉ có `chinese/pinyin/vietnamese/type/note/variants`; giới tính & quy tắc xưng hô chỉ có thể nằm trong `note` tự do.
- Prompt dịch thô yêu cầu "phân biệt hắn/nàng theo giới tính quy định" ([prompts.ts#L136](../../src/services/ai/prompts.ts#L136)) nhưng không có nguồn dữ liệu giới tính có cấu trúc.

## F7. Chỉ dẫn mặc định của Giai đoạn 2 khuyến khích "thêm thắt" (Fact)

- [chapterTranslationService.ts#L295](../../src/services/chapterTranslationService.ts#L295) và [prompts.ts#L317](../../src/services/ai/prompts.ts#L317): mặc định "Hãy tối ưu ngữ điệu mượt mà, **bay bổng nhất có thể**" → đẩy model về phía văn hoa, dễ thêm ý không có trong nguồn.
- Kiểm tra sau chuốt văn chỉ gồm: tỉ lệ độ dài, số đoạn, tỉ lệ chữ Hán ([polishTranslation.ts#L134-L137](../../src/services/translation/polishTranslation.ts#L134-L137)). **Không có** kiểm tra độ trung thành ngữ nghĩa (ví dụ: tên riêng mới không có trong nguồn, vi phạm từ điển).

## F8. Nhiệt độ theo lượt chuốt văn không được áp dụng như khai báo (Fact)

- `getPolishStrategyForRound` khai báo nhiệt độ 0.4/0.5/0.55/0.6 cho lượt 1–4 ([text.ts](../../src/lib/text.ts)), nhưng [polishTranslation.ts#L65-L67](../../src/services/translation/polishTranslation.ts#L65-L67) dùng `roundIndex === 2 ? 0.5 : 0.3` và caller không truyền `temperature` → `strategy.temperature` không được dùng; lượt 3–4 chạy 0.3.
- Lượt 2–4 yêu cầu "thay Hán-Việt bằng thuần Việt giàu hình ảnh" nhưng chỉ đối chiếu với **bản lượt trước**, nên sai lệch có thể tích lũy qua nhiều lượt; hội tụ chỉ đo độ giống giữa 2 lượt liền kề ([chapterTranslationService.ts#L357-L371](../../src/services/chapterTranslationService.ts#L357-L371)).

## F9. QA thiếu loại lỗi quan trọng và không có vòng sửa (Fact)

- Schema QA ([prompts.ts#L454-L458](../../src/services/ai/prompts.ts#L454-L458)) chỉ có `omission | addition | repetition | terminology | other`. **Không có** `mistranslation` (sai nghĩa) và `pronoun/xưng hô` — trong khi bộ kiểm tra Hako (`src/types/hakoChecker.ts`) đã có `mistranslation`, `pronoun_gender`.
- Kết quả QA chỉ được log và lưu ([chapterTranslationService.ts#L397-L437](../../src/services/chapterTranslationService.ts#L397-L437)); sửa lỗi chỉ thủ công từng câu qua `rewriteSentenceDirect` trong `UnifiedAuditPanel`.
- Không có kiểm tra **tất định** (không cần AI) việc tuân thủ từ điển: "thuật ngữ X có trong nguồn → bản dịch phải chứa dạng Việt Y".

## F10. Hai đường dịch xử lý thực thể phát hiện khác nhau (Fact, ưu tiên thấp)

- Batch ([chapterTranslationService.ts#L214-L222](../../src/services/chapterTranslationService.ts#L214-L222)) kiểm tra trùng theo cả chữ Hán và nghĩa Việt; workspace đơn chương ([useWorkspaceState.ts#L637-L639](../../src/hooks/useWorkspaceState.ts#L637-L639)) chỉ kiểm tra chữ Hán → có thể tạo hai nhân vật khác nhau cùng tên Việt.

## Hypotheses (chưa verify bằng dữ liệu thực)

- H1: F1 + F2 là nguyên nhân chính của lỗi "tên riêng/thuật ngữ sai hoặc câu bị vỡ" mà người đọc gặp.
- H2: F5 + F6 là nguyên nhân chính của "xưng hô nhảy loạn" giữa các đoạn/chương.
- H3: F7 + F8 làm tăng lỗi "thêm thắt" sau nhiều lượt chuốt văn.

Cần bộ mẫu đánh giá (User Story 6 trong spec) để đo baseline trước khi kết luận.

# Research: Toàn Diện Rà Soát & Khắc Phục Luồng Prompt Pipeline

**Feature Branch**: `113-verify-prompt-pipeline`  
**Date**: 2026-09-12  
**Status**: Completed  

---

## 1. Lưu trữ & Đồng bộ "Yêu cầu bổ sung khi biên tập" (`additionalInstructions`)

### Bối cảnh
Người dùng cần nhập các yêu cầu văn phong đặc thù (ví dụ: *"truyện tiên hiệp hãy làm cho câu từ bay bổng hơn"*, *"xưng hô tỷ muội thân mật"*). Hiện tại, trường này chỉ là `useState` cục bộ ở `AutoTranslator.tsx` và `BilingualEditor.tsx`, bị mất khi đổi tab, nạp lại trang hoặc chuyển chương.

### Quyết định kỹ thuật
- **Lựa chọn**: Lưu trữ `additionalInstructions` theo dự án trong `StoryProject` (IndexedDB) và đồng bộ qua hook `useWorkspaceState` / `useProjects`. Đồng thời duy trì fallback tại `localStorage` theo key `novel_ai_polish_instructions_${projectId}` để đảm bảo tính sẵn sàng tức thời ngay cả khi dự án chưa kịp nạp xong metadata.
- **Lý do**:
  1. `StoryProject` là single source of truth của toàn bộ dữ liệu truyện trên client.
  2. Đồng bộ 2 chiều: Khi người dùng gõ ở AutoTranslator hoặc Workspace Editor, thay đổi được phản ánh đồng thời ở cả hai nơi.
  3. Giá trị mặc định khi để trống: `"Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết"` thống nhất giữa cả dịch đơn chương và dịch tự động.
- **Phương án thay thế đã đánh giá**:
  - *Chỉ lưu trong localStorage*: Dễ triển khai nhưng không đồng bộ khi người dùng export/import project file JSON hoặc đồng bộ qua Google Drive.
  - *Chỉ lưu trong React context*: Vẫn bị mất dữ liệu khi F5/reload trang.

---

## 2. Khắc phục triệt tiêu Từ điển khi áp dụng văn bản đã thế trước (`isGlossaryApplied` & `hasProcessedText`)

### Bối cảnh
Trong `useWorkspaceState.ts` (dòng 551, 650) và `chapterTranslationService.ts` (dòng 107, 215):
```typescript
glossary: isGlossaryApplied ? [] : activeProject.glossary
```
Khi người dùng kích hoạt "Áp dụng từ điển vào bản gốc" hoặc dịch tự động trên `processedSourceText`, `glossary` bị gán mảng rỗng `[]`. Hậu quả:
1. Giai đoạn 1: `buildRawTranslationPayload` in ra chuỗi `(Không có từ điển tùy chọn, dịch tự động dựa trên âm Hán-Việt phổ thông và ngữ cảnh)`. AI không biết loại thực thể (nhân vật, địa danh, chiêu thức) hay ghi chú vai trò.
2. Giai đoạn 2: `buildPolishTranslationPayload` bỏ qua hoàn toàn khối `[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]`.

### Quyết định kỹ thuật
- **Lựa chọn**: Luôn truyền bảng từ điển gốc (`activeProject.glossary` / `localGlossary`) vào cả Phase 1 và Phase 2 bất kể văn bản đã thế dấu ngoặc vuông `[Tên_Việt]` hay chưa.
- **Lý do**:
  1. Logic thay thế từ điển trong `buildRawTranslationPayload` là lũy kế an toàn (idempotent): các từ đã nằm trong ngoặc vuông `[...]` không bị thay thế lặp lại.
  2. AI cần xem bảng định nghĩa (loại thực thể, giới tính, vai trò, ghi chú bối cảnh) để chọn đại từ nhân xưng phù hợp trong tiếng Việt (hắn/nàng/lão/tiểu thư).
  3. Giai đoạn 2 cần bảng thống kê `[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]` để người chuốt văn bảo đảm không dịch đè danh từ riêng bằng từ thuần Việt ngô nghê.
- **Phương án thay thế đã đánh giá**:
  - *Chỉ truyền glossary ở Phase 1, Phase 2 bỏ qua*: Không giải quyết được việc người dùng chuốt văn phong trực tiếp (Re-polish).

---

## 3. Nâng cấp hiệu lực của "Giới thiệu tóm tắt / Quy tắc dịch" (`description`) trong Giai đoạn 2

### Bối cảnh
Trong `buildRawTranslationPayload` (Phase 1), `description` được đưa vào `systemInstruction` với quy tắc nghiêm ngặt:
```typescript
"\n9. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: " + description.trim()
```
Tuy nhiên, trong `buildPolishTranslationPayload` (Phase 2), `description` chỉ được đưa vào user prompt như một dòng ngắn: `Mô tả bối cảnh & phong cách: ${description}`. Ở giai đoạn biên tập văn học—nơi sắc thái xưng hô và phong cách truyện thực sự được gọt giũa—AI lại không có chỉ thị hệ thống cưỡng chế tuân thủ.

### Quyết định kỹ thuật
- **Lựa chọn**:
  1. Đưa `description` vào `systemInstruction` của `buildPolishTranslationPayload` với vị thế là điều khoản chỉ định bắt buộc:
     ```typescript
     description ? `\n8. BẮT BUỘC TUÂN THỦ NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ CỦA TRUYỆN:\n${description.trim()}` : ""
     ```
  2. Tại khối `prompt`, gắn nhãn rõ ràng:
     ```markdown
     [NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ ĐẶC THÙ TỪ CẨM NANG]
     ${description.trim()}
     ```
- **Lý do**: Đảm bảo các chỉ dẫn chi tiết của người dùng (như Hình 4: *"Tông giọng chủ đạo: U tối, lạnh lẽo, hồi hộp, pha chút châm biếm đen tối..."*) có hiệu lực chi phối tuyệt đối lên văn phong chuốt cuối cùng.

---

## 4. Bổ sung bối cảnh Truyện vào Kiểm định Chất lượng (QA Critique & Hako Audit)

### Bối cảnh
`buildQaCritiquePayload` và `hakoQualityEngine.ts` hiện chỉ đối chiếu thuần túy `sourceText` và `translatedText`. Khi truyện có quy tắc xưng hô riêng (ví dụ: bối cảnh Tây huyễn xưng hô *ngươi - ta*, hoặc nhân vật nữ xưng *lão nương*), QA AI dễ báo lỗi oan `pronoun_gender`. Ngược lại, vì không có từ điển, QA AI không thể kiểm tra lỗi `terminology`. Đồng thời, kết quả QA từ AutoTranslator bị trôi mất trên màn hình console/log mà không lưu vào chương.

### Quyết định kỹ thuật
- **Lựa chọn**:
  1. Mở rộng `BuildQaCritiquePromptParams` tiếp nhận thêm `genre`, `tone`, `description`, và `glossary`.
  2. Đưa danh sách thuật ngữ từ điển và quy tắc xưng hô vào prompt QA Critique để AI đối chiếu lỗi `terminology` và loại trừ cảnh báo giả về phong cách.
  3. Trong `chapterTranslationService.ts`, khi QA Critique chạy xong, gán `chapter.qaIssues = qaData.issues` trước khi lưu vào IndexedDB.
  4. Nâng cấp `rewriteSentenceDirect` tiếp nhận `genre` và `tone` để câu văn viết lại khớp giọng văn truyện.
- **Lý do**: Đồng bộ hoàn chỉnh giữa 3 khâu Dịch -> Biên tập -> Kiểm định, giúp Unified Audit Panel khai thác tối đa sức mạnh sửa lỗi tức thì.

---

## 5. Chuẩn hóa trích xuất và lọc thuật ngữ (Glossary Pipeline)

### Bối cảnh
Khi trích xuất thực thể ở Phase 2 (`discoveredEntities` trong `buildPolishTranslationPayload`), các hướng dẫn xử lý tên phương Tây (Athena, Guy) và đảo danh từ phân loại (*Trà Abbacchio*) chưa đầy đủ như ở Phase 1. Ngoài ra, popup tra cứu nhanh `fetchQuickDefinition` thiếu bối cảnh thể loại truyện.

### Quyết định kỹ thuật
- **Lựa chọn**:
  1. Tái sử dụng `buildEntityExtractionInstruction('extract')` trong prompt trích xuất thực thể Phase 2.
  2. Truyền `genre` vào `fetchQuickDefinition` để định hướng kết quả phiên âm Hán-Việt hay thuần Việt phù hợp thể loại (Tiên Hiệp vs Đô Thị).
  3. Đảm bảo cấu trúc JSON schema luôn đồng nhất chuẩn `OBJECT` và `ARRAY` tương thích tuyệt đối với Google Gemini API v1beta.

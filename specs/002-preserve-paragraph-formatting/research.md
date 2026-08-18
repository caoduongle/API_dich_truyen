# Research & Technical Decisions: Preserve Paragraph Layout in Translation

## 1. Root Cause Analysis (Phân Tích Căn Nguyên)

Sau khi rà soát toàn bộ luồng dữ liệu từ lúc gửi text tiếng Trung đến lúc nhận kết quả từ Gemini API và lưu vào IndexedDB:

1. **Thiếu ràng buộc phân đoạn trong AI System Instruction**:
   - Cả trong `server/controllers/translation/rawController.ts` và `server/controllers/translation/polishController.ts`, system instruction chỉ yêu cầu dịch sát nghĩa, tôn trọng glossary và phong cách văn học, nhưng **không hề có chỉ thị bắt buộc giữ nguyên phân đoạn**.
   - Gemini (đặc biệt khi nhận prompt kèm schema JSON) có khuynh hướng tối ưu hóa token và gộp tất cả các câu văn lại thành một chuỗi (paragraph) duy nhất, vô tình nối tiêu đề chương vào cùng dòng với câu văn mở đầu bằng dấu chấm (`Chương 1: Đài Phát Thanh Kinh Hoàng. Đôi môi đỏ thắm...`).

2. **Thuật toán Divide & Conquer ghép nối chunk thiếu ngắt đoạn**:
   - Trong `splitTextAdaptively`, khi chia văn bản thành các chunk nhỏ hơn 2500 ký tự và ghép lại sau khi AI dịch xong, các đoạn nối giữa các chunk có nguy cơ bị dính dòng cuối chunk trước với dòng đầu chunk sau nếu không dùng `\n\n` làm chất kết dính.

3. **Thiếu bộ lọc hậu xử lý tự động tách tiêu đề (Title Separation Post-Processor)**:
   - Khi AI lỡ trả về dạng `Chương X: [Tên]. [Câu mở đầu]`, hệ thống chấp nhận chuỗi này nguyên bản mà không có bước chuẩn hóa tách dòng.

## 2. Architectural Decisions (Quyết Định Kiến Trúc)

### Quyết định 1: Gia cố System Instruction & Framing Prompt
- Thêm điều khoản bắt buộc số 1 vào `LITERARY_TRANSLATION_FRAMING` trong `server/utils/text.ts` và trong `rawController.ts`, `polishController.ts`:
  ```text
  BẮT BUỘC BẢO TỒN NGUYÊN VẸN CẤU TRÚC PHÂN ĐOẠN (PARAGRAPH BREAKS):
  - Mỗi đoạn văn của nguyên tác tiếng Trung PHẢI tương ứng với một đoạn văn trong bản dịch tiếng Việt, ngăn cách nhau bằng dòng trống (\n\n).
  - TUYỆT ĐỐI KHÔNG nén các đoạn văn lại thành một khối văn bản duy nhất.
  - TIÊU ĐỀ CHƯƠNG PHẢI ĐỨNG RIÊNG BIỆT TRÊN MỘT DÒNG ĐẦU TIÊN, theo sau bởi 2 ký tự xuống dòng (\n\n) trước khi bắt đầu đoạn văn mở đầu.
  ```

### Quyết định 2: Xây dựng hàm Hậu xử lý `separateChapterTitleAndBody`
- Tạo hàm tiện ích `separateChapterTitleAndBody(translatedText: string): string` trong `server/utils/text.ts` và `src/utils/textCleaner.ts`:
  - Dò tìm nếu dòng đầu tiên có dạng `^(Chương\s+\d+[^:\n]*[:\.\-—]\s*[^\.\n]+)[\.\!\?]\s+([A-ZÀ-Ỹ0-9"“'‘].*)$`.
  - Tự động tách thành: `[Tiêu đề]\n\n[Câu mở đầu]`.

### Quyết định 3: Ghép nối an toàn trong Divide & Conquer
- Mọi thao tác join các phân đoạn dịch trong `translateRawWithContentSplit` và `translatePolishWithContentSplit` đều sử dụng `\n\n`.

## 3. Alternatives Considered

| Phương án | Ưu điểm | Nhược điểm | Đánh giá |
|---|---|---|---|
| Chỉ sửa CSS frontend `word-break` | Không chạm backend | Không giải quyết được bản chất dữ liệu trong DB bị dính liền | ❌ Không đạt yêu cầu |
| Dịch từng dòng đơn lẻ (Line-by-line) | Đảm bảo 100% dòng | Mất ngữ cảnh văn học, tốn API token gấp 5 lần | ❌ Không khả thi |
| Gia cố Prompt + Hậu xử lý Regex + D&C Join `\n\n` | Tối ưu token, văn phong mượt mà, phân đoạn chuẩn 100% | Cần kiểm thử regex cẩn thận | ✅ **Được chọn** |

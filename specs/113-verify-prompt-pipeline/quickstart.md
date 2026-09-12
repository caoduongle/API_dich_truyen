# Quickstart Validation Guide: Toàn Diện Rà Soát & Đồng Bộ Luồng Prompt Pipeline

**Feature Branch**: `113-verify-prompt-pipeline`  
**Date**: 2026-09-12  
**Status**: Ready for Implementation  

Tài liệu này hướng dẫn cách kiểm thử và xác minh toàn diện các luồng prompt trong hệ thống từ giao diện người dùng tới payload gửi tới Google Gemini API.

---

## 1. Tiền đề kiểm thử (Prerequisites)

- Node.js v18+ và npm.
- Ít nhất 1 khóa Google Gemini API Key còn hạn mức để kiểm thử mạng thực tế (hoặc chạy qua mock test suite trong Vitest).
- Cài đặt đầy đủ dependencies: `npm install`.

---

## 2. Kịch bản xác minh chức năng (Manual & Integration Scenarios)

### Kịch bản 1: Kiểm tra truyền dẫn Thể loại, Tông giọng và Quy tắc dịch (Phase 1 & Phase 2)

1. Khởi động ứng dụng: `npm run dev`.
2. Mở một dự án truyện hoặc tạo mới.
3. Nhấp vào tiêu đề truyện để mở modal **"Cấu hình & Chỉnh sửa thông tin Truyện"**:
   - Chọn **Thể loại chính**: `Linh Dị / Thần Quái` (Hình 2).
   - Chọn **Tông giọng biên dịch & biên tập**: `Kịch tính ly kỳ` (Hình 3).
   - Nhập vào **Giới thiệu tóm tắt / Quy tắc dịch**:
     ```markdown
     NGUYÊN TẮC DỊCH THUẬT
     ### 1. Giọng văn & Không khí
     - Tông giọng chủ đạo: U tối, lạnh lẽo, hồi hộp, pha chút châm biếm đen tối.
     ```
   - Nhấn **Lưu thay đổi**.
4. Mở một chương truyện và bấm **"Dịch thô" (Phase 1)**:
   - Mở DevTools Network / Console log hoặc xem log: Payload gửi tới Gemini chứa `Linh Dị / Thần Quái`, `Kịch tính ly kỳ`, và khối quy tắc dịch trong cả `systemInstruction` và `prompt`.
5. Bấm **"Chuốt văn phong" (Phase 2)**:
   - Payload chuốt văn chứa `description` trong `systemInstruction` (điều khoản 8) và prompt nhắc nhở giữ đúng tông giọng u ám kịch tính.

---

### Kịch bản 2: Kiểm tra lưu trữ & đồng bộ "Yêu cầu bổ sung khi biên tập"

1. Mở tab **Dịch tự động** (`AutoTranslator`).
2. Tại ô **"Yêu cầu bổ sung khi biên tập"** (Hình 1), nhập:
   `truyện tiên hiệp hãy làm cho câu từ bay bổng hơn`
3. Chuyển sang tab **Biên tập** (`Workspace`):
   - Quan sát ô "Yêu cầu biên tập đặc biệt" dưới khung bản dịch: Câu trên xuất hiện tự động và đồng bộ hoàn toàn.
4. F5 tải lại trang trình duyệt:
   - Mở lại cả 2 tab: Nội dung yêu cầu biên tập vẫn còn nguyên vẹn, không bị xóa trắng.
5. Bấm thực hiện chuốt văn:
   - Payload gửi tới AI Phase 2 chứa chính xác dòng `Yêu cầu dịch thuật bổ sung từ người dùng: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn`.

---

### Kịch bản 3: Kiểm tra tính năng "Áp dụng từ điển vào bản gốc" không làm mất từ điển

1. Trong dự án có sẵn ít nhất 2 thuật ngữ từ điển (ví dụ: `萧炎 -> Tiêu Viêm`).
2. Tại trình soạn thảo song ngữ, nhấn nút **"Áp dụng từ điển vào bản gốc"** để văn bản gốc xuất hiện `[Tiêu Viêm]`.
3. Bấm **Dịch thô** hoặc **Chuốt văn phong**:
   - Kiểm tra nội dung prompt gửi tới AI:
     - **Phase 1**: KHÔNG xuất hiện chuỗi `"(Không có từ điển tùy chọn...)"`. Bảng từ điển vẫn liệt kê đầy đủ `Tiêu Viêm` với ghi chú nhân vật.
     - **Phase 2**: Khối `[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]` vẫn thống kê đầy đủ các thuật ngữ xuất hiện trong đoạn kèm số lần.

---

### Kịch bản 4: Kiểm tra QA Critique bối cảnh và lưu trữ lỗi sau dịch tự động

1. Tại tab Dịch tự động, bật checkbox **"Kích hoạt kiểm định chất lượng AI trực tiếp (Critique Phase)"**.
2. Bấm dịch tự động một chương.
3. Khi tiến trình hoàn tất, mở chương đó tại tab **Biên tập song ngữ**:
   - Bảng **Unified Audit Panel** hiển thị đầy đủ danh sách các cảnh báo kiểm định phát hiện từ lượt dịch tự động mà không cần bấm quét lại thủ công.
4. Bấm nút **"Tự động sửa bằng AI" (Viết lại câu)** tại một lỗi:
   - Câu văn được viết lại tuân thủ đúng thể loại và tông giọng của truyện.

---

## 3. Lệnh kiểm thử tự động (Automated Verification Gates)

Chạy các lệnh bắt buộc theo Quy ước Hiến pháp dự án:

```powershell
# 1. Kiểm tra toàn vẹn kiểu dữ liệu TypeScript (không lỗi)
npm run lint

# 2. Chạy toàn bộ bộ test tự động (Vitest)
npm test

# 3. Kiểm tra đóng gói build production
npm run build
```

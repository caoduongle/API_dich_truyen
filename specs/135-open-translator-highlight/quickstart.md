# Quickstart: Hướng Dẫn Kiểm Thử Tính Năng Định Vị & Bôi Đen Đoạn Lỗi

**Feature**: `135-open-translator-highlight`  
**Date**: 2026-09-14  

---

## 1. Điều Kiện Tiên Quyết (Prerequisites)

- Ứng dụng đang chạy ở môi trường phát triển cục bộ (`npm run dev`) hoặc kiểm thử tự động.
- Dự án truyện có ít nhất một chương đã có bản dịch (thô hoặc chuốt) và có thẻ lỗi trong tab **Kiểm Định Hako** (ví dụ lỗi "Dịch sai nghĩa gốc" hoặc "Lặp lại câu chữ" như trong ảnh chụp màn hình).

---

## 2. Các Kịch Bản Kiểm Thử Bằng Tay (Manual Validation Scenarios)

### Kịch bản 1: Mở sửa đoạn lỗi từ thẻ Kiểm Định Hako (Luồng chính MVP)

1. Mở ứng dụng tại trình duyệt: `http://localhost:5173`.
2. Chuyển sang tab **"Kiểm Định Hako"** (phím tắt `Alt+6`).
3. Chọn một thẻ lỗi bất kỳ có hiển thị phần **"Trích đoạn bản dịch làm bằng chứng"** (ví dụ: thẻ lỗi có trích đoạn *"hắn há hốc mồm thở ra một ngàn khói trắng, gương mặt đờ đẫn ngẩn ngơ."*).
4. Nhấn nút **"Mở trong Bàn Dịch để sửa"** trên thẻ lỗi đó.
5. **Kết quả kỳ vọng**:
   - Ứng dụng lập tức chuyển sang tab **"Bàn Dịch"** (`translate`).
   - Chương truyện tương ứng được nạp đầy đủ.
   - Khung soạn thảo bên dưới tự động cuộn đến vị trí câu văn vi phạm.
   - Câu văn vi phạm được **bôi đen (native selection highlight)** hoàn toàn.
   - Xuất hiện thông báo toast xanh lá: *"Đã định vị đoạn lỗi trong bản dịch"*.
   - Người dùng chỉ cần gõ phím hoặc ấn Backspace là câu văn lỗi được thay thế/xóa ngay lập tức.

---

### Kịch bản 2: Mở sửa khi đang ở một chương khác (Kiểm chứng triệt tiêu Race Condition)

1. Tại tab **"Bàn Dịch"**, mở Chương 1.
2. Chuyển sang tab **"Kiểm Định Hako"**, tìm một thẻ lỗi thuộc Chương 2 hoặc Chương 3.
3. Bấm nút **"Mở trong Bàn Dịch để sửa"**.
4. **Kết quả kỳ vọng**:
   - Ứng dụng chuyển sang Bàn Dịch và nạp đúng nội dung của Chương mới.
   - Vùng chọn bôi đen xuất hiện chính xác trên nội dung của Chương mới, không bị báo lỗi "Không tìm thấy" do xung đột dữ liệu Chương 1 trước đó.

---

### Kịch bản 3: Xử lý trích đoạn có dấu ngoặc kép hoặc dấu ba chấm

1. Tìm hoặc giả lập một thẻ lỗi có `vietnameseSnippet` được bao bởi dấu ngoặc kép: `"đoạn trích văn bản..."`.
2. Bấm nút **"Mở trong Bàn Dịch để sửa"**.
3. **Kết quả kỳ vọng**:
   - Thuật toán tự động lược bỏ dấu ngoặc và bôi đen chính xác đoạn văn bản tương ứng trong ô soạn thảo.

---

## 3. Kiểm Thử Tự Động (Automated Testing)

Chạy các lệnh kiểm thử sau từ thư mục gốc của dự án:

```bash
# 1. Chạy unit tests cho tiện ích bôi chọn và định vị văn bản
npx vitest run src/utils/__tests__/textareaHighlight.test.ts

# 2. Chạy unit tests cho luồng mở từ HakoIssueCard và HakoIssueReviewPanel
npx vitest run src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx

# 3. Chạy toàn bộ test suite để đảm bảo không có hồi quy
npm test

# 4. Kiểm tra toàn vẹn kiểu tĩnh TypeScript
npm run lint

# 5. Kiểm tra build sản phẩm
npm run build
```

# Quickstart: Kiểm Thử Định Vị & Làm Nổi Bật Đoạn Lỗi Trong Bàn Dịch

**Feature**: `131-jump-to-issue-highlight`  
**Date**: 2026-09-13

---

## 1. Kịch Bản Kiểm Thử Thủ Công (Manual Verification Scenarios)

### Kịch bản 1: Mở thẳng đoạn lỗi từ Thẻ Lỗi Kiểm Định Hako
1. Khởi chạy ứng dụng: `npm run dev` và mở trình duyệt tại `http://localhost:5173`.
2. Mở dự án có các chương đã dịch.
3. Chuyển sang tab **Kiểm Định Hako** (`alt+6`), chọn một chương và bấm **Bắt đầu kiểm định** (hoặc mở phiên kiểm định có sẵn).
4. Tìm một thẻ lỗi có phần **Trích đoạn bản dịch làm bằng chứng**.
5. Nhấp nút **"Mở trong Bàn Dịch để sửa"** (`↗`).
6. **Kết quả mong đợi**:
   - Ứng dụng lập tức chuyển sang tab **Bàn Dịch** (`translate`).
   - Màn hình tự động cuộn đến vị trí đoạn lỗi.
   - Toàn bộ đoạn trích lỗi được bôi đen (selection) và ô textarea được đặt focus.
   - Hiển thị thông báo toast: *"Đã định vị đoạn lỗi trong bản dịch"*.

### Kịch bản 2: Đoạn trích lỗi có dấu ngoặc kép hoặc dấu ba chấm
1. Tại tab Kiểm Định Hako, tìm lỗi có snippet chứa dấu ngoặc kép `"..."` hoặc dấu ba chấm cuối câu `...`.
2. Nhấp nút **"Mở trong Bàn Dịch để sửa"**.
3. **Kết quả mong đợi**: Hệ thống tự động lược bỏ dấu bao quanh và bôi chọn chuẩn xác câu văn trong ô soạn thảo mà không báo lỗi.

### Kịch bản 3: Đoạn văn đã được sửa trước đó (văn bản không còn khớp)
1. Mở Bàn Dịch và sửa hoàn toàn câu văn có lỗi trong một chương.
2. Quay lại tab Kiểm Định Hako, tìm thẻ lỗi cũ của câu đó.
3. Bấm **"Mở trong Bàn Dịch để sửa"**.
4. **Kết quả mong đợi**: Hệ thống chuyển sang Bàn Dịch, giữ nguyên vị trí đầu trang và hiển thị thông báo toast: *"Không tìm thấy đoạn văn vi phạm trong bản dịch hiện tại, có thể nội dung đã được sửa."*.

---

## 2. Kịch Bản Kiểm Thử Tự Động (Automated Test Commands)

```bash
# Kiểm tra static typing
npm run lint

# Chạy unit tests cho tiện ích bôi chọn và deep link
npm test -- src/utils/__tests__/textareaHighlight.test.ts
npm test -- src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx

# Chạy toàn bộ test suite dự án
npm test

# Build kiểm tra đóng gói
npm run build
```

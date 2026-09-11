# Quickstart: Kịch Bản Xác Minh & Thử Nghiệm

**Feature**: `108-fix-hako-nav-button`
**Date**: 2026-09-11
**Purpose**: Cung cấp các kịch bản chạy thử độc lập để kiểm chứng khả năng hiển thị và tiếp cận của nút "Kiểm Định Hako".

## 1. Môi Trường & Lệnh Chạy Kiểm Tra Tự Động

Chạy toàn bộ các bài kiểm tra tự động trước và sau khi thực hiện:

```bash
# 1. Kiểm tra Typecheck
npm run lint

# 2. Kiểm tra toàn bộ Unit & Component Test Suites
npm test

# 3. Kiểm tra Build Production
npm run build
```

---

## 2. Kịch Bản Xác Minh Bằng Trực Quan (Manual / Visual Verification)

### Kịch Bản 1: Kiểm tra độ rộng 1280px - 1440px (Laptop tiêu chuẩn)
- **Chuẩn bị**: Khởi chạy ứng dụng `npm run dev` và mở trình duyệt ở kích thước 1366x768 hoặc 1280x800.
- **Thực hiện**: Chọn một dự án có sẵn dữ liệu (ví dụ: "Đài Phát Thanh Kinh Dị").
- **Kỳ vọng**:
  - Cả 6 nút tab từ "Dịch Thuật" đến "Kiểm Định Hako" đều xuất hiện trọn vẹn trên thanh tab.
  - Nút "Kiểm Định Hako" `#tab-hako-checker` nằm hoàn toàn trong tầm nhìn, không bị tràn ra ngoài biên phải hay bị che khuất bởi khối tên truyện.
  - Click vào nút "Kiểm Định Hako": Màn hình chuyển vào không gian Kiểm Định Hako thành công.

### Kịch Bản 2: Kiểm tra màn hình hẹp & Menu "Thêm ▾" (< 1200px)
- **Chuẩn bị**: Co hẹp cửa sổ trình duyệt xuống 1024px hoặc chế độ chia đôi màn hình.
- **Thực hiện**:
  - Quan sát mép phải thanh tab.
  - Click vào nút "Thêm ▾" (`#nav-more-menu-btn`).
- **Kỳ vọng**:
  - Nút "Thêm ▾" hiển thị rõ ràng, không bị ẩn.
  - Khi mở menu, mục "Kiểm Định Hako (Alt+6)" có mặt với biểu tượng chiếc khiên `ShieldCheck`.
  - Click vào "Kiểm Định Hako" trong menu: Chuyển tab thành công và dải tab tự động cuộn nút `#tab-hako-checker` vào tầm nhìn.

### Kịch Bản 3: Kiểm tra phím tắt toàn cục `Alt+6`
- **Chuẩn bị**: Đang ở tab bất kỳ (ví dụ: "Dịch Thuật" hoặc "Quản Lý Truyện").
- **Thực hiện**: Nhấn tổ hợp phím `Alt+6`.
- **Kỳ vọng**:
  - Hệ thống lập tức chuyển sang phân vùng Kiểm Định Hako.
  - Tab "Kiểm Định Hako" được đánh dấu active (viền đỏ chu sa `border-polish`).
  - Nếu tab đang nằm ngoài biên cuộn, container tự động thực hiện `scrollIntoView` đưa tab vào giữa khung nhìn.


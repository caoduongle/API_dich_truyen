# Phase 1 Quickstart Validation Guide: Toàn Diện 20 Hạng Mục UI/UX

**Feature**: `084-ui-ux-optimization`  
**Date**: 2026-09-05  

---

## 1. Mục Đích Kiểm Thử

Tài liệu này cung cấp các kịch bản kiểm tra độc lập và toàn diện để xác minh 20 hạng mục tối ưu UI/UX đã hoàn tất và đáp ứng đầy đủ yêu cầu chất lượng.

---

## 2. Lệnh Kiểm Tra Chất Lượng Mã Nguồn (Bắt buộc)

```bash
# 1. Kiểm tra Type Safety (TypeScript compilation)
npm run lint

# 2. Chạy toàn bộ Test Suites (Vitest)
npm test

# 3. Kiểm tra Build Production Bundle (Vite + esbuild)
npm run build
```

---

## 3. Kịch Bản Kiểm Tra Giao Diện & Tương Tác (Manual Run-through)

### Kịch bản 1: Kiểm tra chống cuộn ngang & Mobile Hamburger Menu (Hạng mục 1, 3, 16, 20)
1. Mở trình duyệt Chrome DevTools (`F12` hoặc `Ctrl+Shift+I`), bật **Toggle Device Toolbar** (`Ctrl+Shift+M`).
2. Chọn kích thước **iPhone SE (375 x 667px)** và **iPhone 14 Pro (393 x 852px)**.
3. Cuộn trang lên xuống và sang hai bên:
   - **Kỳ vọng**: Trang web không có bất kỳ thanh cuộn ngang nào; `window.scrollX` luôn bằng 0.
4. Quan sát Header:
   - Nút Hamburger Menu hiển thị ở góc trái.
   - Nhấn nút Hamburger Menu: Ngăn kéo điều hướng trượt xuống mượt mà hiển thị 6 phân vùng.
   - Nhấn vào "Từ Điển Nhân Vật": Hệ thống chuyển sang phân vùng từ điển và ngăn kéo menu tự động đóng ngay lập tức.
5. Kiểm tra bảng `GlossaryTable`:
   - Bảng hiển thị trọn vẹn, có thể cuộn ngang mượt mà trong vùng bảng mà không đẩy rộng chiều ngang toàn trang.
6. Chạm vào ô tìm kiếm: Safari/Chrome không bị kích hoạt zoom màn hình (nhờ font-size 16px trên mobile).

---

### Kịch bản 2: Kiểm tra Favicon, Tiêu đề Động & Thẻ Meta SEO (Hạng mục 4, 5, 6)
1. Mở tab trình duyệt bất kỳ:
   - Quan sát tab trình duyệt: Favicon hiển thị ấn triện đỏ Chu Sa chữ `譯` sắc nét.
2. Chuyển đổi giữa các tab:
   - Khi ở tab Dịch: Tiêu đề là `[Tên Truyện] — Bàn Dịch Thuật | Bàn Biên Tập Bản Thảo Chu Sa`.
   - Khi ở tab Dự án: Tiêu đề là `Quản Lý Tiểu Thuyết | Bàn Biên Tập Bản Thảo Chu Sa`.
3. Nhấn `Ctrl+U` xem mã nguồn trang:
   - Thẻ `<meta name="description">` chứa nội dung giới thiệu chuẩn SEO.
   - Thẻ `<meta property="og:title">` và `<meta property="og:description">` tồn tại.

---

### Kịch bản 3: Kiểm tra Footer, Copyright Động, Mailto & Tel (Hạng mục 2, 7, 9, 18, 19)
1. Cuộn xuống chân trang (Footer):
   - Quan sát dòng bản quyền: Năm hiển thị chính xác là `new Date().getFullYear()`.
   - Kiểm tra các liên kết: Không có liên kết rỗng `href="#"`.
   - Nhấn vào link "Mã nguồn GitHub": Mở tab mới với `rel="noopener noreferrer"`.
   - Nhấn vào link "Liên hệ": Kích hoạt ứng dụng email với địa chỉ định dạng `mailto:`.
   - Nhấn vào số điện thoại hotline: Mở giao diện quay số cuộc gọi với định dạng `tel:`.

---

### Kịch bản 4: Kiểm tra Logo Clickable & Trang 404 (Hạng mục 8, 17)
1. Khi đang ở bất kỳ phân vùng nào (ví dụ Kiểm Định Hako hoặc Dự án):
   - Nhấp vào cụm Logo và ấn triện `譯` ở góc trái Header: Ứng dụng lập tức chuyển về Bàn Dịch chính (`translate`).
2. Kích hoạt trang lỗi 404:
   - Trang hiển thị con dấu `無` đỏ Chu Sa, thông điệp thân thiện và nút "Quay về Bàn Dịch Thuật" hoạt động chuẩn xác.

---

### Kịch bản 5: Kiểm tra Nút bấm, Toast Phản hồi & Bắt lỗi Form (Hạng mục 11, 12, 13, 14)
1. Mở modal "Cấu hình AI":
   - Bấm nút "Lưu & Đóng": Xuất hiện Toast màu xanh thành công "Đã lưu và áp dụng cấu hình AI thành công!".
2. Chuyển sang phân vùng "Từ Điển":
   - Bấm "Thêm từ khóa mới": Để trống từ gốc và nghĩa tiếng Việt rồi bấm Thêm.
   - **Kỳ vọng**: Xuất hiện viền đỏ Chu Sa trực quan quanh các ô bắt buộc kèm dòng cảnh báo lỗi rõ ràng.

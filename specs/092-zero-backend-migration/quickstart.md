# Quickstart & Verification Guide: Pure Client-Side SPA

**Feature**: `092-zero-backend-migration`  
**Date**: 2026-09-05  
**Spec**: [spec.md](./spec.md)

---

## 1. Development & Quality Gate Checks

Chạy các lệnh sau tại thư mục gốc để đảm bảo hệ thống hoàn toàn đạt tiêu chuẩn:

```bash
# 1. Kiểm tra Type & Cú pháp TypeScript (phải đạt 0 lỗi)
npm run lint

# 2. Chạy toàn bộ Test Suite (phải pass 100%)
npm test

# 3. Đóng gói Production tĩnh
npm run build
```

---

## 2. Kiểm Chứng Tính Độc Lập Zero Backend

### Kịch Bản 1: Không Có Bất Kỳ Request Nào Tới `/api/*`
1. Chạy lệnh kiểm tra mã nguồn:
   ```bash
   grep -rn "fetch('/api" src/
   grep -rn 'fetch("/api' src/
   ```
   *Kết quả mong đợi*: Cả 2 lệnh đều trả về rỗng (0 kết quả).

2. Khởi chạy preview tĩnh:
   ```bash
   npm run preview
   ```
   *Kết quả mong đợi*: Ứng dụng mở tại `http://localhost:4173`, tải thẳng vào Dashboard, không hiện modal đăng nhập mật khẩu site. Mở tab Network trong DevTools kiểm tra: Toàn bộ requests chỉ gồm static assets (`.js`, `.css`, `.svg`, `.json`).

### Kịch Bản 2: Kiểm Chứng Hạn Mức Quota Client-Side
1. Nhập API Key trong màn hình Cài đặt (`/settings`).
2. Mở Bảng Điều Khiển Hạn Mức (`/quota` hoặc QuotaPanel).
3. Thực hiện dịch thử 1 chương:
   - Các chỉ số RPM và TPM hiển thị biến thiên thời gian thực theo cửa sổ trượt 60 giây.
   - Thẻ trạng thái hiển thị `Healthy` màu xanh lá.
   - Không có request nào gọi tới `/api/quota-status` hay `/api/session-keys`.

### Kịch Bản 3: Kiểm Tra Tính Toàn Vẹn Của Bundle Tĩnh
1. Kiểm tra thư mục `dist/`:
   ```bash
   ls dist/
   ```
   *Kết quả mong đợi*:
   - Có `dist/index.html` tại root.
   - Có `dist/_headers` (sao chép từ `public/_headers`).
   - Có `dist/assets/*.js` và `dist/assets/*.css`.
   - Hoàn toàn KHÔNG có thư mục `dist/server/` hay bất kỳ file `.cjs` nào.

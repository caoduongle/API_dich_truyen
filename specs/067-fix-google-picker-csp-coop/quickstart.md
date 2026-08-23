# Quickstart: Google Picker CSP & COOP Verification

**Feature**: 067-fix-google-picker-csp-coop
**Date**: 2026-08-23

---

## 1. Automated Verification Commands

Chạy các lệnh kiểm thử sau:

```bash
# 1. Type check
npm run lint

# 2. Chạy test suite
npm test

# 3. Kiểm tra build production
npm run build
```

## 2. Header Output Verification

Khi gửi request HTTP tới server production:

```http
HTTP/1.1 200 OK
Cross-Origin-Opener-Policy: same-origin-allow-popups
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: *.googleusercontent.com; connect-src 'self' ws: wss: https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

## 3. Manual UI Flow Verification

1. Khởi động ứng dụng: `npm run dev` hoặc `npm run build && npm run preview`.
2. Mở trình duyệt và đăng nhập Google OAuth.
3. Bấm "Mở dự án được chia sẻ (Google Picker)".
4. Quan sát: Iframe Google Picker tải thành công và hiển thị giao diện duyệt thư mục mà không có lỗi CSP trong DevTools Console.
5. Chọn một thư mục và xác nhận ứng dụng nhận được `folderId` và `folderName`.

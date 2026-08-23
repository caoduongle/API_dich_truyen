# Quickstart: Security Headers Verification

**Feature**: 066-fix-coop-google-popup
**Date**: 2026-08-23

---

## 1. Automated Verification Commands

Chạy các lệnh kiểm thử sau:

```bash
# 1. Type check
npm run lint

# 2. Chạy test suite (đặc biệt là server/__tests__/securityHeaders.test.ts)
npm test

# 3. Kiểm tra build production
npm run build
```

## 2. Header Output Verification

Khi gửi request HTTP tới server production:

```http
HTTP/1.1 200 OK
Cross-Origin-Opener-Policy: same-origin-allow-popups
Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com; ... connect-src 'self' ws: wss: https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://apis.google.com; frame-src https://accounts.google.com; ...
```

## 3. Manual UI Flow Verification

1. Khởi động ứng dụng: `npm run dev`.
2. Mở trình duyệt tại `http://localhost:5173`.
3. Mở modal "Đồng bộ Google Drive" và bấm "Đăng nhập với Google".
4. Xác thực tài khoản trong popup Google.
5. Quan sát popup đóng lại và modal trong trang chính nhận token ngay lập tức, chuyển sang trạng thái đã đăng nhập kèm thông tin user (Avatar, Name, Email).

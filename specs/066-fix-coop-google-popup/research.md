# Research: Fix COOP and CSP for Google OAuth Popup

**Feature**: 066-fix-coop-google-popup
**Date**: 2026-08-23

---

## R1: Cross-Origin-Opener-Policy (COOP) and Popup Communication

**Decision**: Cấu hình `crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }` trong `helmet(...)`.

**Rationale**:
- Khi ứng dụng sử dụng `helmet()` mặc định hoặc `Cross-Origin-Opener-Policy: same-origin`, trình duyệt đặt trang chính vào một browsing context group hoàn toàn tách biệt.
- Khi người dùng bấm đăng nhập và GIS mở popup (`window.open`), `window.opener` bị đặt thành `null` hoặc bị ngắt kết nối `postMessage` cross-origin an toàn do chính sách `same-origin`.
- Kết quả là sau khi người dùng xác thực thành công trên Google OAuth, popup gửi kết quả về `window.opener` nhưng gặp lỗi hoặc bị nuốt ngầm, không kích hoạt callback trong ứng dụng.
- Giá trị `same-origin-allow-popups` cho phép trang giữ liên kết với các popup mà trang đó mở ra, giải quyết triệt để lỗi này mà vẫn bảo vệ trang khỏi việc bị nhúng hoặc mở ngoài ý muốn bởi các trang bên thứ ba độc hại.

---

## R2: Content Security Policy (CSP) Directives for Google Ecosystem

**Decision**: Cập nhật `connectSrc` trong `server.ts` bao gồm:
- `'self'`
- `ws:`
- `wss:`
- `https://accounts.google.com`
- `https://oauth2.googleapis.com`
- `https://www.googleapis.com`
- `https://apis.google.com`

Và đảm bảo `scriptSrc` và `frameSrc` đã có đầy đủ:
- `scriptSrc`: `["'self'", "https://accounts.google.com", "https://apis.google.com"]`
- `frameSrc`: `["https://accounts.google.com"]`

**Rationale**:
- GIS script nạp từ `accounts.google.com` và tương tác với các API của Google (`accounts.google.com`, `googleapis.com`, `apis.google.com`).
- Google Picker nạp script từ `apis.google.com` và gọi API `www.googleapis.com`.
- Thêm đầy đủ vào `connectSrc` phòng ngừa các network request (XHR / Fetch / Beacon) của GIS và Picker bị CSP chặn.

---

## R3: Unit Test Synchronization in `securityHeaders.test.ts`

**Decision**: Cập nhật helper `createTestApp` trong `server/__tests__/securityHeaders.test.ts` đồng bộ chính xác với `server.ts`, bổ sung test case xác thực header `cross-origin-opener-policy` là `same-origin-allow-popups` ở cả dev và prod, và kiểm tra CSP đầy đủ ở prod.

**Rationale**:
- Đảm bảo regression test luôn phản ánh đúng cấu hình bảo mật thực tế của server.

# Research: Fix Google Picker CSP & COOP

**Feature**: 067-fix-google-picker-csp-coop
**Date**: 2026-08-23

---

## R1: Google Picker Content Security Policy Requirements

**Decision**: Cập nhật toàn diện các directives trong CSP ở `server.ts` để Google Picker iframe có thể nạp tài nguyên và thực hiện network requests an toàn:

- **`frameSrc`**: `["https://drive.google.com", "https://docs.google.com", "https://accounts.google.com", "https://content.googleapis.com"]`
  - Google Picker tạo iframe nhúng từ `https://docs.google.com/picker` hoặc `https://drive.google.com`. Nếu thiếu `docs.google.com` và `drive.google.com`, trình duyệt sẽ chặn iframe với lỗi "Content Security Policy of your site blocks some resources".
- **`scriptSrc`**: `["'self'", "'unsafe-inline'", "https://apis.google.com", "https://accounts.google.com"]`
  - Cần `'unsafe-inline'` và `apis.google.com` cho `gapi.load('picker', ...)` và Google Identity Services.
- **`connectSrc`**: `["'self'", "ws:", "wss:", "https://www.googleapis.com", "https://accounts.google.com", "https://content.googleapis.com", "https://oauth2.googleapis.com", "https://apis.google.com"]`
  - Cho phép các lệnh fetch/XHR từ Picker API đến `content.googleapis.com` và `www.googleapis.com`.
- **`styleSrc`**: `["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://fonts.googleapis.com"]`
- **`fontSrc`**: `["'self'", "https://fonts.gstatic.com", "data:"]`
- **`imgSrc`**: `["'self'", "data:", "blob:", "https:", "*.googleusercontent.com"]`
  - Cần `*.googleusercontent.com` và `https:` để hiển thị thumbnail tệp/thư mục và avatar người dùng trong Picker.

---

## R2: Google Picker Origin Verification

**Decision**: Thêm `.setOrigin(window.location.origin)` vào `PickerBuilder` trong `src/services/googlePickerService.ts`.

**Rationale**:
- Google Picker sử dụng giao thức HTML5 `postMessage` để truyền dữ liệu giữa iframe Picker và trang chủ (host window).
- Nếu không cấu hình origin tường minh bằng `setOrigin`, Google Picker có thể từ chối phản hồi `Action.PICKED` hoặc gặp cảnh báo mismatch origin trên trình duyệt bảo mật cao.

---

## R3: Unit Test Synchronization

**Decision**: Đồng bộ `createTestApp` trong `server/__tests__/securityHeaders.test.ts` với đầy đủ các directives CSP mở rộng và cập nhật assertions để đảm bảo kiểm thử chính xác.

# Cấu hình COOP same-origin-allow-popups và hoàn thiện CSP cho Google OAuth Popup

**Feature**: Cấu hình header bảo mật `Cross-Origin-Opener-Policy: same-origin-allow-popups` và hoàn thiện Content-Security-Policy (CSP) để hỗ trợ callback xác thực qua popup của Google Identity Services (GIS).

**Status**: Draft
**Created**: 2026-08-23

---

## Problem Statement

Sau khi di chuyển sang Google Identity Services (GIS) Token Client (popup), quá trình đăng nhập Google gặp sự cố: người dùng mở popup Google OAuth, chọn tài khoản và cấp quyền thành công, popup đóng lại nhưng callback JavaScript trong ứng dụng chính không nhận được kết quả (bị ngắt kết nối ngầm).

Nguyên nhân kỹ thuật:
1. Server sử dụng thư viện `helmet` với cấu hình mặc định gửi header `Cross-Origin-Opener-Policy: same-origin` (COOP). Header này hướng dẫn trình duyệt cô lập browsing context của trang chính với các browsing context khác, làm đứt liên kết `window.opener` giữa popup Google và ứng dụng chính. Khi popup đóng, GIS không thể truyền token response về callback của opener.
2. Cấu hình `connect-src` trong CSP cần đảm bảo đầy đủ các endpoint Google cần thiết (`https://accounts.google.com`, `https://www.googleapis.com`, `https://apis.google.com`, `https://oauth2.googleapis.com`) và `frame-src` cho `https://accounts.google.com`.

Giải pháp:
1. Cấu hình `helmet` trong `server.ts` với `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }`, cho phép trang chính duy trì quyền giao tiếp với các popup do chính nó mở.
2. Hoàn thiện CSP directives trong `server.ts` cho các domain Google phục vụ GIS và Google Picker.
3. Cập nhật unit test trong `server/__tests__/securityHeaders.test.ts` để kiểm tra chính xác giá trị COOP và các directives CSP mới.

## Actors

| Actor | Description |
|-------|-------------|
| Người dùng | Người dùng đăng nhập Google Drive qua popup OAuth |
| Frontend App | Ứng dụng SPA mở popup GIS và chờ token trong callback |
| Popup GIS | Cửa sổ popup xác thực của Google giao tiếp ngược lại với `window.opener` |
| Express Server | Server Node.js trả header bảo mật COOP và CSP |

## Functional Requirements

### FR-1: Cấu hình COOP `same-origin-allow-popups`
- Header `Cross-Origin-Opener-Policy` trả về từ server Express phải có giá trị `same-origin-allow-popups` (ở cả môi trường production và development).
- Cấu hình qua Helmet: `helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, ... })`.

### FR-2: Hoàn thiện Content-Security-Policy (CSP)
- `script-src`: Bao gồm `'self'`, `https://accounts.google.com`, `https://apis.google.com`.
- `connect-src`: Bao gồm `'self'`, `ws:`, `wss:`, `https://accounts.google.com`, `https://www.googleapis.com`, `https://apis.google.com`, `https://oauth2.googleapis.com`.
- `frame-src`: Bao gồm `https://accounts.google.com`.
- Các chỉ thị khác (`default-src`, `style-src`, `font-src`, `img-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors`) tiếp tục giữ nguyên cấu hình bảo mật hiện tại.

### FR-3: Cập nhật Unit Tests kiểm thử Security Headers
- Cập nhật helper `createTestApp` trong `server/__tests__/securityHeaders.test.ts` để phản ánh đúng cấu hình `crossOriginOpenerPolicy` và `contentSecurityPolicy` mới.
- Bổ sung kiểm tra assertion cho header `cross-origin-opener-policy` có giá trị `same-origin-allow-popups`.
- Cập nhật assertion cho `content-security-policy` để kiểm tra các directives `script-src`, `connect-src`, `frame-src` mới.

## Non-Functional Requirements

### NFR-1: Bảo mật (Security)
- Giá trị `same-origin-allow-popups` vẫn bảo vệ trang chính khỏi các tấn công cross-origin từ các trang bên ngoài, đồng thời cho phép duy trì opener relationship với các popup hợp lệ.
- CSP ở production chặn mọi nguồn không được khai báo rõ ràng.

### NFR-2: Tính tương thích (Compatibility)
- Tương thích 100% với Google Identity Services Token Client trên tất cả trình duyệt hiện đại (Chrome, Edge, Firefox, Safari).
- Môi trường development tiếp tục hỗ trợ Vite HMR (`ws:`, `wss:`) mà không bị CSP cản trở.

## User Scenarios & Testing

### Scenario 1: Đăng nhập Google hoàn tất và callback nhận token
1. Người dùng mở modal "Đồng bộ Google Drive" và nhấn "Đăng nhập với Google".
2. Popup GIS xuất hiện, người dùng chọn tài khoản và cho phép truy cập.
3. Popup gửi thông điệp token về ứng dụng chính thông qua `window.opener` và tự đóng.
4. Ứng dụng chính nhận được token, cập nhật trạng thái đã đăng nhập và hiển thị thông tin tài khoản người dùng mà không bị nuốt lỗi.

### Scenario 2: Kiểm thử tự động Security Headers
1. Chạy `npm test` với file `server/__tests__/securityHeaders.test.ts`.
2. Test app khởi chạy và gửi request tới `/test`.
3. Response trả về header `cross-origin-opener-policy: same-origin-allow-popups`.
4. Response ở production trả về CSP chứa đầy đủ các directive `accounts.google.com`, `apis.google.com`, `googleapis.com`.

## Scope Boundaries

### Trong phạm vi
- Sửa cấu hình `helmet` trong `server.ts`.
- Cập nhật test cases trong `server/__tests__/securityHeaders.test.ts`.
- Chạy kiểm tra chất lượng `npm run lint`, `npm test`, `npm run build`.

### Ngoài phạm vi
- Không sửa logic xử lý auth client trong `src/services/googleAuthService.ts`.
- Không thêm package NPM mới.
- Không sửa các route API dịch truyện hoặc cấu trúc DB.

## Success Criteria

- Header `Cross-Origin-Opener-Policy: same-origin-allow-popups` xuất hiện trong response của server.
- CSP cho phép kết nối và nạp script/frame từ Google Identity Services.
- Toàn bộ unit tests pass (`npm test`).
- Type check pass (`npm run lint`).
- Build production thành công (`npm run build`).

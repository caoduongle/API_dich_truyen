# Khắc phục lỗi Google Picker bị chặn bởi Content Security Policy (CSP) & Cấu hình Origin

**Feature**: Mở rộng Content Security Policy (CSP), duy trì Cross-Origin-Opener-Policy (COOP) `same-origin-allow-popups`, và cấu hình `setOrigin` cho Google Picker API để iframe Google Picker tải và hoạt động trơn tru.

**Status**: Draft
**Created**: 2026-08-23

---

## Problem Statement

Khi người dùng sử dụng tính năng "Mở dự án được chia sẻ (Google Picker)" để chọn thư mục dự án Google Drive, giao diện iframe của Google Picker bị trình duyệt chặn với thông báo lỗi:
- DevTools Console: `Content Security Policy of your site blocks some resources` (thiếu quyền cho các domain `drive.google.com`, `docs.google.com`, `content.googleapis.com`, `*.googleusercontent.com`).
- Giao diện iframe hiển thị: *"Nội dung này bị chặn. Hãy liên hệ với chủ sở hữu trang web để khắc phục sự cố."*
- Ngoài ra, `googlePickerService.ts` chưa gọi `pickerBuilder.setOrigin(window.location.origin)`, dẫn đến việc iframe Google Picker không xác thực được nguồn gốc trang cha (parent window) khi giao tiếp qua `postMessage`.

Giải pháp:
1. **Mở rộng CSP trong `server.ts`**: Bổ sung đầy đủ các domain Google cần thiết cho iframe (`frame-src`), scripts (`script-src`), network requests (`connect-src`), styles (`style-src`), fonts (`font-src`), và avatars/thumbnails (`img-src`).
2. **Duy trì COOP `same-origin-allow-popups`**: Đảm bảo không bị revert về `same-origin`.
3. **Cấu hình `setOrigin` trong `googlePickerService.ts`**: Đảm bảo `PickerBuilder` luôn gọi `.setOrigin(window.location.origin)` trước khi `.build()`.
4. **Cập nhật Unit Tests**: Đồng bộ `server/__tests__/securityHeaders.test.ts` để kiểm tra chính xác các directive CSP mới.

## Actors

| Actor | Description |
|-------|-------------|
| Người dùng | Người dùng chọn thư mục dự án Google Drive qua Google Picker modal |
| Google Picker iframe | Iframe nhúng từ `docs.google.com` / `drive.google.com` chứa giao diện duyệt tệp của Google Drive |
| Frontend Service | `googlePickerService.ts` khởi tạo `PickerBuilder` với OAuth token, API key và origin |
| Express Server | Server trả về các header bảo mật CSP và COOP |

## Functional Requirements

### FR-1: Mở rộng CSP cho Google Picker Ecosystem
Trong `server.ts` (và test app tương ứng), cập nhật directives của Helmet CSP ở production mode:
- **`frame-src`**: `https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com`
- **`script-src`**: `'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com`
- **`connect-src`**: `'self' ws: wss: https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com`
- **`style-src`**: `'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com`
- **`font-src`**: `'self' https://fonts.gstatic.com data:`
- **`img-src`**: `'self' data: blob: https: *.googleusercontent.com`
- Các directive bảo mật khác (`default-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors`) giữ nguyên chuẩn an toàn.

### FR-2: Đảm bảo COOP `same-origin-allow-popups`
- Header `Cross-Origin-Opener-Policy` tiếp tục duy trì giá trị `same-origin-allow-popups` trong cấu hình Helmet để cho phép giao tiếp popup và iframe.

### FR-3: Cấu hình `setOrigin` trong `googlePickerService.ts`
- Trong hàm `openFolderPicker`, chuỗi cấu hình `google.picker.PickerBuilder()` phải được bổ sung `.setOrigin(window.location.origin)` nếu `typeof window !== 'undefined'`.
- Đảm bảo token OAuth 2.0 (`accessToken`) và Developer Key (`apiKey`) được truyền đầy đủ và hợp lệ trước khi build.

### FR-4: Đồng bộ Unit Tests cho Security Headers
- Cập nhật `createTestApp` trong `server/__tests__/securityHeaders.test.ts` để đồng bộ hoàn toàn với các CSP directives mới.
- Cập nhật các assertions kiểm tra CSP string bao gồm các domain mới (`docs.google.com`, `drive.google.com`, `content.googleapis.com`, `*.googleusercontent.com`).

## Non-Functional Requirements

### NFR-1: Bảo mật (Security)
- Chỉ cấp quyền CSP cho các domain chính thức của Google phục vụ Picker, Drive, và OAuth.
- Giữ nguyên các cơ chế bảo vệ XSS và framing khác.

### NFR-2: Tính sẵn sàng và Trải nghiệm người dùng (UX)
- Khi người dùng bấm "Mở dự án được chia sẻ (Google Picker)", iframe hiển thị danh sách thư mục ngay lập tức mà không gặp bất kỳ lỗi chặn nội dung nào trên Console.

## User Scenarios & Testing

### Scenario 1: Mở Google Picker chọn thư mục thành công
1. Người dùng đã đăng nhập Google và mở modal "Đồng bộ Google Drive".
2. Bấm "Mở dự án được chia sẻ (Google Picker)".
3. Iframe Google Picker tải thành công từ Google Docs/Drive, hiển thị giao diện chọn thư mục.
4. Người dùng chọn một thư mục và bấm Select.
5. Callback `onFolderSelected` nhận được `folderId` và `folderName`, tiếp tục quá trình import/sync.

### Scenario 2: Kiểm thử tự động CSP và COOP headers
1. Chạy `npm test` đối với `server/__tests__/securityHeaders.test.ts`.
2. Response từ server test chứa đầy đủ các directive CSP mới và header COOP `same-origin-allow-popups`.

## Scope Boundaries

### Trong phạm vi
- Sửa `server.ts` (cập nhật CSP directives).
- Sửa `src/services/googlePickerService.ts` (thêm `setOrigin`).
- Sửa `server/__tests__/securityHeaders.test.ts` (đồng bộ test CSP).
- Xác minh bằng `npm run lint`, `npm test`, `npm run build`.

### Ngoài phạm vi
- Không sửa logic xử lý auth trong `src/services/googleAuthService.ts`.
- Không thay đổi schema DB hoặc API dịch truyện.
- Không thêm NPM dependency mới.

## Success Criteria

- Iframe Google Picker không còn bị chặn bởi CSP (`drive.google.com`, `docs.google.com`, `content.googleapis.com` được phép tải).
- `PickerBuilder` truyền đúng origin hiện tại của trang web.
- Toàn bộ unit tests pass 100% (`npm test`).
- Type check pass (`npm run lint`).
- Production build thành công (`npm run build`).

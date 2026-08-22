# Chuyển Google OAuth sang GIS Token Client (Popup)

**Feature**: Thay thế luồng đăng nhập Google từ Authorization Code + PKCE (redirect toàn trang) sang Google Identity Services Token Client (popup, nhận `access_token` trực tiếp) — loại bỏ hoàn toàn nhu cầu `client_secret`.

**Status**: Draft
**Created**: 2026-08-23

---

## Problem Statement

Luồng đăng nhập Google hiện tại sử dụng OAuth 2.0 Authorization Code + PKCE: ứng dụng redirect toàn trang tới Google, nhận `code` qua URL redirect, sau đó gọi `https://oauth2.googleapis.com/token` để đổi `code` lấy `access_token`. Tuy nhiên, Google yêu cầu `client_secret` ở bước đổi code cho mọi OAuth Client ID loại "Web application" — kể cả khi dùng PKCE. Điều này khiến luồng không hoạt động được trên ứng dụng client-side thuần (SPA) vì không thể an toàn nhúng `client_secret` vào frontend.

Giải pháp: Chuyển sang Google Identity Services (GIS) Token Client — thư viện chính chủ của Google — sử dụng popup thay vì redirect, Google trả `access_token` trực tiếp về callback JavaScript mà không qua bước đổi code, do đó hoàn toàn không cần `client_secret`.

## Actors

| Actor | Description |
|-------|-------------|
| Người dùng | Người sử dụng ứng dụng dịch tiểu thuyết, muốn đăng nhập Google để đồng bộ dự án qua Google Drive |
| Ứng dụng (Frontend) | SPA React chạy trong trình duyệt, quản lý luồng xác thực và lưu trữ token |
| Google Identity Services | Thư viện JavaScript chính chủ của Google, xử lý popup đăng nhập và trả access token |
| Google APIs | Các endpoint Google (userinfo, Drive) mà ứng dụng gọi sau khi có access token |

## Functional Requirements

### FR-1: Thay thế luồng xác thực

- Luồng đăng nhập phải sử dụng Google Identity Services Token Client (`google.accounts.oauth2.initTokenClient`) thay vì Authorization Code + PKCE
- Thư viện GIS được tải động qua thẻ `<script>` từ `https://accounts.google.com/gsi/client` — không thêm dependency npm
- Khi người dùng bấm "Đăng nhập với Google", một cửa sổ popup hiện ra cho phép chọn tài khoản và cấp quyền
- Sau khi cấp quyền, Google trả `access_token` trực tiếp về callback JavaScript — popup tự đóng
- Ứng dụng lấy thông tin người dùng (profile, email, ảnh) từ `access_token` và lưu vào session
- Toàn bộ quá trình không redirect toàn trang — người dùng giữ nguyên trạng thái đang làm việc

### FR-2: Xoá code PKCE không còn sử dụng

- Xoá file `src/services/pkceHelper.ts` và test tương ứng `src/services/__tests__/pkceHelper.test.ts`
- Xoá interface `PKCEChallenge` khỏi `src/types/googleAuth.ts`
- Xoá các hằng số và hàm liên quan PKCE trong service xác thực: `GOOGLE_AUTH_ENDPOINT`, `GOOGLE_TOKEN_ENDPOINT`, `PKCE_STATE_KEY`, `PKCE_VERIFIER_KEY`, `getRedirectUri()`, `handleAuthCallback()`
- Trước khi xoá, xác nhận không còn module nào khác tham chiếu tới code PKCE

### FR-3: Xoá xử lý redirect callback

- Xoá khối `useEffect` trong `src/App.tsx` dùng để bắt `code` và `state` từ URL redirect
- Nếu import `googleAuthService` không còn được sử dụng ở nơi nào khác trong file, xoá luôn dòng import

### FR-4: Cập nhật Content Security Policy

- Cho phép script từ `https://accounts.google.com` và `https://apis.google.com` trong `scriptSrc` (GIS cần domain đầu, Google Picker đã cần domain sau từ trước nhưng bị CSP chặn âm thầm)
- Thêm `frameSrc: ["https://accounts.google.com"]` cho iframe ẩn mà GIS có thể sử dụng
- Giữ nguyên `connectSrc` hiện tại — không xoá `https://oauth2.googleapis.com` vì chưa xác định chắc chắn GIS có tự gọi ngầm tới đó hay không

### FR-5: Giữ nguyên giao diện public API

- Phương thức `getAccessToken()` giữ nguyên hành vi: trả `this.state.accessToken` không kiểm tra hết hạn (vì `useChapterCRDT.ts` phụ thuộc hành vi này)
- Phương thức `getValidAccessToken()` giữ nguyên: trả token hoặc `null` nếu hết hạn
- Các phương thức quản lý Client ID tuỳ chỉnh (`getInitialClientId`, `setClientId`, `getClientId`, `getCustomClientId`) giữ nguyên logic
- Phương thức `initiateLogin()` giữ nguyên chữ ký `Promise<void>` — `GoogleSyncModal.tsx` không cần sửa
- Phương thức `fetchUserProfile()` giữ nguyên
- Phương thức `onAuthStateChanged()` giữ nguyên
- Phương thức `logout()` cập nhật để gọi `google.accounts.oauth2.revoke()` thay vì chỉ xoá session cục bộ

### FR-6: Không tồn tại code server-proxy

- Không được tồn tại route `/api/auth/google/token` trong server
- Không được tồn tại biến môi trường `GOOGLE_CLIENT_SECRET` trong codebase
- Nếu đã lỡ áp dụng từ prompt trước đó, phải revert trước khi thực hiện

## Non-Functional Requirements

### NFR-1: Bảo mật

- Không có `client_secret` nào xuất hiện trong codebase (frontend lẫn backend)
- Access token chỉ lưu trong `sessionStorage` — hết tab mất token
- Khi đăng xuất, token được revoke phía Google (best effort) và xoá khỏi bộ nhớ cục bộ

### NFR-2: Trải nghiệm người dùng

- Popup đăng nhập hiện ra và tự đóng sau khi cấp quyền — không mất trạng thái làm việc
- Nếu người dùng đóng popup mà không cấp quyền, ứng dụng không bị treo hay lỗi

### NFR-3: Tương thích

- Hoạt động trên các trình duyệt hiện đại (Chrome, Firefox, Edge, Safari) có hỗ trợ popup
- Hoạt động ở cả môi trường local development (`http://localhost:5173`) và production

## User Scenarios & Testing

### Scenario 1: Đăng nhập thành công

1. Người dùng mở modal "Đồng bộ Google Drive"
2. Người dùng bấm "Đăng nhập với Google"
3. Popup Google hiện ra — người dùng chọn tài khoản và cấp quyền
4. Popup tự đóng — modal hiển thị thông tin người dùng (tên, email, ảnh)
5. Người dùng có thể thực hiện thao tác Push/Pull/Sync với Google Drive

### Scenario 2: Chưa cấu hình Client ID

1. Không có `VITE_GOOGLE_CLIENT_ID` trong `.env` và người dùng chưa nhập Client ID tuỳ chỉnh
2. Người dùng bấm "Đăng nhập với Google"
3. Ứng dụng hiển thị thông báo lỗi yêu cầu cấu hình Client ID

### Scenario 3: Người dùng huỷ popup

1. Người dùng bấm "Đăng nhập với Google"
2. Popup Google hiện ra
3. Người dùng đóng popup mà không chọn tài khoản
4. Ứng dụng không bị treo — có thể thử lại

### Scenario 4: Client ID tuỳ chỉnh

1. Người dùng mở mục nâng cao trong modal, nhập Client ID riêng
2. Bấm "Đăng nhập với Google"
3. Popup Google hiện ra với OAuth consent screen tương ứng Client ID đã nhập
4. Đăng nhập thành công — Client ID tuỳ chỉnh được lưu qua các phiên

### Scenario 5: Đăng xuất

1. Người dùng bấm "Đăng xuất"
2. Token được revoke phía Google (best effort)
3. Session bị xoá — giao diện quay về trạng thái chưa đăng nhập

### Scenario 6: Phiên hết hạn

1. Access token hết hạn (mặc định 1 giờ)
2. Lần gọi `getValidAccessToken()` tiếp theo trả `null` và tự động logout
3. Người dùng cần đăng nhập lại

## Assumptions

- Google Identity Services script (`https://accounts.google.com/gsi/client`) luôn khả dụng từ phía Google
- OAuth Client ID loại "Web application" đã được cấu hình đúng "Authorized JavaScript origins" trên Google Cloud Console (yêu cầu cấu hình ngoài code)
- Trình duyệt của người dùng cho phép popup (không bị popup blocker chặn hoàn toàn)
- Access token do GIS Token Client trả về có cùng scope và thời hạn (mặc định 3600 giây) như token từ luồng Authorization Code

## Dependencies

- Google Identity Services JavaScript library (tải qua `<script>` từ `https://accounts.google.com/gsi/client`)
- Google APIs JavaScript library (đã sử dụng sẵn cho Google Picker — `https://apis.google.com/js/api.js`)
- Biến môi trường `VITE_GOOGLE_CLIENT_ID` hoặc Client ID tuỳ chỉnh do người dùng nhập

## Scope Boundaries

### Trong phạm vi

- Viết lại `src/services/googleAuthService.ts` với luồng GIS Token Client
- Xoá `src/services/pkceHelper.ts` và test tương ứng
- Xoá interface `PKCEChallenge` khỏi `src/types/googleAuth.ts`
- Xoá useEffect redirect callback trong `src/App.tsx`
- Cập nhật CSP trong `server.ts`
- Revert code server-proxy nếu tồn tại

### Ngoài phạm vi

- Không sửa `GoogleSyncModal.tsx` — đã tương thích sẵn
- Không sửa `useChapterCRDT.ts` — hành vi `getAccessToken()` không đổi
- Không sửa `googlePickerService.ts` — chỉ thêm CSP cho domain mà service này đã dùng
- Không đổi text tiếng Việt hiển thị cho người dùng (trừ thông báo lỗi kỹ thuật cần thiết)
- Không thêm dependency npm mới
- Không đổi schema IndexedDB hoặc cấu trúc types (trừ xoá `PKCEChallenge`)

## Success Criteria

- Người dùng có thể hoàn tất đăng nhập Google qua popup trong vòng 30 giây
- Không có request nào tới `oauth2.googleapis.com/token` sau khi chuyển đổi
- Không có lỗi CSP nào trong browser console liên quan đến script Google hoặc iframe
- Không có `client_secret` nào xuất hiện trong codebase
- Mọi tính năng Google Drive (Push/Pull/Sync/Picker) tiếp tục hoạt động bình thường sau đăng nhập
- Lint (`npm run lint`), test (`npm test`), và build (`npm run build`) đều pass
- Client ID tuỳ chỉnh hoạt động đúng như trước

## Post-Deployment Configuration (Manual)

> **IMPORTANT**: Bước này nằm ngoài code — người dùng cần tự thực hiện trên Google Cloud Console.

Vào Google Cloud Console → APIs & Services → Credentials → chọn đúng OAuth Client ID đang dùng (loại "Web application") → mục **"Authorized JavaScript origins"** → thêm:
- `http://localhost:5173` (nếu test local)
- Origin production thật của ứng dụng (ví dụ `https://ten-mien.com`)

Luồng redirect cũ chỉ cần "Authorized redirect URIs" — luồng popup mới yêu cầu "Authorized JavaScript origins". Nếu thiếu mục này, popup sẽ báo lỗi `origin_mismatch`.

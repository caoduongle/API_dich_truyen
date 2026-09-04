# Tasks: Toàn Diện 20 Tiêu Chuẩn Bảo Mật Ứng Dụng (AppSec Hardening)

**Feature**: `085-appsec-hardening` | **Branch**: `085-appsec-hardening` | **Date**: 2026-09-05  
**Spec**: [`specs/085-appsec-hardening/spec.md`](./spec.md) | **Plan**: [`specs/085-appsec-hardening/plan.md`](./plan.md)

---

## Phase 1: Setup (Supply Chain & Infrastructure Baseline)

**Purpose**: Loại bỏ toàn bộ lỗ hổng phụ thuộc đã biết và chuẩn bị cơ sở hạ tầng an ninh ban đầu.

- [x] T001 Cấu hình trường `overrides` cho `browserslist: "^4.28.7"` và `qs: "^6.15.4"` trong package.json
- [x] T002 Chạy `npm install` và kiểm tra `npm audit --audit-level=high` để xác nhận 0 lỗ hổng nghiêm trọng trong package.json
- [x] T003 [P] Tạo kịch bản mẫu di trú Row-Level Security (RLS) cho PostgreSQL/Supabase trong database/migrations/001_rls_policies.sql

---

## Phase 2: Foundational (Security Headers & HTTPS Enforcement)

**Purpose**: Thiết lập các lá chắn an ninh tầng mạng và giao thức HTTP chặn đứng nghe lén và giả mạo.

- [x] T004 [P] Xây dựng middleware kiểm tra `x-forwarded-proto` bắt buộc chuyển hướng HTTPS 301 trong server/middleware/httpsRedirect.ts
- [x] T005 [P] Viết bộ kiểm thử tự động cho middleware chuyển hướng HTTPS trong server/middleware/__tests__/httpsRedirect.test.ts
- [x] T006 Cấu hình Helmet hoàn chỉnh (HSTS preload, Permissions-Policy, X-Content-Type-Options, Frameguard) trong server.ts

**Checkpoint**: Nền tảng an ninh HTTP sẵn sàng. Các câu chuyện người dùng có thể bắt đầu triển khai.

---

## Phase 3: User Story 1 - Xác Thực Máy Chủ & Cookie Phiên An Toàn (Priority: P1) 🎯 MVP

**Goal**: Ngăn chặn đánh cắp phiên qua XSS và bảo vệ mật khẩu quản trị bằng thuật toán băm chuẩn công nghiệp. Thỏa mãn Tiêu chuẩn 6, 9, 10.

**Independent Test**: Đăng nhập qua `POST /api/auth/login` nhận về cookie `auth_token` có đủ cờ `HttpOnly`, `Secure`, `SameSite=Strict`; middleware xác thực thành công cả khi dùng Cookie hoặc Header `X-Auth-Token`.

### Tests for User Story 1
- [x] T007 [P] [US1] Viết unit tests kiểm thử thuật toán băm mật khẩu scrypt và timingSafeEqual trong server/utils/__tests__/passwordScrypt.test.ts
- [x] T008 [P] [US1] Viết unit tests kiểm thử cấp phát và xác thực cookie phiên HttpOnly trong server/controllers/__tests__/authControllerCookie.test.ts

### Implementation for User Story 1
- [x] T009 [P] [US1] Xây dựng module băm mật khẩu scrypt kèm random salt 16 bytes trong server/utils/password.ts
- [x] T010 [US1] Cập nhật server/controllers/authController.ts thiết lập cookie `auth_token` (HttpOnly, Secure, SameSite=Strict) khi login và xóa khi logout
- [x] T011 [US1] Cập nhật server/middleware/authMiddleware.ts để đọc và xác thực `auth_token` từ `req.headers.cookie` song song với các headers hiện có

**Checkpoint**: Phiên xác thực người dùng được bảo vệ tuyệt đối trước XSS bằng HttpOnly cookie.

---

## Phase 4: User Story 2 - Chống Brute-Force & Phòng Chống Bot Tự Động (Priority: P2)

**Goal**: Chặn đứng các đợt tấn công dò mật khẩu tự động và bot spam form mà không làm ảnh hưởng trải nghiệm người dùng thật. Thỏa mãn Tiêu chuẩn 11, 12.

**Independent Test**: Gửi request có điền trường Honeypot hoặc thời gian submit < 800ms sẽ bị từ chối; gửi quá 10 request đăng nhập sai sẽ nhận HTTP 429 và bị khóa IP tạm thời.

### Tests for User Story 2
- [x] T012 [P] [US2] Viết unit tests kiểm thử middleware phòng chống bot Honeypot trong server/middleware/__tests__/botProtection.test.ts

### Implementation for User Story 2
- [x] T013 [P] [US2] Xây dựng middleware kiểm tra Honeypot (`hp_username`, `hp_time`) trong server/middleware/botProtection.ts
- [x] T014 [US2] Gia cố rate limiter đăng nhập với cơ chế tự động khóa IP tạm thời khi vượt ngưỡng vi phạm trong server/middleware/rateLimiter.ts
- [x] T015 [US2] Gắn middleware bot protection vào router đăng nhập trong server/routes/api.ts

**Checkpoint**: Hệ thống loại bỏ 99% bot script tự động và chặn đứng tấn công brute-force.

---

## Phase 5: User Story 3 - Kiểm Soát Dữ Liệu Đầu Vào & Chống Tiêm Nhiễm Lệnh (Priority: P3)

**Goal**: Triệt tiêu lỗ hổng Mass Assignment (Field Tampering), SQL Injection, Redis Command Injection và tải lên tệp tin độc hại. Thỏa mãn Tiêu chuẩn 8, 13, 14, 15, 16.

**Independent Test**: Gửi request có chứa các trường lạ (`role`, `isOwner`, `__proto__`) sẽ bị loại bỏ hoàn toàn; tải file epub sai magic bytes zip sẽ bị từ chối.

### Tests for User Story 3
- [x] T016 [P] [US3] Viết unit tests kiểm định cơ chế Whitelisting DTO và loại bỏ trường lạ trong server/utils/__tests__/validationWhitelisting.test.ts
- [x] T017 [P] [US3] Viết unit tests kiểm định magic number và giới hạn kích thước tệp tải lên trong server/utils/__tests__/fileValidation.test.ts

### Implementation for User Story 3
- [x] T018 [P] [US3] Cập nhật server/utils/validation.ts bổ sung hàm trích xuất Whitelist DTO cho tất cả các endpoint POST
- [x] T019 [P] [US3] Xây dựng module kiểm định kích thước tối đa 15MB và magic bytes (`PK\x03\x04` cho epub) trong server/utils/fileValidation.ts
- [x] T020 [US3] Chuẩn hóa việc khử trùng Redis key pattern chống Redis command injection trong server/services/redisService.ts
- [x] T021 [US3] Cập nhật các controller sử dụng DTO đã được làm sạch qua Whitelist thay vì `req.body` thô trong server/controllers/translationController.ts và server/controllers/glossaryController.ts

**Checkpoint**: Toàn bộ dữ liệu đi vào ứng dụng được kiểm soát chặt chẽ, loại bỏ hoàn toàn nguy cơ tiêm nhiễm lệnh.

---

## Phase 6: User Story 4 - Chống IDOR & Bảo Vệ Bí Mật Hệ Thống (Priority: P4)

**Goal**: Ngăn chặn rò rỉ API key, token, mật khẩu trong log và mã hóa khóa nhạy cảm; phòng chống truy cập trái phép tài nguyên dự án (IDOR). Thỏa mãn Tiêu chuẩn 1, 2, 3, 4, 5, 7, 17.

**Independent Test**: Log server khi có lỗi chứa API key sẽ hiển thị dạng `AIza***[REDACTED]`; kết nối WebSocket `/ws/sync` với user không có quyền trong collaborators sẽ bị từ chối; response production không chứa stack trace.

### Tests for User Story 4
- [x] T022 [P] [US4] Viết unit tests xác minh regex khử trùng chuỗi secret, key, token trong server/utils/__tests__/loggerRedaction.test.ts

### Implementation for User Story 4
- [x] T023 [P] [US4] Nâng cấp regex làm sạch trong server/utils/logger.ts che giấu toàn diện Gemini keys, OpenAI keys, Bearer tokens và password
- [x] T024 [US4] Gia cố xác thực phân quyền cộng tác viên (`verifyCollaboratorAccess`) trên WebSocket Relay trong server/services/websocketRelayService.ts
- [x] T025 [US4] Đảm bảo mọi endpoint trả về DTO chuẩn không chứa stack traces hoặc đường dẫn server trong server/controllers/

**Checkpoint**: Dữ liệu nhạy cảm được bảo vệ tuyệt đối, triệt tiêu nguy cơ rò rỉ thông tin qua log hoặc lỗi.

---

## Phase 7: Polish & Quality Gates Verification

**Purpose**: Đảm bảo toàn bộ 20 tiêu chuẩn an toàn bảo mật thông tin được nghiệm thu thành công và tuân thủ Hiến pháp.

- [x] T026 Chạy kiểm tra Type Safety không có lỗi: `npm run lint` (`tsc --noEmit`)
- [x] T027 Chạy toàn bộ test suites đảm bảo 100% pass: `npm test` (`vitest run`)
- [x] T028 Chạy build production thành công: `npm run build`
- [x] T029 Chạy quét phụ thuộc: `npm audit --audit-level=high` xác nhận 0 lỗ hổng
- [x] T030 Thực hiện các kịch bản cURL kiểm thử trong quickstart.md và ghi nhận kết quả

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Có thể bắt đầu ngay lập tức
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 hoàn tất - CHẶN các user story
- **User Stories (Phase 3 - 6)**: Phụ thuộc Foundational hoàn tất
  - US1 (P1 - Auth & Cookies) -> US2 (P2 - Bot & Brute-force) -> US3 (P3 - Input Whitelisting) -> US4 (P4 - IDOR & Secrets)
- **Polish (Phase 7)**: Thực hiện sau khi hoàn thành toàn bộ các user stories

### Parallel Opportunities
- Các task có đánh dấu `[P]` có thể thực thi độc lập không phụ thuộc nhau (khác file).
- Các unit tests có thể được viết song song trước hoặc cùng lúc với mã nguồn.

# Implementation Plan: Toàn Diện 20 Tiêu Chuẩn Bảo Mật Ứng Dụng (AppSec Hardening)

**Branch**: `085-appsec-hardening` | **Date**: 2026-09-05 | **Spec**: [`specs/085-appsec-hardening/spec.md`](./spec.md)

---

## 1. Summary

Kế hoạch triển khai đồng bộ và hoàn thiện toàn diện **20 tiêu chuẩn an toàn bảo mật thông tin (AppSec)** cho hệ thống AI Dịch Truyện Trung - Việt, gia cố cả 3 tầng: Frontend Client (React 19 / IndexedDB / Vite), Backend Service (Express.js / Node.js / Helmet), và Cache / Message Broker (Redis / WebSocket Relay).

Kế hoạch phân bổ thành 5 pha kỹ thuật có thứ tự phụ thuộc chặt chẽ:
1. **Pha 1: Quét Vá Phụ Thuộc & Cấu Hình Header An Ninh HTTP** (Tiêu chuẩn 18, 19, 20)
   - Cấu hình package overrides vá triệt để 4 lỗ hổng npm audit (`browserslist`, `qs`).
   - Tăng cường Helmet headers: HSTS preload, Permissions-Policy, Referrer-Policy, X-Content-Type-Options.
   - Bổ sung middleware `httpsRedirect` bắt buộc chuyển hướng HTTPS khi chạy production.
2. **Pha 2: Chuẩn Hóa Xác Thực, Cookie Phiên & Chống Brute-Force** (Tiêu chuẩn 6, 9, 10, 11, 12)
   - Cấp phát cookie phiên `auth_token` với đầy đủ cờ `HttpOnly`, `Secure`, `SameSite=Strict`, song song với header token để giữ tương thích ngược.
   - Bổ sung cơ chế băm mật khẩu chuẩn `scrypt` kèm salt ngẫu nhiên và so sánh thời gian cố định (`timingSafeEqual`).
   - Gia cố rate limiter login trên Redis và bổ sung middleware chống bot Honeypot.
3. **Pha 3: Kiểm Soát Đầu Vào, Chống Bơm Trường & Triệt Tiêu Lỗ Hổng Tiêm Nhiễm** (Tiêu chuẩn 8, 13, 14, 15, 16)
   - Thiết lập cơ chế kiểm tra và Whitelisting dữ liệu đầu vào cho 100% endpoint, loại bỏ hoàn toàn các trường dữ liệu thừa (chống Mass Assignment).
   - Chuẩn hóa Redis key pattern chống Redis command injection; định nghĩa hợp đồng truy vấn tham số hóa cho SQL.
   - Làm sạch chuỗi HTML entities chống XSS và kiểm tra magic number, giới hạn dung lượng tệp tin tải lên.
4. **Pha 4: Kiểm Soát Truy Cập IDOR, Phân Tách Khóa & Bảo Vệ Bí Mật Hệ Thống** (Tiêu chuẩn 1, 2, 3, 4, 5, 7, 17)
   - Khử trùng log tự động cho mọi API key, Bearer token, password và error stack traces.
   - Mã hóa AES-256-GCM cho khóa nhạy cảm trong Redis/RAM; kiểm tra quyền cộng tác viên phòng chống IDOR trên WebSocket /ws/sync.
   - Thiết lập playbook dọn dẹp Git secrets và bộ chính sách Row-Level Security (RLS) cho cơ sở dữ liệu Supabase/PostgreSQL.
   - Cắt tỉa API responses loại bỏ toàn bộ dữ liệu nội bộ và stack trace ở môi trường production.
5. **Pha 5: Kiểm Thử Nghiệm Thu & Đảm Bảo Quality Gates** (Toàn bộ 20 Tiêu chuẩn)
   - Chạy kiểm thử tự động toàn diện: `npm run lint`, `npm test` (675+ tests), `npm run build`.
   - Xác minh các kịch bản curl kiểm tra header, chuyển hướng HTTPS, rate limiter, và npm audit sạch lỗi.

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+, React 19
- **Primary Dependencies**: Express 4.21+, Helmet 8.3+, ioredis 5.5+, ws 8.21+, Vite 6.2+, Tailwind CSS v4, Lucide React, motion
- **Storage**: Client-side IndexedDB (`src/services/db.ts`), Redis distributed cache/session/rate-limiter, Google Drive sync
- **Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint` -> `tsc --noEmit`), Production Build (`npm run build`)
- **Target Platform**: Node.js Linux Container (Cloud Run / Render), Modern Desktop & Mobile Web Browsers
- **Project Type**: Web Service API (Express) + Client Single Page Application (React)
- **Performance Goals**: Middleware overhead < 2ms trên mỗi request; bộ nhớ đệm xác thực có TTL rõ ràng; không block Event Loop khi xử lý mật khẩu.
- **Constraints**:
  - Tuân thủ Hiến pháp AI Dịch Truyện Trung-Việt v1.0.0 (Gate I: 100% test pass, Gate II: Dependency Minimization - tận dụng tối đa Node.js built-in `crypto`, Gate III: Domain Boundary Preservation - không đổi logic dịch thuật).
  - Giữ nguyên cấu trúc IndexedDB và `types.ts`.
  - Giữ tương thích ngược với cả client gọi API qua Header `X-Auth-Token` và Cookie `auth_token`.

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá Tuân thủ | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | `tsc --noEmit`, `vitest run`, và `npm run build` PHẢI pass sạch 100% không có lỗi. Không skip/xóa test. | ✅ PASS |
| **II. Dependency Minimization & Existing Library Reuse** | Sử dụng Node.js built-in `crypto` (scrypt, timingSafeEqual, AES-256-GCM), cấu hình Helmet sẵn có, không cài thêm thư viện nặng ngoài danh mục đã phê duyệt. | ✅ PASS |
| **III. Strict Concern Separation & Domain Boundary Preservation** | Chỉ gia cố an ninh tầng Server/Middleware/Auth/Validation/Logging. Tuyệt đối không can thiệp vào prompt dịch hay logic 2-stage dịch của Gemini. | ✅ PASS |
| **IV. Immutable Core Schemas & Storage Stability** | Giữ nguyên các interface trong `src/types.ts` và schema IndexedDB trong `src/services/db.ts`. | ✅ PASS |
| **V. Atomic Commits & Documentation Synchronization** | Mã nguồn được phân tách modular theo từng middleware/controller, đồng bộ tài liệu hợp đồng trong `contracts/` và `quickstart.md`. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/085-appsec-hardening/
├── plan.md              # Implementation Plan (Tài liệu này)
├── research.md          # Phase 0 Research & Technical Decisions
├── data-model.md        # Phase 1 Data Model & Security Entities
├── quickstart.md        # Phase 1 Quickstart Validation Guide
├── contracts/           # Phase 1 Interface Contracts
│   └── appsec.contract.md
└── checklists/
    └── requirements.md  # Requirements & Acceptance Checklist
```

### Source Code Modifications

```text
package.json                                     # [MODIFY] Thêm overrides cho browserslist và qs để vá lỗ hổng
server.ts                                        # [MODIFY] Cấu hình Helmet hoàn chỉnh, thêm httpsRedirect, Permissions-Policy

server/
├── middleware/
│   ├── httpsRedirect.ts                         # [NEW] Middleware bắt buộc HTTPS qua x-forwarded-proto
│   ├── botProtection.ts                         # [NEW] Middleware honeypot & request timing check
│   ├── authMiddleware.ts                        # [MODIFY] Hỗ trợ đọc auth_token từ Cookie song song với Header
│   ├── rateLimiter.ts                           # [MODIFY] Bổ sung cơ chế auto-ban IP khi vượt ngưỡng vi phạm
│   └── __tests__/
│       ├── httpsRedirect.test.ts                # [NEW] Kiểm thử chuyển hướng HTTPS
│       └── botProtection.test.ts                # [NEW] Kiểm thử honeypot bot protection
├── controllers/
│   ├── authController.ts                        # [MODIFY] Thiết lập HttpOnly/Secure/SameSite cookie khi login, xóa khi logout
│   └── __tests__/
│       └── authControllerCookie.test.ts         # [NEW] Kiểm thử session cookie
├── utils/
│   ├── validation.ts                            # [MODIFY] Bổ sung input whitelisting và chống Mass Assignment
│   ├── password.ts                              # [NEW] Tiện ích băm mật khẩu scrypt + timingSafeEqual
│   ├── logger.ts                                # [MODIFY] Tăng cường regex redaction cho Google Gemini keys và tokens
│   └── __tests__/
│       ├── validationWhitelisting.test.ts       # [NEW] Kiểm thử whitelisting dữ liệu
│       └── passwordScrypt.test.ts               # [NEW] Kiểm thử băm mật khẩu scrypt
├── services/
│   └── websocketRelayService.ts                 # [MODIFY] Gia cố kiểm tra collaborator IDOR & token Google
database/
└── migrations/
    └── 001_rls_policies.sql                     # [NEW] Template kịch bản kích hoạt RLS cho PostgreSQL/Supabase
```

**Structure Decision**: Cấu trúc tuân theo chuẩn phân lớp hiện có của dự án: Middleware bảo vệ tại cổng vào (`server/middleware/`), Logic xử lý nghiệp vụ tại (`server/controllers/`), Tiện ích mã hóa & kiểm tra tại (`server/utils/`), và Kịch bản di trú cơ sở dữ liệu mẫu tại (`database/migrations/`).

---

## 5. Complexity Tracking

> Không có vi phạm Hiến pháp. Không phát sinh cấu trúc phức tạp bất thường.

---

## 6. Implementation Phases

### Pha 1: Quét Vá Phụ Thuộc & Cấu Hình Header An Ninh HTTP (Tiêu chuẩn 18, 19, 20)
- Bổ sung trường `overrides` trong `package.json` cho `browserslist: "^4.28.7"` và `qs: "^6.15.4"`.
- Chạy `npm install` và kiểm tra `npm audit --audit-level=high` để xác nhận sạch 0 lỗ hổng nghiêm trọng.
- Tạo middleware `server/middleware/httpsRedirect.ts` tự động chuyển hướng mã 301 khi `req.headers['x-forwarded-proto'] !== 'https'` trong môi trường production.
- Cập nhật `server.ts` với cấu hình Helmet toàn diện:
  - HSTS với `maxAge: 31536000`, `includeSubDomains: true`, `preload: true`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.

### Pha 2: Chuẩn Hóa Xác Thực, Cookie Phiên & Chống Brute-Force (Tiêu chuẩn 6, 9, 10, 11, 12)
- Tạo tiện ích `server/utils/password.ts` sử dụng `crypto.scryptSync` kèm salt 16 bytes ngẫu nhiên và so sánh thời gian cố định `crypto.timingSafeEqual`.
- Cập nhật `server/controllers/authController.ts`:
  - Khi đăng nhập thành công, thiết lập cookie `auth_token` với các cờ: `httpOnly: true`, `secure: isProduction`, `sameSite: 'strict'`, `path: '/'`.
  - Khi đăng xuất, xóa cookie qua `res.clearCookie('auth_token')`.
- Cập nhật `server/middleware/authMiddleware.ts`:
  - Trích xuất token từ `req.headers.cookie` (khóa `auth_token`) bên cạnh `x-auth-token` và `authorization: Bearer`.
- Tạo middleware `server/middleware/botProtection.ts` kiểm tra trường ẩn Honeypot (`hp_time`, `hp_username`) để loại bỏ bot spam tự động.

### Pha 3: Kiểm Soát Đầu Vào, Chống Bơm Trường & Triệt Tiêu Lỗ Hổng Tiêm Nhiễm (Tiêu chuẩn 8, 13, 14, 15, 16)
- Cập nhật `server/utils/validation.ts`:
  - Thêm cơ chế Whitelisting: trích xuất đích danh các trường hợp lệ, loại bỏ hoàn toàn các trường dữ liệu lạ không nằm trong danh mục (chống Mass Assignment).
  - Định nghĩa kiểu trả về kèm dữ liệu đã làm sạch: `{ valid: true, data: CleanedDTO }`.
- Triệt tiêu nguy cơ tiêm nhiễm lệnh Redis qua chuẩn hóa chuỗi khóa: loại bỏ ký tự điều khiển, khoảng trắng, xuống dòng trong Redis keys.
- Kiểm tra tính an toàn của tệp tin: giới hạn kích thước tối đa 15MB cho raw text/epub, kiểm tra magic number zip (`PK\x03\x04`) cho epub.

### Pha 4: Kiểm Soát Truy Cập IDOR, Phân Tách Khóa & Bảo Vệ Bí Mật Hệ Thống (Tiêu chuẩn 1, 2, 3, 4, 5, 7, 17)
- Cập nhật `server/utils/logger.ts`:
  - Tăng cường regex che giấu toàn bộ Google Gemini API Keys (`AIza...`), OpenAI/Anthropic keys, mật khẩu, và Bearer tokens.
  - Đảm bảo error stack traces không bao giờ xuất hiện trong log production hoặc phản hồi client.
- Cập nhật `server/services/websocketRelayService.ts`:
  - Tích hợp kiểm tra quyền truy cập của `userEmail` đối với `projectId` trước khi cho phép nâng cấp socket vào phòng CRDT.
- Tạo tệp di trú mẫu `database/migrations/001_rls_policies.sql` kích hoạt RLS và các chính sách bảo vệ cấp hàng cho Supabase/PostgreSQL.
- Xây dựng hướng dẫn dọn dẹp Git secrets bằng `git-filter-repo`.

### Pha 5: Kiểm Thử Nghiệm Thu & Đảm Bảo Quality Gates
- Viết unit tests cho các middleware và tiện ích mới:
  - `server/middleware/__tests__/httpsRedirect.test.ts`
  - `server/middleware/__tests__/botProtection.test.ts`
  - `server/controllers/__tests__/authControllerCookie.test.ts`
  - `server/utils/__tests__/validationWhitelisting.test.ts`
  - `server/utils/__tests__/passwordScrypt.test.ts`
- Chạy `npm run lint`, `npm test`, và `npm run build` xác nhận 100% pass.
- Thực hiện kiểm tra cURL cho các kịch bản trong `quickstart.md`.

---

## 7. Verification Plan

### Automated Tests
- `npm run lint`: Xác minh TypeScript compilation không có bất kỳ lỗi nào.
- `npm test`: Chạy toàn bộ test suites (hiện tại 96 suites, 675 tests + các tests mới), bảo đảm 100% pass.
- `npm run build`: Build thành công cả frontend bundle (Vite) và backend server bundle (esbuild).
- `npm audit --audit-level=high`: Xác nhận 0 lỗ hổng nghiêm trọng.

### Security Scenarios
- **Scenario 1: Security Headers**: Kiểm tra phản hồi HTTP có đủ HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy.
- **Scenario 2: HTTPS Redirect**: Gửi request với `x-forwarded-proto: http`, nhận mã 301 chuyển hướng sang HTTPS.
- **Scenario 3: Brute-Force Rate Limit**: Gửi 11 lần đăng nhập sai liên tiếp, nhận HTTP 429 sau lần thứ 10.
- **Scenario 4: Mass Assignment Protection**: Gửi request có trường `{ role: "admin", isOwner: true }`, xác nhận server loại bỏ hoàn toàn các trường này.
- **Scenario 5: Secret Masking**: Kiểm tra log console khi có lỗi API key, xác nhận chuỗi `AIzaSy...` hiển thị thành `AIza***[REDACTED]`.

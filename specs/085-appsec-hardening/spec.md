# Feature Specification: Toàn Diện 20 Tiêu Chuẩn Bảo Mật Ứng Dụng (AppSec Hardening)

**Feature Directory**: `specs/085-appsec-hardening`  
**Created**: 2026-09-05  
**Role**: Application Security Engineer (AppSec)  
**Status**: SPECIFIED  

---

## 1. Tóm Tắt Khảo Sát & Phạm Vi Kiến Trúc Hệ Thống (Executive Summary)

Dự án **AI Dịch Truyện Trung - Việt** vận hành theo mô hình phân tán:
- **Frontend Client**: React 19 + TypeScript + Vite. Dữ liệu chương truyện, tiểu thuyết và từ điển được lưu trữ cục bộ tại trình duyệt qua **IndexedDB** (`src/services/db.ts`), đồng bộ thời gian thực qua **Yjs CRDT** (`y-indexeddb`), và sao lưu tùy chọn lên **Google Drive** của người dùng (`googleDriveSyncService.ts`) qua OAuth 2.0 PKCE.
- **Backend Service**: Express.js + Node.js (`server.ts`, `server/`), kết nối **Redis** (`ioredis`) phục vụ rate limiting phân tán, bộ nhớ cache session và pub/sub chuyển tiếp dữ liệu CRDT đa thực thể.
- **AI Calling Pipeline**: Tích hợp Google Gemini API qua 2 cơ chế: gọi trực tiếp từ client (`directTranslationEngine.ts`) hoặc thông qua backend proxy với danh sách API keys luân chuyển an toàn.

Bản đặc tả này thiết lập ma trận kiểm soát bảo mật toàn diện cho **20 tiêu chuẩn AppSec**, ngăn chặn mọi nguy cơ rò rỉ khóa bảo mật, tấn công leo thang đặc quyền (IDOR, Mass Assignment), tiêm nhiễm mã độc (SQLi, XSS), cạn kiệt tài nguyên (DDoS, Brute-force), và các lỗ hổng chuỗi cung ứng phần mềm.

---

## 2. Ma Trận Đánh Giá & Đặc Tả 20 Tiêu Chuẩn AppSec

### Tiêu chuẩn 1: Hide API Keys (Bảo vệ API Key và Bí mật Hệ thống)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Mã nguồn không chứa khóa cứng (`AIzaSy...` chỉ xuất hiện trong mock fixtures/tests). Tuy nhiên, nếu người dùng cấu hình `GEMINI_API_KEY` phía server hoặc người dùng nhập key trên giao diện, key có nguy cơ bị lộ nếu xuất hiện trong error log, network payload không mã hóa, hoặc bundle build client.
- **Tệp tin liên quan**: `server/services/apiKeyEncryption.ts`, `server/utils/logger.ts`, `src/context/AIConfigContext.tsx`, `server.ts`.
- **Yêu cầu kỹ thuật**:
  - Không bundle bất kỳ secret nào bắt đầu bằng `VITE_` ngoại trừ Client ID công khai.
  - Toàn bộ log server khi ghi nhận request phải tự động che giấu (redact/mask) pattern `AIza[0-9A-Za-z-_]{35}` thành `AIzaSy...xxxx`.
  - Khóa API truyền trong session phải được mã hóa tại tầng lưu trữ bộ nhớ/Redis bằng AES-256-GCM.

### Tiêu chuẩn 2: Purge Git Secrets (Dọn dẹp Bí mật khỏi Lịch sử Git)
- **Đánh giá rủi ro hiện tại**: Mức độ **THẤP**. File `.gitignore` đã có cấu hình chặn `.env*` (ngoại trừ `.env.example`). Tuy nhiên, cần quy trình chuẩn để quét lịch sử commit và thanh lọc vĩnh viễn nếu từng có commit nhầm.
- **Tệp tin liên quan**: `.gitignore`, `.env.example`, Git history.
- **Yêu cầu kỹ thuật**:
  - Sử dụng công cụ chuyên dụng `git-filter-repo` hoặc `BFG Repo-Cleaner` để loại bỏ triệt để các chuỗi khóa bí mật khỏi Git commit tree và reflog.
  - Bổ sung pre-commit hook chặn commit các file `.env`, `*.pem`, `*.key`, `id_rsa`.

### Tiêu chuẩn 3: Use Public DB Key (Phân tách Khóa Cơ sở dữ liệu Public vs Secret)
- **Đánh giá rủi ro hiện tại**: Mức độ **THẤP**. Hệ thống hiện dùng IndexedDB client-side và Redis backend. Trong kịch bản tích hợp Supabase/PostgreSQL cho cloud persistence: tuyệt đối không đưa `service_role_key` hoặc database connection string có mật khẩu lên client.
- **Tệp tin liên quan**: `.env.example`, `server.ts`, `src/services/db.ts`.
- **Yêu cầu kỹ thuật**:
  - Client chỉ được phép nhận `SUPABASE_ANON_KEY` / `PUBLIC_URL`.
  - `SUPABASE_SERVICE_ROLE_KEY` và `DATABASE_URL` chỉ được tồn tại trong biến môi trường backend (Node.js runtime).

### Tiêu chuẩn 4: Enable Row-Level Security (Bảo vệ Dữ liệu Cấp Hàng RLS)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Hiện tại dữ liệu lưu cục bộ trên IndexedDB của từng trình duyệt. Khi mở rộng lưu trữ trên PostgreSQL/Supabase, nếu không bật RLS thì mọi user có anon key đều có thể query toàn bộ bảng `projects`, `chapters`, `glossary`.
- **Tệp tin liên quan**: `database/migrations/001_initial_schema.sql`, PostgreSQL/Supabase setup.
- **Yêu cầu kỹ thuật**:
  - Thực thi lệnh `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` cho 100% các bảng.
  - Thiết lập chính sách kiểm soát: chỉ người tạo (`auth.uid() = user_id`) hoặc cộng tác viên trong danh sách `collaborators` mới có quyền `SELECT`, `UPDATE`, `DELETE`.

### Tiêu chuẩn 5: Encrypt Sensitive Data (Mã hóa Dữ liệu Nhạy cảm ở Tầng Lưu trữ)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Khóa API Gemini của người dùng lưu tại `localStorage` trình duyệt và trong RAM/Redis session.
- **Tệp tin liên quan**: `server/services/apiKeyEncryption.ts`, `src/utils/security.ts`.
- **Yêu cầu kỹ thuật**:
  - Áp dụng thuật toán mã hóa chuẩn công nghiệp AES-256-GCM với vector khởi tạo (IV) ngẫu nhiên 96-bit và Authentication Tag 128-bit cho toàn bộ API key lưu trong Redis.
  - Khóa mã hóa chính (`ENCRYPTION_MASTER_KEY`) lấy từ biến môi trường máy chủ, dẫn xuất qua PBKDF2/scrypt.

### Tiêu chuẩn 6: Enforce Server-Side Authentication (Xác thực Bắt buộc Phía Server)
- **Đánh giá rủi ro hiện tại**: Mức độ **CAO** khi triển khai public không có mật khẩu. Hiện tại nếu `ACCESS_PASSWORD` để trống, server mở công khai API.
- **Tệp tin liên quan**: `server/middleware/authMiddleware.ts`, `server/services/websocketRelayService.ts`.
- **Yêu cầu kỹ thuật**:
  - Khi chạy ở môi trường production (`NODE_ENV=production`), bắt buộc xác thực server-side token cho mọi endpoint nghiệp vụ tiêu tốn tài nguyên (`/api/translate-*`, `/api/polish-*`, `/ws/sync`).
  - WebSocket Relay `/ws/sync` bắt buộc kiểm tra token Google OAuth hợp lệ trước khi cho phép nâng cấp kết nối (HTTP 401 Unauthorized nếu thiếu/sai).

### Tiêu chuẩn 7: Lock Record Access (Chống Lỗ hổng IDOR - Insecure Direct Object Reference)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Trong kết nối WebSocket CRDT real-time (`/ws/sync?projectId=...&chapterId=...`), nếu client gửi tùy ý `projectId`, relay cần xác thực xem user có thuộc danh sách cộng tác viên không.
- **Tệp tin liên quan**: `server/services/websocketRelayService.ts`, `src/services/googleDrivePermissionsService.ts`.
- **Yêu cầu kỹ thuật**:
  - Phòng chống IDOR bằng cách xác minh quyền sở hữu hoặc quyền cộng tác viên của `userEmail` đối với `projectId` trước khi add socket vào room.

### Tiêu chuẩn 8: Block Field Tampering (Chống Can thiệp Trường Dữ liệu - Mass Assignment)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Các endpoint nhận request body có thể bị kẻ tấn công bơm thêm các trường nhạy cảm (`role: 'admin'`, `isOwner: true`, `verified: true`).
- **Tệp tin liên quan**: `server/controllers/sessionController.ts`, `server/utils/validation.ts`.
- **Yêu cầu kỹ thuật**:
  - Sử dụng cơ chế Whitelisting (chỉ trích xuất đích danh các trường hợp lệ từ `req.body`, loại bỏ toán tử lan truyền `...req.body`).

### Tiêu chuẩn 9: Secure Session Cookies (Cờ Bảo mật Cookie Phiên)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Hệ thống hiện trả token trong JSON body (`x-auth-token`). Nếu chuyển sang cookie cần đảm bảo cờ bảo mật.
- **Tệp tin liên quan**: `server/controllers/authController.ts`, `server.ts`.
- **Yêu cầu kỹ thuật**:
  - Thiết lập cookie với đầy đủ 4 cờ bắt buộc: `HttpOnly = true` (chống đánh cắp qua XSS), `Secure = true` (chỉ gửi qua HTTPS), `SameSite = 'Strict'` (chống CSRF), `Path = '/'`.

### Tiêu chuẩn 10: Hash Passwords (Băm Mật khẩu Chuẩn An toàn)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. `ACCESS_PASSWORD` so sánh qua SHA-256 + `timingSafeEqual`. Nếu có bảng lưu người dùng cá nhân, SHA-256 đơn thuần không có salt là không an toàn trước rainbow table / GPU cracking.
- **Tệp tin liên quan**: `server/services/authStore.ts`, `server/utils/password.ts`.
- **Yêu cầu kỹ thuật**:
  - Băm mật khẩu người dùng bằng **Argon2id** (hoặc **bcrypt** với cost factor tối thiểu 12), tự động tạo salt ngẫu nhiên cho mỗi mật khẩu.

### Tiêu chuẩn 11: Rate Limit Login (Chống Tấn công Dò Mật khẩu Brute-Force)
- **Đánh giá rủi ro hiện tại**: Mức độ **ĐÃ XỬ LÝ 1 PHẦN**. Đã có `authLoginRateLimiter` (10 request / 15 phút).
- **Tệp tin liên quan**: `server/middleware/rateLimiter.ts`, `server/routes/api.ts`.
- **Yêu cầu kỹ thuật**:
  - Đảm bảo cơ chế rate limiter hoạt động chính xác cả ở môi trường phân tán qua Redis (`INCR` + `EXPIRE` atomic).
  - Tự động khóa IP tạm thời (Blocklist) nếu vượt quá ngưỡng vi phạm liên tục.

### Tiêu chuẩn 12: Add Bot Protection (Chống Bot Tự động hóa)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Các form mở công khai (đăng nhập, submit) có thể bị script tự động spam.
- **Tệp tin liên quan**: `server/middleware/botProtection.ts`, `src/components/AuthModal.tsx`.
- **Yêu cầu kỹ thuật**:
  - Tích hợp Cloudflare Turnstile token verification ở backend hoặc Honeypot hidden fields (`hp_time`, `hp_username`) để nhận diện bot không dùng browser thực tế.

### Tiêu chuẩn 13: Parameterize Queries (Triệt tiêu SQL Injection)
- **Đánh giá rủi ro hiện tại**: Mức độ **THẤP TRONG THỰC TẾ** (do hiện dùng NoSQL Redis + IndexedDB), nhưng **BẮT BUỘC** khi tích hợp cơ sở dữ liệu quan hệ SQL.
- **Tệp tin liên quan**: `server/services/dbClient.ts`, Database access layer.
- **Yêu cầu kỹ thuật**:
  - Tuyệt đối cấm nối chuỗi thủ công trong câu lệnh SQL (`SELECT * FROM ... WHERE id = '` + id + `'`).
  - Bắt buộc 100% sử dụng Prepared Statements có tham số hóa (`$1, $2, ...` trong Postgres) hoặc ORM chuẩn (Prisma/Kysely).
  - Đối với Redis: chuẩn hóa key pattern, cấm nội suy chuỗi không kiểm soát làm phát sinh Redis injection.

### Tiêu chuẩn 14: Validate All Input (Xác thực Dữ liệu Đầu vào Toàn diện)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Hiện đã có `server/utils/validation.ts` kiểm tra thủ công một số endpoint, nhưng chưa dùng Schema Validator tập trung.
- **Tệp tin liên quan**: `server/utils/validation.ts`, `server/routes/api.ts`.
- **Yêu cầu kỹ thuật**:
  - Triển khai Schema Validator (Zod/Joi) chặt chẽ cho 100% các request body, query parameter và URL params.
  - Từ chối mọi trường lạ không nằm trong schema (`strict()` mode).

### Tiêu chuẩn 15: Escape User Content (Làm sạch Nội dung Ngăn chặn Stored XSS)
- **Đánh giá rủi ro hiện tại**: Mức độ **ĐÃ KIỂM SOÁT TỐT**. Đã có hàm `escapeHtml` cho các modal hiển thị diff. Cần duy trì cho toàn bộ văn bản Hán tự và nội dung dịch.
- **Tệp tin liên quan**: `server/utils/text.ts`, `src/components/auto-translator/DiffModal.tsx`.
- **Yêu cầu kỹ thuật**:
  - Mã hóa các ký tự nhạy cảm (`&`, `<`, `>`, `"`, `'`, `/`) thành HTML entities tương ứng trước khi truyền vào ngữ cảnh có nguy cơ nội suy HTML.
  - Hạn chế tối đa `dangerouslySetInnerHTML`.

### Tiêu chuẩn 16: Restrict File Uploads (Giới hạn và Kiểm soát Tệp Tải lên)
- **Đánh giá rủi ro hiện tại**: Mức độ **THẤP**. File `.txt` và `.epub` hiện được phân tích phía client qua Web API (`FileReader`, `DOMParser`).
- **Tệp tin liên quan**: `src/utils/fileParser.ts`, `server.ts`.
- **Yêu cầu kỹ thuật**:
  - Giới hạn kích thước file tải lên (tối đa 15MB cho file raw truyện).
  - Kiểm tra MIME type thực tế và magic numbers của file (ví dụ file zip PK cho epub), không chỉ dựa vào đuôi mở rộng file.
  - Nếu lưu trữ file lên server, bắt buộc tạo tên file ngẫu nhiên (UUID v4) và lưu ngoài thư mục public root.

### Tiêu chuẩn 17: Trim API Responses (Lọc bỏ Dữ liệu Thừa & Nhạy cảm)
- **Đánh giá rủi ro hiện tại**: Mức độ **ĐÃ KIỂM SOÁT**. Error classifier đã chuẩn hóa lỗi thành mã lỗi ngắn gọn.
- **Tệp tin liên quan**: `server/utils/errorClassifier.ts`, `server/controllers/translation/rawController.ts`.
- **Yêu cầu kỹ thuật**:
  - Tuyệt đối không trả stack trace, internal file path, mật khẩu hash, hoặc raw upstream Gemini API response trong môi trường production.
  - Trả về cấu trúc DTO (Data Transfer Object) được định nghĩa rõ ràng.

### Tiêu chuẩn 18: Add Security Headers (Bổ sung Đầy đủ Header An ninh)
- **Đánh giá rủi ro hiện tại**: Mức độ **ĐÃ CẤU HÌNH CƠ BẢN**. Đã có `helmet` với CSP cho Google APIs. Cần bổ sung HSTS, X-Content-Type-Options, Permissions-Policy.
- **Tệp tin liên quan**: `server.ts`.
- **Yêu cầu kỹ thuật**:
  - Cấu hình Helmet với:
    - `Strict-Transport-Security` (HSTS): `maxAge: 31536000, includeSubDomains: true, preload: true`.
    - `X-Content-Type-Options`: `nosniff`.
    - `X-Frame-Options`: `DENY` (hoặc frame-ancestors: 'none').
    - `Referrer-Policy`: `strict-origin-when-cross-origin`.
    - `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`.

### Tiêu chuẩn 19: Force HTTPS (Bắt buộc Chuyển hướng HTTPS)
- **Đánh giá rủi ro hiện tại**: Mức độ **TRUNG BÌNH**. Cloud Run / Render thường terminate SSL ở tầng reverse proxy. Nếu không kiểm tra `x-forwarded-proto`, client có thể truy cập qua HTTP không mã hóa.
- **Tệp tin liên quan**: `server.ts`, `server/middleware/httpsRedirect.ts`.
- **Yêu cầu kỹ thuật**:
  - Bổ sung middleware kiểm tra header `req.headers['x-forwarded-proto'] !== 'https'` trong môi trường production và tự động chuyển hướng với mã trạng thái `301 Moved Permanently`.

### Tiêu chuẩn 20: Scan Dependencies (Rà soát & Vá Lỗ hổng Phụ thuộc)
- **Đánh giá rủi ro hiện tại**: Mức độ **CAO**. `npm audit` phát hiện 4 lỗ hổng (3 moderate trong `qs` / `body-parser` / `express`, 1 high trong `browserslist`).
- **Tệp tin liên quan**: `package.json`, `package-lock.json`.
- **Yêu cầu kỹ thuật**:
  - Cập nhật các dependency dễ bị tổn thương lên phiên bản an toàn (`browserslist >= 4.28.7`, cập nhật `express` / override `qs >= 6.15.4`).
  - Thiết lập lệnh kiểm tra bảo mật tự động `npm audit --audit-level=high` trong CI pipeline.

---

## 3. Kế Hoạch Nghiệm Thu & Tiêu Chí Thành Công (Success Criteria)

- **SC-001**: 0 secret, API key hoặc token nhạy cảm bị rò rỉ trong frontend bundle hoặc server logs.
- **SC-002**: 100% endpoint được bảo vệ bởi xác thực máy chủ và rate limiter phân tán chống brute-force.
- **SC-003**: 100% header an ninh HTTP (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) được trả về trong mọi phản hồi production.
- **SC-004**: `npm audit --audit-level=high` báo cáo **0 lỗ hổng nghiêm trọng**.
- **SC-005**: 100% Quality Gates (`npm run lint`, `npm test`, `npm run build`) tiếp tục vượt qua ổn định.

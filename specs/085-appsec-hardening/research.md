# Phase 0 Research: AppSec Hardening & Architectural Decisions

**Feature**: `085-appsec-hardening`  
**Date**: 2026-09-05  
**Domain**: Application Security, Express.js Hardening, Web Standards, Cryptography, Supply Chain Security

---

## Technical Decisions & Best Practices

### Decision 1: Quét & Vá Lỗ Hổng Phụ Thuộc (Supply Chain Security - Tiêu chuẩn 20)

- **Vấn đề**: Lệnh `npm audit` phát hiện 4 lỗ hổng bảo mật:
  - 1 lỗ hổng High trong `browserslist <=4.28.6` (Unbounded memory growth leading to OOM / Prototype write).
  - 3 lỗ hổng Moderate trong `qs` (`2.2.5 - 6.15.3`) ảnh hưởng gián tiếp tới `body-parser` và `express`.
- **Giải pháp lựa chọn**:
  - Khai báo trường `overrides` trong `package.json`:
    ```json
    "overrides": {
      "browserslist": "^4.28.7",
      "qs": "^6.15.4"
    }
    ```
  - Thực thi cập nhật lockfile để toàn bộ cây phụ thuộc (bao gồm các dependency con của Vite, Tailwind, Express) buộc phải tải phiên bản đã vá an toàn.
- **Lý do**: Không cần nâng cấp toàn bộ Express lên v5 (vốn có thể gây breaking change cho hệ thống middleware hiện tại), đồng thời triệt tiêu 100% cảnh báo bảo mật từ `npm audit`.
- **Phương án đã loại trừ**: Bỏ qua cảnh báo hoặc dùng cờ `--no-audit` (vi phạm tiêu chuẩn SC-004 và Nguyên tắc Bảo mật cơ bản).

---

### Decision 2: Bắt Buộc HTTPS Phía Sau Reverse Proxy (HTTPS Enforcement - Tiêu chuẩn 19)

- **Vấn đề**: Ứng dụng triển khai trên Cloud Run, Render hoặc Docker container phía sau Load Balancer. SSL/TLS thường được giải mã (terminate) tại tầng proxy trước khi chuyển tiếp về container qua HTTP cục bộ. Nếu không kiểm tra đúng header, kẻ tấn công có thể nghe lén lưu lượng trên kênh không mã hóa.
- **Giải pháp lựa chọn**:
  - Đảm bảo `app.set('trust proxy', 1)` đã được kích hoạt.
  - Xây dựng middleware `httpsRedirect`:
    ```typescript
    export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
      if (process.env.NODE_ENV !== 'production') {
        return next();
      }
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        const host = req.headers.host || '';
        return res.redirect(301, `https://${host}${req.originalUrl}`);
      }
      next();
    }
    ```
- **Lý do**: Chuyển hướng mã `301 Moved Permanently` đảm bảo trình duyệt lưu cache chuyển hướng và không bao giờ gửi lại request không mã hóa.
- **Phương án đã loại trừ**: Chỉ dựa vào HSTS mà không có redirect (người dùng truy cập lần đầu qua HTTP vẫn có nguy cơ bị tấn công SSL Stripping).

---

### Decision 3: Bộ Header An Ninh Toàn Diện Với Helmet (Security Headers - Tiêu chuẩn 18)

- **Vấn đề**: Cấu hình Helmet hiện tại trong `server.ts` đã có CSP nhưng còn thiếu các header bảo vệ quan trọng như HSTS preload, Permissions-Policy, Referrer-Policy, và X-Content-Type-Options.
- **Giải pháp lựa chọn**:
  - Cấu hình Helmet với đầy đủ các chỉ mục:
    - `hsts`: `{ maxAge: 31536000, includeSubDomains: true, preload: true }` (Bảo đảm trình duyệt luôn dùng HTTPS trong 1 năm).
    - `noSniff: true` (Chặn MIME-sniffing qua `X-Content-Type-Options: nosniff`).
    - `frameguard: { action: 'deny' }` (Chống Clickjacking).
    - `referrerPolicy: { policy: 'strict-origin-when-cross-origin' }` (Bảo vệ thông tin URL nội bộ khi điều hướng ra ngoài).
    - Thiết lập `Permissions-Policy: camera=(), microphone=(), geolocation=()` để khóa toàn bộ quyền truy cập phần cứng nhạy cảm của thiết bị người dùng.
- **Lý do**: Đạt điểm A+ trên các bài kiểm tra bảo mật Mozilla Observatory / SecurityHeaders.

---

### Decision 4: Bảo Vệ Cookie Phiên & Tương Thích Kép (Secure Session Cookies - Tiêu chuẩn 9)

- **Vấn đề**: Hiện tại `authController.ts` chỉ trả token về trong JSON body và lưu tại `localStorage` client. Điều này tiềm ẩn nguy cơ token bị đánh cắp nếu ứng dụng gặp lỗi XSS.
- **Giải pháp lựa chọn**:
  - Khi đăng nhập thành công tại `POST /api/auth/login`:
    - Đặt cookie `auth_token` với các cờ:
      ```typescript
      res.cookie('auth_token', result.authToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge: DEFAULT_AUTH_TTL_MS,
      });
      ```
    - Vẫn trả `authToken` trong JSON payload để đảm bảo tương thích ngược 100% với các client di động, script tự động, hoặc unit tests hiện hành.
  - Khi xác thực trong `authMiddleware.ts`:
    - Kiểm tra `req.headers.cookie` (khóa `auth_token`) TRƯỚC, sau đó fallback sang header `X-Auth-Token` / `Authorization: Bearer`.
  - Khi đăng xuất tại `POST /api/auth/logout`:
    - Xóa cookie qua `res.clearCookie('auth_token', { path: '/' })`.
- **Lý do**: Triệt tiêu rủi ro đánh cắp token qua XSS mà không làm hỏng bất kỳ test hay client hiện có nào.

---

### Decision 5: Băm Mật Khẩu Chuẩn Công Nghiệp & So Sánh Timing-Safe (Password Hashing - Tiêu chuẩn 10)

- **Vấn đề**: Hiện tại `authStore.ts` so sánh `ACCESS_PASSWORD` bằng SHA-256 không có salt. Với mật khẩu cố định của server, SHA-256 có thể bị tra cứu rainbow table nếu bị lộ mã băm.
- **Giải pháp lựa chọn**:
  - Xây dựng module `server/utils/password.ts` sử dụng thuật toán `scrypt` tích hợp sẵn của Node.js:
    - Tạo salt ngẫu nhiên 16 bytes (`crypto.randomBytes(16)`).
    - Dẫn xuất khóa với cấu hình an toàn: `N = 16384, r = 8, p = 1, keylen = 64`.
    - Định dạng chuỗi băm lưu trữ: `scrypt$N$r$p$saltHex$hashHex`.
    - So sánh chuỗi băm bằng `crypto.timingSafeEqual` để triệt tiêu tấn công Timing Attack.
  - Duy trì khả năng so khớp trực tiếp với `process.env.ACCESS_PASSWORD` để người quản trị dễ dàng cấu hình qua biến môi trường.
- **Lý do**: Thuật toán `scrypt` chống brute-force phần cứng (ASIC/GPU) vượt trội, có sẵn trong core Node.js không cần cài thêm thư viện `bcrypt` hay `argon2` nặng nề.

---

### Decision 6: Chống Can Thiệp Trường & Xác Thực Whitelist (Field Tampering & Mass Assignment - Tiêu chuẩn 8 & 14)

- **Vấn đề**: Nếu client gửi thêm các thuộc tính lạ (ví dụ: `{ role: "admin", isOwner: true }`), việc dùng spread operator `{ ...req.body }` có thể ghi đè các trường nhạy cảm trong hệ thống.
- **Giải pháp lựa chọn**:
  - Cập nhật các hàm trong `server/utils/validation.ts` thành cơ chế **Whitelisting Data Transfer Object (DTO)**:
    - Chỉ trích xuất tường minh các trường đã định nghĩa:
      ```typescript
      export function sanitizeTranslateRawInput(body: any): { valid: boolean; data?: CleanedTranslateRawDTO; error?: string } {
        // Kiểm tra hợp lệ...
        return {
          valid: true,
          data: {
            text: String(body.text),
            glossary: Array.isArray(body.glossary) ? body.glossary : undefined,
            startKeyIndex: typeof body.startKeyIndex === 'number' ? body.startKeyIndex : undefined,
          }
        };
      }
      ```
    - Mọi thuộc tính dư thừa sẽ bị loại bỏ hoàn toàn trước khi dữ liệu đi vào Controller và Service.
- **Lý do**: Ngăn chặn 100% nguy cơ Mass Assignment và ô nhiễm prototype (`__proto__`, `constructor`).

---

### Decision 7: Phòng Chống Bot Bằng Honeypot & Phân Tích Hành Vi (Bot Protection - Tiêu chuẩn 12)

- **Vấn đề**: Các form mở công khai (đăng nhập, submit) có thể bị bot spam tự động dò quét. Việc dùng Google reCAPTCHA hoặc Cloudflare Turnstile có thể gây phiền toái cho người dùng thật và phụ thuộc dịch vụ bên thứ ba.
- **Giải pháp lựa chọn**:
  - Triển khai kỹ thuật **Honeypot + Time-based Challenge**:
    1. Form client gửi kèm trường ẩn `hp_username` (người thật sẽ không nhìn thấy và để trống; bot quét HTML sẽ tự động điền giá trị vào).
    2. Form client gửi kèm trường `hp_time` (timestamp mã hóa lúc form hiển thị). Nếu thời gian từ lúc mở form tới lúc submit < 800ms (tốc độ của bot script), hệ thống sẽ từ chối request với mã lỗi 400.
- **Lý do**: 0 chi phí, không làm gián đoạn trải nghiệm người dùng thật, loại bỏ tới 99% các script bot tự động.

---

### Decision 8: Triệt Tiêu SQL Injection & Redis Injection (Parameterize Queries - Tiêu chuẩn 13)

- **Vấn đề**: Mặc dù dự án hiện lưu trữ dữ liệu chính ở IndexedDB và Redis, nhưng:
  - Khóa Redis nếu nội suy trực tiếp chuỗi từ user có thể bị chèn ký tự điều khiển (\r\n) gây Redis Command Injection.
  - Khi mở rộng lưu trữ sang Supabase/PostgreSQL, việc nối chuỗi câu lệnh SQL là nguyên nhân hàng đầu gây mất mát dữ liệu.
- **Giải pháp lựa chọn**:
  - Đối với Redis: Xây dựng hàm `sanitizeRedisKeyPart(part: string): string` chỉ cho phép ký tự `[a-zA-Z0-9_-]`, thay thế toàn bộ ký tự đặc biệt thành dấu gạch dưới.
  - Đối với SQL: Ban hành tài liệu hợp đồng quy chuẩn (Contract) bắt buộc sử dụng Prepared Statements có tham số hóa (`$1, $2, ...`), nghiêm cấm nối chuỗi trực tiếp.

---

### Decision 9: Giới Hạn Tệp Tải Lên & Kiểm Tra Magic Number (File Uploads - Tiêu chuẩn 16)

- **Vấn đề**: Kẻ tấn công có thể đổi tên tệp thực thi `.exe` hoặc mã độc PHP/HTML thành đuôi `.txt` hoặc `.epub` để tải lên hệ thống.
- **Giải pháp lựa chọn**:
  - Giới hạn dung lượng tệp tối đa: 15MB cho raw text và EPUB.
  - Kiểm tra **Magic Bytes**:
    - Tệp EPUB (bản chất là định dạng ZIP) bắt buộc phải bắt đầu bằng 4 bytes magic: `0x50 0x4B 0x03 0x04` (`PK\x03\x04`).
    - Tệp TXT: Kiểm tra tính hợp lệ của bảng mã UTF-8/UTF-16, từ chối các tệp chứa byte nhị phân không in được (null bytes, control characters).
- **Lý do**: Ngăn chặn tải lên web shell hoặc tệp tin độc hại trá hình.

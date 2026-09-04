# Phase 1 Interface Contracts: Application Security & API Standards

**Feature**: `085-appsec-hardening`  
**Date**: 2026-09-05  

---

## 1. Security Headers Contract (HTTP Response)

Mọi phản hồi HTTP từ máy chủ Express (kể cả phản hồi lỗi 4xx/5xx) **BẮT BUỘC** trả về đầy đủ các header an ninh sau:

| Tên Header | Giá trị bắt buộc | Mục đích an ninh |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Ép buộc trình duyệt chỉ kết nối qua HTTPS |
| `X-Content-Type-Options` | `nosniff` | Chặn MIME-sniffing thực thi file độc hại |
| `X-Frame-Options` | `DENY` | Chống tấn công Clickjacking hoàn toàn |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Bảo vệ URL nội bộ khi người dùng click link ngoài |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Khóa quyền truy cập camera, mic, vị trí |
| `Content-Security-Policy` | Chỉ cho phép self, Google APIs và font gstatic | Chống XSS và chặn chèn script độc hại |

---

## 2. Authentication Handshake Contract

### 2.1 POST `/api/auth/login`

**Yêu cầu Request Body (Strict Whitelist)**:
```json
{
  "password": "string (1-256 ký tự)",
  "hp_username": "" // BẮT BUỘC để trống (Honeypot field)
}
```

**Phản hồi Thành công (HTTP 200)**:
- **Set-Cookie**:
  ```http
  Set-Cookie: auth_token=a1b2c3...64chars; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
  ```
- **JSON Body**:
  ```json
  {
    "success": true,
    "authToken": "a1b2c3...64chars",
    "expiresAt": 1788636800000,
    "message": "Đăng nhập máy chủ thành công."
  }
  ```

**Phản hồi Sai Mật khẩu (HTTP 401)**:
```json
{
  "error": "Mật khẩu truy cập máy chủ không chính xác."
}
```

**Phản hồi Quá Số Lần Đăng Nhập (HTTP 429)**:
```json
{
  "error": "Quá nhiều lần thử đăng nhập không thành công. Vui lòng chờ 15 phút rồi thử lại."
}
```

### 2.2 POST `/api/auth/logout`

- **Set-Cookie**: `auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
- **JSON Body**:
  ```json
  {
    "success": true,
    "message": "Đã đăng xuất máy chủ thành công."
  }
  ```

---

## 3. Standardized Error DTO Contract (Trimmed API Responses)

Tuyệt đối không trả về stack trace, file path nội bộ hoặc chi tiết lỗi nhạy cảm của Gemini API ở môi trường production.

```typescript
export interface StandardErrorResponse {
  /**
   * Thông điệp lỗi an toàn hiển thị cho người dùng
   */
  error: string;

  /**
   * Mã lỗi phân loại ngắn gọn (ví dụ: RATE_LIMIT_EXCEEDED, INVALID_INPUT, UNAUTHORIZED)
   */
  code?: string;

  /**
   * Request ID phục vụ tra cứu log phía server
   */
  requestId?: string;
}
```

---

## 4. Input Whitelisting Schema Contract

Mọi endpoint POST tiếp nhận dữ liệu đều phải đi qua bộ trích xuất Whitelist:

### Endpoint: `POST /api/translate-raw`
- **Trường cho phép**:
  - `text`: string (bắt buộc, độ dài $1 \le \text{len} \le 1,000,000$).
  - `glossary`: Array of objects (tùy chọn).
  - `startKeyIndex`: integer $\ge 0$ (tùy chọn).
- **Trường bị loại bỏ**: Toàn bộ các thuộc tính khác (ví dụ: `role`, `admin`, `__proto__`).

---

## 5. WebSocket Relay Security Upgrade Contract (`/ws/sync`)

Khi thiết lập kết nối WebSocket tới `/ws/sync?projectId=...&chapterId=...&token=...`:

1. **Xác thực IP**:
   - Nếu số socket đang mở từ cùng IP $\ge 20$, từ chối với: `HTTP/1.1 429 Too Many Requests`.
2. **Xác thực Google OAuth Token**:
   - Gửi yêu cầu kiểm tra token tại `https://www.googleapis.com/oauth2/v3/userinfo`.
   - Nếu token không hợp lệ hoặc thiếu, từ chối với: `HTTP/1.1 401 Unauthorized`.
3. **Phòng chống IDOR (Kiểm tra quyền truy cập dự án)**:
   - Nếu dự án có danh sách `collaborators`, email của người dùng bắt buộc phải nằm trong danh sách được cấp phép.
   - Nếu không có quyền, từ chối kết nối với mã: `HTTP/1.1 403 Forbidden`.

---

## 6. Rate Limiting Response Headers Contract

Mọi request bị giới hạn hoặc trong diện kiểm soát đều nhận các headers:

| Header | Mô tả |
|---|---|
| `X-RateLimit-Limit` | Số lượng request tối đa trong cửa sổ |
| `X-RateLimit-Remaining` | Số lượng request còn lại |
| `X-RateLimit-Reset` | Thời điểm Unix timestamp đặt lại quota |
| `Retry-After` | Số giây client cần chờ trước khi thử lại (khi bị 429) |

# Phase 1 Quickstart Validation Guide: AppSec Hardening

**Feature**: `085-appsec-hardening`  
**Date**: 2026-09-05  

---

## 1. Mục Đích & Chuẩn Bị

Tài liệu này cung cấp các kịch bản chạy lệnh độc lập (runnable validation scenarios) để kiểm tra và nghiệm thu toàn diện 20 tiêu chuẩn bảo mật ứng dụng.

### Điều kiện tiên quyết:
- Máy chủ đang chạy ở chế độ kiểm thử hoặc development:
  ```bash
  npm run dev
  ```
- Công cụ kiểm tra: `curl`, `npm`, trình duyệt Web.

---

## 2. Kịch Bản Kiểm Tra Nghiệm Thu (Validation Scenarios)

### Kịch bản 1: Quét Phụ Thuộc Bằng npm audit (Tiêu chuẩn 20)

```bash
# Kiểm tra toàn bộ lỗ hổng phụ thuộc cấp độ High trở lên
npm audit --audit-level=high
```
- **Kỳ vọng**: Báo cáo trả về `found 0 vulnerabilities` (hoặc 0 high vulnerabilities).

---

### Kịch bản 2: Kiểm Tra Header An Ninh HTTP (Tiêu chuẩn 18)

```bash
curl -I http://localhost:3000/api/auth/status
```
- **Kỳ vọng**: Phản hồi HTTP chứa đầy đủ các header:
  - `x-content-type-options: nosniff`
  - `x-frame-options: DENY`
  - `referrer-policy: strict-origin-when-cross-origin`
  - `permissions-policy: camera=(), microphone=(), geolocation=()`

---

### Kịch bản 3: Kiểm Tra Bắt Buộc HTTPS & Reverse Proxy (Tiêu chuẩn 19)

```bash
# Giả lập request từ reverse proxy với header x-forwarded-proto: http
curl -I -H "x-forwarded-proto: http" -H "Host: dichtruyen.ai" http://localhost:3000/api/auth/status
```
- **Kỳ vọng** (khi chạy ở NODE_ENV=production):
  - Mã trạng thái: `HTTP/1.1 301 Moved Permanently`
  - Header: `Location: https://dichtruyen.ai/api/auth/status`

---

### Kịch bản 4: Kiểm Tra Cookie Phiên HttpOnly & Secure (Tiêu chuẩn 9)

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"mat_khau_test\"}"
```
- **Kỳ vọng**:
  - Header trả về chứa:
    `Set-Cookie: auth_token=...; Path=/; HttpOnly; SameSite=Strict`
  - Người dùng dùng cookie này có thể truy cập các API được bảo vệ mà không cần truyền header `X-Auth-Token`.

---

### Kịch bản 5: Kiểm Tra Chống Brute-Force Đăng Nhập (Tiêu chuẩn 11)

```bash
# Gửi 11 request đăng nhập sai liên tiếp
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"password\": \"sai_pass\"}"
done
```
- **Kỳ vọng**: Từ request thứ 11 trở đi, server trả về mã `HTTP 429 Too Many Requests` kèm thông báo lỗi và header `Retry-After`.

---

### Kịch bản 6: Kiểm Tra Chống Bơm Trường (Mass Assignment Whitelisting - Tiêu chuẩn 8)

```bash
# Gửi request dịch thô kèm các trường lạ (role, isOwner, __proto__)
curl -i -X POST http://localhost:3000/api/translate-raw \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"你好世界\", \"role\": \"admin\", \"isOwner\": true}"
```
- **Kỳ vọng**: Server lọc sạch dữ liệu đầu vào; các trường lạ không được chuyển vào controller hoặc service.

---

### Kịch bản 7: Kiểm Tra Khử Trùng Log Secret (Tiêu chuẩn 1)

```bash
# Kiểm tra tệp server log hoặc console
```
- **Kỳ vọng**: Không có chuỗi nào dạng `AIzaSy...` hiển thị nguyên văn. Tất cả đều tự động chuyển thành `AIza***[REDACTED]`.

---

### Kịch bản 8: Chạy Toàn Bộ Quality Gates (Hiến pháp Nguyên tắc I)

```bash
# 1. Type check
npm run lint

# 2. Toàn bộ unit/integration tests
npm test

# 3. Production build
npm run build
```
- **Kỳ vọng**: Cả 3 lệnh đều chạy thành công 100% với exit code 0.

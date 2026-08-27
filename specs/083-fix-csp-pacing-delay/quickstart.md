# Quickstart Validation Guide: Fix CSP Gemini Model Discovery & Pacing Interval Delay

## 1. Prerequisites
- Node.js 20+ installed
- Dependencies installed via `npm install`

## 2. Automated Quality Checks

Run the mandatory quality gates:

```bash
# 1. Type Check
npx tsc --noEmit

# 2. Test Suite Check (Bao gồm kiểm thử Security Headers CSP và Model Discovery)
npx vitest run server/__tests__/securityHeaders.test.ts

# 3. Full Test Suite
npm test

# 4. Production Build Check
npm run build
```

## 3. Manual End-to-End Verification Scenarios

### Scenario A: Verify Production CSP allows Gemini API requests
1. Chạy server ở chế độ production: `NODE_ENV=production node dist/server.cjs` (hoặc build và chạy).
2. Gửi request `GET /` hoặc `GET /test` và kiểm tra tiêu đề `content-security-policy`.
3. Xác nhận `connect-src` chứa `https://generativelanguage.googleapis.com` và `https://*.googleapis.com`.
4. Mở trình duyệt tới ứng dụng, vào tab **Cấu hình AI** và nhấn **"Kiểm tra Model"** trên một API key cá nhân.
5. Xác nhận danh sách các model Google (như `gemini-2.5-flash`, `gemini-2.5-pro`) được tải về và hiển thị thành công với **0 lỗi vi phạm CSP** trong Console.

### Scenario B: Verify Non-negative Pacing Delay Display
1. Mở tab **Theo dõi Hạn mức (Quota Usage)**.
2. Kiểm tra các thẻ Quota Group ở trạng thái nhàn rỗi (sẵn sàng gọi) hoặc sau khi dịch 1 lượt.
3. Xác nhận phần "Điều phối" hiển thị nhãn `"Sẵn sàng"` hoặc `"~Xms/call"` với $X \ge 0$.
4. Xác nhận **hoàn toàn không có giá trị âm** (ví dụ `-4445ms/call`) xuất hiện trên giao diện.

### Scenario C: Verify Friendly Error Message on Connection Failure
1. Ngắt kết nối mạng hoặc chặn URL Gemini trên trình duyệt.
2. Nhấn **"Kiểm tra Model"**.
3. Xác nhận thông báo hiển thị `"Không thể kết nối đến Gemini API (Vui lòng kiểm tra mạng hoặc chính sách CSP)"` thay vì chỉ in lỗi thô `Failed to fetch`.

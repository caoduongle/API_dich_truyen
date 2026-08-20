# Quickstart: HTTP Rate Limiter Upgrade Validation

**Feature**: HTTP Rate Limiter Upgrade & Boundary Protection  
**Branch**: `028-task-15-http` | **Date**: 2026-08-20  

---

## 1. Automated Test Execution

Chạy toàn bộ bộ test kiểm thử tự động cho cơ chế Sliding Window Counter, Boundary Burst, Headers, và Degradation:

```bash
# Chạy riêng các bài test Rate Limiter
npx vitest run server/middleware/__tests__/rateLimiter.test.ts
npx vitest run server/middleware/__tests__/rateLimiterDegradation.test.ts
npx vitest run server/middleware/__tests__/rateLimiterSlidingWindow.test.ts

# Chạy toàn bộ test suites của repo
npm test

# Kiểm tra kiểu dữ liệu TypeScript
npm run lint

# Kiểm tra build sản phẩm
npm run build
```

---

## 2. Validation Test Scenarios

### Scenario 1: Window Boundary Burst Elimination
1. Giả lập một client gửi 50 requests ở giây thứ 58 của window 1.
2. Giây thứ 02 của window 2 (ngay sau ranh giới), client gửi thêm 20 requests.
3. **Kết quả mong đợi**:
   - Ở giây 02, hệ thống tính toán trọng số window trước (50 * (58/60) ≈ 48) + window hiện tại (20) = 68 requests > 60 RPM.
   - Các requests vượt quá bị chặn với mã `429 Too Many Requests`.

### Scenario 2: High Concurrency (100 concurrent requests)
1. Gửi 100 requests đồng thời trong cùng 100ms.
2. **Kết quả mong đợi**:
   - Đúng 60 requests được chấp thuận (`200 OK`) kèm `X-RateLimit-Remaining` giảm dần từ 59 về 0.
   - 40 requests còn lại nhận `429 Too Many Requests` và header `Retry-After`.

### Scenario 3: Graceful Degradation under Redis Outage
1. Đang chạy bình thường với Redis kết nối.
2. Giả lập Redis bị ngắt kết nối (`error` event).
3. **Kết quả mong đợi**:
   - `getRateLimiterStatus().isDegraded` chuyển thành `true`.
   - Middleware tiếp tục xử lý các requests kế tiếp bằng in-memory sliding limiter mà không trả về lỗi 500.

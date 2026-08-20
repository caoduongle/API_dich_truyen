# Research: HTTP Rate Limiter Upgrade (Sliding Window Counter & Abuse Protection)

**Feature**: HTTP Rate Limiter Upgrade & Boundary Protection  
**Branch**: `028-task-15-http` | **Date**: 2026-08-20  

---

## 1. Research Objectives & Technical Context

Mục tiêu cốt lõi: Nâng cấp middleware `server/middleware/rateLimiter.ts` để bảo vệ server Express backend khỏi lạm dụng HTTP (DoS, Brute-force, spam requests).
- **Ranh giới quan trọng**: Đây là HTTP rate limiting theo client IP (bảo vệ tầng mạng/HTTP), độc lập hoàn toàn với Gemini Quota Service (hạn mức model AI của Google API).
- **Yêu cầu không đổi**: Giữ nguyên hạn mức chuẩn `60 requests / 60s / IP` (`SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS`) và `5 requests / 15 phút / IP` cho auth endpoints.

---

## 2. Algorithm Comparison & Selection

### 2.1 Thuật toán 1: Fixed Window (Hiện tại)
- **Cơ chế**: Dùng key `ratelimit:<ip>`, tăng bằng `INCR` và đặt `EXPIRE 60`.
- **Nhược điểm**: Lỗ hổng 2x burst tại ranh giới (ví dụ 60 reqs ở 00:59 và 60 reqs ở 01:01 cho phép 120 reqs trong 2 giây).

### 2.2 Thuật toán 2: Sliding Window Log (Sorted Set)
- **Cơ chế**: Lưu mỗi request là 1 phần tử trong Redis Sorted Set (`ZADD`) với score là timestamp. Xóa các phần tử cũ (`ZREMRANGEBYSCORE`), đếm số lượng (`ZCARD`).
- **Nhược điểm**: Tốn bộ nhớ O(N) theo số request. Không tối ưu khi traffic lớn.

### 2.3 Thuật toán 3: Sliding Window Counter (Lựa chọn tối ưu)
- **Cơ chế**:
  Chia thời gian thành các khối window cố định (ví dụ 60s). Lưu 2 biến đếm: `count_current` và `count_previous`.
  Số lượng request ước tính trong cửa sổ trượt 60 giây bất kỳ:
  $$\text{Estimated Count} = \text{count\_current} + \text{count\_previous} \times \frac{\text{window\_size} - \text{time\_into\_current}}{\text{window\_size}}$$
- **Ưu điểm**:
  1. Loại bỏ hoàn toàn 2x burst tại ranh giới.
  2. Cực kỳ tiết kiệm bộ nhớ: Chỉ tốn 2 integer keys trên Redis hoặc 1 hash.
  3. Độ phức tạp tính toán O(1).
  4. Thực thi nguyên tử (atomic) hoàn toàn bằng 1 Redis Lua script ngắn.
  5. Dễ dàng triển khai tương đương trên in-memory fallback khi Redis mất kết nối.

---

## 3. Redis Lua Script Design (Atomic Sliding Window Counter)

```lua
-- KEYS[1]: Current window key, e.g., ratelimit:translation:1.2.3.4:1724140800
-- KEYS[2]: Previous window key, e.g., ratelimit:translation:1.2.3.4:1724140740
-- ARGV[1]: window_size_ms (e.g., 60000)
-- ARGV[2]: max_requests (e.g., 60)
-- ARGV[3]: current_time_ms

local current_key = KEYS[1]
local prev_key = KEYS[2]
local window_ms = tonumber(ARGV[1])
local max_req = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local current_count = tonumber(redis.call('get', current_key) or '0')
local prev_count = tonumber(redis.call('get', prev_key) or '0')

-- Tính toán trọng số cửa sổ trượt
local current_window_start = math.floor(now / window_ms) * window_ms
local time_into_current = now - current_window_start
local prev_weight = (window_ms - time_into_current) / window_ms
local estimated_count = current_count + (prev_count * prev_weight)

if estimated_count >= max_req then
  local retry_after = math.ceil((window_ms - time_into_current) / 1000)
  if retry_after < 1 then retry_after = 1 end
  return {0, math.floor(estimated_count), retry_after, current_count}
end

-- Tăng biến đếm và gán TTL 2 chu kỳ window để phục vụ tính toán cho window sau
local new_count = redis.call('incr', current_key)
if new_count == 1 then
  redis.call('pexpire', current_key, window_ms * 2)
end

local remaining = math.max(0, max_req - (new_count + math.floor(prev_count * prev_weight)))
local reset_time = math.ceil((current_window_start + window_ms) / 1000)

return {1, remaining, reset_time, new_count}
```

---

## 4. In-Memory Fallback Algorithm

Khi Redis không sẵn sàng hoặc chạy môi trường dev không có Redis:
- Cấu trúc: `Map<string, { currentWindow: number; currentCount: number; previousCount: number }>`
- Bounded capacity: Giới hạn tối đa 10,000 entries với cơ chế dọn dẹp định kỳ mỗi 60 giây.
- Sử dụng cùng công thức trọng số sliding window để bảo đảm tính nhất quán 100% giữa môi trường phân tán (Redis) và độc lập (Memory).

---

## 5. Standard HTTP Rate Limit Headers

Theo chuẩn RFC 6585 & IETF draft RateLimit:
1. `X-RateLimit-Limit`: Tổng số request cho phép trong window (ví dụ: `60`).
2. `X-RateLimit-Remaining`: Số request còn lại trong window trượt hiện tại (ví dụ: `45`).
3. `X-RateLimit-Reset`: Thời điểm epoch (giây) mà window hiện tại kết thúc (ví dụ: `1724140860`).
4. `Retry-After`: (Chỉ xuất hiện khi trả về `429`) Số giây client cần chờ trước khi thử lại (ví dụ: `18`).

# Feature Specification: HTTP Rate Limiter Upgrade (Abuse Protection)

**Feature**: HTTP Rate Limiter Upgrade & Boundary Protection  
**Branch**: `028-task-15-http` | **Status**: `Draft` | **Created**: 2026-08-20  

---

## 1. Feature Overview & Problem Statement

### 1.1 Context
Hệ thống máy chủ Express backend cung cấp các HTTP API endpoints cho ứng dụng dịch thuật:
- `/api/translate-raw`, `/api/translate-stream`, `/api/polish`, `/api/dictionary/lookup` (Translation & AI Endpoints).
- `/api/auth/login`, `/api/auth/session` (Authentication Endpoints).
- `/api/quota`, `/api/health`, `/api/list-models` (Telemetry & Discovery Endpoints).

Để bảo vệ máy chủ khỏi tấn công từ chối dịch vụ (DoS), spam request và lạm dụng băng thông (HTTP Abuse), middleware `rateLimiter.ts` được áp dụng cho mọi request theo IP máy khách.

> [!IMPORTANT]
> **Ranh giới phân biệt**: HTTP Rate Limiter này là lớp bảo vệ tầng mạng/HTTP (**HTTP Abuse Protection**) độc lập hoàn toàn với **Gemini Provider Quota & Key Health Scheduler** (tầng quota AI của Google API).

### 1.2 Problem Statement with Fixed-Window Rate Limiting
Hiện tại, `rateLimiter.ts` sử dụng thuật toán **Fixed Window** (cửa sổ cố định 60 giây). Thuật toán này tồn tại điểm yếu nghiêm trọng về **biên cửa sổ (Boundary Burst Vulnerability)**:
- Nếu một IP gửi 60 requests vào giây thứ 59 của window 1, sau đó gửi tiếp 60 requests vào giây thứ 01 của window 2 (ngay sau khi window reset):
  - Hệ thống cho phép **120 requests chỉ trong 2 giây** (gấp 200% tải thiết kế).
  - Gây quá tải đột ngột cho Event Loop của Node.js và làm cạn kiệt tài nguyên xử lý.

### 1.3 Target Solution & Algorithm Evaluation

```text
┌─────────────────────────┬───────────────────┬───────────────────┬─────────────────────┐
│ Tiêu chí đánh giá       │ Fixed Window (Cũ) │ Sliding Window    │ Token Bucket / GCRA │
├─────────────────────────┼───────────────────┼───────────────────┼─────────────────────┤
│ Ngăn chặn Burst biên    │ ❌ Kém (2x burst)  │ ✅ Tốt            │ ✅ Rất tốt (mịn)    │
│ Tiêu tốn bộ nhớ Redis   │ Rất thấp (1 key)  │ Thấp (2 keys/ZSET)│ Rất thấp (1-2 keys) │
│ Tính toán Retry-After   │ Rời rạc           │ Ước lượng         │ Chuẩn xác mili-giây │
│ Phù hợp traffic HTTP    │ Trung bình        │ Tốt               │ Xuất sắc            │
└─────────────────────────┴───────────────────┴───────────────────┴─────────────────────┘
```

**Lựa chọn giải pháp**:
- Nâng cấp sang **Sliding Window Counter / Token Bucket với GCRA Lua Script** trên Redis và bộ đếm in-memory fallback.
- **Giữ nguyên định mức 60 RPM/IP** cho translation endpoints và **5 requests / 15 phút** cho auth endpoints (không làm xáo trộn cấu hình hiện có).
- Bổ sung các chuẩn HTTP Rate Limit Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`.

---

## 2. User Stories & Priorities

### User Story 1 (P1) — Smooth Boundary Protection without 2x Bursts (MVP)
**As an** quản trị viên hệ thống bảo mật,  
**I want** rate limiter ngăn chặn triệt để hiện tượng 2x burst tại thời điểm chuyển giao giữa 2 cửa sổ thời gian,  
**So that** máy chủ không bị quá tải đột ngột bởi các đợt bắn request dồn dập ở ranh giới window.

#### Acceptance Scenarios
- **Given** client gửi 60 requests trong 5 giây cuối của chu kỳ 1 phút,
- **When** client tiếp tục gửi thêm request ngay ở giây đầu tiên của chu kỳ tiếp theo,
- **Then** rate limiter phát hiện tốc độ trượt vượt quá 60 RPM và trả về ngay mã `HTTP 429 Too Many Requests`.

---

### User Story 2 (P2) — Standard HTTP Headers & Precise Retry-After
**As a** client frontend hoặc API consumer,  
**I want** nhận được các HTTP headers tiêu chuẩn (`Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`),  
**So that** client biết chính xác cần chờ bao nhiêu giây trước khi gửi request tiếp theo và chủ động điều phối nhịp độ gọi.

#### Acceptance Scenarios
- **Given** client gửi request thứ 61 vượt quá giới hạn 60 RPM,
- **When** server phản hồi mã `429 Too Many Requests`,
- **Then** response header PHẢI chứa `Retry-After: <seconds>` và body chứa `{ error, code: 'RATE_LIMITED', retryAfterSec: <seconds> }`.

---

### User Story 3 (P3) — High Concurrency & Race-Condition Freedom in Redis
**As a** hệ thống chạy trong môi trường phân tán / đa tiến trình,  
**I want** việc kiểm tra và tăng biến đếm rate limit diễn ra nguyên tử (atomic) trong Redis thông qua Lua script,  
**So that** các request gửi đồng thời (high concurrency) không bị race condition và không vượt quá quota đã định.

#### Acceptance Scenarios
- **Given** 100 requests đồng thời được gửi từ cùng 1 IP trong cùng 100 mili-giây,
- **When** Redis xử lý qua atomic Lua script,
- **Then** đúng 60 requests đầu tiên được chấp thuận (`200 OK`) và 40 requests còn lại bị chặn chính xác với mã `429`.

---

### User Story 4 (P4) — Seamless Graceful Degradation (Memory Fallback)
**As an** hệ thống khi gặp sự cố mất kết nối Redis hoặc môi trường không có Redis (local dev / standalone),  
**I want** rate limiter tự động chuyển sang cơ chế trượt cục bộ trong bộ nhớ (bounded in-memory sliding limiter),  
**So that** máy chủ vẫn được bảo vệ 100% mà không bị gián đoạn hay crash dịch vụ.

#### Acceptance Scenarios
- **Given** Redis server đột ngột ngắt kết nối hoặc `REDIS_URL` không được cấu hình,
- **When** client gửi request liên tiếp,
- **Then** rate limiter ghi log cảnh báo và kích hoạt in-memory sliding limiter bảo đảm hạn mức 60 RPM/IP với cấu trúc Map có giới hạn dung lượng (`MAX_LOCAL_MAP_ENTRIES = 10000`).

---

## 3. Functional Requirements

### 3.1 Rate Limiting Engine & Algorithm
- **FR-001**: Hệ thống PHẢI áp dụng thuật toán **Sliding Window Counter / Token Bucket** thay thế cho Fixed-Window thô sơ để loại bỏ điểm yếu 2x burst tại ranh giới thời gian.
- **FR-002**: Giới hạn mặc định PHẢI giữ nguyên:
  - **Translation & AI Endpoints**: `60 requests / 60 seconds` (`SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS`).
  - **Auth Endpoints**: `5 requests / 15 minutes` (`SERVER_CONFIG.AUTH_RATE_LIMIT_MAX_REQUESTS`).
  - **Non-critical Endpoints**: `120 requests / 60 seconds`.
- **FR-003**: Hệ thống PHẢI định danh client theo địa chỉ IP (`req.ip` hoặc `req.socket.remoteAddress`) và tiền tố endpoint (`keyPrefix`).

### 3.2 Standard HTTP Headers & Response Contract
- **FR-004**: Với mọi request được chấp thuận (`200/2xx`), hệ thống PHẢI đính kèm các headers:
  - `X-RateLimit-Limit: <max>`
  - `X-RateLimit-Remaining: <remaining>`
  - `X-RateLimit-Reset: <reset_epoch_seconds>`
- **FR-005**: Với request bị từ chối (`429 Too Many Requests`), hệ thống PHẢI đính kèm header `Retry-After: <seconds>` và trả về JSON payload:
  ```json
  {
    "error": "Quá nhiều yêu cầu. Vui lòng chờ <N> giây rồi thử lại.",
    "code": "RATE_LIMITED",
    "retryAfterSec": 15
  }
  ```

### 3.3 Redis Atomic Execution
- **FR-006**: Trên Redis, toàn bộ thao tác tính toán trượt, kiểm tra hạn mức và ghi nhận thời gian PHẢI được thực thi nguyên tử (atomic) trong 1 Redis Lua script duy nhất.
- **FR-007**: Key trong Redis PHẢI được gán TTL tự động (`EXPIRE` hoặc `PEXPIRE`) tương ứng với độ dài cửa sổ để tránh rò rỉ bộ nhớ Redis.

### 3.4 In-Memory Fallback & Memory Safety
- **FR-008**: Khi Redis không sẵn sàng, hệ thống PHẢI chuyển sang bộ đếm Sliding Window in-memory có dọn dẹp định kỳ (`cleanupInterval` 60s) và giới hạn dung lượng tối đa 10,000 IPs để chống tấn công tràn bộ nhớ (Memory Exhaustion).
- **FR-009**: Trạng thái chuyển đổi (`connected` <-> `degraded`) PHẢI được ghi nhận vào `RateLimiterStatus` và throttle log cảnh báo để tránh spam console.

---

## 4. Edge Cases & Boundary Handling

| Tình huống ngoại lệ (Edge Case) | Hành vi mong đợi của hệ thống |
|:---|:---|
| **Window Boundary Spike** | Client gửi 59 requests ở cuối window và 59 requests ở đầu window mới → Hệ thống tính trọng số cửa sổ trượt và chặn ngay khi vượt quá 60 reqs trong 60s bất kỳ. |
| **High Concurrency Burst (100 concurrent reqs)** | Redis Lua script xử lý tuần tự nguyên tử: chấp nhận đúng 60 reqs đầu tiên, trả về 429 cho 40 reqs còn lại. |
| **Mất kết nối Redis giữa chừng** | Bắt lỗi `catch (err)`, gọi `handleRedisError`, chuyển tiếp request qua `applyLocalLimit` mà không làm crash Express handler. |
| **IP giả mạo / `req.ip` rỗng** | Fallback về `req.socket.remoteAddress` hoặc gán `'unknown'` an toàn. |
| **Độ trễ tính toán `Retry-After`** | Luôn làm tròn lên (`Math.ceil`) và đảm bảo `Retry-After >= 1` giây để client không gửi request lại tức thì. |
| **Client không có API key / Session rỗng** | Rate limiter vẫn áp dụng bình thường theo IP máy khách để ngăn chặn brute-force. |

---

## 5. Key Entities & Data Schema

### 5.1 Redis Sliding Window State Payload
```text
Key: ratelimit:<endpointType>:<ip>
Data: Hash hoặc Sorted Set với:
  - current_count: số lượng request trong window hiện tại
  - previous_count: số lượng request trong window liền trước
  - window_start: timestamp bắt đầu window hiện tại
```

### 5.2 Rate Limiter Telemetry Status (`getRateLimiterStatus`)
```typescript
export interface RateLimiterStatus {
  redisStatus: 'connected' | 'degraded' | 'disconnected';
  isDegraded: boolean;
  degradedFallbackCount: number;
  localEntriesCount: number;
  algorithm: 'sliding-window-counter';
  lastRedisError?: string;
  lastRedisTransitionAt?: number;
}
```

---

## 6. Measurable Success Criteria

- **SC-001 (Boundary Burst Elimination)**: 0 trường hợp client gửi được quá **60 requests trong bất kỳ khoảng thời gian 60 giây trượt nào** (loại bỏ 100% lỗ hổng 2x burst).
- **SC-002 (Atomic Concurrency)**: Với 100 requests gửi đồng thời từ 1 IP, đúng 60 requests được chấp thuận và 40 requests bị chặn với mã 429.
- **SC-003 (Standard Header Compliance)**: 100% responses trả về đầy đủ `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` và `Retry-After` khi bị rate limited.
- **SC-004 (Seamless Degradation)**: Chuyển đổi sang in-memory fallback mượt mà trong < **5ms** khi Redis ngắt kết nối mà không làm rơi bất kỳ request nào.
- **SC-005 (Quality Gates)**: Đạt 100% các bài kiểm thử tự động (`vitest`), 0 lỗi TypeScript (`npm run lint`), và build thành công (`npm run build`).

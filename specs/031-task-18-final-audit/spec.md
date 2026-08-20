# Final Audit Specification & Comprehensive Findings

**Feature**: System-Wide Final Architecture, Security, Model, Quota & Reliability Audit  
**Branch**: `031-task-18-final-audit` | **Status**: `Completed` | **Created**: 2026-08-20  

---

# Final Audit

## Resolved Issues
1. **Lỗ hổng 2x Burst tại Ranh giới Phút (Rate Limiting Boundary Vulnerability)**:
   - Thay thế fixed-window bằng **Sliding Window Counter** với Lua script nguyên tử trên Redis và in-memory sliding fallback, triệt tiêu khả năng gửi 120 reqs/2s tại ranh giới phút.
2. **Sai lệch Múi giờ Reset Hạn mức Ngày (PST Midnight Reset Offset)**:
   - Đồng bộ đồng hồ RPD về chuẩn `00:00:00 PST/PDT` (`America/Los_Angeles`) thay vì phụ thuộc múi giờ máy chủ local.
3. **Rò rỉ API Keys & Bản thảo vào LocalStorage**:
   - Chuyển toàn bộ quản lý runtime credential sang **Server SessionStore** (24h TTL) và `sessionStorage`; thiết lập `verifyStorageIntegrity` audit định kỳ.
4. **Crash Giao diện khi Model Google bị Đóng cửa (Shutdown Migration)**:
   - Tự động di chuyển các model cũ (`gemini-1.5-flash`, `gemini-1.5-pro`...) sang model thế hệ mới (`gemini-2.5-flash`, `gemini-2.5-pro`...) kèm thông báo rõ ràng cho người dùng.
5. **UI Blocking khi Tải Danh mục Model (Model Discovery SWR)**:
   - Tải danh mục model tức thì từ cache (< 5ms), revalidate ngầm và áp dụng cơ chế Zero-Wipe Fallback khi Google API lỗi 429 hoặc mất mạng.
6. **Mất Dấu Vết Tracing khi Retry (RequestId Inconsistency)**:
   - Bảo toàn `requestId` duy nhất xuyên suốt tất cả các lần thử retry giữa client và server.

---

## Architecture Improvements
- **Phân tách Rạch ròi 2 Lớp Kiểm soát Tốc độ**:
  - *HTTP Rate Limiter*: Bảo vệ hạ tầng máy chủ theo IP máy khách (`req.ip`, 60 RPM).
  - *Gemini Quota Scheduler*: Điều phối tải AI Provider theo API Key Hash (`keyHash`, 15 RPM / 1M TPM / 1500 RPD).
- **Phân vùng Quyền Sở hữu Dữ liệu (Source of Truth Matrix)**:
  - *IndexedDB*: Sở hữu duy nhất bản thảo, chương truyện, từ điển.
  - *Server SessionStore*: Sở hữu duy nhất API keys và credentials phiên.
  - *Server QuotaService*: Sở hữu duy nhất số liệu RPM/TPM/RPD và trạng thái sức khỏe khóa.
  - *LocalStorage*: Chỉ lưu UI preferences và SWR model cache ngắn hạn.
- **Khử Phụ thuộc Vòng & Logic Trùng lặp**:
  - `shared/` đóng vai trò ranh giới kiểu dữ liệu dùng chung; không có import ngược từ `server/` vào `src/`.

---

## Security Improvements
- **Không Lưu Plain API Keys**: Client không ghi plain keys vào `localStorage`. Tất cả giao tiếp sử dụng `x-session-token` hoặc session tạm.
- **Làm Sạch Dữ liệu Nhật ký (Log Sanitization)**: Mọi log đều che mặt nạ (`maskApiKey`) hoặc băm SHA-256 (`hashApiKey`), tuyệt đối không in bản thảo hay token ra console.
- **Bảo mật Proxy Headers**: Sử dụng `app.set('trust proxy', 1)` và trích xuất IP an toàn cho rate limiting.
- **Audit Bộ nhớ Trình duyệt**: Hàm `verifyStorageIntegrity()` và `sanitizeLocalStorage()` tự động phát hiện và thanh trừng các key vi phạm.

---

## Model System
- **Preset Models**: Cấu hình chuẩn hóa cho `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`.
- **Discovered Models**: Cơ chế SWR 1 giờ TTL, khử trùng lặp Promise in-flight, bảo toàn stale cache khi lỗi.
- **Custom Models**: Xác minh tính hợp lệ và khả năng `generateContent` qua `/api/verify-model`.
- **Model Lifecycle**: Tự động nhận diện mô hình bị shutdown và di chuyển mượt mà không gây gián đoạn.

---

## Quota System
- **Giám sát Đa Chiều (RPM / TPM / RPD)**: Theo dõi đồng thời số request và tokens tiêu thụ trong cửa sổ trượt 60 giây.
- **Chuẩn Reset PST**: Tính toán ngày hiện tại theo giờ chuẩn California của Google AI Studio.
- **Pacing Động**: Tự động chèn độ trễ điều hòa khi lưu lượng đạt ngưỡng tới hạn.

---

## Scheduler
- **Máy Trạng thái Sức khỏe Khóa**: `Healthy` ➔ `Degraded` ➔ `Cooldown` (3s–60s) ➔ `QuotaExhausted`.
- **Ngắt Mạch Circuit Breaker**: Tự động ngắt khi phát hiện lỗi liên tiếp và thăm dò phục hồi khi hết cooldown.
- **Luân phiên Khóa Thông minh**: Ưu tiên key khỏe nhất, ít lỗi nhất, ít tải nhất trong phút hiện tại.

---

## Observability
- **Truy vết Đầu-Cuối (End-to-End Tracing)**: Mã định danh `requestId` đồng nhất từ client đến server và xuyên suốt các lần retry.
- **Nhật ký Attempt Chi tiết**: Lưu vết chi tiết `modelId`, `keyIdentifier`, `latencyMs`, `errorCode`, `attempt`.
- **Health & Readiness Endpoints**: `/api/health` và `/api/health/ready` báo cáo trạng thái máy chủ, Redis failover và scheduler readiness.

---

## Tests
- **Hệ thống Test Toàn diện**: 59 test files với 431 test cases (tăng trưởng mạnh từ 45 files ban đầu).
- **Bảo vệ Regression Thâm sâu**: Kiểm tra thực tế các lỗi biên (2x burst, PST offset, shutdown migration, Redis degradation, Zero-wipe SWR).

---

## Verification

- `npm run lint`: **PASS** (0 TypeScript errors)
- `npm test`: **PASS** (59 test files, 431 tests passed, 100%)
- `npm run build`: **PASS** (Vite build + esbuild bundle thành công)

---

## Remaining Risks
- **Google API Thay đổi Bất ngờ**: Nếu Google thay đổi schema JSON của `/v1beta/models`, cơ chế SWR Stale Cache sẽ đóng vai trò lá chắn bảo vệ tạm thời cho đến khi API adapter được cập nhật.
- **Môi trường Server Không có Redis**: Hệ thống tự động fallback về in-memory sliding window (giới hạn 10.000 entries), tuy nhiên đối với hệ thống cụm đa máy chủ (Multi-node Cluster) nên cấu hình `REDIS_URL` để chia sẻ quota rate limit giữa các node.

---

## Recommended Next Steps
1. Triển khai ứng dụng lên môi trường Production Staging và giám sát telemetry qua `/api/health/ready` và `/api/quota`.
2. Định kỳ kiểm tra danh sách model mới từ Google AI Studio để bổ sung các preset tối ưu nhất cho cộng đồng dịch giả.

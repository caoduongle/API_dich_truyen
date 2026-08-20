# Feature Specification: Master Infrastructure, Security & Resiliency Hardening

**Feature Branch**: `037-infrastructure-architectural-hardening`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: Comprehensive Architectural Refactoring System Instruction based on 3 Core Architectural Laws: (1) API key ≠ Quota bucket (QuotaGroup authority), (2) Model syntax-valid ≠ Model verified (Singleflight & non-blocking hot path), (3) Provider attempt ≠ Logical user request (Telemetry & metrics separation), across 6 implementation phases (Security & Idempotency, Quota Group Decoupling, Model Lifecycle, Error Taxonomy & Circuit Breaker, Redis Degradation & Telemetry, Frontend UX).

---

## 3 Core Architectural Laws *(non-negotiable)*

1. **API Key ≠ Quota Bucket**: Google Gemini rate limits apply at the Google Cloud Project / Billing Tier level, NOT per API key. Grouping multiple keys under the same project MUST NOT artificially multiply RPM/TPM capacity. Quota accounting belongs strictly to `QuotaGroup`.
2. **Model Syntax-Valid ≠ Model Verified**: A syntactically valid model identifier (e.g. `tunedModels/novel-v1`) does not prove model existence, authorization, or capability. Custom models must undergo explicit singleflight verification and MUST NOT perform blocking network calls in the translation hot path.
3. **Provider Attempt ≠ Logical User Request**: One user request (`POST /translate-raw`) may generate multiple provider attempts across keys/groups due to retries or rotation. Metrics and telemetry must strictly disambiguate logical requests from provider attempts.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo mật & Idempotency Cấp Production (Priority: P0) 🎯 MVP

Là hệ thống dịch thuật và bảo mật,  
Tôi muốn toàn bộ API keys lưu tại SessionStore/Redis được mã hóa AES-256-GCM, payload log được redact tự động, và các request dịch có Idempotency Key kèm Fingerprint nhận diện,  
Để bảo vệ an toàn thông tin khóa API của người dùng, ngăn chặn rò rỉ log, và chống trùng lặp request khi mạng chập chờn (hoặc phát hiện payload conflict 409).

**Independent Test**:
1. Lưu session chứa API keys $\to$ kiểm tra dữ liệu thô trong Redis/Memory: API key được mã hóa dạng `iv:authTag:encryptedData` (AES-256-GCM).
2. Gửi 2 request với cùng `Idempotency-Key` nhưng khác payload $\to$ server trả về ngay HTTP 409 Conflict.
3. Kiểm tra console/logs: Toàn bộ chuỗi `AIzaSy...` và token phiên bị che giấu `[REDACTED]` 100%.

---

### User Story 2 - Quản trị Quota Group & Tách biệt Sức khỏe API Key (Priority: P0/P1) 🎯 MVP

Là scheduler điều phối tải,  
Tôi muốn quản lý hạn mức RPM, TPM, RPD theo `QuotaGroup` (cấp độ Project) và duy trì máy trạng thái sức khỏe độc lập cho từng API Key (`HEALTHY`, `COOLDOWN`, `DEGRADED`, `AUTH_FAILED`, `DISABLED`),  
Để loại bỏ hiện tượng nhân ảo hạn mức (False Capacity) và khi một key gặp lỗi 401/403 (`AUTH_FAILED`) chỉ cách ly riêng key đó mà không đánh sập toàn bộ Quota Group.

**Independent Test**:
1. Cấu hình 3 API keys thuộc cùng 1 QuotaGroup (15 RPM) $\to$ scheduler điều phối tối đa 15 RPM cho cả nhóm, không cho phép bắn 45 RPM.
2. Giả lập 1 key bị Google trả về 401 Unauthorized $\to$ key đó chuyển sang `AUTH_FAILED`, 2 key còn lại trong nhóm vẫn tiếp tục phục vụ bình thường.

---

### User Story 3 - Vòng đời Model & Pipeline Xác minh Singleflight (Priority: P1)

Là hệ thống quản trị model,  
Tôi muốn phân loại model theo 5 trạng thái (`UNVERIFIED`, `VERIFIED`, `INVALID`, `DEPRECATED`, `SHUTDOWN`), sử dụng Promise-lock Singleflight khi xác minh model, và hot path dịch thuật chỉ đọc cache in-memory,  
Để ngăn chặn Thundering Herd khi xác minh model và đảm bảo độ trễ của luồng dịch chính không bị ảnh hưởng bởi network verification.

**Independent Test**:
1. Gửi 20 request đồng thời yêu cầu xác minh model mới $\to$ đúng 1 outbound HTTP fetch gửi tới Google AI Studio.
2. Gửi request dịch thuật hot path $\to$ 0 cuộc gọi mạng tra cứu model, từ chối ngay 400 nếu model chưa verified trong $< 5$ms.

---

### User Story 4 - Phân loại Lỗi, Circuit Breaker Giới hạn Phạm vi & Concurrency Gate (Priority: P1)

Là bộ điều khiển khả năng phục hồi (Resilience Controller),  
Tôi muốn phân loại chuẩn hóa toàn bộ lỗi upstream Google (`RATE_LIMITED`, `QUOTA_EXCEEDED`, `AUTH_FAILED`, `OVERLOADED`, `SAFETY_BLOCKED`, `NETWORK_ERROR`, `TIMEOUT`), áp dụng Circuit Breaker scoped theo `[QuotaGroupId + ModelId]`, và chặn quá tải bằng Concurrency Gate (`MAX_CONCURRENT_REQUESTS = 50`),  
Để khi một model bị lỗi 503 Overload không làm tê liệt các model khác, và khi máy chủ quá tải sẽ trả về 503 kèm `Retry-After` an toàn.

**Independent Test**:
1. Gây lỗi 503 liên tiếp trên `gemini-2.5-pro` trong Group A $\to$ Circuit Breaker mở cho `[GroupA + gemini-2.5-pro]`; `gemini-2.5-flash` trong Group A và Group B vẫn nhận request bình thường.
2. Gửi 51 request đồng thời $\to$ request thứ 51 bị từ chối 503 với header `Retry-After`.

---

### User Story 5 - Dự phòng Mềm dẻo Redis & Minh bạch Số liệu Telemetry (Priority: P1/P2)

Là kỹ sư vận hành (SRE/DevOps),  
Tôi muốn hệ thống tự động fallback sang in-memory khi Redis gặp sự cố (endpoint `/ready` báo `degraded: true`), đồng thời `MetricsService` tách bạch rõ các chỉ số `logicalRequests`, `providerAttempts`, `successfulRequests`, `failedRequests`, `retriesTotal`,  
Để hệ thống không bị sập khi Redis restart và cung cấp góc nhìn đo lường chuẩn xác về hiệu quả dịch thuật so với số lần gọi Google.

**Independent Test**:
1. Ngắt kết nối Redis $\to$ các chức năng SessionStore và Idempotency tự chuyển sang in-memory, endpoint `/ready` trả về HTTP 200 `{ "status": "ready", "degraded": true }`.
2. Thực hiện 1 request dịch phải xoay qua 3 keys mới thành công $\to$ `logicalRequests: 1`, `providerAttempts: 3`, `successfulRequests: 1`, `retriesTotal: 2`.

---

### User Story 6 - Đồng bộ Giao diện Frontend & Trải nghiệm Người dùng (Priority: P2)

Là người dùng sử dụng ứng dụng web,  
Tôi muốn QuotaPanel hiển thị hạn mức theo QuotaGroup và sức khỏe từng key độc lập (không cộng dồn RPM ảo), và ApiSettings hiển thị huy hiệu xác thực rõ ràng cho từng model,  
Để nắm bắt chính xác năng lực thực tế của hệ thống và đưa ra quyết định chọn model/key phù hợp.

**Independent Test**:
1. Mở QuotaPanel với 3 keys cùng group $\to$ hiển thị thanh hạn ngạch nhóm 15 RPM và danh sách 3 keys với trạng thái sức khỏe riêng.
2. Nhập model tùy chỉnh $\to$ nút hiển thị `Đang xác minh...` $\to$ chuyển thành `Đã xác minh` hoặc hiển thị thông báo lỗi chi tiết.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (AES-256-GCM Session Encryption)**: `SessionStore` PHẢI mã hóa toàn bộ API keys trước khi lưu vào Redis hoặc Memory bằng thuật toán AES-256-GCM với khóa derived từ `ENCRYPTION_MASTER_KEY`.
- **FR-002 (Scoped Idempotency & Conflict Detection)**: `idempotencyMiddleware` PHẢI xây dựng composite key dạng `idemp:{identityScope}:{endpoint}:{clientKey}` và so khớp fingerprint payload. Trả về HTTP 409 Conflict nếu trùng key nhưng khác payload.
- **FR-003 (Telemetry & Log Redaction)**: Mọi log error, request log và trace PHẢI tự động loại bỏ chuỗi `AIzaSy[A-Za-z0-9_-]{33}`, session token và credentials nhạy cảm.
- **FR-004 (QuotaGroup Rate Limiting)**: Scheduler PHẢI tính toán và thực thi pacing theo `QuotaGroup.schedulingHint.effectiveIntervalMs`, nghiêm cấm cộng dồn RPM giữa các key thuộc cùng một QuotaGroup.
- **FR-005 (Key Health Isolation)**: Máy trạng thái sức khỏe key PHẢI hỗ trợ 5 trạng thái (`HEALTHY`, `COOLDOWN`, `DEGRADED`, `AUTH_FAILED`, `DISABLED`). Lỗi 401/403 chỉ đánh dấu riêng key đó là `AUTH_FAILED`.
- **FR-006 (Model Singleflight & Hot Path Separation)**: `ModelInfoService` PHẢI sử dụng `inFlightVerifications: Map<string, Promise>` để khử trùng lặp xác minh đồng thời, và `validateModelMiddleware` chỉ đọc bộ nhớ đệm (0 network call).
- **FR-007 (Scoped Circuit Breaker)**: Quá tải 503/429 từ Google PHẢI kích hoạt cooldown scoped theo `[QuotaGroupId + ModelId]` mà không làm gián đoạn các model khác.
- **FR-008 (Concurrency Gate)**: Giới hạn tối đa `MAX_CONCURRENT_REQUESTS = 50` trên server, trả về HTTP 503 kèm `Retry-After: 5` khi đạt ngưỡng.
- **FR-009 (Redis Graceful Degradation)**: `redisManager` PHẢI tự động chuyển sang in-memory cache khi Redis mất kết nối; endpoint `/ready` trả về HTTP 200 kèm `degraded: true`.
- **FR-010 (Metrics Disambiguation)**: `MetricsService` PHẢI tách bạch `logicalRequests` (số request người dùng gửi đến) và `providerAttempts` (số lượt gọi Google API).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% API keys lưu trữ ở trạng thái mã hóa AES-256-GCM, không chứa plaintext trong Redis hay dumps.
- **SC-002**: 0 false capacity summing (tổng RPM hiển thị và điều phối bằng đúng hạn ngạch của QuotaGroup).
- **SC-003**: 0 network verification call trong hot path dịch thuật.
- **SC-004**: 1 network fetch duy nhất cho $N$ request xác minh đồng thời cùng 1 model ID.
- **SC-005**: 100% pass toàn bộ Quality Gates (`npm run lint`, `npm test` với 470+ tests, `npm run build`).

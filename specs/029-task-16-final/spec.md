# Feature Specification: Final Regression Suite (End-to-End System Invariants)

**Feature**: Final Comprehensive Regression Test Suite  
**Branch**: `029-task-16-final` | **Status**: `Draft` | **Created**: 2026-08-20  

---

## 1. Feature Overview & Objectives

### 1.1 Goal
Xây dựng bộ kiểm thử hồi quy toàn diện (**Final Regression Test Suite**) bảo vệ toàn bộ các cải tiến cốt lõi đã hoàn thành qua các Tasks từ 1 đến 15:
1. **Model Subsystem**: Model selection, SWR discovered model cache, custom model addition & verification, shutdown/deprecated model lifecycle migration.
2. **Scheduler & Quota Subsystem**: Per-key RPM, TPM, RPD (PST midnight reset), dynamic pacing, intelligent key rotation, runtime key health.
3. **Resilience & Error Handling Subsystem**: Retry with jitter, 429 Quota Exceeded cooldown, 503 Overload fallback, Timeout handling, Circuit breaker.
4. **Infrastructure & Security Subsystem**: Redis failure graceful degradation, HTTP Sliding Window Rate Limiter (Abuse protection), ephemeral Session Token security, Health/Readiness endpoints.
5. **Observability & Telemetry Subsystem**: Unified `requestId` propagation across retries, attempt-level logs, per-model latency profiles, per-key error counters.

### 1.2 Principle: Real Bug Reproduction
> [!IMPORTANT]
> **Nguyên tắc thiết kế test**: Các bài test trong regression suite này **PHẢI tái hiện các tình huống lỗi thực tế (Real-World Scenarios)** trong luồng dịch thuật và điều phối API, không chỉ kiểm tra các hàm đơn lẻ một cách hình thức.

---

## 2. User Stories & Subsystem Test Scenarios

### User Story 1 (P1) — Model Subsystem Regression Suite
**As a** hệ thống quản lý mô hình,  
**I want** mọi thao tác lựa chọn, khám phá, xác minh và di chuyển vòng đời model được bảo vệ toàn diện,  
**So that** người dùng không bao giờ bị mất model, không bị crash khi model Google bị shutdown, và không bị block giao diện khi mở app.

#### Acceptance Scenarios
- **Scenario 1.1 (Shutdown Migration)**: Khi user có model đã bị Google đóng cửa (vd: `gemini-1.5-flash`), hệ thống tự động di chuyển sang model thay thế tối ưu (`gemini-2.5-flash`) và gắn cờ cảnh báo người dùng.
- **Scenario 1.2 (SWR Cache Instant Render)**: Khi cache đã quá 1 giờ TTL, hệ thống vẫn trả về danh sách model ngay lập tức (< 5ms) cho UI và kích hoạt background refresh ngầm mà không xóa cache cũ.
- **Scenario 1.3 (Custom Model Verification)**: Model tự nhập chỉ được thêm khi vượt qua kiểm tra định dạng và xác minh hỗ trợ `generateContent`.

---

### User Story 2 (P2) — Scheduler & Quota Authority Regression Suite
**As a** hệ thống điều phối Gemini Scheduler,  
**I want** việc kiểm soát hạn mức RPM, TPM, RPD và chọn key hoạt động chuẩn xác theo múi giờ PST,  
**So that** không bao giờ có key nào bị gọi vượt quá hạn mức dẫn đến tràn quota hàng loạt.

#### Acceptance Scenarios
- **Scenario 2.1 (PST Midnight Reset)**: Đồng hồ RPD tự động reset về 0 đúng vào nửa đêm múi giờ America/Los_Angeles (PST/PDT), không phụ thuộc vào múi giờ địa phương của client/server.
- **Scenario 2.2 (Sliding RPM/TPM Enforcement)**: Cửa sổ trượt 60 giây ghi nhận chính xác cả số lượt gọi (RPM) lẫn số lượng tokens tiêu thụ (TPM), tự động kích hoạt pacing delay khi tiến gần ngưỡng giới hạn.
- **Scenario 2.3 (Key Rotation & Health Sorting)**: Scheduler tự động ưu tiên các key có độ sẵn sàng cao nhất, ít lỗi nhất và chưa đạt tải.

---

### User Story 3 (P3) — Resilience, Failure & Retry Tracing Regression Suite
**As a** tiến trình dịch thuật tự động,  
**I want** khi gặp lỗi mạng, 429 Quota hoặc 503 Overload, hệ thống tự động chuyển sang key khác và retry mà vẫn giữ nguyên mã định danh `requestId`,  
**So that** toàn bộ vòng đời request có thể được truy vết chính xác từ client tới server.

#### Acceptance Scenarios
- **Scenario 3.1 (Retry with Preserved RequestId)**: Request dịch thuật gặp lỗi 429 ở attempt 1 tự động chuyển sang key 2 ở attempt 2; log telemetry ghi nhận cả 2 attempts với cùng 1 `requestId`.
- **Scenario 3.2 (Dynamic Cooldown on 429)**: Key nhận lỗi 429 bị đưa vào trạng thái Cooldown tạm thời (3s–60s) và không được chọn cho các request khác trong thời gian này.
- **Scenario 3.3 (Timeout Safety)**: Request bị quá thời gian chờ (15s/60s) bị hủy an toàn bằng `AbortController` mà không gây treo Event Loop.

---

### User Story 4 (P4) — Infrastructure, Rate Limiting & Storage Security Suite
**As a** quản trị viên an ninh hệ thống,  
**I want** HTTP rate limiter ngăn chặn spam DoS và hệ thống lưu trữ không bao giờ làm lộ plain API key ra `localStorage`,  
**So that** máy chủ và dữ liệu người dùng được bảo vệ tuyệt đối.

#### Acceptance Scenarios
- **Scenario 4.1 (HTTP Sliding Window Rate Limiting)**: Chặn đứng hiện tượng 2x burst tại ranh giới phút, trả về đúng header `Retry-After` và mã `429 Too Many Requests`.
- **Scenario 4.2 (Redis Graceful Degradation)**: Mất kết nối Redis không làm sập server; hệ thống chuyển đổi mượt mà sang in-memory limiter và chunk cache trong < 5ms.
- **Scenario 4.3 (Storage Zero-Plain-Key Invariant)**: `verifyStorageIntegrity` bảo đảm `localStorage` không chứa plain API keys hoặc văn bản bản thảo.

---

## 3. Measurable Success Criteria

- **SC-001 (End-to-End Coverage)**: 100% các subsystem (Model, Quota, Resilience, Infra, Telemetry) có test case tái hiện lỗi thực tế.
- **SC-002 (Quality Gates)**: Đạt 100% test pass (`npm test`), 0 lỗi TypeScript (`npm run lint`), và build thành công (`npm run build`).
- **SC-003 (Bug Regression Immunity)**: Tất cả các bug biên (boundary burst, PST timezone offset, shutdown migration, retry requestId preservation, Redis failover) đều có assertion cụ thể.

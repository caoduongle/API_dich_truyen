# Feature Specification: Zero Model Verification in Translation Hot Path & Concurrency Deduplication

**Feature Branch**: `036-hot-path-model-verification`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 04 — KHÔNG GỌI MODEL VERIFICATION TRONG HOT PATH: Audit validateModelMiddleware(), modelInfoService.isModelVerified(), model discovery, translation request. Đảm bảo translation request KHÔNG BAO GIỜ dẫn tới outbound verification network call trước khi gọi Gemini. Luồng mong muốn: Discovery/Verify phase -> cached verified registry -> Translation hot path -> read registry -> Gemini. Concurrency: 20 request cùng gặp 1 model chưa verify -> 1 verification, 19 await same promise. Tests: cache hit, cache miss, concurrent verification, verification failure, stale verification, refresh."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Loại bỏ Hoàn toàn Verification Network Call khỏi Hot Path Dịch thuật (Priority: P1) 🎯 MVP

Là một người dùng đang thực hiện dịch chương truyện (Translation Hot Path),  
Tôi muốn request dịch thuật (`/translate-raw`, `/polish-translation`, `/qa-critique`, v.v.) được chuyển thẳng tới Gemini API mà KHÔNG bị chèn thêm bất kỳ cuộc gọi mạng ngầm nào để xác minh model (model verification network call),  
Để tối ưu hóa độ trễ (latency), tiết kiệm thời gian dịch, và tránh nghẽn băng thông do các cuộc gọi thăm dò lặp lại.

**Why this priority**: Rà soát code (Audit) phát hiện `validateModelMiddleware` hiện đang gọi `modelInfoService.isModelVerified()`, và khi gặp model chưa có trong cache server, hàm này tự động gọi `verifySingleModel()` kích hoạt HTTP request tới Google AI Studio ngay giữa luồng dịch thuật.

**Independent Test**:
1. Gửi request dịch thuật `/api/translate-raw` với model hợp lệ đã cache hoặc preset.
2. Xác minh 0 request `GET /v1beta/models/...` được gửi tới Google trước khi gọi `generateContent`.
3. Gửi request dịch thuật với custom model chưa từng xác minh.
4. Xác minh hệ thống từ chối ngay lập tức với HTTP 400 `MODEL_UNVERIFIED` trong < 5ms mà KHÔNG gửi bất kỳ outbound network call nào để thăm dò Google API.

**Acceptance Scenarios**:
1. **Given** một request dịch thuật với model hợp lệ (preset hoặc custom model đã xác minh trong cache), **When** qua `validateModelMiddleware`, **Then** middleware chỉ đọc từ bộ nhớ cache/preset và chuyển tiếp ngay tới controller (`next()`).
2. **Given** một request dịch thuật với model chưa được xác minh hoặc cache miss, **When** qua `validateModelMiddleware`, **Then** middleware từ chối ngay lập tức với HTTP 400 `MODEL_UNVERIFIED`, hướng dẫn người dùng xác minh model trước qua Cấu hình AI hoặc endpoint `/api/verify-model`.
3. **Given** pipeline dịch thuật đang chạy, **When** middleware kiểm tra model, **Then** số lượng outbound HTTP request tới Google để tra cứu model trong suốt chu kỳ dịch là chính xác 0.

---

### User Story 2 - Khử trùng lặp Đơn luồng (Single-Flight Promise Deduplication) khi Xác minh Đồng thời (Priority: P1) 🎯 MVP

Là hệ thống dịch thuật và máy chủ API,  
Tôi muốn khi có nhiều request đồng thời yêu cầu xác minh cùng một Model ID (ví dụ: 20 request đồng thời), hệ thống chỉ thực hiện DUY NHẤT 1 cuộc gọi mạng tới Google AI Studio và cho 19 request còn lại cùng chờ chung (await) Promise đó,  
Để bảo vệ Quota API, tránh lãng phí tài nguyên mạng, và chống hiện tượng Thundering Herd / Cache Stampede.

**Why this priority**: Khi người dùng mở nhiều tab, hoặc hệ thống thực hiện xác minh hàng loạt, việc không khử trùng lặp Promise in-flight sẽ gửi hàng chục request giống hệt nhau lên Google API, gây rate limit hoặc lãng phí quota.

**Independent Test**:
1. Kích hoạt đồng thời 20 cuộc gọi `modelInfoService.verifySingleModel("tunedModels/my-novel-v1", apiKey)`.
2. Kiểm tra spy của `fetch`: Số lần gọi mạng tới Google API chính xác là 1 lần.
3. Toàn bộ 20 Promise đều nhận được kết quả `ModelDefinition` hợp lệ.

**Acceptance Scenarios**:
1. **Given** 20 request xác minh cùng một model ID đến gần như cùng lúc, **When** request đầu tiên đang thực thi mạng, **Then** 19 request sau tái sử dụng Promise in-flight của request đầu tiên.
2. **Given** request xác minh in-flight hoàn tất (thành công hoặc thất bại), **When** kết thúc, **Then** hệ thống tự động dọn dẹp in-flight map trong khối `finally` để các request sau đó trong tương lai không bị kẹt promise cũ.
3. **Given** request xác minh in-flight thất bại (ví dụ: 404 Not Found), **When** ném lỗi, **Then** toàn bộ 20 caller đều nhận được lỗi chính xác và promise bị hủy khỏi map ngay lập tức.

---

### User Story 3 - Phân tách Rõ ràng Luồng Xác minh (Explicit Path) và Luồng Dịch thuật (Hot Path) (Priority: P2)

Là một lập trình viên và kiến trúc sư hệ thống,  
Tôi muốn phân tách triệt để 2 luồng:
1. **Explicit Verification Path (`POST /api/verify-model`)**: Chịu trách nhiệm gọi Google API, kiểm tra capability, và ghi kết quả vào Cache / Registry.
2. **Translation Hot Path (`/translate-raw`, `/polish-translation`, v.v.)**: Hoàn toàn chỉ đọc từ Cache / Registry,  
Để kiến trúc hệ thống đạt tính đơn nhiệm, dễ bảo trì và không bị side-effect ngầm.

**Why this priority**: Ngăn chặn hoàn toàn việc "âm thầm gọi discovery / verify" trong luồng xử lý chính.

**Independent Test**:
1. Kiểm tra cache hit: Trả về kết quả ngay từ server cache.
2. Kiểm tra cache miss trong hot path: Trả về lỗi 400 mà không gọi mạng.
3. Kiểm tra explicit verification: Gọi `POST /api/verify-model` nạp model vào server cache thành công.
4. Gửi lại request dịch thuật: Thành công ngay lập tức vì model đã có trong cache.

---

### Edge Cases

- **Cache Timeout / Hết hạn TTL (15 phút)**: Nếu model trong cache hết hạn TTL, explicit verification sẽ làm mới cache; trong khi hot path nếu gặp model hết hạn mà không có preset sẽ yêu cầu re-verify hoặc kiểm tra thời gian ân hạn an toàn.
- **Provider Outage / Timeout trong Concurrency**: Nếu 20 concurrent request đang chờ và Google API timeout (15s), tất cả 20 request đều nhận được lỗi `TIMEOUT` an toàn mà không làm rò rỉ bộ nhớ map.
- **Thử lại ngay sau lỗi (Fast Retry after Failure)**: Khi một request xác minh thất bại, in-flight promise bị xóa ngay để request thử lại sau đó có thể gửi request mới lên Google thay vì nhận lại lỗi cached cũ.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `validateModelMiddleware` TUYỆT ĐỐI KHÔNG thực hiện outbound network call tới Google API để tra cứu/xác minh model trong luồng request dịch thuật.
- **FR-002**: `modelInfoService` PHẢI cung cấp hàm kiểm tra thuần túy từ bộ nhớ đệm (`isModelVerifiedCached(modelId: string): boolean`) hoặc `isModelVerified(modelId, { allowProbe: false })` để chỉ tra cứu Presets và `verifiedModelsCache`.
- **FR-003**: Nếu `validateModelMiddleware` phát hiện model chưa có trong Presets và chưa có trong `verifiedModelsCache`, middleware PHẢI trả về ngay HTTP 400 với `code: 'MODEL_UNVERIFIED'` trong thời gian < 5ms mà không gửi bất kỳ network call nào.
- **FR-004**: `modelInfoService.verifySingleModel` PHẢI cài đặt cơ chế **Single-Flight Concurrency Deduplication** (`inFlightVerifications: Map<string, Promise<ModelDefinition>>`) để $N$ request đồng thời cho cùng một model ID chỉ sinh ra đúng 1 outbound fetch.
- **FR-005**: Mọi in-flight Promise trong `inFlightVerifications` PHẢI được dọn dẹp (xóa khỏi Map) trong khối `finally` sau khi hoàn thành hoặc gặp lỗi.
- **FR-006**: Luồng xác minh mô hình PHẢI là luồng tường minh (Explicit Path qua `POST /api/verify-model`), tự động lưu model vào `verifiedModelsCache` để phục vụ các request dịch thuật tiếp theo.
- **FR-007**: Hệ thống PHẢI hỗ trợ làm mới cache (re-verification / refresh) thông qua việc gọi lại endpoint `POST /api/verify-model`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **0ms Verification Overhead in Hot Path**: 0 outbound network request tới Google API để tra cứu model trong suốt vòng đời của request dịch thuật (`/translate-raw`, `/polish-translation`, `/qa-critique`).
- **SC-002**: **Single-Flight Concurrency**: 100% các request xác minh đồng thời cùng 1 model ID được gộp thành 1 HTTP fetch duy nhất.
- **SC-003**: **Immediate Cache Miss Rejection**: Request dịch thuật với model chưa xác minh bị từ chối với HTTP 400 trong thời gian $\le 5$ms.
- **SC-004**: **Full Test Coverage**: 100% pass toàn bộ 6 kịch bản kiểm thử:
  1. `cache hit` (đọc cache 0 network call)
  2. `cache miss in hot path` (từ chối 400 0 network call)
  3. `concurrent verification` (20 concurrent requests = 1 fetch)
  4. `verification failure` (lỗi lan truyền đúng và xóa khỏi in-flight map)
  5. `stale verification` (xử lý cache quá hạn)
  6. `refresh` (làm mới cache thành công).

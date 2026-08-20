# Feature Specification: Model Discovery Dùng Header Auth (Không Gửi API Key Trong URL)

**Feature Branch**: `044-model-discovery-header-auth`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 07 — MODEL DISCOVERY KHÔNG GỬI API KEY TRONG URL. Mục tiêu: Audit toàn bộ request tới Google model discovery. Không sử dụng: ?key=<API_KEY> nếu API hiện tại hỗ trợ header. Dùng: x-goog-api-key: <API_KEY> theo API contract hiện tại của Google. Kiểm tra: URL, logs, error objects, proxy, tests, mocks. Không để key xuất hiện trong URL. Tests: Mock request và assert: URL does not contain key, header contains key, logs do not contain key."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chuyển Đổi Xác Thực Sang Header `x-goog-api-key` (Priority: P1) 🎯 MVP

Khi dịch vụ `modelInfoService` gửi các yêu cầu HTTP tới Google AI Studio API (bao gồm: `listModelsForKey`, `fetchSingleModelFromGoogle`, và `probeModelGeneration`), toàn bộ thông tin khóa xác thực (API Key) phải được đặt trong HTTP Request Header:
```http
x-goog-api-key: <API_KEY>
```
thay vì nối vào URL Query Parameter (`?key=<API_KEY>`).

**Why this priority**: Bảo vệ API key khỏi nguy cơ bị rò rỉ qua các tầng trung gian (Access Logs của Web Server, Reverse Proxy, Browser History, DNS/TLS logging, Packet Sniffers).

**Independent Test**:
- Giả lập gọi `listModelsForKey` $\to$ Kiểm tra Request URL là `https://generativelanguage.googleapis.com/v1beta/models` (hoàn toàn không có `?key=`), và Headers có `'x-goog-api-key': 'AIzaSy...'`.

**Acceptance Scenarios**:
1. **Scenario 1.1 (Header Auth on Model List)**: **Given** API key hợp lệ, **When** gọi `listModelsForKey`, **Then** request gửi tới Google sử dụng header `x-goog-api-key` và URL sạch tham số `key`.
2. **Scenario 1.2 (Header Auth on Single Model Verification)**: **Given** modelId và API key, **When** gọi `verifySingleModel`, **Then** request tra cứu chi tiết model sử dụng header `x-goog-api-key`.
3. **Scenario 1.3 (Header Auth on Probe Request)**: **Given** modelId cần probe, **When** gọi `probeModelGeneration`, **Then** request `generateContent` thăm dò sử dụng header `x-goog-api-key`.

---

### User Story 2 - Loại Bỏ Triệt Để Khóa Khỏi URL & Mạng Lưới (Zero URL Key Leakage) (Priority: P1) 🎯 MVP

Rà soát và đảm bảo toàn bộ mã nguồn server không còn bất kỳ dòng code nào tạo chuỗi URL chứa `?key=${key}` hoặc `&key=${key}` khi tương tác với các API của Google.

**Why this priority**: Tuân thủ tiêu chuẩn an toàn thông tin OWASP và Google Cloud API Security Guidelines.

**Independent Test**: Quét toàn bộ codebase $\to$ Không có URL outbound nào chứa chuỗi con `?key=`.

**Acceptance Scenarios**:
1. **Scenario 2.1 (URL Cleanliness Assert)**: **Given** bất kỳ request outbound nào tới Google APIs, **When** kiểm tra URL, **Then** `url.includes('?key=') === false` và `url.includes(apiKey) === false`.

---

### User Story 3 - Khử Nhiễm Nhật Ký & Đối Tượng Lỗi (Zero-Leak Logs & Error Objects) (Priority: P1) 🎯 MVP

Khi các yêu cầu HTTP tới Google API gặp lỗi (ví dụ 400, 401, 403, 404, 500, timeout), đối tượng lỗi (Error Objects) và nhật ký hệ thống (System Logs) không được chứa URL có khóa hoặc các thông điệp phản hồi lộ khóa thô.

**Why this priority**: Ngăn chặn rò rỉ khóa bí mật qua các dịch vụ giám sát lỗi tập trung (như Sentry, Datadog) hoặc console log máy chủ.

**Independent Test**: Gây lỗi 403/500 khi tra cứu model $\to$ Kiểm tra log và chuỗi `err.message` $\to$ không chứa plaintext API key.

**Acceptance Scenarios**:
1. **Scenario 3.1 (Log Sanitization)**: **Given** lỗi từ Google API, **When** ghi log, **Then** thông báo lỗi được làm sạch bằng `redactApiKey`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toàn bộ các hàm gửi request HTTP trong `modelInfoService.ts` (`fetchModelsFromGoogle`, `fetchSingleModelFromGoogle`, `probeModelGeneration`) PHẢI sử dụng header `x-goog-api-key: <API_KEY>` để xác thực.
- **FR-002**: URL của toàn bộ các endpoint gọi tới Google Generative Language API TUYỆT ĐỐI KHÔNG ĐƯỢC chứa tham số truy vấn `?key=` hay `&key=`.
- **FR-003**: Header `x-goog-api-key` PHẢI chứa chuỗi API key đã được loại bỏ khoảng trắng thừa (`apiKey.trim()`).
- **FR-004**: Request headers PHẢI bao gồm:
  - `'x-goog-api-key': trimmedKey`
  - `'Content-Type': 'application/json'`
  - `'User-Agent': 'aistudio-build'`
- **FR-005**: Mọi thông điệp lỗi hoặc phản hồi từ Google API PHẢI được xử lý qua hàm `redactApiKey` trước khi ném ngoại lệ hoặc ghi log.
- **FR-006**: Toàn bộ mock và unit tests liên quan đến Model Discovery & Verification PHẢI được cập nhật để kiểm tra header `x-goog-api-key` và URL sạch.
- **FR-007**: Toàn bộ 3 kịch bản kiểm thử bắt buộc (`URL does not contain key`, `header contains key`, `logs do not contain key`) PHẢI được cài đặt và pass 100%.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% request gửi tới Google Model Discovery & Probe đều mang header `x-goog-api-key`.
- **SC-002**: 0% request gửi tới Google APIs chứa tham số `?key=` trong URL.
- **SC-003**: 0% log hay error trace rò rỉ plaintext API key.
- **SC-004**: Toàn bộ test suite chuyên biệt và toàn diện đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`).

---

## Assumptions

- Google Generative Language API v1beta hỗ trợ chuẩn xác thực qua header `x-goog-api-key` cho toàn bộ các endpoint `/v1beta/models`, `/v1beta/models/{modelId}`, và `/v1beta/models/{modelId}:generateContent`.

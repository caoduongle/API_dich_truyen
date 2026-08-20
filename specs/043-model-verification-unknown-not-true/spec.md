# Feature Specification: Xác Thực Năng Lực Mô Hình (Model Verification: Unknown ≠ True)

**Feature Branch**: `043-model-verification-unknown-not-true`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 06 — MODEL VERIFICATION UNKNOWN ≠ TRUE. Mục tiêu: Audit modelInfoService. Đặc biệt logic: supportedGenerationMethods === undefined -> true không được mặc định là verified capability. Desired state: true, false, unknown. Ví dụ: generateContent present -> supported; generateContent absent -> unsupported; metadata missing -> unknown. Behavior: Unknown không được tự động trở thành: verified = true. Nếu workflow cần xác minh: unknown -> explicit verification. Tests: capability present, capability absent, capability missing, malformed metadata, verification success, verification failure."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phân Tách 3 Trạng Thái Năng Lực Mô Hình (Tri-State Model Capability) (Priority: P1) 🎯 MVP

Khi truy vấn metadata của mô hình từ Google AI Studio, hệ thống phải phân định rạch ròi 3 trạng thái của phương thức tạo nội dung (`generateContent`):
1. **`supported` (`true`)**: Thuộc tính `supportedGenerationMethods` tồn tại và chứa rõ ràng chuỗi `"generateContent"`.
2. **`unsupported` (`false`)**: Thuộc tính `supportedGenerationMethods` là một mảng nhưng **không** chứa `"generateContent"` (ví dụ: chỉ hỗ trợ `["embedContent"]` hoặc `["countTokens"]`).
3. **`unknown`**: Thuộc tính `supportedGenerationMethods` bị thiếu (`undefined`/`null`), mảng rỗng, hoặc cấu trúc metadata bị lỗi/dị tật.

Hệ thống tuyệt đối **không được** mặc định gán `unknown === true` hoặc tự động đánh dấu mô hình là `verified = true` khi chưa có bằng chứng xác minh cụ thể.

**Why this priority**: Ngăn chặn việc gửi yêu cầu dịch thuật vào các mô hình chuyên biệt không hỗ trợ sinh văn bản (như Text Embedding models, Audio models) gây lỗi 400 Bad Request và tiêu tốn tài nguyên hệ thống.

**Independent Test**:
- Model có `supportedGenerationMethods: ["generateContent"]` $\to$ Năng lực `generateContent = 'supported'`.
- Model có `supportedGenerationMethods: ["embedContent"]` $\to$ Năng lực `generateContent = 'unsupported'`.
- Model có `supportedGenerationMethods: undefined` $\to$ Năng lực `generateContent = 'unknown'`.

**Acceptance Scenarios**:
1. **Scenario 1.1 (Capability Present)**: **Given** metadata có `supportedGenerationMethods` chứa `"generateContent"`, **When** đánh giá năng lực, **Then** hệ thống ghi nhận trạng thái `'supported'` (`verified = true`).
2. **Scenario 1.2 (Capability Absent)**: **Given** metadata có `supportedGenerationMethods` không chứa `"generateContent"`, **When** đánh giá năng lực, **Then** hệ thống ghi nhận trạng thái `'unsupported'` (`verified = false`).
3. **Scenario 1.3 (Capability Missing)**: **Given** metadata thiếu trường `supportedGenerationMethods`, **When** đánh giá năng lực, **Then** hệ thống ghi nhận trạng thái `'unknown'` (tuyệt đối không tự động coi là `true`).

---

### User Story 2 - Quy Trình Thử Nghiệm Xác Minh Rõ Ràng (Explicit Verification Probe) (Priority: P1) 🎯 MVP

Khi một mô hình tùy chỉnh (Custom Model) có trạng thái năng lực là `unknown` (do metadata thiếu hoặc không trả về danh sách methods), hệ thống không được từ chối ngay lập tức mà phải chuyển sang bước **Thử nghiệm xác minh thực tế (Explicit Verification Probe)**: gửi một yêu cầu `generateContent` thăm dò tối giản với API key của người dùng để kiểm chứng khả năng sinh nội dung thực tế của mô hình:
- Nếu probe thành công: Chuyển trạng thái sang `verified = true`, `capabilities.generateContent = true`.
- Nếu probe thất bại (lỗi 400 Unsupported, 404 Not Found, hoặc lỗi API): Từ chối xác minh (`verified = false`) và thông báo lỗi rõ ràng cho người dùng.

**Why this priority**: Hỗ trợ các mô hình mới ra mắt hoặc các mô hình tinh chỉnh (Fine-tuned/Custom Models) của Google có thể chưa cập nhật metadata đầy đủ trên endpoint `/v1beta/models` nhưng vẫn có khả năng chạy thực tế.

**Independent Test**:
- Custom model thiếu metadata + Probe thành công $\to$ `verified = true`.
- Custom model thiếu metadata + Probe gặp 400 `unsupported method` $\to$ `verified = false` kèm thông báo lỗi.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Verification Success on Probe)**: **Given** model có năng lực `unknown`, **When** thực hiện explicit probe thành công, **Then** model được nâng cấp thành `verified = true`.
2. **Scenario 2.2 (Verification Failure on Probe)**: **Given** model có năng lực `unknown`, **When** explicit probe thất bại, **Then** hệ thống từ chối xác minh và trả về lỗi thích hợp.

---

### User Story 3 - Xử Lý Bền Vững Khi Metadata Bị Dị Tật (Malformed Metadata Resilience) (Priority: P1) 🎯 MVP

Khi phản hồi từ Google API trả về cấu trúc dị tật (ví dụ: `supportedGenerationMethods` là chuỗi thay vì mảng, hoặc đối tượng rỗng), hệ thống phải bắt lỗi an toàn (safe parse), chuyển trạng thái năng lực về `unknown` và kích hoạt luồng explicit verification probe thay vì phát sinh ngoại lệ `TypeError: methods.includes is not a function` làm sập tiến trình.

**Why this priority**: Bảo đảm tính ổn định tuyệt đối của hệ thống trước mọi biến động cấu trúc dữ liệu từ nhà cung cấp bên thứ ba.

**Independent Test**: Truyền metadata dị tật `supportedGenerationMethods: "not-an-array"` $\to$ Hệ thống nhận diện an toàn là `unknown` và không bị crash.

**Acceptance Scenarios**:
1. **Scenario 3.1 (Malformed Handling)**: **Given** metadata có trường kiểu dữ liệu sai, **When** xử lý, **Then** hệ thống gán nhãn `unknown` an toàn.

---

### User Story 4 - Lọc Sạch Danh Sách Mô Hình Khám Phá (Discovery Filtering) (Priority: P2)

Trong hàm `listModelsForKey`, hệ thống chỉ đưa vào danh sách mô hình đề xuất cho người dùng những mô hình đã được xác nhận chắc chắn có `supportedGenerationMethods` chứa `"generateContent"`. Các mô hình thiếu metadata hoặc chỉ hỗ trợ embedding/vision-only mà không sinh văn bản sẽ bị loại khỏi danh sách gợi ý dịch thuật.

**Why this priority**: Giữ cho danh sách mô hình dịch thuật luôn sạch sẽ, chính xác và đáng tin cậy.

**Independent Test**: Mock danh sách gồm 1 model text generation, 1 embedding model, và 1 model thiếu metadata $\to$ `listModelsForKey` chỉ trả về model text generation đã được xác minh.

---

### Edge Cases

- **Mô hình trả về chữ hoa / chữ thường khác biệt (`GenerateContent` vs `generatecontent`)**: So sánh không phân biệt hoa thường (Case-insensitive matching).
- **Mô hình bị Google khai tử (Shutdown)**: Preset model có trạng thái `shutdown` luôn bị từ chối xác minh (`verified = false`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI loại bỏ hoàn toàn biểu thức logic mặc định `supportedGenerationMethods === undefined -> true` và `methods.length === 0 -> true` trong toàn bộ `modelInfoService.ts`.
- **FR-002**: Hệ thống PHẢI định nghĩa rõ ràng 3 trạng thái năng lực của mô hình (**Model Capability Tri-State**):
  - `'supported'`: Thuộc tính `supportedGenerationMethods` là mảng và có chứa `"generateContent"`.
  - `'unsupported'`: Thuộc tính `supportedGenerationMethods` là mảng và KHÔNG chứa `"generateContent"`.
  - `'unknown'`: Thuộc tính `supportedGenerationMethods` bị `undefined`, `null`, mảng rỗng, hoặc kiểu dữ liệu không hợp lệ.
- **FR-003**: Trạng thái `'unknown'` TUYỆT ĐỐI KHÔNG ĐƯỢC tự động gán thành `verified = true`.
- **FR-004**: Khi gọi `verifySingleModel(modelId, apiKey, customLabel)`:
  - Nếu năng lực là `'supported'` $\to$ xác minh thành công (`verified = true`).
  - Nếu năng lực là `'unsupported'` $\to$ ném lỗi từ chối rõ ràng (`verified = false`).
  - Nếu năng lực là `'unknown'` $\to$ hệ thống PHẢI kích hoạt luồng **Explicit Verification Probe** thăm dò trực tiếp với Google GenAI.
- **FR-005**: Quy trình **Explicit Verification Probe** gửi một yêu cầu thăm dò tối giản với API key của người dùng. Nếu probe thành công $\to$ xác nhận `verified = true`; nếu probe thất bại $\to$ từ chối với lỗi `VERIFICATION_FAILED`.
- **FR-006**: Khi metadata trả về từ Google API bị dị tật (không phải mảng hoặc cấu trúc bất thường), hệ thống PHẢI xử lý an toàn (safe parsing) và gán nhãn năng lực là `'unknown'` mà không làm sập máy chủ.
- **FR-007**: Trong `listModelsForKey`, hệ thống CHỈ ĐƯỢC liệt kê các mô hình có năng lực xác nhận là `'supported'`.
- **FR-008**: Toàn bộ các kết quả xác minh thành công PHẢI được lưu vào `verifiedModelsCache` để tăng tốc độ truy xuất cho Hot Path dịch thuật (0 network call).
- **FR-009**: Thông điệp lỗi từ chối xác minh PHẢI được chuẩn hóa và che giấu (redacted) toàn bộ API keys.
- **FR-010**: Toàn bộ 6 kịch bản kiểm thử bắt buộc (`capability present`, `capability absent`, `capability missing`, `malformed metadata`, `verification success`, `verification failure`) PHẢI được cài đặt và pass 100%.

---

### Key Entities

- **ModelCapabilityState**: Kiểu dữ liệu 3 trạng thái năng lực:
  ```typescript
  export type ModelCapabilityState = 'supported' | 'unsupported' | 'unknown';
  ```
- **ModelCapabilityEvaluation**: Kết quả đánh giá năng lực từ metadata:
  ```typescript
  export interface ModelCapabilityEvaluation {
    state: ModelCapabilityState;
    hasGenerateContent: boolean;
    rawMethods: string[];
  }
  ```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các trường hợp `supportedGenerationMethods === undefined` hoặc thiếu metadata được đánh giá chính xác là `'unknown'` (0% bị gán nhầm thành `true`).
- **SC-002**: 100% các mô hình ở trạng thái `'unknown'` đều phải trải qua Explicit Verification Probe trước khi được cấp trạng thái `verified = true`.
- **SC-003**: 100% các metadata dị tật được xử lý an toàn với 0 lỗi `TypeError` hoặc crash tiến trình.
- **SC-004**: Toàn bộ 6 ca kiểm thử bắt buộc đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi cảnh báo.

---

## Assumptions

- Hầu hết các mô hình Gemini chính thức (`gemini-2.5-flash`, `gemini-2.5-pro`) đều có trường `supportedGenerationMethods: ["generateContent", ...]` chuẩn tắc trên Google AI Studio.
- Các mô hình thử nghiệm hoặc custom endpoint có thể tạm thời thiếu metadata, do đó cơ chế probe tối giản là giải pháp tối ưu vừa đảm bảo tính bảo mật vừa duy trì tính tương thích cao.

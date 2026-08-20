# Feature Specification: Mandatory Custom Model Verification & State Governance

**Feature Branch**: `035-custom-model-verification`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 03 — CUSTOM MODEL KHÔNG ĐƯỢC TỰ ĐỘNG VERIFIED: Sửa inconsistency custom model thiếu verification metadata lại mặc định verified=true. Xây dựng state machine (unverified, verified, invalid, deprecated, shutdown), luồng kiểm tra cú pháp → xác minh provider → trích xuất capabilities → registry, tối ưu UX kiểm tra trạng thái và bộ nhớ đệm cache không gọi lại khi render."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Xác minh bắt buộc trước khi kích hoạt Mô hình Tự nhập (Priority: P1) 🎯 MVP

Là một người dùng hoặc quản trị viên hệ thống,  
Tôi muốn khi thêm một mô hình tùy chỉnh (Custom Model ID), hệ thống BẮT BUỘC phải xác thực cú pháp và gửi yêu cầu xác minh tới nhà cung cấp (Google AI Studio) trước khi đưa mô hình vào trạng thái hoạt động (Active / Verified),  
Để ngăn chặn tình trạng người dùng chọn nhầm các model không tồn tại, model sai tên, hoặc model chưa được cấp quyền gây sập/lỗi toàn bộ tiến trình dịch tự động.

**Why this priority**: Loại bỏ hoàn toàn lỗ hổng giả định sai lệch (inconsistency) khi custom model không có metadata xác minh nhưng lại tự động được gán `verified: true`.

**Independent Test**:
1. Người dùng nhập một model ID hợp lệ về cú pháp nhưng không có thật trên Google (ví dụ: `gemini-fake-999-ultra`).
2. Nhấn Thêm mô hình.
3. Xác minh hệ thống hiển thị "Đang kiểm tra mô hình...", sau đó báo lỗi "Mô hình không tồn tại trên Google AI Studio" và KHÔNG đưa model này vào danh sách model có thể chọn dịch.

**Acceptance Scenarios**:
1. **Given** người dùng nhập một custom model ID, **When** chưa thực hiện xác minh với Google API, **Then** mô hình ở trạng thái `unverified` và không được phép chọn để chạy dịch thuật.
2. **Given** người dùng thêm custom model và xác minh thành công với Google API (có hỗ trợ `generateContent`), **When** kết quả trả về, **Then** mô hình chuyển sang trạng thái `verified` (`status: 'active'`), lưu đầy đủ `capabilities` và `lastVerifiedAt` vào registry.
3. **Given** người dùng nhập model ID bị lỗi xác minh (404 Not Found hoặc không có quyền), **When** hoàn tất kiểm tra, **Then** hệ thống chuyển trạng thái sang `invalid` và hiển thị thông báo lỗi chi tiết cho người dùng.

---

### User Story 2 - Quản trị Vòng đời Trạng thái Mô hình Đầy đủ (Priority: P1) 🎯 MVP

Là một hệ thống điều phối dịch thuật (Scheduler & Pipeline),  
Tôi muốn mỗi mô hình trong Registry có trạng thái vòng đời rõ ràng: `unverified`, `verified`, `invalid`, `deprecated`, `shutdown`,  
Để pipeline chỉ cho phép admission đối với các model `verified` (hoặc `active`/`deprecated`), tự động chặn các model `unverified` / `invalid` và tự động chuyển hướng đối với model `shutdown`.

**Why this priority**: Đảm bảo an toàn cấp hệ thống (defense-in-depth), middleware và controller backend từ chối phục vụ nếu client cố tình gửi model `unverified` hoặc `invalid`.

**Independent Test**:
1. Gửi request dịch `/api/translate-raw` với `model: "custom-unverified-model"`.
2. Xác minh backend từ chối với lỗi 400 và mã lỗi `MODEL_UNVERIFIED` hoặc yêu cầu xác minh trước khi sử dụng.

**Acceptance Scenarios**:
1. **Given** một custom model có trạng thái `unverified` hoặc `invalid`, **When** client gửi yêu cầu dịch thuật với model đó, **Then** hệ thống chặn yêu cầu và thông báo model chưa được xác minh.
2. **Given** một model có trạng thái `shutdown`, **When** hệ thống kiểm tra, **Then** hệ thống tự động di chuyển sang `replacementId` hoặc `DEFAULT_MODEL_ID`.

---

### User Story 3 - Trải nghiệm UX Trực quan & Bộ đệm Cache Không Gọi Lại Khi Render (Priority: P2)

Là một người dùng giao diện Cài đặt API (ApiSettings),  
Tôi muốn thấy phản hồi trực quan theo thời gian thực khi thêm model ("Đang kiểm tra mô hình..." $\to$ "Đã xác minh" hoặc "Mô hình không hợp lệ"),  
Và giao diện phải sử dụng bộ nhớ đệm cache/registry đã lưu thay vì gửi request xác minh liên tục mỗi lần component re-render.

**Why this priority**: Đảm bảo trải nghiệm mượt mà, không bị nháy giật giao diện và không lãng phí quota/băng thông mạng do gọi API vô tận trong vòng đời React.

**Independent Test**:
1. Mở modal Cài đặt API.
2. Re-render modal nhiều lần (ví dụ: chuyển tab, gõ phím).
3. Xác minh tab Network không phát sinh bất kỳ request `POST /api/verify-model` thừa nào cho các model đã có trong cache.

**Acceptance Scenarios**:
1. **Given** người dùng nhấn nút Thêm Model, **When** request đang xử lý, **Then** nút hiển thị trạng thái loading "Đang kiểm tra mô hình..." (disabled).
2. **Given** modal ApiSettings được render hoặc re-render, **When** đọc danh sách custom models, **Then** component lấy trực tiếp từ `getCustomModels()` trong registry mà không gọi `verifyModel` qua mạng.
3. **Given** một custom model chưa được xác minh hoặc đã quá hạn, **When** người dùng bấm nút "Xác minh lại" (Re-verify), **Then** hệ thống thực hiện xác minh on-demand và cập nhật lại cache.

---

### Edge Cases

- **Mô hình hỗ trợ Embeddings nhưng không hỗ trợ `generateContent`** (ví dụ: `text-embedding-004`): Hệ thống phải nhận diện thiếu capability và từ chối với thông báo "Mô hình không hỗ trợ tạo nội dung (generateContent) phục vụ dịch thuật".
- **Timeout từ phía Google Provider ($\ge 15$s)**: Xử lý timeout an toàn, hiển thị thông báo "Quá thời gian phản hồi từ nhà cung cấp" và giữ model ở trạng thái `unverified` / không kích hoạt.
- **Provider gặp sự cố mạng (Offline / Network Error)**: Thông báo lỗi kết nối rõ ràng, cho phép người dùng thử lại sau mà không làm hỏng registry.
- **Thêm model đã có trong Presets**: Từ chối ngay ở bước cú pháp để tránh trùng lặp.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống TUYỆT ĐỐI KHÔNG mặc định gán `verified: true` hoặc `status: 'active'` cho bất kỳ custom model nào nếu chưa nhận được xác nhận thành công từ nhà cung cấp.
- **FR-002**: Hệ thống PHẢI định nghĩa và quản lý trạng thái mô hình theo 5 mức tối thiểu: `unverified`, `verified`, `invalid`, `deprecated`, `shutdown`.
- **FR-003**: Khi người dùng thêm custom model, hệ thống PHẢI tuân thủ luồng:
  1. Kiểm tra định dạng cú pháp ID (`isValidModelIdFormat`).
  2. Gửi yêu cầu xác minh tới nhà cung cấp (`POST /api/verify-model`).
  3. Trích xuất metadata & năng lực (`capabilities`, đặc biệt là `generateContent`).
  4. Lưu vào Registry với đầy đủ trạng thái (`verified`, `capabilities`, `lastVerifiedAt`).
- **FR-004**: Hệ thống PHẢI từ chối các model không hỗ trợ phương thức `generateContent` với lỗi `UNSUPPORTED_METHODS` / `UNSUPPORTED_FOR_TRANSLATION`.
- **FR-005**: Giao diện người dùng PHẢI hiển thị các trạng thái rõ ràng: "Đang kiểm tra mô hình..." trong quá trình kiểm tra, và "Đã xác minh" hoặc thông báo lỗi cụ thể khi kết thúc.
- **FR-006**: Giao diện người dùng KHÔNG ĐƯỢC gọi `verifyModel` mỗi lần render component; toàn bộ trạng thái hiển thị phải lấy từ Cache/Registry (`localStorage` + in-memory store) và chỉ gọi mạng khi người dùng thao tác thêm hoặc yêu cầu xác minh lại.
- **FR-007**: Module `src/utils/modelRegistry.ts` và backend middleware PHẢI chỉ đưa các model có `verified: true` vào danh sách model khả dụng cho dịch thuật.

---

### Key Entities

- **ModelVerificationState**: Enum/Union type biểu thị trạng thái xác minh:  
  `'unverified' | 'verifying' | 'verified' | 'invalid' | 'deprecated' | 'shutdown'`
- **RegisteredModelDef**:
  - `id`: Mã định danh chuẩn hóa (ví dụ: `tunedModels/my-novel-v1`).
  - `label`: Tên hiển thị người dùng.
  - `source`: `'custom' | 'discovered' | 'preset'`.
  - `status`: `'active' | 'deprecated' | 'shutdown'`.
  - `verified`: `boolean` (chỉ `true` khi đã qua kiểm tra provider).
  - `lastVerifiedAt`: Chuỗi ISO 8601 thời điểm xác minh gần nhất.
  - `capabilities`: `{ generateContent: boolean; vision?: boolean; thinking?: boolean }`.
  - `verificationError`?: Thông báo lỗi nếu xác minh thất bại.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **0% False Verification**: 0% custom model nào được coi là `verified` nếu không có metadata xác minh thành công từ nhà cung cấp.
- **SC-002**: **100% Capability Enforcement**: 100% custom model được kích hoạt dịch thuật phải có năng lực `generateContent: true`.
- **SC-003**: **0 Render Leakage Calls**: 0 request gọi tới endpoint `/api/verify-model` trong các chu kỳ render thông thường của UI Cài đặt.
- **SC-004**: **100% Test Suite Coverage**: Toàn bộ 7 kịch bản kiểm thử bắt buộc (valid model, invalid model, provider unavailable, provider timeout, missing capability, verified cached model, re-verification) pass sạch 100%.

---

## Assumptions

- Xác minh custom model yêu cầu người dùng đã nhập ít nhất một API Key hợp lệ trong hệ thống để thực hiện cuộc gọi kiểm tra tới Google AI Studio.
- Các preset model mặc định của hệ thống (`gemini-2.5-flash`, `gemini-2.5-pro`, v.v.) được coi là `verified: true` sẵn trong cấu hình hệ thống.
- Thời gian sống của cache xác minh custom model là 15 phút (theo `CACHE_TTL_MS` của server) và được lưu bền vững trên client cho đến khi người dùng yêu cầu kiểm tra lại hoặc xóa.

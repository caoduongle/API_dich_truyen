# Feature Specification: Lựa Chọn & Đăng Ký Model AI Động (Dynamic Model Selection & Discovery Registry)

**Feature Branch**: `009-dynamic-model-registry`  
**Created**: 2026-08-19  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Khám Phá & Chọn Nhanh Model Thực Tế Từ API Key (Priority: P1) 🎯 MVP

Là dịch giả sử dụng ứng dụng, tôi muốn sau khi bấm "Kiểm tra Model" ở tab "Quota & Hạn mức", các mô hình AI thực tế được trả về từ tài khoản Google AI Studio (qua `models.list`) sẽ tự động được ghi nhận vào kho mô hình và tôi có thể bấm nút "Dùng model này" ngay tại thẻ mô hình đó để áp dụng ngay lập tức cho toàn bộ các tính năng dịch thuật.

**Why this priority**: Hiện tại danh sách model chỉ hardcode tĩnh 5 model. Nhiều tài khoản có quyền truy cập các model mới (ví dụ: `gemini-2.0-flash-thinking-exp`, `gemini-exp-1206`, `gemini-2.5-pro-preview`) nhưng không thể chọn hay dùng được dù đã kiểm tra thấy trong danh sách.

**Independent Test**:
1. Thêm API key và chuyển sang tab "Quota & Hạn mức", bấm "Kiểm tra Model".
2. Trong danh sách các model khả dụng trả về, bấm nút **"Dùng model này"** tại một model được khám phá (ví dụ `gemini-2.0-flash-lite-preview-02-05`).
3. Xác nhận `selectedModel` lập tức chuyển sang model đó và xuất hiện huy hiệu "Đang chọn".
4. Quay lại tab "Cấu hình AI", xác nhận dropdown đã tự động chọn model này trong nhóm "Mô hình tìm thấy từ API Key".
5. Thực hiện dịch thử một đoạn văn bản hoặc gửi request đến backend API, xác nhận backend chấp nhận model mới và thực hiện dịch thành công.

**Acceptance Scenarios**:
1. **Given** người dùng bấm "Kiểm tra Model" ở bất kỳ key nào và API trả về danh sách model khả dụng (`ModelInfoItem[]`), **When** dữ liệu được tải về, **Then** hệ thống tự động lọc các model có hỗ trợ sinh văn bản (`supportsGenerateContent: true` hoặc phương thức hợp lệ), khử trùng lặp với danh sách Presets, và lưu vào bộ nhớ cục bộ `gemini_discovered_models`.
2. **Given** danh sách model khả dụng hiển thị trên thẻ key, **When** người dùng bấm "Dùng model này" trên một model bất kỳ, **Then** `selectedModel` trong `AIConfigContext` cập nhật ngay thành ID của model đó, hiển thị thông báo thành công và cập nhật badge "Đang chọn".
3. **Given** người dùng đã chọn một model khám phá, **When** gửi request dịch thô (`/api/translate-raw`), chuốt (`/api/polish-translation`), hoặc QA (`/api/qa-critique`), **Then** backend `validateModelMiddleware` kiểm tra cú pháp an toàn theo regex và cho phép xử lý bình thường.

---

### User Story 2 - Nhập Tùy Chỉnh Model AI Fine-Tuned / Preview (Priority: P1) 🎯 MVP

Là người dùng nâng cao / nhà phát triển, tôi muốn có thể nhập trực tiếp tên hoặc ID của bất kỳ mô hình AI nào (bao gồm model fine-tuned cá nhân, tunedModels, hoặc phiên bản preview nội bộ) trong tab "Cấu hình AI" để hệ thống sử dụng model đó cho quá trình dịch.

**Why this priority**: Cho phép người dùng linh hoạt thử nghiệm các model fine-tuned riêng biệt hoặc các model phiên bản thử nghiệm mà không phụ thuộc vào chu kỳ cập nhật mã nguồn của ứng dụng.

**Independent Test**:
1. Mở modal "Cấu hình AI & Bản Thảo" trong tab "Cấu hình AI".
2. Tại khu vực chọn mô hình, chọn tùy chọn "+ Nhập model tùy chỉnh..." hoặc nhập trực tiếp tên model vào trường nhập liệu (ví dụ: `tunedModels/my-novel-translator-v1`).
3. Bấm "Thêm & Sử dụng", xác nhận model mới xuất hiện trong nhóm "Mô hình tự nhập (Custom)", được chọn làm `selectedModel`, và lưu bền vững vào `gemini_custom_models`.
4. Đóng modal và mở lại, xác nhận model tự nhập vẫn tồn tại trong danh sách và được duy trì trạng thái đã chọn.

**Acceptance Scenarios**:
1. **Given** người dùng nhập một chuỗi model hợp lệ (ví dụ `gemini-exp-1206`), **When** bấm lưu/chọn, **Then** model được lưu vào danh sách `customModels`, trở thành `selectedModel`, và dropdown hiển thị đúng trong nhóm "Mô hình tự nhập (Custom)".
2. **Given** người dùng nhập chuỗi không hợp lệ (chứa dấu cách, ký tự đặc biệt nguy hiểm hoặc quá dài >128 ký tự), **When** bấm thêm, **Then** hệ thống hiển thị cảnh báo lỗi và không thêm vào danh sách.

---

### User Story 3 - Phân Nhóm Danh Sách Model Trực Quan Trong Dropdown (Priority: P2)

Là người dùng, tôi muốn danh sách chọn mô hình trong tab "Cấu hình AI" được phân chia thành các nhóm rõ ràng (`Mô hình khuyên dùng`, `Mô hình tìm thấy từ API Key`, `Mô hình tự nhập`) để dễ dàng phân biệt giữa các model tiêu chuẩn, model khám phá và model cá nhân.

**Why this priority**: Tránh làm lộn xộn danh sách dropdown khi có hàng chục model được trả về từ API Google, giúp người dùng dễ dàng tìm kiếm và lựa chọn.

**Independent Test**:
1. Mở dropdown chọn model trong tab "Cấu hình AI".
2. Xác nhận dropdown render các `<optgroup>`:
   - `Mô hình khuyên dùng (Presets)`
   - `Mô hình tìm thấy từ API Key (Discovered)` (chỉ hiện khi có model khám phá)
   - `Mô hình tự nhập (Custom)` (chỉ hiện khi có model tự nhập)

**Acceptance Scenarios**:
1. **Given** người dùng có cả 3 loại model (Presets, Discovered, Custom), **When** mở dropdown chọn model, **Then** các model được phân nhóm đúng `<optgroup>` với nhãn chuẩn tiếng Việt.

---

### Edge Cases

- **Model ID có hoặc không có tiền tố `models/`**: Hệ thống tự động chuẩn hóa (loại bỏ `models/` để hiển thị và so khớp, tự động thêm `models/` khi gọi Google API trong `geminiService.ts`).
- **Trùng lặp giữa Presets và Discovered/Custom**: Nếu một model được khám phá hoặc tự nhập trùng ID với một Preset (ví dụ `gemini-2.5-flash`), hệ thống tự động ưu tiên Preset và khử trùng lặp.
- **Model độc hại hoặc path traversal từ client**: Backend `validateModelMiddleware` từ chối tất cả các chuỗi model chứa `..`, ký tự điều khiển (`\0`, `\n`), ký tự HTML/script tag, hoặc dài quá 128 ký tự với mã lỗi HTTP 400.
- **Xóa model tùy chỉnh**: Cho phép người dùng xóa các model tùy chỉnh không còn sử dụng khỏi danh sách.
- **Khởi tạo lần đầu chưa có model khám phá/tùy chỉnh**: Dropdown hoạt động trơn tru với danh sách Presets mặc định (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Backend `validateModelMiddleware` (`server/routes/api.ts`) chuyển từ kiểm tra whitelist cứng `ALLOWED_MODEL_IDS` sang kiểm tra an toàn theo Regex `/^[a-zA-Z0-9_\-\.\/]{1,128}$/`, từ chối các chuỗi chứa `..` hoặc ký tự không hợp lệ.
- **FR-002**: Giữ `ALLOWED_MODEL_IDS` trong `shared/models.ts` và `server/constants/models.ts` làm danh sách Preset mặc định và fallback an toàn.
- **FR-003**: Nâng cấp `src/utils/modelRegistry.ts` để quản lý bộ nhớ đệm model trong `localStorage`:
  - `gemini_discovered_models`: danh sách model tìm thấy từ API Key qua `models.list`.
  - `gemini_custom_models`: danh sách model do người dùng tự nhập.
  - Cung cấp các hàm: `getRegisteredModels()`, `saveDiscoveredModels()`, `addCustomModel()`, `removeCustomModel()`, `validateModelId()`.
- **FR-004**: Cập nhật `src/context/AIConfigContext.tsx` và `src/hooks/useAIConfig.ts`:
  - Quản lý state `discoveredModels` và `customModels`.
  - Cung cấp `availableModels`: danh sách hợp nhất `[...PRESET_MODELS, ...discoveredModels, ...customModels]`.
  - Cung cấp các hàm: `registerDiscoveredModels(models)`, `addCustomModel(modelId, label)`, `removeCustomModel(modelId)`.
- **FR-005**: Nâng cấp `src/components/ApiSettings.tsx`:
  - Dropdown chia nhóm `<optgroup>` theo Presets, Discovered, Custom.
  - Bổ sung form/input nhỏ gọn cho phép nhập model mới tùy chỉnh kèm nút thêm.
- **FR-006**: Nâng cấp `src/components/QuotaPanel.tsx`:
  - Tự động gọi `registerDiscoveredModels` khi tra cứu model thành công.
  - Bổ sung nút "Dùng model này" (hoặc icon check) trên từng thẻ model khả dụng để đổi ngay `selectedModel` và hiển thị badge "Đang chọn".
- **FR-007**: Đồng bộ hóa dữ liệu thống kê Quota (`byModel`) cho cả các model động mới được chọn.

### Non-Functional Requirements & Guardrails

- **NFR-001 (Type Safety)**: Chạy `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type.
- **NFR-002 (Unit Tests Pass)**: Chạy `npm test` (`vitest run`) pass 100% tất cả các test suites.
- **NFR-003 (Build Stability)**: Chạy `npm run build` thành công cả Vite frontend và esbuild server.
- **NFR-004 (Design System Compliance)**: Tuân thủ nghiêm ngặt bảng màu "Mực & Chu Sa" (`bg-ink`, `bg-parchment`, `border-parchment-2`, `text-polish`, `font-display`, `font-mono`).

---

## Success Criteria *(mandatory)*

1. **Seamless Discovery-to-Use Flow**: Bấm "Kiểm tra Model" ở bất kỳ key nào -> Bấm "Dùng model này" trên model bất kỳ -> `selectedModel` đổi ngay lập tức và có thể dùng dịch thành công 100%.
2. **Custom Model Persistence**: Nhập model tùy chỉnh -> Lưu trữ thành công vào localStorage và hiển thị đúng trong dropdown ở các lần mở sau.
3. **Backend Safety**: Backend API chấp nhận bất kỳ model hợp lệ nào theo regex và chặn đứng 100% các payload độc hại/path traversal.
4. **Backward Compatibility**: Toàn bộ các model mặc định (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`) hoạt động ổn định không bị ảnh hưởng.
5. **Quality Gates Passed**: `npm run lint`, `npm test`, và `npm run build` pass sạch sẽ.

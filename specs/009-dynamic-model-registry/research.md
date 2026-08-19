# Research & Architecture Decisions: Dynamic Model Registry & Selection

**Feature**: `009-dynamic-model-registry`  
**Created**: 2026-08-19  

---

## 1. Vấn Đề Kỹ Thuật & Hiện Trạng

### 1.1. Backend Whitelist Cứng
- Trong `server/routes/api.ts`, `validateModelMiddleware` kiểm tra `!ALLOWED_MODEL_IDS.includes(model)`.
- `ALLOWED_MODEL_IDS` chỉ chứa 5 model tĩnh: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`.
- Khi client gửi các model mới hơn (như `gemini-2.0-flash-thinking-exp`, `gemini-exp-1206`, `tunedModels/xxx`), server trả lỗi HTTP 400.

### 1.2. Frontend Model Discovery Chưa Được Tích Hợp Vào Lựa Chọn
- `QuotaPanel.tsx` gọi `fetchModelsForKey(keyIndex)` và nhận về danh sách `ModelInfoItem[]` từ Google API `models.list`, nhưng chỉ hiển thị trong danh sách mở rộng chứ không lưu vào hệ thống đăng ký model (Model Registry) hay cho phép người dùng chọn dùng.
- Dropdown trong `ApiSettings.tsx` chỉ đọc từ `AVAILABLE_MODELS` tĩnh.

---

## 2. Các Quyết Định Kiến Trúc (Decisions & Rationale)

### 2.1. Quyết định 1: Chuyển đổi `validateModelMiddleware` sang Regex Validation An Toàn
- **Decision**: Thay vì kiểm tra whitelist cứng, sử dụng Regex:
  ```typescript
  const MODEL_ID_REGEX = /^[a-zA-Z0-9_\-\.\/]{1,128}$/;
  ```
  Kèm theo các điều kiện phòng thủ:
  1. Không cho phép chứa `..` (ngăn chặn directory / path traversal).
  2. Không chứa ký tự điều khiển (`\0`, `\n`, `\r`, `\t`).
  3. Độ dài từ 1 đến 128 ký tự.
- **Rationale**: Cho phép mở rộng với mọi model Google AI Studio hiện tại và tương lai (kể cả prefix `models/`, `tunedModels/`, format có dấu chấm `.`, gạch dưới `_`, gạch ngang `-`) mà vẫn tuyệt đối an toàn trước các cuộc tấn công injection hay path traversal.
- **Alternatives Considered**: Duy trì dynamic whitelist ở Redis hoặc server memory. Lý do bác bỏ: làm phức tạp hóa kiến trúc không cần thiết và tốn chi phí đồng bộ state giữa client và server. Regex validation đơn giản, nhanh và an toàn tuyệt đối.

### 2.2. Quyết định 2: Quản Lý Model Động Phía Client qua `modelRegistry.ts` & LocalStorage
- **Decision**:
  - Lưu model tìm thấy qua API key vào `localStorage.getItem('gemini_discovered_models')`.
  - Lưu model do người dùng tự nhập vào `localStorage.getItem('gemini_custom_models')`.
  - Hàm `getRegisteredModels()` trả về danh sách đã gộp và khử trùng lặp:
    `[...PRESET_MODELS, ...discoveredModels, ...customModels]`
- **Rationale**: Dữ liệu model lưu bền vững phía client, không bị mất khi F5 trình duyệt, hoạt động tốt ngay cả khi offline hoặc khi chuyển đổi giữa các tab.
- **Deduplication Strategy**: So khớp `normalizeModelId(id)`. Nếu model tìm thấy hoặc tự nhập trùng ID với Preset mặc định thì ưu tiên Preset.

### 2.3. Quyết định 3: Phân Nhóm Dropdown `<select>` Bằng `<optgroup>`
- **Decision**:
  - Nhóm 1: `Mô hình khuyên dùng (Presets)`
  - Nhóm 2: `Mô hình tìm thấy từ API Key (Discovered)` (chỉ hiển thị khi `discoveredModels.length > 0`)
  - Nhóm 3: `Mô hình tự nhập (Custom)` (chỉ hiển thị khi `customModels.length > 0`)
  - Tùy chọn đặc biệt hoặc nút bấm "+ Nhập model tùy chỉnh..." để mở form thêm model.
- **Rationale**: Giao diện trực quan, rõ ràng, tuân thủ đúng Design System "Mực & Chu Sa".

### 2.4. Quyết định 4: Nút "Dùng model này" Trực Tiếp Trong `QuotaPanel.tsx`
- **Decision**:
  - Khi tra cứu model thành công từ Google API qua `fetchModelsForKey`, tự động gọi `registerDiscoveredModels(models)`.
  - Trên từng dòng model khả dụng trong `QuotaPanel`, bổ sung nút / icon "Dùng model này" (nếu chưa chọn) hoặc Badge "Đang dùng" (nếu đang chọn).
  - Khi bấm, cập nhật trực tiếp `selectedModel` và hiển thị toast thông báo thành công.

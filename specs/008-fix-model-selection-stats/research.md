# Research & Technical Discovery: Sửa Chọn Model & Thống Kê Request Theo Model

**Feature**: `008-fix-model-selection-stats`  
**Created**: 2026-08-19  

---

## 1. Hiện Trạng & Phân Tích Nguyên Nhân

### 1.1. Hiện Trạng Quản Lý State
- `selectedModel` được lưu trữ tại `localStorage` với key `gemini_selected_model`, quản lý qua hook `src/hooks/useAIConfig.ts` và context `src/context/AIConfigContext.tsx`.
- `ApiSettings.tsx` nhận `selectedModel` và `onSaveModel` qua props từ `App.tsx`.
- `QuotaPanel.tsx` nhận `selectedModel` làm prop chỉ để hiển thị, nhưng lưu trữ `inspectResults` (`Record<number, ModelInfoItem[]>`) và `snapshotKeys` (`KeyQuotaFullSnapshot[]`) trong `useState` nội bộ.

### 1.2. Các Vấn Đề Phát Sinh Khi Sử Dụng
1. **Mất dữ liệu quan sát khi chuyển tab**:
   - Khi chuyển đổi giữa tab `Cấu hình AI` (`activeTab === 'config'`) và `Quota & Hạn mức` (`activeTab === 'quota'`), `QuotaPanel` bị unmount. Toàn bộ `inspectResults` (kết quả bấm "Kiểm tra Model") bị xóa sạch, bắt buộc người dùng phải bấm kiểm tra lại từ đầu.
2. **Thiếu thông tin thống kê cho Model đang chọn trong tab Cấu hình AI**:
   - Trong tab `Cấu hình AI`, dropdown chỉ có danh sách model tĩnh từ `AVAILABLE_MODELS`, không có thông tin tóm tắt: Model này đã gửi bao nhiêu request? RPM hiện tại bao nhiêu? Có bao nhiêu key hỗ trợ?
3. **Thiếu vùng tổng quan cho Model đang chọn trong tab Quota**:
   - Tab `Quota & Hạn mức` chỉ hiển thị danh sách từng key và thông số chung của key. Thống kê theo model bị giấu bên trong accordion `byModel` của từng key, không có một Banner Tổng Quan ở đầu tab để người dùng nhìn nhanh hiệu năng của model đang chọn.
4. **Hiển thị thông tin kiểm tra trên từng key**:
   - Từng thẻ key cần làm nổi bật rõ: Key này hỗ trợ những model nào (từ `inspectResults`), và riêng với Model Đang Sử Dụng thì key này đã thực hiện bao nhiêu request / lỗi.
5. **Cảnh báo model không khả dụng**:
   - Nếu sau khi kiểm tra, model đang chọn không được bất kỳ key nào hỗ trợ (`availableKeyCount === 0`), cần hiển thị cảnh báo trực quan nhưng KHÔNG tự ý đổi `selectedModel` ngầm.

---

## 2. Giải Pháp Kỹ Thuật (Architecture & State Integration)

### 2.1. Phân Tách Tuyệt Đối 2 Loại State
- **Configuration State**:
  - `selectedModel: string` (Model thực sự dùng để dịch).
  - Chỉ thay đổi khi người dùng chủ động chọn trong `<select>` và gọi `onSaveModel(newModel)`.
  - Không bao giờ bị biến đổi hay reset bởi bất kỳ hành động kiểm tra nào.
- **Observability State**:
  - `snapshotKeys: KeyQuotaFullSnapshot[]`: Dữ liệu hạn ngạch & thống kê request thời gian thực từ `fetchQuotaStatus`.
  - `inspectResults: Record<number, ModelInfoItem[]>`: Kết quả tra cứu model thực tế của từng key từ `fetchModelsForKey`.
  - `inspectLoading: number | null`: Trạng thái đang kiểm tra của riêng key có chỉ mục `keyIndex`.
  - `inspectErrors: Record<number, string>`: Lỗi phát sinh khi kiểm tra từng key.

### 2.2. Nâng Observability State Lên Cấp Độ `ApiSettings.tsx`
- Bằng cách duy trì `snapshotKeys` và `inspectResults` ở cấp độ modal `ApiSettings.tsx` (hoặc thông qua một custom hook gọn gàng `useModelQuotaRegistry`), cả 2 tab `Cấu hình AI` và `Quota & Hạn mức` đều dùng chung một nguồn dữ liệu quan sát trực tiếp.
- Chuyển qua lại giữa 2 tab không làm mất dữ liệu đã kiểm tra.

### 2.3. Model Registry Helper Logic
Tạo module helper `src/utils/modelRegistry.ts` (pure functions) để tính toán số liệu thống kê:
```typescript
export interface ModelStatsSummary {
  modelId: string;
  displayName: string;
  totalRequests: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  totalKeys: number;
  checkedKeyCount: number;
  availableKeyCount: number;
  supportingKeyIndices: number[];
  hasChecked: boolean;
  isUnavailable: boolean; // hasChecked && availableKeyCount === 0
}
```
- Chuẩn hóa so khớp model ID (loại bỏ hoặc bổ sung tiền tố `models/` linh hoạt để so khớp chính xác).
- Tổng hợp từ `KeyQuotaFullSnapshot.byModel` của tất cả các key.

---

## 3. Visual Design ("Mực & Chu Sa") Compliance

- **Tab "Cấu hình AI"**:
  - Khối tóm tắt Model Đang Chọn đặt ngay bên dưới dropdown:
    - Viền `border-parchment-2`, nền `bg-ink`, chữ `text-text-main`.
    - Số liệu dùng `font-mono`, nhãn dùng `font-bold text-xs`.
    - Điểm nhấn dùng `text-polish` / `Badge tone="polish"` hoặc `Badge tone="warning"`.
- **Tab "Quota & Hạn mức"**:
  - Banner Tổng Quan Model Đang Sử Dụng ở đầu tab:
    - Icon `Cpu` / `Seal` "Mô hình".
    - 4 ô chỉ số thống kê: RPM hiện tại, Request hôm nay, Tổng request, Lỗi phát sinh (dùng `font-mono font-bold`).
    - Số lượng key khả dụng (`X / Y key khả dụng`).
- **Thẻ Key trong Quota**:
  - Giữ nguyên cấu trúc card hiện có, bổ sung dòng thông tin `Model đang dùng: [Model Name] - [N] request` và danh sách model khả dụng sau khi kiểm tra.
  - Nút "Kiểm tra Model" / "Kiểm tra lại" hoạt động độc lập, hiển thị spinner chỉ tại thẻ key đó.
- Không thêm bất kỳ icon/emoji lạ, không thêm gradient, không phá vỡ thang bo góc `rounded-[2px]`/`rounded-md`.

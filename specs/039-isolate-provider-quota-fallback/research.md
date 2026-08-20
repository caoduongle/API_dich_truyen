# Phase 0 Research: Phân Tách ProviderQuota Khỏi Fallback / Scheduling Hint

**Feature**: `039-isolate-provider-quota-fallback`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Nghiên Cứu Hiện Trạng & Vấn Đề Ngữ Nghĩa (Data Semantics Analysis)

### Vấn Đề Hiện Tại
- Trong `shared/models.ts` và `server/services/quotaService.ts`, khi một `QuotaGroup` được tạo tự động qua `ensureKeyGroup` hoặc `registerQuotaGroup`, đối tượng `providerQuota` được gán cứng các giá trị mặc định:
  ```typescript
  // CŨ (Sai ngữ nghĩa):
  providerQuota: {
    rpm: 15,
    tpm: 1000000,
    rpd: 1500,
    isVerified: false,
  }
  ```
- **Hệ quả tiêu cực**:
  1. Gây ngộ nhận rằng Google đã cấp 15 RPM / 1M TPM / 1500 RPD cho group/key này, trong khi thực tế hệ thống chưa từng nhận diện hay xác thực thông tin từ Google AI Studio.
  2. Không phân biệt được giữa: "Hạn mức nhà cung cấp đã biết" (Verified Provider Quota), "Cấu hình người dùng" (Configured Limits), và "Nhịp độ an toàn dự phòng" (Model Fallback / Safe Pacing).
  3. Khi một API route hay component đọc `group.providerQuota.rpm`, code ngầm hiểu đó là quota chính thức từ Google.

### Quyết Định Kiến Trúc Mới
1. **`ProviderQuota` Thuần Khiết**:
   - `providerQuota` chỉ được khởi tạo khi có kết quả xác minh từ API Google hoặc siêu dữ liệu đã kiểm định.
   - Khi chưa có dữ liệu: `providerQuota = undefined`.
   - Cấu trúc:
     ```typescript
     export interface ProviderQuota {
       rpm?: number;
       tpm?: number;
       rpd?: number;
       verifiedAt?: number;
       source?: "provider";
     }
     ```
2. **`SchedulingHint` Độc Lập Mang Nguồn Gốc Rõ Ràng**:
   - Tách riêng `SchedulingHint` để phục vụ Admission Control và Pacing Dispatcher.
   - Cấu trúc:
     ```typescript
     export type SchedulingHintSource =
       | "provider"
       | "configured"
       | "model-fallback"
       | "safe-default";

     export interface SchedulingHint {
       effectiveIntervalMs: number;
       safetyFloorMs: number;
       isCustom: boolean;
       estimatedThroughputRpm: number;
       source: SchedulingHintSource;
       pacingIntervalMs?: number;
     }
     ```
3. **Thứ Tự Ưu Tiên Tính Toán SchedulingHint**:
   $$\text{Configured} \ (1) \longrightarrow \text{Provider} \ (2) \longrightarrow \text{Model-Fallback} \ (3) \longrightarrow \text{Safe-Default} \ (4)$$

---

## 2. Rà Soát Tác Vụ Tương Thích Ngược & Các Thành Phần Ảnh Hưởng

| Module / File | Ảnh Hưởng | Giải Pháp Xử Lý |
|---|---|---|
| `shared/models.ts` | `ProviderQuota`, `QuotaGroup`, `SchedulingHint` | Cập nhật `ProviderQuota` (optional, `source?: "provider"`, `verifiedAt?: number`), `QuotaGroup.providerQuota?: ProviderQuota`, `SchedulingHint.source`. |
| `server/services/quotaService.ts` | `registerQuotaGroup`, `ensureKeyGroup`, `evaluateQuotaGroups`, `updateProviderQuota` | Khởi tạo `providerQuota = undefined` khi chưa verify; hàm tính `deriveSchedulingHint(...)` gán đúng `source`; `evaluateQuotaGroups` dùng fallback hợp lệ khi `providerQuota === undefined`. |
| `server/services/geminiService.ts` | Khởi tạo nhóm & Pacing loop | Giữ nguyên logic gọi `quotaService.ensureKeyGroup(...)` với `providerQuota = undefined`. |
| `src/utils/apiClient.ts` | DTO `QuotaGroupDisplayItem` | Cho phép `providerQuota?: ...`, thêm trường `source` vào `schedulingHint`. |
| `src/components/QuotaPanel.tsx` | Hiển thị thông tin nhóm hạn mức | Kiểm tra `group.providerQuota?.source === 'provider'`: Nếu có $\to$ "Hạn mức Google (Đã xác minh)"; nếu không $\to$ "Nhịp độ an toàn dự phòng (Chưa xác minh)". |
| `server/services/__tests__/quotaGroup.test.ts` | Unit tests | Thêm 5 bài test bắt buộc: `provider quota known`, `provider quota unknown`, `configured hint`, `fallback hint`, `verified quota update`. |

---

## 3. Đánh Giá Alternatives & Quyết Định Chọn

- **Phương án A (Giữ boolean `isVerified: false` trong `ProviderQuota`)**:
  - *Đánh giá*: Vẫn giữ đối tượng `providerQuota` với số giả 15 RPM. Dẫn đến code vẫn truy cập `providerQuota.rpm` và nhầm tưởng đó là quota.
  - *Kết luận*: **BÁC BỎ** (Vi phạm yêu cầu semantics của TASK 02).
- **Phương án B (`providerQuota = undefined` khi chưa biết + `SchedulingHint` mang `source`)**:
  - *Đánh giá*: Tuyệt đối minh bạch, phân định rõ ràng giữa Hạn ngạch nhà cung cấp và Nhịp độ an toàn nội bộ, đúng 100% yêu cầu người dùng.
  - *Kết luận*: **CHỌN**.

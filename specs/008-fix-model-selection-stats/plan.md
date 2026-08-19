# Implementation Plan: Sửa Chọn Model & Hiển Thị Thống Kê Request Theo Model

**Feature**: `008-fix-model-selection-stats`  
**Spec**: [specs/008-fix-model-selection-stats/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/spec.md)  
**Research**: [specs/008-fix-model-selection-stats/research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/research.md)  
**Data Model**: [specs/008-fix-model-selection-stats/data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/data-model.md)  
**Contract**: [specs/008-fix-model-selection-stats/contracts/model-selection-stats.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/contracts/model-selection-stats.contract.md)  

---

## 1. Executive Summary

Kế hoạch này tập trung giải quyết dứt điểm các vấn đề liên quan đến việc chọn model và hiển thị thống kê quota theo model:
1. **Tách biệt hoàn toàn Configuration State và Observability State**:
   - `selectedModel` chỉ thay đổi khi người dùng chọn trong dropdown; các thao tác kiểm tra key không bao giờ can thiệp vào `selectedModel`.
   - Nâng Observability State (`snapshotKeys`, `inspectResults`) lên cấp độ `ApiSettings.tsx` (qua hook dùng chung) để bảo toàn dữ liệu khi người dùng chuyển đổi tab.
2. **Model Registry & Thống Kê Request Theo Model**:
   - Viết pure helper `src/utils/modelRegistry.ts` để tổng hợp số liệu từ `KeyQuotaFullSnapshot.byModel` và `inspectResults`.
   - Thêm khối Model Summary thu nhỏ cho model đang chọn trong Tab "Cấu hình AI".
   - Thêm Banner Tổng Quan Model Đang Sử Dụng ở đầu Tab "Quota & Hạn mức".
   - Bổ sung thông tin Model đang dùng và Model khả dụng trên từng thẻ Key.
   - Cảnh báo trực quan khi model không có key khả dụng mà không tự ý đổi model.

---

## 2. User Review Required

> [!NOTE]
> - Backend hiện đã cung cấp đầy đủ `byModel` trong `fetchQuotaStatus` (`/api/quota-status`) và danh sách model trong `fetchModelsForKey` (`/api/models-for-key`). Không cần sửa đổi backend logic hay schema dữ liệu.
> - Toàn bộ thay đổi nằm trong phạm vi UI & state integration của frontend (`src/components/`, `src/utils/`, `src/hooks/`).

---

## 3. Proposed Changes

### Component 1: Model Registry Helper & Pure Utils

#### [NEW] [modelRegistry.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/modelRegistry.ts)
- Định nghĩa hàm `normalizeModelId(id: string): string`.
- Định nghĩa hàm `computeModelStatsSummary(selectedModelId, snapshotKeys, inspectResults, cleanKeys): ModelStatsSummary`.
- Định nghĩa hàm `getKeyModelDetail(keyIndex, keySnapshot, inspectData, selectedModelId): KeyModelDetail`.

#### [NEW] [modelRegistry.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/__tests__/modelRegistry.test.ts)
- Unit tests kiểm tra tính chính xác của việc tính tổng request, RPM, RPD, lỗi, số key khả dụng, chuẩn hóa tiền tố `models/`, và trạng thái `isUnavailable`.

---

### Component 2: Quota & Observability Hook

#### [NEW] [useModelObservability.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useModelObservability.ts)
- Quản lý `snapshotKeys`, `loadingQuota`, `quotaError`, `inspectResults`, `inspectLoadingKeyIndex`, `inspectErrors`.
- Chịu trách nhiệm gọi `fetchQuotaStatus` và `fetchModelsForKey(keyIndex)`.
- Duy trì cache kiểm tra model trong suốt phiên mở modal mà không bị reset khi chuyển tab.

#### [NEW] [useModelObservability.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/__tests__/useModelObservability.test.ts)
- Unit test xác nhận: kiểm tra 1 key không ảnh hưởng key khác, không thay đổi `selectedModel`, loading độc lập theo `keyIndex`.

---

### Component 3: Tab "Cấu hình AI" Enhancement

#### [MODIFY] [ApiSettings.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/ApiSettings.tsx)
- Nhúng `useModelObservability(cleanKeys)`.
- Thêm khối Model Summary thu nhỏ bên dưới dropdown chọn model:
  - Tên model + số key hỗ trợ (ví dụ: `X/Y API key hỗ trợ` hoặc `Chưa kiểm tra`).
  - Thống kê request: Tổng request, RPM hiện tại, Lỗi phát sinh.
  - Cảnh báo nếu model không có key nào hỗ trợ (`isUnavailable`).
- Truyền `observabilityState` xuống `QuotaPanel`.

---

### Component 4: Tab "Quota & Hạn mức" Enhancement

#### [MODIFY] [QuotaPanel.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/QuotaPanel.tsx)
- Sử dụng `observabilityState` truyền từ `ApiSettings.tsx` (hoặc fallback nội bộ nếu dùng độc lập).
- Thêm Banner Tổng Quan Model Đang Sử Dụng ở đầu trang:
  - Hiển thị tên Model, số key khả dụng.
  - 4 ô chỉ số: RPM hiện tại, Request hôm nay, Tổng request, Lỗi phát sinh.
- Trong từng thẻ Key:
  - Hiển thị dòng thông tin `Model đang dùng: [Model Name] - [N] request`.
  - Hiển thị danh sách model khả dụng sau khi kiểm tra, highlight model đang dùng.
  - Nút "Kiểm tra Model" / "Kiểm tra lại" độc lập trên từng key với spinner riêng biệt.

---

## 4. Verification Plan

### Automated Tests
1. `npm run lint` (`tsc --noEmit`) - Kiểm tra type safety sạch 100%.
2. `npm test` (`vitest run`) - Chạy toàn bộ test suites hiện có và các test mới cho `modelRegistry` và `useModelObservability`.
3. `npm run build` - Xác nhận production build sạch sẽ.

### Manual / Browser Verification
- Thực hiện toàn bộ 14 bước trong kịch bản kiểm thử của [quickstart.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/008-fix-model-selection-stats/quickstart.md).

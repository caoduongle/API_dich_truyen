# Data Model: Model Registry & Observability State

**Feature**: `008-fix-model-selection-stats`  
**Created**: 2026-08-19  

---

## 1. Model Registry Data Structures (`src/utils/modelRegistry.ts`)

```typescript
export interface ModelStatsSummary {
  /** Mã định danh model (ví dụ: 'gemini-3.1-flash-lite') */
  modelId: string;
  /** Tên hiển thị đầy đủ của model */
  displayName: string;
  /** Tổng số request đã gửi lũy kế trong phiên */
  totalRequests: number;
  /** Số request đã gửi trong ngày hiện tại (múi giờ Los Angeles PST) */
  requestsToday: number;
  /** Số request đã gửi trong phút hiện tại (RPM) */
  requestsThisMinute: number;
  /** Tổng số lỗi ghi nhận khi gọi model này */
  errorsTotal: number;
  /** Tổng số key cấu hình hợp lệ */
  totalKeys: number;
  /** Số lượng key đã thực hiện kiểm tra model */
  checkedKeyCount: number;
  /** Số lượng key được xác nhận hỗ trợ model này */
  availableKeyCount: number;
  /** Danh sách chỉ mục các key hỗ trợ model này */
  supportingKeyIndices: number[];
  /** Đã có ít nhất 1 key được kiểm tra model hay chưa */
  hasChecked: boolean;
  /** Model không được bất kỳ key nào hỗ trợ trong số các key đã kiểm tra */
  isUnavailable: boolean;
}
```

---

## 2. Key-Level Model Support Info

```typescript
export interface KeyModelDetail {
  /** Chỉ mục của key trong danh sách apiKeys */
  keyIndex: number;
  /** Mã che giấu của key (ví dụ: 'AIzaSy...4xQ') */
  maskedKey: string;
  /** Key này có hỗ trợ model đang chọn hay không (true / false / 'uninspected') */
  supportsSelectedModel: boolean | 'uninspected';
  /** Thống kê request của key này dành riêng cho model đang chọn */
  selectedModelUsage?: {
    requestsTotal: number;
    requestsToday: number;
    requestsThisMinute: number;
    errorsTotal: number;
  };
  /** Danh sách toàn bộ model mà key này có quyền truy cập (từ inspectResults) */
  availableModels: string[];
}
```

---

## 3. Observability State Container (`ApiSettings` / Hook)

```typescript
export interface ModelObservabilityState {
  /** Dữ liệu snapshot hạn ngạch từ /api/quota-status */
  snapshotKeys: KeyQuotaFullSnapshot[];
  /** Trạng thái đang tải snapshot hạn ngạch */
  loadingQuota: boolean;
  /** Lỗi tải snapshot hạn ngạch nếu có */
  quotaError: string | null;
  /** Kết quả tra cứu model theo key index từ /api/models-for-key */
  inspectResults: Record<number, ModelInfoItem[]>;
  /** Chỉ mục key đang thực hiện tra cứu model (null nếu không có) */
  inspectLoadingKeyIndex: number | null;
  /** Lỗi tra cứu model theo từng key index */
  inspectErrors: Record<number, string>;
  /** Hàm tải/làm mới snapshot hạn ngạch */
  refreshQuota: () => Promise<void>;
  /** Hàm kiểm tra danh sách model cho một key cụ thể */
  inspectKeyModels: (keyIndex: number) => Promise<void>;
}
```

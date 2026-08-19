# Interface Contract: Model Selection & Observability Integration

**Feature**: `008-fix-model-selection-stats`  
**Created**: 2026-08-19  

---

## 1. State Invariants & Separation Contract

### Contract Rules:
1. **Configuration Immutability During Observation**:
   - Việc gọi hàm `fetchModelsForKey(keyIndex)` hoặc `fetchQuotaStatus()` TUYỆT ĐỐI KHÔNG làm thay đổi giá trị `selectedModel`.
   - `selectedModel` CHỈ ĐƯỢC PHÉP thay đổi khi hàm `onSaveModel(newModel)` được gọi tường minh từ sự kiện `onChange` của phần tử `<select>` chọn model.
2. **Key Isolation**:
   - Khi `inspectKeyModels(keyIndex)` chạy cho `keyIndex = N`, chỉ có `inspectLoadingKeyIndex = N` hiển thị trạng thái đang nạp.
   - Các key khác `keyIndex !== N` giữ nguyên dữ liệu và trạng thái tương tác.
   - Kết quả trả về cập nhật vào `inspectResults[N]`, không xóa hay ghi đè `inspectResults[M]` của key khác.
3. **Model ID Normalization**:
   - Khi so sánh giữa model ID người dùng chọn (ví dụ: `gemini-2.5-flash`) và model ID trả về từ API Google (ví dụ: `models/gemini-2.5-flash`), hệ thống chuẩn hóa bằng cách loại bỏ tiền tố `models/` trước khi so sánh tương đương chuỗi:
     ```typescript
     function normalizeModelId(id: string): string {
       return id ? id.replace(/^models\//, '').trim().toLowerCase() : '';
     }
     ```

---

## 2. Component Props Interface Contracts

### `QuotaPanelProps`
```typescript
interface QuotaPanelProps {
  apiKeys: string[];
  selectedModel: string;
  onSwitchToConfigTab?: () => void;
  observabilityState?: ModelObservabilityState; // Optional for shared state or internal fallback
}
```

### `ModelSummaryCardProps` (Tab "Cấu hình AI")
```typescript
interface ModelSummaryCardProps {
  summary: ModelStatsSummary;
  onCheckModelsClick?: () => void;
}
```

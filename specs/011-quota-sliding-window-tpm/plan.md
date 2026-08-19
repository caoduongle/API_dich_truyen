# Implementation Plan: Đo Lường Hạn Ngạch Thời Gian Thực: RPM, TPM & RPD (Sliding Window Token & Request Quota Observability)

**Feature**: `011-quota-sliding-window-tpm`  
**Spec**: [specs/011-quota-sliding-window-tpm/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/011-quota-sliding-window-tpm/spec.md)  
**Research**: [specs/011-quota-sliding-window-tpm/research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/011-quota-sliding-window-tpm/research.md)  
**Data Model**: [specs/011-quota-sliding-window-tpm/data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/011-quota-sliding-window-tpm/data-model.md)  
**Contract**: [specs/011-quota-sliding-window-tpm/contracts/quota-sliding-window.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/011-quota-sliding-window-tpm/contracts/quota-sliding-window.contract.md)  

---

## 1. Executive Summary

Nâng cấp toàn bộ hệ thống đo lường Quota và Rate Limits từ Fixed Window sang Sliding Window Log 60s, bổ sung số liệu Token tiêu thụ (TPM, TPD, Total Tokens):
1. **Backend Service (`quotaService.ts`)**: Thay thế biến đếm phút cố định bằng `recentCalls: Array<{ timestamp, tokens }>` cửa sổ trượt 60 giây, bổ sung `tokensTotal`, `tokensTodayCount`, `tokensTodayDateKey`.
2. **SDK Integration (`geminiService.ts`)**: Trích xuất `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`) từ SDK response và truyền vào `quotaService.recordAttempt`.
3. **API & Client Models (`quotaController.ts`, `apiClient.ts`, `modelRegistry.ts`)**: Đồng bộ các trường token trong các types và helper tổng hợp thống kê model.
4. **UI Progress Gauges & Custom TPM Limit (`QuotaPanel.tsx`)**: Bổ sung cấu hình `maxTpm`, hiển thị chỉ số TPM và thanh tiến độ phần trăm RPM, TPM, RPD.

---

## 2. User Review Required

> [!IMPORTANT]
> - `requestsThisMinute` và `tokensThisMinute` sẽ đo chính xác lưu lượng trong 60 giây trượt gần nhất (`now - 60000`) thay vì reset cứng theo đầu phút đồng hồ hệ thống.
> - Các số liệu `requestsTotal`, `requestsToday`, `errorsTotal` giữ nguyên cơ chế hoạt động và tương thích 100%.

---

## 3. Proposed Changes

### Component 1: Server Quota & Gemini Services

#### [MODIFY] [server/services/quotaService.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/services/quotaService.ts)
- Cập nhật `KeyUsageRecord` & `ModelUsageRecord` với `recentCalls: Array<{ timestamp: number; tokens: number }>`.
- Thêm trường token: `tokensTotal`, `tokensTodayCount`, `tokensTodayDateKey`.
- Cập nhật `recordAttempt(key, success, model, errorType, tokenStats)`:
  - Thêm entry vào `recentCalls`.
  - Tự động lọc các entry cũ hơn 60s.
  - Cập nhật `tokensTotal`, `tokensTodayCount` (với PST date check).
- Cập nhật `getSnapshot()` tính `requestsThisMinute` và `tokensThisMinute` từ `recentCalls`.

#### [MODIFY] [server/services/geminiService.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/services/geminiService.ts)
- Trong `generateWithRotation`: Trích xuất `response.usageMetadata` và truyền `tokenStats` vào `quotaService.recordAttempt`.

#### [MODIFY] [server/services/__tests__/quotaService.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/services/__tests__/quotaService.test.ts)
- Bổ sung test suites kiểm tra Sliding Window 60s, TPM calculation, PST rollover và pruning memory.

---

### Component 2: Frontend Data Models & Utilities

#### [MODIFY] [src/utils/apiClient.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/apiClient.ts)
- Cập nhật `ModelUsageStats` và `KeyQuotaFullSnapshot` bổ sung `tokensTotal`, `tokensToday`, `tokensThisMinute`.

#### [MODIFY] [src/utils/modelRegistry.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/modelRegistry.ts)
- Mở rộng `ModelStatsSummary` với `totalTokens`, `tokensToday`, `tokensThisMinute`.
- Cập nhật `computeModelStatsSummary` và `getKeyModelStats` để tổng hợp token metrics.
- Thêm hàm `formatTokenCount(count: number): string` (`1.2k`, `350k`, `1.5M`).

#### [MODIFY] [src/utils/__tests__/modelRegistry.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/__tests__/modelRegistry.test.ts)
- Bổ sung unit test cho token stats aggregation và `formatTokenCount`.

---

### Component 3: UI Quota Gauges & Custom Limits

#### [MODIFY] [src/components/QuotaPanel.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/QuotaPanel.tsx)
- Cập nhật `CustomLimit` thêm `maxTpm: number` (mặc định 1.000.000).
- Thêm input Giới hạn TPM trong `CustomLimitsPanel`.
- Bổ sung hiển thị TPM trong Tile Metrics tổng quan trên cùng và trong `KeyCardItem`.
- Thêm thanh tiến độ phần trăm TPM (`tokensThisMinute / limit.maxTpm`).

---

## 4. Verification Plan

### Automated Tests
1. `npm run lint` (`tsc --noEmit`) - Kiểm tra type safety.
2. `npm test` (`vitest run`) - Chạy toàn bộ test suites.
3. `npm run build` - Kiểm tra build Vite và esbuild.

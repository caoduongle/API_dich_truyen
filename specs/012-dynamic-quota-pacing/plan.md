# Implementation Plan: Điều Phối Nhịp Độ Gọi API Động Dựa Trên Quota Cá Nhân (Dynamic Quota-Driven Pacing & Rate Limiting)

**Feature**: `012-dynamic-quota-pacing`  
**Spec**: [specs/012-dynamic-quota-pacing/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/012-dynamic-quota-pacing/spec.md)  
**Research**: [specs/012-dynamic-quota-pacing/research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/012-dynamic-quota-pacing/research.md)  
**Data Model**: [specs/012-dynamic-quota-pacing/data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/012-dynamic-quota-pacing/data-model.md)  
**Contract**: [specs/012-dynamic-quota-pacing/contracts/dynamic-pacing.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/012-dynamic-quota-pacing/contracts/dynamic-pacing.contract.md)  

---

## 1. Executive Summary

Triển khai cơ chế điều phối nhịp độ gọi API động thích ứng (Adaptive Pacing) thay thế cho hằng số 13 RPM / 4500ms tĩnh:
1. **Pacing Utilities (`modelRegistry.ts`)**: Viết `getDynamicPacingInterval`, `isTpmNearLimit`, `formatPacingSummary`.
2. **Backend Header Support (`server/routes/api.ts`, `server/services/geminiService.ts`)**: Tiếp nhận header `x-custom-rpm` và tính toán `keyMinInterval = customRpm > 0 ? Math.max(400, Math.ceil(60000 / (customRpm * 0.9))) : 4500`.
3. **Queue & Pipeline Pacing (`useAutoTranslationQueue.ts`, `useTranslationProcess.ts`)**: Áp dụng khoảng trễ động và kích hoạt cơ chế bảo vệ TPM khi `tokensThisMinute >= 85%`.
4. **UI Observability (`ApiSettings.tsx`, `QuotaPanel.tsx`)**: Hiển thị trực quan tốc độ điều phối và tự động cập nhật ngay khi người dùng chỉnh sửa RPM/TPM.

---

## 2. User Review Required

> [!IMPORTANT]
> - Giới hạn sàn an toàn: Khoảng cách giữa 2 request tối thiểu là 400ms trên server và 500ms trên client để bảo vệ kết nối socket.
> - Khi không có cấu hình tùy chỉnh, hệ thống tự động fallback về mức an toàn theo tier model (Flash ~ 4500ms, Pro ~ 6000ms).

---

## 3. Proposed Changes

### Component 1: Utilities & Client API

#### [MODIFY] [src/utils/modelRegistry.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/modelRegistry.ts)
- Bổ sung `getDynamicPacingInterval(customRpm?: number, modelId?: string): number`.
- Bổ sung `isTpmNearLimit(currentTpm: number, maxTpm?: number): boolean`.
- Bổ sung `formatPacingSummary(customRpm?: number, modelId?: string): PacingConfig`.

#### [MODIFY] [src/utils/apiClient.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/apiClient.ts)
- Truyền header `x-custom-rpm` trong `translateRaw`, `polishTranslation`, `qaCritique`, `translateSegmentStream`.

---

### Component 2: Server Backend

#### [MODIFY] [server/routes/api.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/routes/api.ts)
- Đọc `x-custom-rpm` từ header / body và truyền vào `geminiService`.

#### [MODIFY] [server/services/geminiService.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/server/services/geminiService.ts)
- Thay đổi `MIN_REQUEST_INTERVAL_PER_KEY_MS` tĩnh sang tính toán động dựa trên `customRpm`.

---

### Component 3: Auto Translation Queue & Process

#### [MODIFY] [src/hooks/useAutoTranslationQueue.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useAutoTranslationQueue.ts)
- Sử dụng dynamic interval thay vì delay cố định.
- Thêm kiểm tra `isTpmNearLimit` trước khi dịch batch, tạm hoãn và hiển thị trạng thái giãn nhịp.

---

### Component 4: UI Pacing Display

#### [MODIFY] [src/components/ApiSettings.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/ApiSettings.tsx)
- Hiển thị thông số nhịp độ điều phối trong `ModelSummaryCard`.

#### [MODIFY] [src/components/QuotaPanel.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/QuotaPanel.tsx)
- Hiển thị badge nhịp độ điều phối động trong Banner và `CustomLimitsPanel`.

---

## 4. Verification Plan

### Automated Tests
1. `npm run lint` (`tsc --noEmit`) - Kiểm tra type safety.
2. `npm test` (`vitest run`) - Chạy toàn bộ test suites.
3. `npm run build` - Kiểm tra build Vite và esbuild.

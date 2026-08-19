# Implementation Plan: Tối Ưu Hóa Hiệu Năng Màn Hình Quota & Hạn Mức (Quota Panel Performance Optimization)

**Feature**: `010-quota-panel-optimization`  
**Spec**: [specs/010-quota-panel-optimization/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/010-quota-panel-optimization/spec.md)  
**Research**: [specs/010-quota-panel-optimization/research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/010-quota-panel-optimization/research.md)  
**Data Model**: [specs/010-quota-panel-optimization/data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/010-quota-panel-optimization/data-model.md)  
**Contract**: [specs/010-quota-panel-optimization/contracts/quota-optimization.contract.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/010-quota-panel-optimization/contracts/quota-optimization.contract.md)  

---

## 1. Executive Summary

Triển khai tối ưu hóa toàn diện hiệu năng hiển thị và thời gian đáp ứng cho màn hình "Quota & Hạn mức" trong `ApiSettings.tsx`:
1. **Loại bỏ Global 1s Timer trong `useModelObservability.ts`**: Thay thế cơ chế đếm lùi toàn cục bằng component lá `CountdownBadge` tự quản lý timer nội bộ, triệt tiêu 100% việc re-render toàn bộ `QuotaPanel` và `ApiSettings` mỗi giây.
2. **Ngăn chặn Cascading Re-render trong `useAIConfig.ts`**: Thêm so khớp ID mảng trước khi `setDiscoveredModels`, giữ nguyên state reference (`return prev`) khi không có model mới.
3. **Bóc tách và Memoize `KeyCardItem`**: Tách thẻ API key thành component con độc lập bọc `React.memo`.
4. **Bộ Đệm Cache 30s TTL cho `loadQuotaStatus`**: Tối ưu hóa việc chuyển đổi tab, tránh gửi request HTTP dư thừa và loại bỏ hiện tượng flash loading spinner khi chuyển tab qua lại.

---

## 2. User Review Required

> [!IMPORTANT]
> - Các tính năng đếm lùi thời gian ngắt mạch (Circuit Breaker) và hoãn (Rate Limited) vẫn hoạt động chính xác từng giây trên giao diện, nhưng được cô lập hoàn toàn trong `CountdownBadge`.
> - Không có thay đổi nào làm phá vỡ logic tính toán thống kê hay định dạng hiển thị Design System "Mực & Chu Sa".

---

## 3. Proposed Changes

### Component 1: State & Observability Hook Optimization

#### [MODIFY] [src/hooks/useModelObservability.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useModelObservability.ts)
- Xóa bỏ `useEffect` chạy `setInterval` 1000ms đếm lùi `setSnapshotKeys`.
- Thêm bộ đệm cache 30 giây TTL (`quotaCache`) cho `loadQuotaStatus(forceRefresh = false)`.

#### [MODIFY] [src/hooks/useAIConfig.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useAIConfig.ts)
- Trong `handleRegisterDiscoveredModels`: Kiểm tra mảng `updated` với `prev`. Nếu danh sách ID không đổi, `return prev` để giữ nguyên reference.

---

### Component 2: QuotaPanel Component Decomposition & Memoization

#### [MODIFY] [src/components/QuotaPanel.tsx](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/QuotaPanel.tsx)
- Tạo component con `CountdownBadge` được bọc `React.memo` để đếm lùi độc lập.
- Tách `KeyCardItem` thành component riêng biệt bọc `React.memo`.
- Tách và memoize `CustomLimits` bảng cấu hình hạn mức.
- Đảm bảo các callbacks truyền xuống (`onInspect`, `onClearInspect`, `onToggleExpand`, `onSelectModel`) được bọc `useCallback`.

---

### Component 3: Test Suites Verification

#### [MODIFY] [src/hooks/__tests__/useModelObservability.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/__tests__/useModelObservability.test.ts)
- Cập nhật test cases kiểm tra cache 30s và tính ổn định không bị re-render do timer.

#### [MODIFY] [src/components/__tests__/ApiSettingsModelFlow.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/__tests__/ApiSettingsModelFlow.test.ts)
- Xác nhận các kịch bản kiểm tra model và chọn model hoạt động ổn định và mượt mà.

---

## 4. Verification Plan

### Automated Tests
1. `npm run lint` (`tsc --noEmit`) - Kiểm tra type safety.
2. `npm test` (`vitest run`) - Chạy toàn bộ 34+ test files.
3. `npm run build` - Kiểm tra build Vite và esbuild.

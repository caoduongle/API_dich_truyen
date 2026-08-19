# Feature Specification: Tối Ưu Hóa Hiệu Năng Màn Hình Quota & Hạn Mức (Quota Panel Performance Optimization)

**Feature Branch**: `010-quota-panel-optimization`  
**Created**: 2026-08-19  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cách Ly Đồng Hồ Đếm Lùi & Loại Bỏ Re-render Toàn Cục (Priority: P1) 🎯 MVP

Là người dùng dịch truyện, tôi muốn khi mở modal "Cấu hình AI" và xem tab "Quota & Hạn mức", giao diện hoạt động mượt mà, phản hồi ngay tức thì với 60 FPS, không bị giật lag hay drop frame do đồng hồ đếm ngược ngắt mạch/hoãn rate limit.

**Why this priority**: Hiện tại timer 1 giây đếm lùi thời gian ngắt mạch (`blacklistRemainingMs`) đang kích hoạt cập nhật state ở cấp độ hook cha `useModelObservability`, ép toàn bộ `ApiSettings`, `computeModelStatsSummary`, và toàn bộ `QuotaPanel` re-render liên tục mỗi giây dù các thông số request/quota khác không hề thay đổi.

**Independent Test**:
1. Mở modal "Cấu hình AI & Bản Thảo" sang tab "Quota & Hạn mức".
2. Khi có key ở trạng thái ngắt mạch (Circuit Breaker) hoặc đang hoãn (Rate Limited), quan sát huy hiệu đếm lùi (ví dụ: `Ngắt mạch (29s)`).
3. Xác nhận số giây trên huy hiệu giảm dần mượt mà theo từng giây trong khi toàn bộ phần tử còn lại của thẻ key và bảng QuotaPanel không bị re-render thừa.

**Acceptance Scenarios**:
1. **Given** một hoặc nhiều key có `blacklistRemainingMs > 0` hoặc `nextAllowedRemainingMs > 0`, **When** đồng hồ đếm lùi nhảy từng giây, **Then** chỉ component lá `CountdownBadge` re-render, không kích hoạt re-render toàn bộ `QuotaPanel` hay `ApiSettings`.
2. **Given** không có key nào bị ngắt mạch, **When** tab Quota hiển thị, **Then** không có bất kỳ background timer vô ích nào chạy ở cấp độ container.

---

### User Story 2 - Ngăn Chặn Cascading Context Update Khi Khám Phá Model (Priority: P1) 🎯 MVP

Là người dùng, tôi muốn khi bấm "Kiểm tra Model" ở các key, hệ thống chỉ cập nhật state khi phát hiện ra model mới thực sự, tránh việc gán lại mảng model giống hệt gây cascading re-render lan truyền lên toàn bộ ứng dụng (`App.tsx`, `TranslatorWorkspace.tsx`, v.v.).

**Why this priority**: Hiện tại `registerDiscoveredModels` luôn gọi `setDiscoveredModels(updated)` với reference mảng mới mỗi khi kiểm tra key, khiến React Context kích hoạt re-render toàn bộ các component đang subscribe `AIConfigContext`.

**Independent Test**:
1. Bấm "Kiểm tra Model" ở Key #1 (đã lưu các model trước đó).
2. Kiểm tra log/profiler xác nhận `AIConfigContext` nhận biết danh sách model không thay đổi và giữ nguyên reference (`return prev`), không kích hoạt chuỗi re-render lan truyền.

**Acceptance Scenarios**:
1. **Given** `models.list` trả về danh sách model đã tồn tại trong registry, **When** hàm `registerDiscoveredModels` được gọi, **Then** state reference `discoveredModels` được giữ nguyên (`prev === next`), không kích hoạt context update.

---

### User Story 3 - Tối Ưu Thẻ Key & Bộ Đệm Cache 30s Khi Chuyển Tab (Priority: P2)

Là người dùng, tôi muốn việc nhập ngưỡng hạn mức cá nhân (RPM/RPD) diễn ra trơn tru không bị khựng chữ, và khi chuyển đổi qua lại giữa tab "Cấu hình AI" và "Quota & Hạn mức", dữ liệu hạn ngạch được tải từ bộ đệm cache 30 giây thay vì gửi lại request mạng liên tục.

**Why this priority**: Giúp tiết kiệm băng thông mạng, giảm tải cho máy chủ backend và mang lại trải nghiệm mượt mà, tức thì cho người dùng khi chuyển đổi tab.

**Independent Test**:
1. Mở tab Quota (dữ liệu tải về và lưu cache 30s).
2. Chuyển sang tab "Cấu hình AI" rồi chuyển lại tab "Quota & Hạn mức" trong vòng 30 giây -> dữ liệu hiển thị tức thì, không hiện spinner loading toàn trang.
3. Bấm nút "Làm mới" (Refresh) -> luôn cưỡng chế gọi lại API để lấy dữ liệu mới nhất bất kể cache.

**Acceptance Scenarios**:
1. **Given** dữ liệu Quota đã được nạp thành công cách đây < 30 giây, **When** người dùng chuyển tab, **Then** hệ thống tái sử dụng snapshot trong cache, không gọi lại `/api/quota-status`.
2. **Given** người dùng chủ động bấm nút "Làm mới", **When** bấm nút, **Then** hệ thống bỏ qua cache và nạp lại snapshot mới nhất từ máy chủ.

---

### Edge Cases

- **Hết thời gian đếm lùi (0s)**: `CountdownBadge` tự động chuyển trạng thái sang "Hoạt động" (`Badge tone="polish"`).
- **Nhập nhanh RPM/RPD liên tục**: Giá trị được lưu mượt mà không làm đơ giao diện.
- **Key rỗng hoặc chưa có key**: Hiển thị `EmptyState` nhanh gọn không chạy bất kỳ timer nào.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Xóa bỏ timer `setInterval` 1 giây ở cấp độ hook `useModelObservability`.
- **FR-002**: Tạo component `CountdownBadge` bọc `React.memo` tự quản lý interval 1 giây nội bộ dựa trên timestamp mục tiêu (`targetTimestamp = Date.now() + remainingMs`).
- **FR-003**: Tách thẻ hiển thị 1 API key thành `KeyCardItem` bọc `React.memo` với so sánh props nông (`shallow equal`).
- **FR-004**: Tối ưu hóa `registerDiscoveredModels` trong `useAIConfig.ts`: so sánh ID mảng trước khi `setDiscoveredModels`, giữ nguyên state reference cũ (`return prev`) nếu không có model mới.
- **FR-005**: Bổ sung cơ chế cache 30 giây TTL (Time-To-Live) cho `loadQuotaStatus()` trong `useModelObservability.ts`, cho phép tham số `forceRefresh: boolean` khi bấm nút "Làm mới".
- **FR-006**: Tối ưu bảng nhập hạn ngạch tùy chỉnh (`CustomLimits`) để việc gõ phím không re-render các thẻ key khác.

### Non-Functional Requirements & Guardrails

- **NFR-001 (Type Safety)**: `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type.
- **NFR-002 (Unit Tests Pass)**: `npm test` (`vitest run`) pass 100% tất cả test suites (bao gồm `ApiSettingsModelFlow.test.ts` và `quotaService.test.ts`).
- **NFR-003 (Build Clean)**: `npm run build` thành công.
- **NFR-004 (Design System Compliance)**: Giữ nguyên 100% phong cách thiết kế "Mực & Chu Sa".

---

## Success Criteria *(mandatory)*

1. **Zero Global Ticking Re-renders**: Khi có key bị ngắt mạch/hoãn rate limit, `QuotaPanel` và `ApiSettings` KHÔNG re-render mỗi giây; chỉ `CountdownBadge` tự cập nhật nội bộ.
2. **Zero Redundant Context Cascades**: Gọi `registerDiscoveredModels` với danh sách model không đổi không làm re-render các subscriber của `AIConfigContext`.
3. **Instant Tab Switching**: Chuyển đổi giữa 2 tab trong vòng 30 giây hiển thị ngay lập tức không có độ trễ mạng hay giật khung hình.
4. **All Quality Gates Passed**: `npm run lint`, `npm test`, `npm run build` đều pass sạch sẽ.

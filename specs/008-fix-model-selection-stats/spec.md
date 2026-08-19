# Feature Specification: Sửa Chọn Model & Hiển Thị Thống Kê Request Theo Model

**Feature Branch**: `008-fix-model-selection-stats`  
**Created**: 2026-08-19  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tách Biệt Hoàn Toàn Trạng Thái Cấu Hình & Kiểm Tra Model (Priority: P1) 🎯 MVP

Là người dùng dịch thuật, tôi muốn việc lựa chọn mô hình AI (Model) trong tab "Cấu hình AI" là một trạng thái cấu hình ổn định, độc lập tuyệt đối với hành động "Kiểm tra Model" trong tab "Quota & Hạn mức", để việc kiểm tra khả năng hỗ trợ model của từng API key không bao giờ tự động ghi đè hoặc làm thay đổi model tôi đã chọn.

**Why this priority**: Hiện tại, khi người dùng bấm "Kiểm tra Model" ở từng key, trạng thái quan sát (observability) và trạng thái cấu hình (configuration) chưa được tách bạch rõ ràng, dẫn đến nguy cơ model đang chọn bị thay đổi ngoài ý muốn hoặc dropdown chọn model bị gián đoạn.

**Independent Test**:
1. Mở modal "Cấu hình AI", chọn mô hình `Gemini 3.1 Flash Lite` (`gemini-3.1-flash-lite`).
2. Chuyển sang tab "Quota & Hạn mức", bấm nút "Kiểm tra Model" ở Key #1 và Key #2.
3. Xác nhận Key #1 và Key #2 tải và cập nhật danh sách model khả dụng độc lập, không làm ảnh hưởng trạng thái của key còn lại.
4. Chuyển lại tab "Cấu hình AI", xác nhận dropdown vẫn hiển thị `Gemini 3.1 Flash Lite`, không bị disabled, và người dùng có thể đổi sang model khác (`Gemini 2.5 Flash`) rồi lưu lại thành công.

**Acceptance Scenarios**:
1. **Given** người dùng đã chọn `selectedModel = gemini-3.1-flash-lite`, **When** người dùng bấm "Kiểm tra Model" ở bất kỳ key nào, **Then** `selectedModel` vẫn giữ nguyên giá trị `gemini-3.1-flash-lite`.
2. **Given** đang trong quá trình kiểm tra Key #2 (loading spinner hiển thị trên Key #2), **When** quan sát giao diện, **Then** Key #1 và Key #3 vẫn giữ nguyên trạng thái hiển thị và thao tác bình thường, không khóa toàn bộ panel.
3. **Given** người dùng đóng modal hoặc chuyển qua lại giữa 2 tab "Cấu hình AI" và "Quota & Hạn mức", **When** mở lại, **Then** kết quả kiểm tra model đã tra cứu và `selectedModel` không bị reset đột ngột.

---

### User Story 2 - Thống Kê Mức Sử Dụng Request Theo Model Đang Chọn (Priority: P1) 🎯 MVP

Là dịch giả/quản trị viên, tôi muốn xem thống kê chi tiết về mức độ sử dụng (Tổng số request, RPM hiện tại, RPD hôm nay, số lỗi phát sinh) và số lượng API key thực tế đang hỗ trợ cho **Model hiện tại đang chọn** ở cả 2 tab "Cấu hình AI" và "Quota & Hạn mức", để nắm bắt chính xác tải lượng và dung lượng của mô hình đang dùng.

**Why this priority**: Hiện tại hệ thống chỉ hiển thị thống kê gộp chung của từng key hoặc ẩn trong accordion chi tiết, khiến người dùng không biết model mình đang dịch đã tiêu tốn bao nhiêu request, tốc độ bao nhiêu, và có bao nhiêu key trong tổng số key sẵn sàng phục vụ model đó.

**Independent Test**:
1. Trong tab "Cấu hình AI", bên dưới dropdown chọn model, kiểm tra hiển thị khối tóm tắt Model Đang Chọn: hiển thị số key hỗ trợ (ví dụ: `X/Y API key hỗ trợ` hoặc `Chưa kiểm tra`), tổng request, RPM hiện tại, và tổng lỗi của model đó.
2. Trong tab "Quota & Hạn mức", kiểm tra khối Banner Tổng Quan ở đầu trang dành riêng cho Model Đang Chọn: hiển thị tên Model, số key khả dụng, RPM hiện tại / giới hạn, Request hôm nay, Tổng request, và Lỗi phát sinh.
3. Trong từng thẻ Key ở tab Quota: hiển thị rõ ràng thống kê request của riêng key đó cho Model Đang Dùng, cùng danh sách các model khả dụng được kiểm tra thực tế.

**Acceptance Scenarios**:
1. **Given** model `Gemini 2.5 Flash` đang được chọn và đã có dữ liệu quota từ máy chủ, **When** người dùng xem tab "Cấu hình AI", **Then** hệ thống tổng hợp từ trường `byModel` của các key để hiển thị chính xác tổng request, RPM, và số key hỗ trợ model này.
2. **Given** người dùng chuyển sang tab "Quota & Hạn mức", **When** xem đầu danh sách, **Then** banner tổng quan hiển thị đầy đủ các chỉ số của model đang chọn (`selectedModel`).
3. **Given** một key cụ thể đã được kiểm tra model qua `fetchModelsForKey`, **When** render thẻ key, **Then** hiển thị danh sách các model khả dụng kèm dấu kiểm xác nhận model nào được hỗ trợ.

---

### User Story 3 - Cảnh Báo Trực Quan Khi Model Đang Chọn Không Có Key Khả Dụng (Priority: P2)

Là người dùng, tôi muốn nhận được cảnh báo trực quan rõ ràng nếu sau khi kiểm tra, không có API key nào hỗ trợ mô hình đang chọn (`availableKeyCount === 0`), nhưng hệ thống không được tự ý âm thầm đổi model của tôi mà để tôi chủ động quyết định.

**Why this priority**: Giúp người dùng phát hiện sớm sự cố quyền truy cập mô hình (ví dụ tài khoản không có quyền dùng model Pro hoặc Experimental) trước khi tiến hành dịch hàng loạt, tránh phát sinh lỗi hàng loạt giữa chừng.

**Independent Test**:
1. Chọn một model không được bất kỳ key nào hỗ trợ (sau khi kiểm tra toàn bộ key).
2. Xác nhận hiển thị hộp cảnh báo tông màu hổ phách (`amber` theo Design System) thông báo model hiện tại không có API key khả dụng kèm nút "Kiểm tra lại".
3. Xác nhận `selectedModel` không bị tự động thay đổi, dropdown vẫn cho phép người dùng tự đổi sang model khác.

**Acceptance Scenarios**:
1. **Given** tất cả các key đã được kiểm tra và không key nào có `selectedModel` trong danh sách model hỗ trợ, **When** hiển thị giao diện, **Then** xuất hiện thông báo cảnh báo rõ ràng, không tự động fallback ngầm làm mất model đã chọn của người dùng.

---

### Edge Cases

- **Chưa có API key nào**: Hiển thị trạng thái rỗng (`EmptyState`) hướng dẫn thêm key.
- **Chưa thực hiện kiểm tra model (chưa bấm nút)**: Hiển thị trạng thái "Chưa kiểm tra" cho số lượng key hỗ trợ thay vì báo 0 key lỗi.
- **Một số key hỗ trợ, một số key không hỗ trợ**: Hiển thị chính xác tỷ lệ `X/Y key khả dụng` (ví dụ `3/5 key hỗ trợ`).
- **Mất mạng / Lỗi kiểm tra 1 key**: Chỉ báo lỗi tại thẻ key đó, không ảnh hưởng đến dữ liệu đã kiểm tra của các key khác hay làm hỏng giao diện chọn model.
- **Model ID có hoặc không có tiền tố `models/`**: Hệ thống chuẩn hóa so khớp (ví dụ `gemini-2.5-flash` và `models/gemini-2.5-flash`) một cách nhất quán khi tra cứu trong `byModel` và danh sách model từ API.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tách bạch tuyệt đối Configuration State (`selectedModel` lưu tại localStorage `gemini_selected_model`) và Observability State (`inspectResults`, `snapshotKeys`, `byModel`).
- **FR-002**: Việc bấm nút "Kiểm tra Model" ở bất kỳ key nào TUYỆT ĐỐI KHÔNG làm thay đổi `selectedModel`, không disable dropdown chọn model, không ghi đè trạng thái của key khác.
- **FR-003**: Tạo cấu trúc Model Registry / Helper tổng hợp dữ liệu thống kê từ `KeyQuotaFullSnapshot.byModel` và kết quả kiểm tra `inspectResults` để tính toán:
  - `availableKeyCount`: số lượng key đã xác nhận hỗ trợ model
  - `totalCheckedKeys`: số lượng key đã kiểm tra
  - `totalRequests`: tổng request tích lũy của model
  - `requestsToday`: tổng request hôm nay (PST) của model
  - `requestsThisMinute`: RPM thời gian thực của model
  - `errorsTotal`: tổng lỗi phát sinh của model
- **FR-004**: Bổ sung khối Model Summary thu nhỏ ngay bên dưới dropdown chọn model trong Tab "Cấu hình AI" (`ApiSettings.tsx`).
- **FR-005**: Bổ sung Banner Tổng Quan dành riêng cho Model Đang Chọn ở đầu Tab "Quota & Hạn mức" (`QuotaPanel.tsx`).
- **FR-006**: Trong từng thẻ Key ở `QuotaPanel.tsx`, hiển thị thông tin Model đang dùng (số request của key đó cho model hiện tại) và danh sách Model khả dụng sau khi kiểm tra.
- **FR-007**: Duy trì trạng thái quan sát (`inspectResults`, `snapshotKeys`) khi người dùng chuyển đổi giữa Tab "Cấu hình AI" và "Quota & Hạn mức" trong cùng phiên mở modal `ApiSettings.tsx`.
- **FR-008**: Hiển thị cảnh báo trực quan nếu model đang chọn đã kiểm tra nhưng không có key nào hỗ trợ (`availableKeyCount === 0`), không tự ý đổi model ngầm.

### Non-Functional Requirements & Guardrails

- **NFR-001 (Zero Type Errors)**: Chạy `npm run lint` (`tsc --noEmit`) phải sạch 100%.
- **NFR-002 (Zero Test Regressions)**: Chạy `npm test` (`vitest run`) phải pass toàn bộ các unit tests.
- **NFR-003 (Clean Build)**: Chạy `npm run build` phải build thành công sạch sẽ.
- **NFR-004 (Design System Compliance)**: Tuân thủ nghiêm ngặt bảng màu "Mực & Chu Sa" (`bg-ink`, `bg-parchment`, `border-parchment-2`, `text-polish`, `font-display`, `font-mono`), không dùng gradient, không dùng rounded-xl/2xl, không hard-code mã hex lạ.
- **NFR-005 (No Backend / Translation Alterations)**: Không sửa đổi logic dịch Gemini, không đổi circuit breaker/rotation logic, không đổi schema IndexedDB hay types.ts không liên quan.

---

## Success Criteria *(mandatory)*

1. **Model Selection Stability**: 100% các thao tác "Kiểm tra Model" trên từng key hoặc nhiều key liên tiếp không làm thay đổi giá trị `selectedModel`.
2. **Model Metrics Accuracy**: Số liệu request, RPM, RPD, lỗi hiển thị ở cả 2 tab phản ánh đúng 100% dữ liệu từ trường `byModel` của backend API.
3. **Seamless Tab Switching**: Chuyển đổi giữa 2 tab "Cấu hình AI" và "Quota & Hạn mức" không làm mất kết quả kiểm tra model vừa thực hiện trong phiên làm việc.
4. **Independent Key Loading**: Kiểm tra 1 key chỉ hiển thị trạng thái tải trên đúng key đó, không làm đơ hoặc khóa các key khác.
5. **Quality Gates Passed**: `npm run lint`, `npm test`, và `npm run build` đều pass 100%.

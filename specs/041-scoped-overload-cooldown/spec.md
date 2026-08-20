# Feature Specification: Phân Vùng Phạm Vi Cooldown Quá Tải (Scoped Overload Cooldown)

**Feature Branch**: `041-scoped-overload-cooldown`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 04 — SỬA GLOBAL OVERLOAD COOLDOWN. Mục tiêu: Audit: overloadCooldownUntil. Nếu đang global process-wide, xác định provider semantics. Phân loại: provider-wide overload, project/group overload, model-specific overload, key-specific failure. Desired behavior: Nếu Model A + Project A bị overload, không tự động block Model B + Project B trừ khi provider error thực sự cho thấy provider-wide outage. Thiết kế: Scope cooldown phù hợp: provider, model, quotaGroup (không nhất thiết chỉ một cấp). Tests: model A overloaded, model B remains usable, project A overloaded, project B remains usable, provider-wide outage, recovery."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phân Tách Cooldown Quá Tải Theo Từng Model & Từng QuotaGroup (Priority: P1) 🎯 MVP

Khi Google AI trả về lỗi HTTP 503 ("The model is overloaded" hoặc "Service Unavailable") đối với một mô hình cụ thể (ví dụ: `gemini-2.5-pro`) hoặc trong phạm vi một QuotaGroup (Project A), hệ thống chỉ kích hoạt Cooldown đối với đúng Mô hình đó (Model-scoped) hoặc Nhóm dự án đó (Group-scoped). Toàn bộ các mô hình khác (`gemini-2.5-flash`, `gemini-3.1-flash-lite`) và các nhóm dự án độc lập khác (Project B) phải tiếp tục hoạt động bình thường với `delayMs = 0` mà không bị chặn oan bởi một biến cooldown toàn cục dùng chung.

**Why this priority**: Triệt tiêu tổn thất thông lượng khi một model chuyên sâu (như Pro) bị quá tải trên hạ tầng Google, ngăn không cho lỗi 503 của một model làm tê liệt toàn bộ các luồng dịch thuật khác đang dùng Flash hoặc các dự án dự phòng.

**Independent Test**:
- Bắn request vào Model A (`gemini-2.5-pro`) nhận lỗi 503 $\to$ Model A chuyển sang trạng thái Cooldown (3000ms).
- Ngay tại thời điểm đó, phát request tới Model B (`gemini-2.5-flash`) $\to$ Model B nhận `isEligible = true`, `delayMs = 0` và thực thi thành công ngay lập tức.
- Tương tự, nếu Project A bị 503/429 $\to$ Project B vẫn nhận `isEligible = true` và `delayMs = 0`.

**Acceptance Scenarios**:
1. **Scenario 1.1 (Model-Specific Isolation)**: **Given** Model A gặp lỗi 503, **When** hệ thống ghi nhận lỗi, **Then** chỉ Model A bị đặt vào danh sách Cooldown; Model B vẫn được xếp lịch bình thường.
2. **Scenario 1.2 (Project/Group Isolation)**: **Given** Group A gặp lỗi 503/429, **When** hệ thống kích hoạt Group Cooldown cho Group A, **Then** Group B hoàn toàn không bị ảnh hưởng và tiếp tục tiếp nhận request.

---

### User Story 2 - Nhận Diện Đúng Sự Cố Toàn Hạ Tầng Provider-Wide Outage (Priority: P1) 🎯 MVP

Hệ thống chỉ kích hoạt Cooldown cấp độ toàn nhà cung cấp (**Provider-Wide Cooldown**) khi có bằng chứng thực tế cho thấy sự cố diện rộng từ phía Google (ví dụ: nhiều mô hình độc lập và nhiều nhóm dự án khác nhau đồng thời gặp lỗi kết nối DNS/mạng hoặc liên tiếp trả về 503 trong một cửa sổ ngắn). Khi xảy ra Provider-Wide Outage, hệ thống kích hoạt backoff toàn cục để bảo vệ ứng dụng và tránh bắn request vô nghĩa vào hệ thống đang sập.

**Why this priority**: Phân biệt rạch ròi giữa quá tải cục bộ của một model và sự cố sập máy chủ toàn diện của Google Cloud.

**Independent Test**: Khi 3 mô hình độc lập (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite`) trên 2 QuotaGroup khác nhau đồng thời gặp lỗi 503 trong vòng 5 giây $\to$ Hệ thống kích hoạt Provider Outage Cooldown (5000ms); khi chỉ có 1 model lỗi $\to$ không kích hoạt Provider Outage.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Provider-Wide Outage Trigger)**: **Given** nhiều model và group độc lập đồng thời báo lỗi 503, **When** ngưỡng sự cố diện rộng bị vượt qua, **Then** Scheduler Authority kích hoạt Provider-Wide Cooldown.
2. **Scenario 2.2 (Key-Specific Failure)**: **Given** Key 1 gặp lỗi 401 Auth Failed hoặc 429 Key Exhausted, **When** ghi nhận lỗi, **Then** chỉ Key 1 bị cô lập, nhóm vẫn tiếp tục điều phối qua Key 2 bình thường.

---

### User Story 3 - Tự Động Phục Hồi Trạng Thái (Self-Healing Recovery) (Priority: P2)

Khi thời gian Cooldown TTL của một Model, một QuotaGroup, hoặc Provider-Wide Outage kết thúc, Scheduler Authority tự động mở lại khả năng điều phối cho đối tượng đó mà không cần khởi động lại máy chủ hoặc can thiệp thủ công. Request đầu tiên sau khi hết Cooldown được gửi đi thăm dò (Half-Open probing).

**Why this priority**: Đảm bảo tính liên tục của dịch vụ, tự động đưa hệ thống trở lại thông lượng tối đa ngay khi hạ tầng Google hồi phục.

**Independent Test**: Model A bị Cooldown 3000ms tại $T$ $\to$ Tại $T+1000\text{ms}$ request tới Model A bị hoãn; tại $T+3001\text{ms}$ request tới Model A được cấp phép ngay lập tức (`delayMs = 0`).

**Acceptance Scenarios**:
1. **Scenario 3.1 (Automatic Model Recovery)**: **Given** Model A đang trong Cooldown, **When** thời gian Cooldown TTL hết hạn, **Then** Model A tự động chuyển về trạng thái `Available`.
2. **Scenario 3.2 (Automatic Group Recovery)**: **Given** Group A đang trong Cooldown, **When** thời gian TTL hết hạn, **Then** Group A tự động phục hồi `Available`.

---

### User Story 4 - Giám Sát & Viễn Trắc Cooldown Đa Tầng (Priority: P2)

Bảng viễn trắc Scheduler Telemetry và Quota Panel hiển thị rõ ràng thông tin Cooldown theo từng tầng:
- Tầng Model: Mô hình nào đang quá tải, còn lại bao nhiêu mili-giây.
- Tầng Group: Nhóm dự án nào đang tạm dừng (429/503).
- Tầng Key: Khóa nào đang bị ngắt mạch (Circuit Breaker) hoặc lỗi xác thực.

**Why this priority**: Minh bạch hóa lý do vì sao request bị hoãn hoặc chuyển model, giúp người dùng nắm bắt tình trạng hạ tầng AI chính xác.

**Independent Test**: Kiểm tra API `/api/quota-status` trả về chi tiết `modelCooldowns`, `groupCooldowns`, và `providerOutageStatus`.

---

### Edge Cases

- **Tất cả các Model đều quá tải cùng lúc**: Scheduler Authority kích hoạt backoff theo thời gian Cooldown nhỏ nhất trong danh sách model và trả về lý do cụ thể cho người dùng.
- **Clock Skew / Reset Thời Gian Hệ Thống**: Sử dụng hàm lấy delta thời gian an toàn, tránh Cooldown TTL bị âm hoặc vô hạn.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI loại bỏ hoàn toàn các biến cooldown quá tải toàn cục dùng chung cho mọi model (`overloadCooldownUntil` process-wide) và thay thế bằng kiến trúc Cooldown có phân vùng phạm vi (**4-Tier Scoped Cooldown Hierarchy**):
  1. `Provider-Wide Cooldown` (Cấp toàn nhà cung cấp)
  2. `Model-Specific Cooldown` (Cấp mô hình cụ thể)
  3. `QuotaGroup Cooldown` (Cấp nhóm dự án Google Cloud)
  4. `Key-Specific Cooldown` (Cấp khóa API riêng lẻ)
- **FR-002**: Khi một mô hình cụ thể (Model A) gặp lỗi HTTP 503 Overloaded, Scheduler Authority CHỈ ĐƯỢC PHÉP kích hoạt Cooldown cho Model A, TUYỆT ĐỐI KHÔNG được chặn các mô hình khác (Model B, Model C).
- **FR-003**: Khi một nhóm dự án (Project A) gặp lỗi 503/429, Scheduler Authority CHỈ ĐƯỢC PHÉP kích hoạt Cooldown cho Project A, TUYỆT ĐỐI KHÔNG được chặn các nhóm dự án khác (Project B).
- **FR-004**: Khi một API key riêng lẻ gặp lỗi 401 Auth Failed hoặc 429 Key Quota, Scheduler Authority CHỈ ĐƯỢC PHÉP cô lập riêng key đó, nhóm dự án vẫn hoạt động bình thường nếu còn key lành lặn khác.
- **FR-005**: Provider-Wide Cooldown CHỈ ĐƯỢC KÍCH HOẠT khi phát hiện sự cố diện rộng thực tế (ít nhất 2 mô hình khác nhau VÀ ít nhất 2 nhóm khác nhau cùng gặp lỗi 503/Network Error trong cửa sổ 5 giây gần nhất).
- **FR-006**: Trong phương thức `scheduleAttempt(candidateKeys, modelName, estimatedTokens, now)`:
  - Nếu `providerOutageUntilMs > now` $\to$ Cấp phép bị hoãn cho toàn bộ request.
  - Nếu `modelCooldownUntilMs[modelName] > now` $\to$ Nhận diện model đang quá tải và trả về `isEligible: false` kèm `earliestAvailableInMs` hoặc đề xuất chuyển model khác.
  - Nếu `group.cooldownUntilMs > now` $\to$ Nhóm bị bỏ qua, chuyển sang nhóm tiếp theo trong danh sách ưu tiên.
- **FR-007**: Sau khi hết thời gian Cooldown TTL, các trạng thái Cooldown ở cả 4 tầng PHẢI tự động phục hồi về `Available` / `Healthy` mà không cần gọi hàm reset thủ công.
- **FR-008**: Bảng viễn trắc `getSchedulerTelemetry()` PHẢI báo cáo chi tiết các trường: `activeModelCooldowns`, `activeGroupCooldowns`, và `isProviderOutage`.
- **FR-009**: Giao diện Quota Panel và API `/api/quota-status` PHẢI hiển thị trạng thái Cooldown chi tiết theo từng tầng.
- **FR-010**: Toàn bộ 6 kịch bản kiểm thử bắt buộc (`model A overloaded`, `model B remains usable`, `project A overloaded`, `project B remains usable`, `provider-wide outage`, `recovery`) PHẢI được cài đặt và pass 100%.

---

### Key Entities

- **ModelCooldownRecord**: Bản ghi Cooldown của từng Model:
  - `modelName: string`: Mã mô hình (ví dụ: `gemini-2.5-pro`)
  - `cooldownUntilMs: number`: Mốc thời gian kết thúc Cooldown
  - `consecutiveOverloads: number`: Số lần quá tải liên tiếp
  - `lastOverloadAtMs: number`: Thời điểm ghi nhận quá tải gần nhất
- **ProviderOutageTracker**: Bộ theo dõi sự cố diện rộng:
  - `outageUntilMs: number`: Mốc thời gian kết thúc sự cố nhà cung cấp
  - `recentFailures: Array<{ modelName: string; groupId: string; timestamp: number }>`: Cửa sổ trượt 5 giây theo dõi các lỗi hệ thống
  - `isOutageActive: boolean`: Cờ báo hiệu sự cố diện rộng

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các trường hợp Model A bị quá tải 503 không gây ảnh hưởng đến tính sẵn sàng của Model B (Độ trễ của Model B là `0ms` trong suốt thời gian Model A Cooldown).
- **SC-002**: 100% các trường hợp Project A bị quá tải không gây ảnh hưởng đến tính sẵn sàng của Project B (Độ trễ của Project B là `0ms` trong suốt thời gian Project A Cooldown).
- **SC-003**: Provider-Wide Outage chỉ kích hoạt khi có tối thiểu 2 mô hình khác nhau và 2 nhóm khác nhau đồng thời lỗi trong 5 giây, triệt tiêu 100% việc kích hoạt nhầm sự cố diện rộng khi chỉ có 1 model quá tải cục bộ.
- **SC-004**: Toàn bộ 6 kịch bản kiểm thử bắt buộc đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn bộ Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi cảnh báo.

---

## Assumptions

- Các lỗi 503 từ Google AI thường có bản chất là quá tải hạ tầng GPU/TPU phục vụ riêng cho họ mô hình cụ thể (ví dụ: cụm phục vụ `gemini-2.5-pro` quá tải trong khi cụm `gemini-2.5-flash` hoàn toàn thông thoáng).
- Thời gian Cooldown an toàn mặc định cho Model Overload là $3000\text{ms} \to 15000\text{ms}$ (theo hàm Exponential Backoff).

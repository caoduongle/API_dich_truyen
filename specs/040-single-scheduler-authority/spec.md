# Feature Specification: Tập Trung Toàn Bộ Quyền Điều Phối Vào Một Single Scheduler Authority Duy Nhất

**Feature Branch**: `040-single-scheduler-authority`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 03 — TẠO SINGLE SCHEDULER AUTHORITY. Mục tiêu: Hiện pacing state đang nằm ở nhiều nơi: nextAllowedTimeByKey, nextAllowedTimeByGroup, customRpm, perKeyRpm, group pacing. Điều này dễ tạo double-throttling. Mục tiêu architecture: Tạo một scheduler authority duy nhất (QuotaScheduler / QuotaService). Scheduler chịu trách nhiệm: quota group eligibility, pacing, selection timing, cooldown. geminiService chỉ nên: prepare request -> ask scheduler -> execute provider call -> report result. Không được: Không để geminiService tự duy trì một scheduler khác. Không có scheduler #1 + scheduler #2 cùng quyết định sleep. Acceptance criteria: Một request chỉ có một authority quyết định: when may this request run? Tests: group pacing, multiple keys same group, multiple groups, parallel requests, no double sleep."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Một Nguồn Sự Thật Duy Nhất Cho Thời Điểm Thực Thi Request (Priority: P1) 🎯 MVP

Khi một yêu cầu dịch thuật được phát lệnh từ tầng ứng dụng, luồng thực thi phải chỉ hỏi duy nhất **Một Cơ Quan Điều Phối Trung Tâm (Single Scheduler Authority)** để nhận quyết định: Nhóm nào được chọn, Khóa nào được chọn, và cần giãn cách (pacing delay) chính xác bao nhiêu mili-giây trước khi phát lệnh gọi HTTP tới Google. Tầng chấp hành (`geminiService`) tuyệt đối không tự lưu trữ các bảng đồng hồ riêng (`nextAllowedTimeByKey`, `nextAllowedTimeByGroup`) hay tự tính toán thêm các khoảng nghỉ trùng lặp.

**Why this priority**: Đây là giải pháp triệt tiêu hoàn toàn lỗi nghẽn kép (Double-Throttling / Double-Sleep) — nguyên nhân gây lãng phí thời gian chờ và suy giảm thông lượng dịch thuật khi nhiều tầng cùng quyết định sleep độc lập.

**Independent Test**: Gửi 2 request liên tiếp vào một nhóm có nhịp độ pacing 2000ms $\to$ Scheduler Authority cấp quyền thực thi: Request 1 chạy ngay (delay 0ms), Request 2 nhận lệnh chờ đúng 2000ms; `geminiService` thực hiện sleep đúng 1 lần duy nhất theo chỉ định của Scheduler.

**Acceptance Scenarios**:
1. **Scenario 1.1 (Single Authority Decision)**: **Given** một yêu cầu dịch mới, **When** tầng thực thi yêu cầu cấp quyền điều phối từ Scheduler Authority, **Then** Scheduler trả về một `QuotaScheduleLease` hoàn chỉnh chứa: `selectedGroupId`, `selectedKey`, `delayMs`, và `leaseId`.
2. **Scenario 1.2 (No Double Sleep)**: **Given** Scheduler đã chỉ định khoảng chờ `delayMs = 1500ms`, **When** tầng chấp hành thực hiện yêu cầu, **Then** tổng thời gian hoãn trước khi phát HTTP request bằng đúng 1500ms (sai số $\pm 50\text{ms}$), không bị cộng dồn thêm bởi bất kỳ bộ đếm thời gian nào khác.

---

### User Story 2 - Điều Phối Song Song & Khóa Pacing Độc Quyền Theo Nhóm (Priority: P1) 🎯 MVP

Khi có nhiều request đồng thời (parallel / concurrent requests) gửi tới hệ thống:
- Các request nhắm vào **Cùng một QuotaGroup** (hoặc dùng các key thuộc cùng một Google Cloud Project) được xếp hàng và giãn cách tuần tự theo đồng hồ pacing duy nhất của nhóm đó mà không bị race-condition hay ghi đè thời gian chờ.
- Các request nhắm vào **Các QuotaGroup Khác Nhau** (thuộc các Project Google độc lập) được cấp quyền chạy song song ngay lập tức mà không bị cản trở bởi nhịp độ của nhóm khác.

**Why this priority**: Đảm bảo mở rộng thông lượng tối đa khi người dùng cấu hình nhiều dự án độc lập, đồng thời bảo vệ nghiêm ngặt hạn ngạch chống lỗi 429 khi gửi đồng thời nhiều đoạn dịch trong cùng một dự án.

**Independent Test**:
- Bắn 5 request song song vào Group A (pacing 1000ms) $\to$ các request được cấp lịch tuần tự tại $T+0\text{ms}, T+1000\text{ms}, T+2000\text{ms}, T+3000\text{ms}, T+4000\text{ms}$.
- Bắn đồng thời 1 request vào Group A và 1 request vào Group B $\to$ cả 2 request đều nhận `delayMs = 0` và chạy song song đồng thời.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Multiple Keys Same Group)**: **Given** một nhóm có 3 API keys và nhịp độ nhóm là 3000ms, **When** gửi 2 request liên tiếp dùng 2 key khác nhau trong nhóm, **Then** request thứ 2 vẫn phải chịu nhịp độ giãn cách 3000ms của nhóm (không được bypass vì đổi key).
2. **Scenario 2.2 (Multiple Groups Parallel)**: **Given** Group A và Group B độc lập, **When** gửi đồng thời 2 request, **Then** cả 2 đều được khởi chạy ngay tức thì với `delayMs = 0`.
3. **Scenario 2.3 (Parallel Requests Atomicity)**: **Given** 10 request đồng thời vào 1 group, **When** scheduler xử lý cấp phép, **Then** các mốc thời gian `nextAllowedTime` được tăng lũy tiến nguyên tử, không có 2 request nào bị trùng mốc thời gian dẫn đến xung đột RPM.

---

### User Story 3 - Hợp Nhất Trạng Thái Cooldown & Xử Lý Lỗi Tự Động (Priority: P2)

Toàn bộ các trạng thái tạm dừng (Overload Cooldown 503, Quota Rate Limit 429, Circuit Breaker Open, Key Cooldown) được quản lý tập trung bên trong Scheduler Authority. Tầng chấp hành chỉ gửi báo cáo kết quả (`reportResult` / `recordCategorizedError`), Scheduler tự động kích hoạt Cooldown cho Key hoặc Group và tự động chuyển hướng các request tiếp theo sang Key/Group lành lặn còn lại.

**Why this priority**: Đảm bảo tính nhất quán của vòng đời sức khỏe; loại bỏ các biến cờ toàn cục phân tán (`overloadCooldownUntil`, `isRateLimited`) khỏi tầng `geminiService`.

**Independent Test**: Gửi request gặp 429 trên Group A $\to$ `geminiService` báo cáo lỗi về Scheduler $\to$ Scheduler đánh dấu Group A vào trạng thái `InCooldown(5000ms)`; request tiếp theo Scheduler tự động chuyển sang Group B mà không cần `geminiService` can thiệp logic rẽ nhánh.

**Acceptance Scenarios**:
1. **Scenario 3.1 (Centralized Error Reporting)**: **Given** một lượt gọi provider thất bại với mã lỗi HTTP 429, **When** `geminiService` gửi báo cáo lỗi về Scheduler, **Then** Scheduler tự động cập nhật Cooldown toàn nhóm và ghi nhận lịch sử thử lại.
2. **Scenario 3.2 (Self-Healing Failover)**: **Given** Key A1 gặp lỗi xác thực 401, **When** `geminiService` thử lại vòng lặp, **Then** Scheduler trả về ngay Key A2 lành lặn trong cùng nhóm.

---

### User Story 4 - Loại Bỏ Triệt Để Các Bảng Trạng Thái Phân Tán Cũ (Priority: P2)

Dọn dẹp sạch sẽ toàn bộ các biến lưu trữ pacing phân tán trong `server/services/geminiService.ts` (`nextAllowedTimeByKey`, `nextAllowedTimeByGroup`, các tham số `perKeyRpm` legacy), chuyển giao 100% quyền sở hữu state cho `quotaService` / `QuotaScheduler`.

**Why this priority**: Ngăn ngừa nợ kỹ thuật (technical debt), mã nguồn trong sáng, dễ kiểm thử và tuân thủ nguyên tắc Single Responsibility Principle.

**Independent Test**: Kiểm tra mã nguồn `geminiService.ts` không còn bất kỳ biến Map `nextAllowedTime...` nào; toàn bộ các bài unit test kiểm thử scheduler đều tương tác trực tiếp qua interface của Scheduler Authority.

**Acceptance Scenarios**:
1. **Scenario 4.1 (Clean Dispatch Loop)**: **Given** hàm `generateWithRotation`, **When** duyệt mã nguồn, **Then** toàn bộ logic chọn key và tính delay đều gói gọn trong một lệnh gọi duy nhất tới Scheduler Authority.

---

### Edge Cases

- **Tất cả các QuotaGroup đều đang Cooldown hoặc Hết hạn ngạch**: Scheduler Authority trả về quyết định `isEligible: false` kèm thời gian chờ tối thiểu cho đến khi nhóm gần nhất được phục hồi (`earliestAvailableInMs`), giúp tầng gọi đưa ra thông báo backpressure chính xác cho người dùng.
- **Request bị hủy / AbortSignal**: Nếu client hủy request trong khi đang chờ pacing delay, Scheduler cung cấp cơ chế hoàn trả/hủy nhịp độ nếu cần để không lãng phí dung lượng slot tiếp theo.
- **Clock Drift / Thay đổi đồng hồ hệ thống**: Scheduler sử dụng timestamp đơn điệu và ngưỡng chặn sàn an toàn để tránh bị treo vĩnh viễn nếu đồng hồ máy chủ bị lùi giờ.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI có một và chỉ một Cơ quan Điều phối Hạn ngạch duy nhất (**Single Scheduler Authority**) quản lý toàn bộ việc cấp phép gửi request, tính toán pacing delay, và quản lý cooldown.
- **FR-002**: Tầng chấp hành gọi mô hình (`geminiService`) TUYỆT ĐỐI KHÔNG được tự duy trì các bảng đồng hồ pacing riêng (`nextAllowedTimeByKey`, `nextAllowedTimeByGroup` hoặc bất kỳ cơ chế sleep độc lập nào ngoài chỉ định của Scheduler).
- **FR-003**: Luồng gọi API tại `geminiService` PHẢI tuân thủ nghiêm ngặt mô hình 4 bước:
  1. Chuẩn bị yêu cầu (`Prepare Request`)
  2. Xin quyền điều phối từ Scheduler (`Ask Scheduler Authority / Acquire Lease`)
  3. Chờ đúng thời gian được chỉ định nếu có (`Sleep once if delayMs > 0`)
  4. Thực thi gọi Google API và báo cáo kết quả về Scheduler (`Execute Provider Call & Report Result`)
- **FR-004**: Khi cấp quyền điều phối (`scheduleAttempt` / `acquireLease`), Scheduler Authority PHẢI trả về một cấu trúc dữ liệu hợp đồng xác định:
  - `selectedGroupId: string`: Nhóm được chọn có điểm ưu tiên cao nhất
  - `selectedKey: string`: Khóa API lành lặn tối ưu nhất trong nhóm
  - `delayMs: number`: Khoảng thời gian chính xác cần hoãn trước khi phát request (0 nếu sẵn sàng ngay)
  - `isEligible: boolean`: Trạng thái hợp lệ (false nếu toàn bộ hệ thống đang nghẽn/hết quota)
  - `rejectReason?: string`: Lý do từ chối nếu không hợp lệ
- **FR-005**: Nhịp độ pacing PHẢI được quản lý độc quyền ở cấp độ QuotaGroup; việc gửi nhiều request qua các key khác nhau trong cùng một nhóm PHẢI dùng chung một đồng hồ pacing duy nhất của nhóm.
- **FR-006**: Các QuotaGroup khác nhau PHẢI có đồng hồ pacing độc lập, cho phép các request thuộc các nhóm khác nhau được cấp quyền thực thi song song không độ trễ.
- **FR-007**: Xử lý cấp phép pacing đồng thời (parallel requests) PHẢI đảm bảo tính nguyên tử (atomic reservation), lũy tiến mốc `nextAllowedTime` của nhóm mà không xảy ra race-condition.
- **FR-008**: Khi xảy ra lỗi HTTP 429 hoặc 503, `geminiService` PHẢI báo cáo về Scheduler để Scheduler kích hoạt Cooldown tập trung cho Key hoặc Group tương ứng.
- **FR-009**: Scheduler Authority PHẢI cung cấp phương thức truy vấn trạng thái viễn trắc (telemetry) đồng nhất cho toàn bộ hệ thống (`queueWaitTotalMs`, `queueWaitAvgMs`, `rejectedByReason`).
- **FR-010**: Tất cả 5 ca kiểm thử bắt buộc (`group pacing`, `multiple keys same group`, `multiple groups`, `parallel requests`, `no double sleep`) PHẢI được cài đặt đầy đủ và pass 100%.

---

### Key Entities

- **QuotaScheduleLease**: Hợp đồng cấp quyền thực thi do Scheduler Authority ban hành cho 1 attempt:
  - `leaseId: string`: Mã định danh phiên cấp phép
  - `isEligible: boolean`: Có được phép thực thi hay không
  - `selectedGroupId?: string`: ID QuotaGroup được chọn
  - `selectedKey?: string`: Khóa API được chọn
  - `delayMs: number`: Thời gian chờ bắt buộc trước khi gửi (ms)
  - `effectiveIntervalMs: number`: Khoảng cách an toàn của nhóm (ms)
  - `rejectReason?: string`: Lý do từ chối nếu không đủ điều kiện
  - `earliestAvailableInMs?: number`: Thời gian sớm nhất có thể thử lại nếu toàn bộ nhóm bị nghẽn
- **QuotaSchedulerAuthority**: Giao diện dịch vụ điều phối trung tâm duy nhất:
  - `acquireLease(rawKeys, modelName, estimatedTokens, now)`: Cấp phép và tính toán nhịp độ nguyên tử
  - `reportAttemptResult(leaseId, key, modelName, status, latencyMs, tokens, error)`: Báo cáo kết quả và cập nhật sức khỏe

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các quyết định "Khi nào request được phép chạy?" được ban hành bởi duy nhất một Scheduler Authority, không có bất kỳ dòng code nào gây ra hiện tượng sleep trùng lặp (Zero Double-Sleep).
- **SC-002**: 100% các request đồng thời gửi vào cùng một nhóm 15 RPM được giãn cách chính xác theo nhịp độ ~4445ms với độ trôi lệch $< 5\%$.
- **SC-003**: 100% các request gửi tới các QuotaGroup độc lập khác nhau được cấp quyền thực thi song song tức thì (`delayMs = 0`).
- **SC-004**: Toàn bộ 5 kịch bản kiểm định bắt buộc (`group pacing`, `multiple keys same group`, `multiple groups`, `parallel requests`, `no double sleep`) đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn bộ các Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi cảnh báo và 0 suy giảm hiệu năng.

---

## Assumptions

- `quotaService` đóng vai trò là `QuotaSchedulerAuthority` duy nhất trong hệ thống, quản lý tập trung toàn bộ state từ QuotaGroup, Health Pool đến Pacing Reservation.
- Trong môi trường đơn tiến trình Node.js (Express), việc cập nhật `nextAllowedTimeMs` trong luồng đồng bộ JavaScript đảm bảo tính nguyên tử tự nhiên (thread-safe by Node event loop).
- Client-side pacing trong `apiClient.ts` chỉ đóng vai trò là gợi ý trực quan cho thanh tiến độ; server-side Scheduler Authority là cơ quan phán quyết cuối cùng có tính chất bắt buộc.

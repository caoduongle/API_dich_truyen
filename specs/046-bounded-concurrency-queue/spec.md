# Feature Specification: Cổng Đồng Thời Kèm Hàng Đợi Có Giới Hạn (Bounded Concurrency Queue)

**Feature Branch**: `046-bounded-concurrency-queue`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 09 — ĐỔI CONCURRENCY GATE THÀNH SEMANTICS ĐÚNG. Mục tiêu: Hiện MAX_CONCURRENT_REQUESTS = 50 và request #51 bị reject. Đây không phải queue. Đánh giá workload trước: Nếu product hiện tại không cần chờ batch: Đổi tên thành BoundedConcurrencyGate và document: max in-flight Gemini requests. Nếu batch translation cần waiting: xây bounded queue thực sự. Không được: Không xây queue vô hạn. Nếu xây queue: Phải có: maxDepth, timeout, cancellation, priority nếu cần, queueWait, backpressure. Tests: 50 concurrent, 51st behavior, queue full, timeout, cancel, failure."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kiểm Soát Tải Đồng Thời & Chuyển Tiếp Khe Chạy (Bounded Concurrency Queue & Slot Drain) (Priority: P1) 🎯 MVP

Khi hệ thống tiếp nhận các yêu cầu dịch thuật văn bản (bao gồm cả các tác vụ dịch từng chương đơn lẻ lẫn các tác vụ dịch hàng loạt - Batch Translation), hệ thống cho phép tối đa **50 yêu cầu in-flight đồng thời** (`maxConcurrent = 50`) thực thi song song trực tiếp với Google Gemini API.
- 50 yêu cầu đầu tiên được cấp phát khe chạy ngay lập tức (`queueWaitMs = 0`).
- Yêu cầu thứ 51 (`51st request`) không bị từ chối đột ngột mà được đưa vào **Hàng đợi có giới hạn (Bounded Queue)** để chờ khe chạy kế tiếp.
- Ngay khi bất kỳ yêu cầu nào trong 50 yêu cầu đang chạy hoàn tất (thành công hoặc thất bại), khe chạy được giải phóng và yêu cầu đang chờ đầu tiên trong hàng đợi sẽ được lập tức kích hoạt (`drainNext`).

**Why this priority**: Đảm bảo quy trình dịch hàng loạt (Batch Translation) không bị đứt đoạn do lỗi reject tức thì, đồng thời vẫn bảo vệ máy chủ không bị quá tải kết nối.

**Independent Test**:
- Gửi đồng thời 50 tasks $\to$ cả 50 tasks chạy song song ngay lập tức.
- Gửi task thứ 51 $\to$ task thứ 51 chờ trong queue; khi 1 task đầu tiên hoàn thành $\to$ task 51 lập tức được cấp slot và chạy thành công.

**Acceptance Scenarios**:
1. **Scenario 1.1 (50 Concurrent Execution)**: **Given** 50 requests đồng thời, **When** gửi vào queue, **Then** cả 50 requests thực thi ngay lập tức với `activeCount = 50, queuedCount = 0`.
2. **Scenario 1.2 (51st Request Queuing & Drain)**: **Given** 50 requests đang chạy, **When** request thứ 51 tới, **Then** request 51 được xếp hàng chờ (`queuedCount = 1`) và tự động thực thi ngay khi 1 request hoàn tất.

---

### User Story 2 - Cơ Chế Áp Lực Ngược Khi Hàng Đợi Đầy (Backpressure on Queue Full) (Priority: P1) 🎯 MVP

Để ngăn chặn tình trạng tràn bộ nhớ (Out-Of-Memory) do hàng đợi phình to vô hạn, hệ thống thiết lập giới hạn cứng cho độ sâu hàng đợi: **`maxDepth = 100`**.
Khi số lượng yêu cầu đang chạy đạt tối đa 50 VÀ số lượng yêu cầu đang chờ trong hàng đợi đạt tối đa 100 (tổng cộng 150 requests), bất kỳ yêu cầu thứ 151 trở đi sẽ bị từ chối ngay lập tức với mã lỗi **Áp lực ngược (Backpressure Error: `QUEUE_FULL`)** kèm thông báo thân thiện: *"Hệ thống dịch thuật hiện đang đầy hàng đợi xử lý. Vui lòng thử lại sau giây lát."*

**Why this priority**: Tuyệt đối cấm xây dựng hàng đợi vô hạn (No unbounded queue invariant), bảo vệ tài nguyên RAM và CPU của máy chủ.

**Independent Test**: Gửi đồng thời 50 (active) + 100 (queued) + 1 requests $\to$ 150 requests được xử lý/chờ, request thứ 151 bị từ chối ngay lập tức với lỗi `QUEUE_FULL`.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Queue Full Backpressure)**: **Given** queue đã đầy 100 items chờ, **When** request tiếp theo đến, **Then** hệ thống ném ngoại lệ Backpressure `QUEUE_FULL` ngay lập tức.

---

### User Story 3 - Kiểm Soát Thời Gian Chờ & Hủy Yêu Cầu An Toàn (Timeout & Cancellation) (Priority: P1) 🎯 MVP

1. **Queue Timeout (`queueTimeoutMs = 30000`)**: Nếu một yêu cầu nằm chờ trong hàng đợi quá 30 giây mà không được cấp khe chạy, yêu cầu sẽ tự động bị hủy và ném lỗi `QUEUE_TIMEOUT`, đồng thời tự động rút khỏi hàng đợi để tránh lãng phí tài nguyên.
2. **Cancellation via AbortSignal**: Nếu client gửi tín hiệu hủy (`AbortSignal`), yêu cầu đang chờ trong hàng đợi sẽ ngay lập tức được dọn dẹp, hủy bộ đếm timer và ném lỗi `ABORTED` mà không rò rỉ bộ nhớ.
3. **Failure Isolation**: Nếu một tác vụ đang chạy bị ném lỗi ngoại lệ (throw Error), khe chạy (slot) vẫn được giải phóng 100% an toàn trong khối `finally` để nhường quyền cho các yêu cầu tiếp theo trong hàng đợi.

**Why this priority**: Tránh tình trạng treo request vĩnh viễn (stale hanging promises) và xử lý rò rỉ khe chạy khi gặp lỗi bất ngờ.

**Independent Test**:
- Giữ 50 slot bận $\to$ Request 51 chờ quá 30s bị timeout và queue trở về rỗng.
- Request 51 bị abort $\to$ hủy chờ ngay lập tức và giải phóng timer.
- Task ném Error $\to$ activeCount giảm chuẩn xác và task tiếp theo trong queue vẫn chạy bình thường.

**Acceptance Scenarios**:
1. **Scenario 3.1 (Timeout)**: **Given** request chờ quá thời gian `queueTimeoutMs`, **When** timeout kích hoạt, **Then** request bị reject với lỗi timeout và rút khỏi hàng đợi.
2. **Scenario 3.2 (Cancellation)**: **Given** request đang chờ trong queue, **When** nhận tín hiệu `signal.abort()`, **Then** request bị hủy ngay lập tức.
3. **Scenario 3.3 (Failure Resilience)**: **Given** task đang chạy bị lỗi, **When** task kết thúc, **Then** slot được trả lại an toàn cho task tiếp theo.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI đóng gói toàn bộ logic kiểm soát đồng thời vào lớp chuyên biệt **`BoundedConcurrencyQueue`** (thay thế cho biến đếm thô `activeConcurrentRequests` cũ).
- **FR-002**: Tham số cấu hình của `BoundedConcurrencyQueue` PHẢI bao gồm:
  - `maxConcurrent`: Số tác vụ chạy song song tối đa (mặc định: `50`).
  - `maxDepth`: Số lượng tác vụ xếp hàng chờ tối đa (mặc định: `100`).
  - `queueTimeoutMs`: Thời gian chờ tối đa trong hàng đợi (mặc định: `30000` ms).
- **FR-003**: Khi `activeCount < maxConcurrent`, yêu cầu PHẢI được thực thi ngay lập tức (`queueWaitMs = 0`).
- **FR-004**: Khi `activeCount >= maxConcurrent` và `queuedCount < maxDepth`, yêu cầu PHẢI được đưa vào hàng đợi chờ và tự động kích hoạt khi có slot trống (`drainNext`).
- **FR-005**: Khi `queuedCount >= maxDepth`, hệ thống PHẢI ném lỗi Backpressure `QUEUE_FULL` ngay lập tức mà không cho phép hàng đợi phình to vô hạn (**No Unbounded Queue Invariant**).
- **FR-006**: Mỗi phần tử trong hàng đợi PHẢI có một `NodeJS.Timeout` tương ứng với `queueTimeoutMs`. Khi hết giờ, phần tử tự động bị loại khỏi queue và ném lỗi `QUEUE_TIMEOUT`.
- **FR-007**: Hệ thống PHẢI hỗ trợ `AbortSignal`: Khi nhận tín hiệu abort, phần tử đang chờ PHẢI bị hủy ngay lập tức, dọn dẹp timer và ném lỗi `ABORTED`.
- **FR-008**: Bất kể tác vụ thực thi thành công hay ném ngoại lệ, khe chạy PHẢI luôn được giải phóng trong khối `finally` và gọi `drainNext()` cho tác vụ tiếp theo.
- **FR-009**: Hệ thống PHẢI cung cấp phương thức `getMetrics()` phản ánh: `activeCount`, `queuedCount`, `maxConcurrent`, `maxDepth`, `totalExecuted`, `totalRejected`, `totalTimeouts`, `totalCancelled`.
- **FR-010**: Toàn bộ 6 kịch bản kiểm thử bắt buộc (`50 concurrent`, `51st behavior`, `queue full`, `timeout`, `cancel`, `failure`) PHẢI được cài đặt và pass 100%.

---

### Key Entities

- **BoundedConcurrencyQueueConfig**: Cấu hình khởi tạo:
  ```typescript
  export interface BoundedConcurrencyQueueConfig {
    maxConcurrent?: number;
    maxDepth?: number;
    queueTimeoutMs?: number;
  }
  ```
- **QueueMetrics**: Viễn trắc hàng đợi:
  ```typescript
  export interface QueueMetrics {
    activeCount: number;
    queuedCount: number;
    maxConcurrent: number;
    maxDepth: number;
    totalExecuted: number;
    totalRejected: number;
    totalTimeouts: number;
    totalCancelled: number;
  }
  ```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 50 yêu cầu đồng thời chạy song song 100% không bị nghẽn.
- **SC-002**: Yêu cầu thứ 51 được chuyển tiếp vào hàng đợi chờ và tự động thực thi ngay khi có slot trống (0% bị reject oan uổng).
- **SC-003**: 100% các yêu cầu vượt quá `maxDepth = 100` bị chặn bởi Backpressure `QUEUE_FULL` (0% nguy cơ tràn RAM).
- **SC-004**: Toàn bộ 6 ca kiểm thử bắt buộc đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`).

---

## Assumptions

- Cấu hình mặc định 50 concurrency slots và 100 queue depth là tối ưu cho máy chủ Node.js phục vụ luồng dịch thuật AI, vừa đảm bảo hiệu năng cao vừa duy trì độ ổn định tuyệt đối.

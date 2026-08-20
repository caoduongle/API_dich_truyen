# Feature Specification: Gộp Yêu Cầu Khám Phá Mô Hình Đồng Thời (Model Discovery SingleFlight)

**Feature Branch**: `045-model-discovery-singleflight`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 08 — MODEL DISCOVERY SINGLEFLIGHT. Mục tiêu: Nếu cache miss và có 20 concurrent requests, không được tạo 20 model discovery requests. Thay vào đó: 1 upstream request, 19 await same in-flight promise. Requirements: success cache; short failure cache nếu phù hợp; timeout; cleanup; no unbounded memory; race-safe. Có thể dùng: Map<string, Promise<Result>> hoặc abstraction tốt hơn. Tests: single request, 20 concurrent cache miss, cache hit, failure, timeout, recovery."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hợp Nhất Yêu Cầu Đồng Thời Khi Cache Miss (SingleFlight Deduplication) (Priority: P1) 🎯 MVP

Khi hệ thống chưa có dữ liệu bộ nhớ đệm (Cache Miss hoặc Force Refresh) và nhận đồng thời 20 (hoặc nhiều hơn) yêu cầu tra cứu danh sách mô hình (`listModelsForKey`) cho cùng một API key, hệ thống chỉ được phép phát sinh duy nhất **1 cuộc gọi HTTP thực tế lên Google Upstream API**. 19 yêu cầu đồng thời còn lại phải cùng chia sẻ và chờ đợi (await) chung một `in-flight Promise`. Khi Promise hoàn tất, tất cả 20 yêu cầu đều nhận cùng một kết quả chính xác mà không làm bùng nổ lưu lượng mạng (Zero Thundering Herd).

**Why this priority**: Ngăn chặn tình trạng kẹt mạng, lãng phí hạn ngạch API và nguy cơ bị Google chặn tạm thời (429 Rate Limit) khi nhiều luồng hoặc tabs người dùng cùng mở ứng dụng một lúc.

**Independent Test**: Gửi đồng thời 20 lời gọi `listModelsForKey(apiKey)` khi chưa có cache $\to$ Mock `fetch` chỉ được gọi đúng 1 lần duy nhất, 20 promises đều resolve với danh sách models chuẩn xác.

**Acceptance Scenarios**:
1. **Scenario 1.1 (Single Request Baseline)**: **Given** 1 yêu cầu duy nhất, **When** gọi `listModelsForKey`, **Then** phát sinh 1 cuộc gọi upstream và kết quả được lưu vào success cache.
2. **Scenario 1.2 (20 Concurrent Cache Miss)**: **Given** 20 yêu cầu đồng thời trên 1 key chưa có cache, **When** thực thi, **Then** hệ thống chỉ gửi đúng 1 HTTP request lên upstream và cả 20 yêu cầu đều nhận kết quả thành công.
3. **Scenario 1.3 (Subsequent Cache Hit)**: **Given** cache đã được nạp, **When** có yêu cầu tiếp theo, **Then** hệ thống trả về ngay từ cache (0 HTTP request).

---

### User Story 2 - Bộ Đệm Thất Bại Ngắn Hạn & Tự Động Khôi Phục (Short Failure Cache & Recovery) (Priority: P1) 🎯 MVP

Khi yêu cầu upstream lên Google API gặp lỗi (như 401 Invalid Key, 403 Forbidden, 500 Internal Error) hoặc bị timeout (15 giây), hệ thống phải:
1. Lan truyền lỗi an toàn cho toàn bộ các yêu cầu đang chờ chung in-flight Promise.
2. Dọn dẹp sạch sẽ `inFlightDiscovery` map trong khối `finally`.
3. Lưu lỗi vào **Short Failure Cache** (TTL ngắn: 30 giây) để ngăn chặn các request dồn dập tiếp theo tiếp tục tấn công upstream bị lỗi.
4. Cho phép **Tự động khôi phục (Self-Healing Recovery)**: Sau khi hết thời gian TTL của Failure Cache (hoặc khi gọi `forceRefresh`), yêu cầu tiếp theo sẽ được phép gọi lại upstream để khôi phục trạng thái hoạt động bình thường khi sự cố đã qua.

**Why this priority**: Bảo vệ hệ thống khỏi vòng lặp lỗi liên tục và giải phóng tài nguyên bộ nhớ ngay lập tức.

**Independent Test**:
- 20 request đồng thời khi upstream 500 $\to$ 1 upstream call, cả 20 request nhận lỗi an toàn, `inFlightDiscovery` map rỗng sau khi hoàn thành.
- Sau khi hết 30s failure TTL $\to$ request tiếp theo gửi thành công lên upstream.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Failure Broadcast & Cleanup)**: **Given** upstream trả về lỗi, **When** 20 request đang await, **Then** cả 20 request nhận lỗi an toàn và in-flight map được giải phóng.
2. **Scenario 2.2 (Timeout Handling)**: **Given** upstream bị treo quá 15s, **When** timeout kích hoạt, **Then** ném lỗi timeout và in-flight map được dọn dẹp sạch.
3. **Scenario 2.3 (Recovery After Failure)**: **Given** lỗi đã xảy ra và hết thời gian failure cache, **When** có request mới, **Then** hệ thống gọi lại upstream và khôi phục thành công.

---

### User Story 3 - Giới Hạn Bộ Nhớ & Dọn Dẹp An Toàn Tuyệt Đối (Bounded Memory & Race-Safety) (Priority: P1) 🎯 MVP

Toàn bộ các cấu trúc dữ liệu lưu trữ in-flight promises và caches phải đảm bảo:
1. **No Unbounded Memory**: Giới hạn số lượng entries tối đa và có cơ chế dọn dẹp định kỳ (Periodic Timer) để tự động xóa các entries hết hạn TTL.
2. **Race-Safe**: Không có hiện tượng deadlock, rò rỉ promise vĩnh viễn (unresolved promises) hoặc memory leak kể cả khi hàng trăm request đến và hủy bỏ (abort) bất ngờ.

**Why this priority**: Duy trì sự ổn định của máy chủ trong môi trường production hoạt động dài ngày.

---

### Edge Cases

- **Client abort request giữa chừng**: Signal abort của 1 client không làm hủy in-flight promise đang được chia sẻ bởi các clients khác; in-flight promise có timeout độc lập của máy chủ.
- **Force Refresh đồng thời với request thường**: Yêu cầu `forceRefresh` sẽ tạo một in-flight promise mới và ghi đè cache ngay khi có kết quả mới.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI áp dụng cơ chế **SingleFlight Concurrency Deduplication** cho `listModelsForKey`: Khi có $N \ge 1$ yêu cầu đồng thời cho cùng 1 `keyHash` trong lúc chưa có cache hoặc đang làm mới, chỉ DUY NHẤT 1 yêu cầu được gửi lên Google API, các yêu cầu còn lại PHẢI await chung `inFlightDiscovery` promise.
- **FR-002**: Khi in-flight promise hoàn tất (dù thành công hay thất bại), `keyHash` PHẢI được xóa khỏi `inFlightDiscovery` map trong khối `finally` để tránh memory leak.
- **FR-003**: Hệ thống PHẢI duy trì **Success Cache** với TTL 15 phút (`CACHE_TTL_MS = 15 * 60 * 1000`).
- **FR-004**: Hệ thống PHẢI hỗ trợ **Short Failure Cache** với TTL 30 giây (`FAILURE_CACHE_TTL_MS = 30 * 1000`) để bảo vệ upstream khỏi thundering herd khi key bị lỗi.
- **FR-005**: Mọi yêu cầu outbound lên Google Discovery PHẢI có giới hạn thời gian chờ tối đa 15 giây (`REQUEST_TIMEOUT_MS = 15 * 1000`). Khi quá thời gian này, `AbortController` sẽ kích hoạt hủy request và giải phóng in-flight promise.
- **FR-006**: Khi upstream gặp lỗi và tồn tại stale cache cũ, hệ thống PHẢI ưu tiên trả về stale cache an toàn thay vì làm gián đoạn trải nghiệm người dùng.
- **FR-007**: Hệ thống PHẢI có cơ chế dọn dẹp bộ nhớ định kỳ (Cleanup Interval) để tự động xóa các bản ghi hết hạn khỏi `cache`, `failureCache`, `verifiedModelsCache`.
- **FR-008**: Phương thức `clearCache()` PHẢI dọn dẹp toàn bộ: `cache`, `failureCache`, `inFlightDiscovery`, `inFlightRevalidation`, `verifiedModelsCache`, `inFlightVerifications`.
- **FR-009**: Thông điệp lỗi và logs TUYỆT ĐỐI KHÔNG ĐƯỢC chứa API key ở dạng plaintext (áp dụng `redactApiKey`).
- **FR-010**: Toàn bộ 6 kịch bản kiểm thử bắt buộc (`single request`, `20 concurrent cache miss`, `cache hit`, `failure`, `timeout`, `recovery`) PHẢI được cài đặt và pass 100%.

---

### Key Entities

- **DiscoveryResult**: Kết quả trả về của `listModelsForKey`:
  ```typescript
  export interface DiscoveryResult {
    keyHash: string;
    maskedKey: string;
    cached: boolean;
    stale?: boolean;
    models: ModelInfo[];
  }
  ```
- **FailureCacheEntry**: Bản ghi lỗi ngắn hạn:
  ```typescript
  interface FailureCacheEntry {
    timestamp: number;
    error: Error;
  }
  ```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 20 yêu cầu đồng thời khi cache miss chỉ tạo duy nhất **1 HTTP request** lên Google API (Tỉ lệ giảm tải: 95%).
- **SC-002**: 100% in-flight promises được giải phóng an toàn sau khi hoàn thành (0% promise bị treo hoặc rò rỉ bộ nhớ).
- **SC-003**: 100% các trường hợp lỗi upstream được chặn bởi Short Failure Cache trong 30s tiếp theo nếu không bị force refresh.
- **SC-004**: Toàn bộ 6 ca kiểm thử bắt buộc đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi.

---

## Assumptions

- Thuật toán SingleFlight (Promise Deduplication) trên tiến trình Node.js là thread-safe và race-safe trong môi trường xử lý bất đồng bộ (Single-threaded Event Loop).

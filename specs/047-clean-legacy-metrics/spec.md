# Feature Specification: Dọn Dẹp Số Liệu Di Sản & Chuẩn Tắc Hóa Metrics (Clean Legacy Metrics)

**Feature Branch**: `047-clean-legacy-metrics`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 10 — DỌN METRIC LEGACY. Mục tiêu: Hiện key-level metrics có thể đồng thời tồn tại: requestsTotal, requestsToday, requestsThisMinute và: providerAttemptsTotal, providerAttemptsToday, providerAttemptsThisMinute. Không để hai field cùng mang một semantics. Canonical semantics: Logical (logicalRequests, successfulRequests, failedRequests); Provider (providerAttempts, retries, providerFailures); Key activity (keyAttempts, keyFailures, keyCooldowns). Migration: Nếu frontend/API còn dùng field cũ: giữ compatibility layer tạm thời; mark deprecated; migrate consumers; sau đó remove. Không breaking-change ngầm. Tests: 1 request / 1 attempt, 1 request / 3 attempts, multiple logical requests, all retries fail."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phân Định Rõ Ràng 3 Tầng Số Liệu Chuẩn Tắc (Canonical Metrics Hierarchy) (Priority: P1) 🎯 MVP

Hệ thống cung cấp 3 tầng số liệu giám sát với ngữ nghĩa rõ ràng, độc lập và không chồng lấn:
1. **Logical Metrics (Cấp Độ Yêu Cầu Dịch Thuật)**:
   - `logicalRequests`: Tổng số yêu cầu dịch thuật logic từ client/người dùng.
   - `successfulRequests`: Số yêu cầu dịch thuật thành công trọn vẹn.
   - `failedRequests`: Số yêu cầu dịch thuật thất bại hoàn toàn (sau khi đã thử hết tất cả retries/keys).
2. **Provider Metrics (Cấp Độ Nhà Cung Cấp Google Upstream)**:
   - `providerAttempts`: Tổng số lần thực hiện cuộc gọi HTTP attempt tới Google GenAI API.
   - `retries`: Số lần thử lại sau các lần attempt đầu tiên bị lỗi (ví dụ: request thử qua 3 keys thì `retries = 2`).
   - `providerFailures`: Tổng số lần các cuộc gọi attempt tới provider bị lỗi (HTTP 4xx/5xx/timeout).
3. **Key Activity Metrics (Cấp Độ Khóa API Cá Nhân)**:
   - `keyAttempts`: Số lần khóa được cấp phát để thực thi attempt.
   - `keyFailures`: Số lần khóa bị lỗi khi thực thi.
   - `keyCooldowns`: Số lần khóa bị đưa vào trạng thái cooldown.

**Why this priority**: Loại bỏ hoàn toàn sự mập mờ giữa "số lần người dùng bấm dịch" (Logical Request) và "số cuộc gọi HTTP thực tế tới nhà cung cấp" (Provider Attempt) và "số lần từng key được sử dụng" (Key Attempt).

**Independent Test**:
- 1 request thành công ngay lần thử đầu: `logicalRequests = 1`, `successfulRequests = 1`, `failedRequests = 0`, `providerAttempts = 1`, `retries = 0`, `keyAttempts = 1`.
- 1 request thử qua 3 keys (key1 fail, key2 fail, key3 success): `logicalRequests = 1`, `successfulRequests = 1`, `failedRequests = 0`, `providerAttempts = 3`, `retries = 2`, `providerFailures = 2`.

**Acceptance Scenarios**:
1. **Scenario 1.1 (1 Request / 1 Attempt)**: **Given** 1 yêu cầu dịch, **When** thành công ở attempt đầu, **Then** `logicalRequests = 1, successfulRequests = 1, providerAttempts = 1, retries = 0`.
2. **Scenario 1.2 (1 Request / 3 Attempts)**: **Given** 1 yêu cầu dịch cần retry qua 3 keys, **When** key thứ 3 thành công, **Then** `logicalRequests = 1, successfulRequests = 1, providerAttempts = 3, retries = 2, providerFailures = 2`.
3. **Scenario 1.3 (Multiple Logical Requests)**: **Given** 5 yêu cầu dịch (3 thành công, 2 thất bại), **When** hoàn tất, **Then** `logicalRequests = 5, successfulRequests = 3, failedRequests = 2`.
4. **Scenario 1.4 (All Retries Fail)**: **Given** 1 yêu cầu dịch thử $N$ keys và toàn bộ đều fail, **When** kết thúc, **Then** `logicalRequests = 1, successfulRequests = 0, failedRequests = 1, providerAttempts = N, retries = N - 1, providerFailures = N`.

---

### User Story 2 - Tầng Tương Thích Ngược & Đánh Dấu Deprecated (Backward Compatibility Layer) (Priority: P1) 🎯 MVP

Để không gây ra bất kỳ sự cố phá vỡ nào (Zero Breaking Changes) cho các giao diện Client hoặc API Consumers hiện hữu:
1. Các trường cũ như `requestsTotal`, `requestsToday`, `requestsThisMinute`, `providerAttemptsTotal` vẫn được trả về trong API payload snapshot nhưng được ánh xạ (alias/getter) chuẩn xác từ canonical metrics.
2. Các trường di sản trong `shared/models.ts` được đánh dấu rõ ràng bằng JSDoc `@deprecated`.
3. Di chuyển toàn bộ các component tiêu thụ số liệu (như `ApiSettings.tsx`, `QuotaPanelMetrics.test.ts`, `quotaController.ts`) sang sử dụng tên trường chuẩn tắc mới.

**Why this priority**: Bảo đảm tính liền mạch tuyệt đối khi nâng cấp hệ thống (Smooth migration & backward compatibility).

**Independent Test**: Gửi request lấy snapshot từ API `/api/quota/snapshot` $\to$ Nhận đủ cả trường chuẩn tắc mới lẫn trường alias cũ với giá trị số liệu đồng nhất 100%.

**Acceptance Scenarios**:
1. **Scenario 2.1 (API Compatibility)**: **Given** client gọi API snapshot, **When** đọc response, **Then** các trường cũ (`requestsTotal`) và mới (`keyAttempts`) đồng nhất giá trị.
2. **Scenario 2.2 (Deprecation Annotations)**: **Given** mã nguồn TypeScript, **When** kiểm tra kiểu dữ liệu, **Then** các trường cũ đều có cảnh báo `@deprecated`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI chuẩn hóa ngữ nghĩa của 3 tầng metrics:
  - **Logical**: `logicalRequests`, `successfulRequests`, `failedRequests`.
  - **Provider**: `providerAttempts`, `retries`, `providerFailures`.
  - **Key Activity**: `keyAttempts`, `keyFailures`, `keyCooldowns`.
- **FR-002**: Không được để 2 trường mang cùng một ngữ nghĩa tồn tại độc lập với dữ liệu lệch nhau (**Zero Semantic Overlap Invariant**).
- **FR-003**: Cấu trúc `KeyQuotaSnapshot` và `KeyObservedAttempts` PHẢI sử dụng canonical metric fields:
  ```typescript
  export interface KeyActivityMetrics {
    keyAttempts: number;
    keyFailures: number;
    keyCooldowns: number;
  }
  ```
- **FR-004**: Cung cấp Compatibility Layer trả về các trường di sản (`requestsTotal`, `requestsToday`, `requestsThisMinute`, `providerAttemptsTotal`, `providerAttemptsToday`, `providerAttemptsThisMinute`) với giá trị ánh xạ trực tiếp từ canonical metrics.
- **FR-005**: Toàn bộ các trường di sản trong `shared/models.ts` PHẢI được đánh dấu JSDoc `@deprecated`.
- **FR-006**: Cập nhật `quotaController.ts` và các API responses trả về đầy đủ canonical metrics kèm compatibility aliases.
- **FR-007**: Đồng bộ hóa toàn bộ các test cases hiện hữu (`logicalMetrics.test.ts`, `quotaService.test.ts`, `quotaAuthority.test.ts`, `QuotaPanelMetrics.test.ts`) sang kiểm tra canonical semantics.
- **FR-008**: Toàn bộ 4 kịch bản kiểm thử bắt buộc (`1 request / 1 attempt`, `1 request / 3 attempts`, `multiple logical requests`, `all retries fail`) PHẢI được cài đặt và pass 100%.
- **FR-009**: Tuyệt đối không làm thay đổi các chức năng cốt lõi khác của QuotaService hoặc GeminiService.
- **FR-010**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`).

---

### Key Entities

- **CanonicalMetricsSnapshot**:
  ```typescript
  export interface CanonicalKeyMetrics {
    keyAttempts: number;
    keyFailures: number;
    keyCooldowns: number;
    /** @deprecated Sử dụng `keyAttempts` thay thế */
    requestsTotal?: number;
    /** @deprecated Sử dụng `keyAttempts` thay thế */
    providerAttemptsTotal?: number;
  }

  export interface CanonicalLogicalMetrics {
    logicalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  }

  export interface CanonicalProviderMetrics {
    providerAttempts: number;
    retries: number;
    providerFailures: number;
  }
  ```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các metrics được phân định rành mạch vào 3 tầng: Logical, Provider, Key Activity.
- **SC-002**: 0% xung đột ngữ nghĩa (Semantic Overlap) giữa các trường số liệu.
- **SC-003**: 100% API responses tương thích ngược với Frontend mà không gây breaking change.
- **SC-004**: Toàn bộ 4 ca kiểm thử bắt buộc đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi.

---

## Assumptions

- Các consumers hiện hữu có thể đọc đồng thời cả trường cũ và mới mà không bị lỗi type hoặc crash ứng dụng.

# Feature Specification: Tách Biệt Rõ Ràng Giữa Provider Quota Xác Minh & Gợi Ý Điều Phối (Scheduling Hint / Fallback)

**Feature Branch**: `039-isolate-provider-quota-fallback`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 02 — TÁCH ProviderQuota KHỎI FALLBACK/SCHEDULING HINT. Provider quota chỉ tồn tại khi thực sự biết (verified from provider / metadata). Không có dữ liệu: providerQuota = undefined (không phải fake defaults). Scheduling hint tách riêng: interface SchedulingHint { pacingIntervalMs?: number; source: 'provider' | 'configured' | 'model-fallback' | 'safe-default' }. Mục tiêu: Không một phần code nào được phép hiểu fallback pacing là actual provider quota. Tests: provider quota known, provider quota unknown, configured hint, fallback hint, verified quota update."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phân Biệt Tuyệt Đối Giữa Hạn Mức Nhà Cung Cấp Đã Biết & Chưa Biết (Priority: P1) 🎯 MVP

Khi một nhóm hạn ngạch (QuotaGroup) hoặc API key được khởi tạo nhưng chưa từng thực hiện truy vấn thông tin metadata chính thức từ Google AI Studio / GCP, hệ thống phải công nhận rằng hạn ngạch thực tế từ nhà cung cấp là **chưa xác định** (`providerQuota = undefined`), tuyệt đối không được gán các giá trị mặc định giả định (như 15 RPM, 1M TPM, 1500 RPD) vào đối tượng mang tên `providerQuota`.

**Why this priority**: Đây là nền tảng cốt lõi của tính đúng đắn ngữ nghĩa (Data Semantics). Việc gán nhãn các giá trị phỏng đoán thành "Provider Quota" làm lu mờ ranh giới giữa hạn mức thực tế đã được Google xác nhận và nhịp độ an toàn nội bộ của hệ thống.

**Independent Test**:
- Tạo một QuotaGroup mới không kèm siêu dữ liệu xác thực $\to$ `group.providerQuota` có giá trị `undefined`.
- Khi nạp dữ liệu xác thực chính thức từ API nhà cung cấp $\to$ `group.providerQuota` được gán đầy đủ (`rpm`, `tpm`, `rpd`, `verifiedAt`, `source: "provider"`).

**Acceptance Scenarios**:
1. **Scenario 1.1 (Provider Quota Unknown)**: **Given** một QuotaGroup mới được khởi tạo chưa qua bước kiểm tra metadata từ Google, **When** hệ thống kiểm tra thuộc tính `providerQuota`, **Then** thuộc tính này phải là `undefined` (không chứa các con số 15 RPM hay 1M TPM giả lập).
2. **Scenario 1.2 (Provider Quota Known)**: **Given** một QuotaGroup đã được xác minh thành công qua Google API với hạn mức chính thức (ví dụ: 60 RPM, 2M TPM, 5000 RPD), **When** hệ thống lưu trữ thông tin, **Then** `providerQuota` chứa đúng các giá trị trên với nhãn `source: "provider"` và dấu thời gian `verifiedAt`.

---

### User Story 2 - Phân Tách & Nguồn Gốc Hóa Gợi Ý Điều Phối Pacing (Priority: P1) 🎯 MVP

Khi bộ điều phối tải tính toán khoảng cách an toàn (pacing interval) để gửi yêu cầu, hệ thống phải trích xuất nhịp độ từ đối tượng `SchedulingHint` riêng biệt. Mỗi `SchedulingHint` phải chỉ rõ nguồn gốc quyết định nhịp độ (`source`): `"provider"` (từ hạn mức đã xác minh), `"configured"` (người dùng tự chỉnh), `"model-fallback"` (theo tier của mô hình), hoặc `"safe-default"` (mặc định sàn an toàn).

**Why this priority**: Đảm bảo bộ điều phối (Admission / Pacing Controller) luôn vận hành an toàn dù có hay không có `providerQuota`, đồng thời minh bạch 100% cơ sở tính toán thời gian chờ.

**Independent Test**:
- Kiểm tra một group có cấu hình RPM thủ công (ví dụ: 30 RPM) $\to$ `schedulingHint.source` là `"configured"`, `pacingIntervalMs` tính theo 30 RPM.
- Kiểm tra một group không có cấu hình và không có `providerQuota` $\to$ `schedulingHint.source` là `"model-fallback"`, `pacingIntervalMs` tính theo fallback tier của model.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Configured Hint)**: **Given** người dùng thiết lập cấu hình hạn mức 30 RPM cho nhóm, **When** bộ điều phối tính toán nhịp độ gửi tin, **Then** `schedulingHint` trả về `source: "configured"` và khoảng cách nhịp độ tương ứng (~2223ms).
2. **Scenario 2.2 (Fallback Hint)**: **Given** một nhóm không có cấu hình tùy chỉnh và `providerQuota` là `undefined`, **When** gửi request đến mô hình `gemini-2.5-pro`, **Then** `schedulingHint` trả về `source: "model-fallback"` và nhịp độ mặc định của dòng Pro (6000ms).
3. **Scenario 2.3 (Provider Hint)**: **Given** một nhóm có `providerQuota` đã xác minh là 60 RPM, **When** tính toán nhịp độ, **Then** `schedulingHint` có `source: "provider"` và nhịp độ tương ứng (~1112ms).

---

### User Story 3 - Cập Nhật Động Hạn Mức Xác Minh Không Ảnh Hưởng Cấu Hình Người Dùng (Priority: P2)

Khi hệ thống thực hiện xác minh trực tiếp với Google Gemini API và nhận được thông tin hạn ngạch thực tế mới, hệ thống tự động cập nhật `providerQuota` của QuotaGroup mà không ghi đè lên các giá trị tùy chỉnh `configuredLimits` do người dùng đã thiết lập từ trước.

**Why this priority**: Bảo vệ quyền kiểm soát của người dùng; nếu người dùng cố tình giới hạn thấp hơn để tiết kiệm hoặc kiểm soát chi phí, hệ thống phải ưu tiên `configuredLimits` trong khi vẫn lưu giữ đúng thông số kỹ thuật thực tế tại `providerQuota`.

**Independent Test**:
- Đặt cấu hình người dùng `configuredRpm = 10` cho nhóm có `providerQuota = 60 RPM` $\to$ `schedulingHint` tuân theo 10 RPM (`source: "configured"`), `providerQuota` vẫn lưu 60 RPM (`source: "provider"`).

**Acceptance Scenarios**:
1. **Scenario 3.1 (Verified Quota Update)**: **Given** một nhóm đang có `providerQuota = undefined`, **When** tiến trình xác minh model hoàn tất với kết quả xác thực hạn mức mới, **Then** `providerQuota` được cập nhật chính xác và `schedulingHint` được tái tính toán phù hợp.
2. **Scenario 3.2 (User Configuration Precedence)**: **Given** người dùng đã tự đặt `configuredRpm`, **When** `providerQuota` được cập nhật, **Then** `schedulingHint` vẫn tôn trọng `configuredRpm` của người dùng.

---

### User Story 4 - Đồng Bộ & Minh Bạch Hóa Nguồn Gốc Hạn Mức Trên Giao Diện Người Dùng (Priority: P2)

Giao diện Quota Panel phải phân biệt rõ ràng cho người dùng biết con số hiển thị là: Hạn mức chính thức từ nhà cung cấp (Đã xác minh), Giới hạn người dùng tự đặt, hay Nhịp độ an toàn phỏng đoán (Fallback).

**Why this priority**: Tránh gây hiểu nhầm cho người dùng rằng hệ thống đã "đọc" được hạn mức thực của tài khoản Google khi thực tế chỉ đang chạy theo chế độ phòng ngừa an toàn mặc định.

**Independent Test**:
- Xem QuotaPanel khi `providerQuota = undefined` $\to$ hiển thị nhãn "Nhịp độ an toàn dự phòng (Chưa xác minh từ Google)".
- Xem QuotaPanel khi `providerQuota` có dữ liệu $\to$ hiển thị nhãn "Hạn mức chính thức từ Google (Đã xác minh lúc ...)".

**Acceptance Scenarios**:
1. **Scenario 4.1 (UI Unverified Display)**: **Given** một nhóm chưa có `providerQuota`, **When** mở QuotaPanel, **Then** giao diện hiển thị nhãn rõ ràng "Chưa xác minh hạn mức - Đang chạy nhịp độ an toàn".
2. **Scenario 4.2 (UI Verified Display)**: **Given** một nhóm đã có `providerQuota`, **When** mở QuotaPanel, **Then** giao diện hiển thị hạn mức chính xác kèm ngày giờ xác minh.

---

### Edge Cases

- **Mạng mất kết nối / Lỗi xác minh**: Nếu quá trình gọi API tra cứu hạn mức thất bại, `providerQuota` vẫn giữ nguyên là `undefined` (không tự ý điền số giả), `schedulingHint` tự động lùi về `"model-fallback"` hoặc `"safe-default"`.
- **Cấu hình tùy chỉnh bị xóa / đặt về 0**: Khi người dùng xóa giới hạn tùy chỉnh, hệ thống chuyển quyền ưu tiên: nếu có `providerQuota` thì dùng `source: "provider"`, nếu không thì dùng `source: "model-fallback"`.
- **Hạn ngạch nhà cung cấp chỉ trả về một phần thông tin** (ví dụ chỉ có RPM, không có RPD): `providerQuota` chỉ lưu các trường có giá trị xác thực (`rpm: 60`, `rpd: undefined`); `schedulingHint` kết hợp linh hoạt các nguồn theo từng tiêu chí.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống TUYỆT ĐỐI KHÔNG được khởi tạo đối tượng `providerQuota` bằng các giá trị mặc định giả định (15 RPM, 1M TPM, 1500 RPD).
- **FR-002**: Thuộc tính `providerQuota` trong `QuotaGroup` PHẢI mang giá trị `undefined` khi chưa có dữ liệu xác minh chính thức từ nhà cung cấp hoặc siêu dữ liệu đã kiểm định.
- **FR-003**: Khi `providerQuota` tồn tại, nó PHẢI chứa nguồn gốc dữ liệu (`source: "provider"`) và có thể kèm thời điểm xác minh (`verifiedAt`).
- **FR-004**: Hệ thống PHẢI tách riêng hoàn toàn `SchedulingHint` thành một thực thể độc lập với `ProviderQuota`.
- **FR-005**: Đối tượng `SchedulingHint` PHẢI định danh rõ ràng nguồn gốc tính toán nhịp độ (`source`) thông qua một trong các giá trị: `"provider"` | `"configured"` | `"model-fallback"` | `"safe-default"`.
- **FR-006**: Thứ tự ưu tiên để xác định `SchedulingHint` PHẢI tuân thủ: `configured` (nếu người dùng tự đặt) > `provider` (nếu đã có hạn mức xác minh) > `model-fallback` (theo tier của mô hình) > `safe-default` (sàn an toàn 400ms server / 500ms client).
- **FR-007**: Bộ điều phối luồng gọi API (Admission / Pacing) PHẢI chỉ dựa vào `SchedulingHint` và `ConfiguredQuota` để ra quyết định giãn cách request, TUYỆT ĐỐI KHÔNG được coi nhịp độ fallback là hạn mức thực tế của nhà cung cấp.
- **FR-008**: Khi nhận được dữ liệu xác thực mới từ Google AI Studio, hệ thống PHẢI cập nhật `providerQuota` và đồng thời phát tín hiệu tính toán lại `SchedulingHint`.
- **FR-009**: Dữ liệu snapshot trả về cho client qua API `/api/quota-status` PHẢI phản ánh trung thực trạng thái `providerQuota: undefined | ProviderQuota` và `schedulingHint.source`.
- **FR-010**: Giao diện Quota Panel PHẢI hiển thị huy hiệu (Badge) và chú thích phân biệt rõ ràng giữa hạn mức đã xác minh và nhịp độ phỏng đoán an toàn.

---

### Key Entities

- **ProviderQuota**: Đại diện cho hạn ngạch thực tế do Google Cloud / Google AI Studio cấp.
  - `rpm?: number`: Số lượt gọi tối đa mỗi phút theo hợp đồng/tier chính thức.
  - `tpm?: number`: Số token tối đa mỗi phút theo hợp đồng/tier chính thức.
  - `rpd?: number`: Số lượt gọi tối đa mỗi ngày theo hợp đồng/tier chính thức.
  - `verifiedAt?: number | string`: Thời điểm hoàn tất xác minh dữ liệu.
  - `source: "provider"`: Định danh nguồn dữ liệu chính thức.
- **SchedulingHint**: Đại diện cho hướng dẫn điều phối nhịp độ an toàn nội bộ của ứng dụng.
  - `pacingIntervalMs: number`: Khoảng thời gian giãn cách an toàn giữa 2 yêu cầu liên tiếp (ms).
  - `safetyFloorMs: number`: Ngưỡng sàn an toàn tối thiểu (400ms server / 500ms client).
  - `estimatedThroughputRpm: number`: Tốc độ thông lượng ước tính (RPM).
  - `source: "provider" | "configured" | "model-fallback" | "safe-default"`: Nguồn gốc tạo ra gợi ý điều phối.
- **ConfiguredQuota**: Đại diện cho cấu hình do người dùng chủ động chỉ định.
  - `configuredRpm?: number`
  - `configuredTpm?: number`
  - `configuredRpd?: number`
  - `customPacingFloorMs?: number`
- **QuotaGroup**: Cụm dự án quản lý hạn ngạch chung.
  - `id: string`
  - `providerQuota?: ProviderQuota` *(có thể `undefined`)*
  - `configuredLimits: ConfiguredQuota`
  - `schedulingHint: SchedulingHint`
  - `observedUsage: GroupObservedUsage`

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các nhóm QuotaGroup mới khởi tạo không có dữ liệu xác minh đều có `providerQuota === undefined`, không có bất kỳ giá trị mặc định giả định nào tồn tại trong `providerQuota`.
- **SC-002**: 100% các gợi ý điều phối `SchedulingHint` được gắn thẻ nguồn gốc `source` chính xác (`provider`, `configured`, `model-fallback`, hoặc `safe-default`).
- **SC-003**: 5 kịch bản kiểm thử bắt buộc (Provider quota known, Provider quota unknown, Configured hint, Fallback hint, Verified quota update) đạt tỉ lệ pass 100%.
- **SC-004**: Người dùng có thể nhận biết ngay lập tức trên giao diện Quota Panel xem hạn mức đang hiển thị là chính thức từ Google hay nhịp độ an toàn nội bộ với tỉ lệ rõ ràng 100%.
- **SC-005**: Toàn bộ hệ thống vượt qua các Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi cảnh báo và 0 suy giảm hiệu năng.

---

## Assumptions

- Mặc định khi người dùng thêm API key mới vào hệ thống mà chưa chạy kiểm tra "Tra cứu mô hình" hoặc "Xác minh mô hình", hệ thống coi như chưa biết `providerQuota` của key/group đó.
- Các mô hình trong danh sách Preset (ví dụ `gemini-2.5-flash`, `gemini-2.5-pro`) có các thông số tier phỏng đoán trong Model Registry; những thông số này được sử dụng làm `model-fallback` cho `SchedulingHint`, không được phép ghi đè vào `providerQuota`.
- Khi người dùng cấu hình RPM tùy chỉnh (`configuredRpm`), hệ thống ưu tiên tính toán `SchedulingHint` từ cấu hình này để đảm bảo người dùng có toàn quyền kiểm soát tốc độ dịch thuật.

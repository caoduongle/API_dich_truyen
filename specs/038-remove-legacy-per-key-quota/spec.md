# Feature Specification: Loại bỏ Legacy Per-Key Quota Ownership & Chuẩn hóa Kiến trúc Quota Group Authority

**Feature Branch**: `038-remove-legacy-per-key-quota`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: Phê duyệt kiến trúc 5 tầng chuẩn hóa (Model Registry → Admission/Request → Quota Group/Project → API Key Health Pool → Gemini Execution), áp dụng 3 quy tắc bắt buộc (API key ≠ quota bucket, Provider attempt ≠ logical request, Pacing ≠ HTTP rate limit), và thực thi Task 01: Loại bỏ hoàn toàn legacy per-key quota ownership (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `calculateKeyScore()`), chuyển toàn bộ quyền sở hữu hạn mức (RPM/TPM/RPD) về Quota Group / Project, đồng thời giữ API key thuần túy là pool tài nguyên sức khỏe (health, auth state, cooldown, lastUsedAt).

---

## 3 Quy tắc Kiến trúc Bắt buộc *(Core Invariants)*

1. **API Key ≠ Quota Bucket**: Hạn ngạch nhà cung cấp (RPM, TPM, RPD) thuộc về cấp độ Dự án / Google Cloud Project (`QuotaGroup`), không thuộc về từng API key riêng lẻ. Việc thêm nhiều key cùng dự án chỉ tăng tính sẵn sàng (redundancy/health pooling), tuyệt đối không nhân ảo hạn ngạch của hệ thống.
2. **Provider Attempt ≠ Logical Request**: Một yêu cầu dịch logic của người dùng có thể thực hiện nhiều lượt gọi provider (do xoay key, thử lại hoặc phân giải lỗi). Các tầng đo lường và ghi nhận quota phải tách bạch rõ ràng giữa hai khái niệm này.
3. **Pacing ≠ HTTP Rate Limit**: Khoảng cách an toàn giữa các lượt gửi (pacing / safety interval) là cơ chế chủ động ngăn ngừa quá tải, độc lập với việc bị chặn lỗi 429 từ phía nhà cung cấp.

---

## Sơ đồ Luồng Kiến trúc Chuẩn hóa

```
┌────────────────────────────────────────────────────────┐
│                   Model Registry                       │
│  - Vòng đời: Active, Deprecated, Shutdown              │
│  - Năng lực: generateContent, structuredOutput, vision │
│  - Xác minh: Verified / Unverified (Singleflight)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Admission / Request                    │
│  - Validation, Token estimation, Request routing       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                Quota Group / Project                   │
│  - Sở hữu hạn mức: Provider Quota (RPM / TPM / RPD)    │
│  - Thực thi điều phối: Observed Usage, Sliding Window  │
│  - Gợi ý điều phối: Scheduling Hint, Pacing Floor      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 API Key Health Pool                    │
│  - Máy trạng thái: Healthy, Degraded, Cooldown,        │
│    AuthFailed, Disabled                                │
│  - Sức khỏe độc lập: Circuit Breaker, LastUsedAt       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Gemini Execution                     │
│  - Phân loại lỗi chuẩn hóa: Upstream Error Taxonomy    │
│  - Quản lý thử lại có điều kiện: Smart Retry & Pacing  │
│  - Thực thi gọi nhà cung cấp: Provider Dispatcher      │
└────────────────────────────────────────────────────────┘
```

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tập trung Hạn ngạch theo Quota Group / Dự án (Priority: P1) 🎯 MVP

Là hệ thống quản trị hạn mức và điều phối tải,  
Tôi muốn toàn bộ định nghĩa hạn ngạch (RPM, TPM, RPD) thuộc quyền sở hữu của `QuotaGroup` (đại diện cho một Google Cloud Project) thay vì gắn độc lập vào từng API Key,  
Để phản ánh chính xác mô hình hạn ngạch của nhà cung cấp, ngăn chặn việc tính toán nhân ảo hạn mức khi người dùng thêm nhiều key cùng một dự án.

**Why this priority**: Đây là nền tảng cốt lõi của nguyên tắc "API key ≠ quota bucket". Nếu còn giữ logic per-key quota, hệ thống sẽ gửi dồn dập vượt ngưỡng thật của provider và bị lỗi 429 hàng loạt.

**Independent Test**:
- Cấu hình Dự án A chứa 2 API Keys (`Key A1`, `Key A2`) với hạn mức nhóm là 15 RPM. Gửi liên tiếp các yêu cầu dịch thuật $\to$ Hệ thống điều phối chung trên hạn mức 15 RPM của Nhóm A, không cho phép vượt quá 15 requests/phút trên toàn bộ các key của dự án A.

**Acceptance Scenarios**:
1. **Given** 2 API Keys thuộc cùng một Project A với hạn mức 15 RPM, **When** gửi 15 requests trong vòng 60 giây, **Then** QuotaGroup của Project A chuyển sang trạng thái bão hòa hạn mức phút (RateLimited/Pacing wait), và không một key nào trong nhóm được bắn thêm request trước khi sliding window mở lại.
2. **Given** Project A (chứa Key A1, Key A2) và Project B (chứa Key B1) có QuotaGroup riêng biệt, **When** Project A chạm ngưỡng cạn kiệt hạn mức (Quota Exhaustion), **Then** Project B vẫn hoàn toàn khả dụng và tiếp tục xử lý các yêu cầu bình thường.

---

### User Story 2 - Cách ly Trạng thái Sức khỏe API Key (Priority: P1) 🎯 MVP

Là bộ điều phối tài nguyên (Key Health Dispatcher),  
Tôi muốn API Key chỉ đóng vai trò là một điểm kết nối trong Health Pool với các trạng thái (`Healthy`, `Degraded`, `Cooldown`, `AuthFailed`, `Disabled`),  
Để khi một key gặp sự cố xác thực (401/403 Invalid API Key) hoặc tạm thời bị Cooldown, chỉ riêng key đó bị cách ly mà nhóm QuotaGroup vẫn tiếp tục hoạt động thông qua các key khỏe mạnh còn lại.

**Why this priority**: Đảm bảo tính sẵn sàng cao (High Availability). Sự cố của một key đơn lẻ không được phép làm gián đoạn toàn bộ dự án nếu vẫn còn các key khác hoạt động tốt.

**Independent Test**:
- Thiết lập Project A với 2 keys. Giả lập `Key A1` trả về lỗi 401 Auth Failed $\to$ `Key A1` bị đánh dấu `AuthFailed`, `Key A2` vẫn được chọn để thực thi và request hoàn thành thành công mà không làm sập Quota Group.

**Acceptance Scenarios**:
1. **Given** QuotaGroup A có 2 keys (`Key A1` và `Key A2`), **When** `Key A1` gặp lỗi xác thực `AUTH_FAILED` (401/403), **Then** hệ thống chuyển trạng thái `Key A1` thành `AuthFailed`, ghi nhận lý do và tự động định tuyến toàn bộ request tiếp theo sang `Key A2` mà QuotaGroup A vẫn ở trạng thái `Available`.
2. **Given** QuotaGroup A có 2 keys, **When** `Key A1` bị rơi vào `Cooldown` tạm thời (ví dụ do lỗi mạng cục bộ hoặc 503), **Then** `Key A2` lập tức tiếp quản các request tiếp theo trong khi `Key A1` chờ hết thời gian Cooldown TTL.
3. **Given** toàn bộ các key trong QuotaGroup A đều ở trạng thái `AuthFailed` hoặc `Disabled`, **When** có yêu cầu cần xử lý qua nhóm này, **Then** QuotaGroup A chuyển sang trạng thái `NoHealthyKeys` và scheduler từ chối với lý do rõ ràng trước khi gửi lệnh ra ngoài.

---

### User Story 3 - Loại bỏ Triệt để Legacy Per-Key Scoring & Di trú Dữ liệu Cũ (Priority: P2)

Là nhà phát triển và người bảo trì hệ thống,  
Tôi muốn loại bỏ toàn bộ các trường dữ liệu và phương thức tính toán per-key quota cũ (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `calculateKeyScore()`), đồng thời chuyển đổi các cấu hình nhập liệu cũ trên giao diện thành Quota Group Setting hoặc Scheduling Hint,  
Để mã nguồn sạch sẽ, thống nhất theo một mô hình phân cấp duy nhất và không làm mất các tùy chỉnh trước đó của người dùng.

**Why this priority**: Loại bỏ nợ kỹ thuật (technical debt), tránh tình trạng logic nửa nọ nửa kia (chỗ tính theo Group, chỗ tính theo Key) gây sai lệch số liệu và khó khăn cho việc bảo trì.

**Independent Test**:
- Chạy toàn bộ test suite và static type checker: 0 lời gọi tới `calculateKeyScore` hoặc các tham số `perKeyRpm`, mọi đánh giá điều phối đi qua `evaluateQuotaGroups` và `selectBestKeyInGroup`.
- Nạp cấu hình từ phiên bản cũ chứa `maxRpm` từng key $\to$ tự động ánh xạ thành cấu hình hạn mức của Quota Group tương ứng mà không bị crash.

**Acceptance Scenarios**:
1. **Given** dữ liệu cấu hình cũ lưu trữ trong LocalStorage với các trường `maxRpm`, `maxTpm`, `maxRpd` theo từng key, **When** ứng dụng khởi chạy, **Then** hệ thống đọc và di chuyển các giá trị này thành `configuredLimits` của QuotaGroup sở hữu key đó một cách trong suốt.
2. **Given** luồng gọi `generateWithRotation`, **When** bộ điều phối tìm kiếm key để thực thi, **Then** scheduler chấm điểm và lựa chọn Quota Group trước (`evaluateQuotaGroups`), sau đó chọn key khỏe mạnh nhất trong group (`selectBestKeyInGroup`), loại bỏ hoàn toàn việc chấm điểm per-key độc lập.

---

### User Story 4 - Đồng bộ Giao diện Quota Panel theo Mô hình Phân cấp Mới (Priority: P2)

Là người dùng thao tác trên giao diện,  
Tôi muốn Quota Panel hiển thị rõ ràng cấu trúc phân cấp: Nhóm Hạn mức Dự án (sở hữu RPM/TPM/RPD) $\to$ Danh sách API Key thành viên (hiển thị trạng thái sức khỏe, số lượt thử, lỗi),  
Để tôi hiểu đúng cách phân bổ hạn ngạch của Google AI Studio và không bị hiểu lầm rằng cứ thêm key là nhân gấp đôi tốc độ dịch.

**Why this priority**: Mang lại sự minh bạch cho người dùng cuối, đồng bộ giao diện người dùng với kiến trúc thực tế bên dưới.

**Independent Test**:
- Mở QuotaPanel với 2 API Keys thuộc 1 dự án $\to$ giao diện hiển thị 1 hộp QuotaGroup duy nhất chứa thanh tiến độ RPM/TPM/RPD tổng, bên dưới là danh sách 2 keys với nhãn sức khỏe (Hoạt động, Tạm dừng, Lỗi xác thực).

**Acceptance Scenarios**:
1. **Given** người dùng cấu hình nhiều API Keys, **When** mở Quota Panel, **Then** màn hình hiển thị trực quan Quota Group với thông tin hạn mức (Provider Quota / Configured Limits), nhịp độ điều phối (Pacing interval), và danh sách trạng thái của từng key trực thuộc.
2. **Given** người dùng muốn tùy chỉnh nhịp độ, **When** nhập thông số trong phần cấu hình hạn mức, **Then** giao diện giải thích rõ đây là giới hạn của Nhóm Quota / Gợi ý điều phối (Scheduling Hint), không phải hạn ngạch riêng của từng khóa.

---

## Edge Cases

- **Tất cả các key trong một Quota Group đều AuthFailed**: Hệ thống phải đánh dấu Quota Group là `NoHealthyKeys`, không tiếp tục gửi request thử vô ích, ghi nhận log và thông báo lỗi rõ ràng cho người dùng.
- **Quota Group cạn kiệt hạn mức ngày (RPD)**: Toàn bộ Quota Group chuyển sang `Exhausted` cho đến chu kỳ làm mới lúc 00:00 PST (Múi giờ Thái Bình Dương), không thử xoay vòng qua các key khác trong cùng group đó vì đều chia sẻ chung một bucket ngày.
- **Nhận lỗi 429 Rate Limited từ nhà cung cấp**: Toàn bộ Quota Group phải được kích hoạt Cooldown TTL (dựa trên header `retry-after` hoặc mặc định an toàn), tạm dừng toàn bộ key trong group đó và chuyển sang Quota Group khác (nếu có).
- **Key không khai báo Project ID**: Tự động gán vào một QuotaGroup mặc định an toàn với định danh suy diễn từ key hash để đảm bảo không key nào nằm ngoài sự quản lý của hệ thống Quota Group.
- **Xung đột cấu hình cũ**: Nếu người dùng trước đó cấu hình nhiều key cùng group nhưng nhập các giá trị `maxRpm` khác nhau, hệ thống ưu tiên lấy giá trị an toàn nhất (nhỏ nhất) hoặc giá trị của key đầu tiên và hợp nhất vào QuotaGroup.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Loại bỏ Legacy Per-Key Quota Properties)**: Hệ thống PHẢI loại bỏ hoàn toàn các trường dữ liệu mang tính giả định quota per-key khỏi các kiểu dữ liệu và model (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `independentProviderRpm/Tpm/Rpd`).
- **FR-002 (Loại bỏ Legacy Per-Key Scoring Method)**: Hệ thống PHẢI loại bỏ hàm `calculateKeyScore()` cũ và chuyển toàn bộ việc đánh giá độ ưu tiên sang quy trình 2 bước: Đánh giá Quota Group (`evaluateQuotaGroups`) $\to$ Chọn API Key khỏe mạnh trong Group (`selectBestKeyInGroup`).
- **FR-003 (Sở hữu Hạn mức Độc quyền tại QuotaGroup)**: Hạn mức RPM (Requests Per Minute), TPM (Tokens Per Minute), RPD (Requests Per Day) và cơ chế Sliding Window 60s PHẢI được quản lý và ghi nhận độc quyền tại thực thể `QuotaGroup`.
- **FR-004 (Health State Machine cho API Key)**: Mỗi API Key PHẢI duy trì một máy trạng thái sức khỏe độc lập gồm các trạng thái: `Healthy`, `Degraded`, `Cooldown`, `AuthFailed`, `Disabled`, kèm `consecutiveErrors`, `consecutiveSuccesses`, `cooldownUntilMs`, và `lastUsedAtMs`.
- **FR-005 (Cách ly Lỗi Xác thực Cấp độ Key)**: Khi một API Key trả về lỗi 401 hoặc 403 (`AUTH_FAILED`), hệ thống CHỈ chuyển trạng thái của riêng key đó sang `AuthFailed` và tiếp tục sử dụng các key `Healthy` khác trong cùng QuotaGroup.
- **FR-006 (Phản ứng Toàn nhóm khi Chạm Hạn mức 429)**: Khi nhận lỗi 429 (`RATE_LIMITED` hoặc `QUOTA_EXCEEDED`), hệ thống PHẢI kích hoạt Cooldown cho toàn bộ `QuotaGroup`, ngăn chặn việc bắn tiếp các key khác trong cùng một dự án.
- **FR-007 (Phục hồi Hạn ngạch Ngày theo Chu kỳ PST)**: Hệ thống PHẢI tự động làm mới bộ đếm sử dụng ngày (`requestsToday`, `tokensToday`) và phục hồi trạng thái `Exhausted` của QuotaGroup khi bước sang ngày mới theo múi giờ `America/Los_Angeles` (PST/PDT).
- **FR-008 (Di trú Cấu hình Cũ Trong suốt)**: Hệ thống PHẢI có cơ chế tự động chuyển đổi cấu hình người dùng cũ từ LocalStorage (dạng per-key limits) sang cấu hình `configuredLimits` / `schedulingHint` của QuotaGroup mà không gây gián đoạn hoạt động.
- **FR-009 (Đồng bộ Giao diện Quota Panel)**: Giao diện QuotaPanel PHẢI hiển thị cấu trúc cây rõ ràng (Quota Group $\to$ Member Keys), phân định rạch ròi giữa Hạn ngạch Nhóm (Group Quota) và Sức khỏe Khóa (Key Health).
- **FR-010 (Bảo toàn Toàn vẹn Quality Gates)**: Toàn bộ quá trình tái cấu trúc PHẢI vượt qua `npm run lint`, `npm test` (toàn bộ test cases bao gồm các kịch bản test bắt buộc), và `npm run build`.

---

### Key Entities

- **QuotaGroup**: Thực thể đại diện cho một Google Cloud Project / Hạn ngạch hạn mức chung. Chứa thông tin cấu hình (`configuredLimits`), hạn ngạch nhà cung cấp (`providerQuota`), lịch sử sử dụng quan sát được (`observedUsage`), gợi ý điều phối (`schedulingHint`), và danh sách ID các khóa trực thuộc (`keyIds`).
- **ApiKeyEntity / KeyHealthState**: Thực thể phản ánh trạng thái sức khỏe và điểm kết nối của một API key trong hệ thống. Chỉ lưu trữ: `healthState`, `circuitBreaker`, `cooldownUntilMs`, `lastUsedAtMs`, `transitionReason`, và thống kê số lượt gọi/lỗi quan sát được (`observedAttempts`).
- **GroupSchedulingHint**: Thông số điều phối an toàn được suy diễn từ hạn mức của nhóm, bao gồm khoảng cách an toàn giữa các request (`effectiveIntervalMs`), ngưỡng sàn bảo vệ (`safetyFloorMs`), và thông lượng ước tính (`estimatedThroughputRpm`).
- **GroupScoreResult**: Kết quả đánh giá và xếp hạng mức độ ưu tiên của một Quota Group tại thời điểm yêu cầu, bao gồm tính khả dụng (`isEligible`), điểm tổng hợp (`score`), và lý do từ chối nếu không khả dụng (`rejectReason`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Loại bỏ 100% các tham chiếu và thuộc tính legacy per-key quota (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `calculateKeyScore`) khỏi toàn bộ codebase (`server/`, `src/`, `shared/`).
- **SC-002**: 100% các API Key thuộc cùng một dự án chia sẻ chính xác một Quota Bucket chung, không xảy ra hiện tượng nhân ảo RPM khi thêm key.
- **SC-003**: 100% các trường hợp lỗi 401/403 trên một key được cô lập an toàn, giữ cho QuotaGroup tiếp tục hoạt động bình thường nếu còn ít nhất 1 key khỏe mạnh.
- **SC-004**: 100% pass toàn bộ Quality Gates bắt buộc (`npm run lint` sạch 0 lỗi, `npm test` pass 100% các bộ unit test bao gồm 6 kịch bản kiểm thử bắt buộc, `npm run build` thành công).
- **SC-005**: 100% dữ liệu cấu hình hạn mức cũ được tự động di trú an toàn sang định dạng QuotaGroup mà không gây mất mát thiết lập của người dùng.

---

## Assumptions

- **Mặc định Provider**: Google Gemini API áp dụng rate limit ở cấp độ Google Cloud Project (hoặc Billing Account), do đó các API Key tạo trong cùng một project chia sẻ chung hạn mức RPM/TPM/RPD.
- **Phân nhóm Mặc định**: Các API Key nếu không được người dùng chỉ định Project ID rõ ràng sẽ được hệ thống gom nhóm an toàn hoặc ánh xạ vào một QuotaGroup riêng biệt dựa trên key hash để đảm bảo tính nhất quán.
- **Múi giờ Reset Ngày**: Chu kỳ reset hạn ngạch ngày của Google AI Studio tuân theo múi giờ PST (`America/Los_Angeles`), bắt đầu làm mới lúc 00:00 PST.
- **Không thay đổi Schema Cơ sở dữ liệu Dự án Dịch**: Việc tái cấu trúc Quota Group và Key Health Pool chỉ diễn ra trong phạm vi bộ nhớ in-memory / cache và giao diện cấu hình, không ảnh hưởng đến schema dữ liệu truyện/chương trong IndexedDB (`src/services/db.ts`).

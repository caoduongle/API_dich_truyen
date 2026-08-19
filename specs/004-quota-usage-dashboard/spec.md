# Feature Specification: Quota & Usage Tracking Dashboard

**Feature Branch**: `004-quota-usage-dashboard`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Áp dụng và kiểm tra toàn bộ tính năng 'Quota & Usage Tracking Dashboard' từ file patch vào codebase hiện tại của dự án: Quản lý in-memory usage tracking, chuẩn hóa múi giờ America/Los_Angeles cho reset RPD hàng ngày, băm SHA-256 và che mờ API key (maskApiKey), tra cứu danh sách model khả dụng qua upstream với cache 10 phút và timeout 15s, ghi nhận quota attempt trên các nhánh kết quả, endpoint quota status và models-for-key, apiClient helpers, giao diện QuotaPanel tab switcher trong ApiSettings chuẩn phong cách Mực & Chu Sa, và test suite Vitest toàn diện."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Giám sát mức sử dụng và hạn ngạch API Key theo thời gian thực (Priority: P1) 🎯 MVP

Là người dịch tiểu thuyết và quản trị viên hệ thống, tôi muốn theo dõi chính xác số lượng yêu cầu (tổng số, trong ngày hôm nay, trong phút hiện tại, và số lần lỗi) của từng khóa API để chủ động kiểm soát chi phí, tránh bị vượt ngưỡng giới hạn của nhà cung cấp dịch vụ AI, mà không làm lộ khóa bí mật trên màn hình hay trong nhật ký truyền thông.

**Why this priority**: Khi dịch truyện số lượng lớn với cơ chế xoay vòng nhiều khóa, việc nắm bắt mức tiêu thụ thực tế (RPM, RPD) là điều kiện tiên quyết để phân bổ tải hợp lý và ngăn ngừa gián đoạn quy trình dịch.

**Independent Test**:
1. Thêm một hoặc nhiều khóa API vào hệ thống, thực hiện một số tác vụ dịch thuật.
2. Mở bảng điều khiển Quota, xác nhận mỗi khóa hiển thị định dạng che mờ an toàn (ví dụ: `AIzaSy...4xQ`) kèm chỉ số sử dụng: Tổng số request, số request trong ngày (tính theo múi giờ Google `America/Los_Angeles`), số request trong phút hiện tại, và số lỗi.
3. Kích hoạt giả lập chuyển ngày theo múi giờ `America/Los_Angeles`, xác nhận chỉ số request trong ngày tự động làm mới về 0.

**Acceptance Scenarios**:

1. **Given** một danh sách các khóa API đang hoạt động trong hệ thống, **When** người dùng yêu cầu xem trạng thái hạn ngạch, **Then** hệ thống trả về bảng tóm tắt mức sử dụng với các khóa được che mờ (masking), không để lộ toàn bộ chuỗi ký tự khóa gốc.
2. **Given** một yêu cầu xử lý dịch thuật hoặc thao tác AI được thực hiện, **When** yêu cầu hoàn tất (thành công hoặc thất bại theo từng loại lỗi), **Then** bộ đếm tương ứng (tổng request, request theo ngày, request theo phút, lỗi) của khóa API đó được cập nhật ngay lập tức.
3. **Given** thời điểm chuyển giao sang ngày mới tính theo múi giờ Thái Bình Dương (`America/Los_Angeles`), **When** hệ thống kiểm tra chỉ số sử dụng hàng ngày, **Then** chỉ số `requestsToday` của tất cả các khóa được tự động đặt lại về 0 mà không cần khởi động lại máy chủ.

---

### User Story 2 - Theo dõi trạng thái ngắt mạch bảo vệ và đếm ngược thời gian phục hồi (Priority: P1) 🎯 MVP

Là người dùng dịch truyện, tôi muốn biết ngay khóa API nào đang bị tạm ngắt bảo vệ (Circuit Breaker Cooldown) do lỗi quá tải (503) hoặc vượt hạn ngạch (429), kèm theo đồng hồ đếm ngược thời gian còn lại trước khi khóa được tự động mở lại để tiếp tục sử dụng.

**Why this priority**: Giúp người dùng hiểu rõ tại sao một khóa bị bỏ qua trong vòng xoay, biết chính xác thời điểm khóa sẵn sàng trở lại thay vì tưởng nhầm hệ thống bị lỗi đứng hình.

**Independent Test**:
1. Giả lập một khóa API gặp lỗi 429 hoặc quá tải khiến cơ chế ngắt mạch kích hoạt.
2. Mở tab Quota trên giao diện, kiểm tra khóa đó có nhãn trạng thái cảnh báo và đồng hồ đếm ngược hiển thị số giây/phút còn lại.
3. Chờ đồng hồ đếm ngược về 0 (hoặc tua nhanh thời gian), xác minh trạng thái của khóa tự động chuyển về trạng thái sẵn sàng (Active/Ready).

**Acceptance Scenarios**:

1. **Given** một khóa API bị rơi vào trạng thái cooldown do gặp lỗi hạn ngạch hoặc lỗi hệ thống, **When** người dùng mở bảng theo dõi Quota, **Then** khóa đó được đánh dấu trạng thái đặc biệt kèm mốc thời gian hết hạn cooldown.
2. **Given** khóa đang trong thời gian cooldown, **When** người dùng quan sát trên giao diện, **Then** đồng hồ đếm ngược tự động giảm từng giây và tự cập nhật giao diện khi thời gian hết hạn.
3. **Given** thời gian cooldown kết thúc, **When** lượt quay vòng tiếp theo diễn ra, **Then** khóa được tái kích hoạt tham gia xử lý yêu cầu bình thường.

---

### User Story 3 - Kiểm tra danh sách mô hình AI khả dụng cho từng khóa API (Priority: P2)

Là người dịch, tôi muốn kiểm tra trực tiếp xem từng khóa API của mình có quyền truy cập những mô hình AI nào (Gemini 2.5 Flash, Gemini 2.5 Pro, v.v.) và mô hình nào thực sự hỗ trợ phương thức tạo nội dung (`generateContent`), nhằm lựa chọn mô hình phù hợp nhất cho từng dự án.

**Why this priority**: Một số tài khoản hoặc khóa API có thể bị hạn chế quyền truy cập với một số model đặc thù; việc tra cứu trực tiếp giúp phát hiện sớm xung đột cấu hình.

**Independent Test**:
1. Nhấn nút kiểm tra mô hình khả dụng cho một khóa API cụ thể trên giao diện.
2. Hệ thống gửi yêu cầu kiểm tra tới dịch vụ cung cấp AI và hiển thị danh sách các mô hình được hỗ trợ sinh văn bản.
3. Nhấn kiểm tra lại trong vòng 10 phút, xác nhận hệ thống trả về kết quả nhanh chóng từ bộ nhớ đệm (cache) mà không cần gọi lại upstream.
4. Giả lập mạng chậm quá 15 giây, xác nhận hệ thống tự ngắt an toàn và thông báo lỗi rõ ràng.

**Acceptance Scenarios**:

1. **Given** người dùng chọn kiểm tra một khóa API, **When** hệ thống truy vấn danh mục mô hình từ nhà cung cấp, **Then** chỉ các mô hình có hỗ trợ phương thức tạo nội dung (`generateContent`) mới được tổng hợp và hiển thị.
2. **Given** danh sách mô hình của một khóa đã được tra cứu thành công, **When** có yêu cầu kiểm tra lại trong khoảng thời gian hiệu lực 10 phút, **Then** hệ thống trả kết quả từ bộ nhớ đệm mà không phát sinh thêm request lên nhà cung cấp.
3. **Given** yêu cầu kiểm tra mô hình kéo dài vượt quá 15 giây, **When** bộ định thời timeout kích hoạt, **Then** tiến trình bị hủy an toàn và trả về thông báo lỗi timeout dễ hiểu.

---

### User Story 4 - Giao diện Quota Panel đồng bộ phong cách Mực & Chu Sa và cấu hình hạn mức cá nhân (Priority: P2)

Là người dùng, tôi muốn giao diện Quota & Hạn mức được tích hợp gọn gàng thành một tab trong bảng "Cấu hình AI & Bản Thảo", sử dụng đúng ngôn ngữ thiết kế "Mực & Chu Sa" (nền mực, viền giấy da, điểm nhấn chu sa, con dấu triện), đồng thời cho phép tôi tự cấu hình ngưỡng cảnh báo hạn ngạch cá nhân để theo dõi trực quan theo tỷ lệ phần trăm đã dùng.

**Why this priority**: Đảm bảo tính nhất quán của hệ thống thiết kế toàn ứng dụng và trao quyền cho người dùng chủ động đặt ngưỡng an toàn riêng cho các khóa API của mình.

**Independent Test**:
1. Mở modal "Cấu hình AI & Bản Thảo", nhấp chuyển đổi giữa tab "Cấu hình" và tab "Quota & Hạn mức".
2. Kiểm tra các thành phần giao diện: màu sắc (`bg-ink`, `bg-parchment-2`, `text-polish`, `text-text-main`, `text-text-muted`), bo góc, typography, con dấu triện hoặc huy hiệu trạng thái.
3. Nhập ngưỡng hạn ngạch mong muốn (ví dụ 1500 request/ngày), quan sát thanh đo tiến độ hiển thị phần trăm sử dụng trực quan với màu sắc tương ứng.

**Acceptance Scenarios**:

1. **Given** người dùng mở modal cài đặt AI, **When** chuyển sang tab "Quota & Hạn mức", **Then** giao diện hiển thị danh sách các khóa API kèm đầy đủ thông số sử dụng, trạng thái cooldown và bảng điều khiển trực quan.
2. **Given** người dùng cấu hình ngưỡng giới hạn cho khóa, **When** số lượng request tăng lên, **Then** thanh tiến độ phần trăm phản ánh đúng tỷ lệ và đổi màu cảnh báo khi tiến gần tới ngưỡng giới hạn.
3. **Given** giao diện QuotaPanel, **When** hiển thị trên màn hình, **Then** mọi thành phần tuân thủ nghiêm ngặt bảng màu và quy chuẩn thiết kế Mực & Chu Sa, không sử dụng gradient hay màu sắc ngoại lai.

---

### Edge Cases

- **Khóa API mới tinh chưa từng có request**: Hệ thống hiển thị tất cả các bộ đếm ở mức 0 và trạng thái sẵn sàng, không bị lỗi `undefined` hay `NaN`.
- **Nhiều khóa API cùng xử lý đồng thời trong chế độ xoay vòng**: Dữ liệu quota của từng khóa được ghi nhận độc lập và cách ly, không bị cộng dồn nhầm giữa các khóa khác nhau.
- **Xảy ra lỗi mạng hoặc lỗi từ chối dịch vụ từ upstream**: Hệ thống ghi nhận chính xác phân loại lỗi vào bộ đếm `errorsTotal` của đúng khóa API gặp sự cố.
- **Khóa API rỗng hoặc chuỗi khoảng trắng**: Hệ thống tự động lọc bỏ trước khi băm và lưu trữ, ngăn ngừa rác bộ nhớ.
- **Lưu trữ bảo mật**: Mã băm SHA-256 được dùng làm khóa định danh duy nhất trong bộ nhớ máy chủ; chuỗi khóa gốc không bao giờ xuất hiện trong response JSON hay log hệ thống.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI duy trì dịch vụ theo dõi hạn ngạch trong bộ nhớ (in-memory usage tracking) ghi nhận: `requestsTotal`, `requestsToday`, `requestsThisMinute`, `errorsTotal`, và phân tách theo từng định danh mô hình cho mỗi khóa API.
- **FR-002**: Hệ thống PHẢI chuẩn hóa việc xác định ngày mới theo múi giờ chuẩn của nhà cung cấp dịch vụ AI (`America/Los_Angeles`), tự động đặt lại bộ đếm `requestsToday` khi bước sang ngày mới theo múi giờ này.
- **FR-003**: Hệ thống PHẢI sử dụng mã băm an toàn SHA-256 của chuỗi khóa API làm định danh khóa lưu trữ nội bộ và cung cấp hàm che mờ khóa hiển thị (`maskApiKey`, ví dụ: chỉ giữ lại vài ký tự đầu và cuối, thay thế phần giữa bằng `...`).
- **FR-004**: Hệ thống PHẢI cung cấp dịch vụ tra cứu danh sách mô hình (`modelInfoService`) kết nối với API danh mục của nhà cung cấp để lọc ra các mô hình hỗ trợ phương thức tạo nội dung, có cơ chế lưu đệm với thời gian sống (TTL) 10 phút và cơ chế hủy yêu cầu (timeout) sau 15 giây.
- **FR-005**: Hệ thống PHẢI cung cấp các endpoint API chuyên biệt (`/api/quota-status` và `/api/models-for-key`) được bảo vệ bởi middleware giải mã khóa API và xác thực hệ thống.
- **FR-006**: Dịch vụ gọi mô hình AI (`geminiService`) PHẢI ghi nhận kết quả thực thi vào hệ thống theo dõi hạn ngạch trên tất cả các nhánh kết quả: thành công, quá tải (overloaded), vượt hạn ngạch (quota exceeded), chặn an toàn (safety), và các lỗi khác.
- **FR-007**: Dịch vụ gọi mô hình AI PHẢI cung cấp hàm đọc trạng thái thời gian thực (`getKeyRuntimeStatus`) để trả về thông tin trạng thái hoạt động, thời điểm ngắt mạch bảo vệ, và thời gian chờ còn lại của khóa.
- **FR-008**: Thư viện kết nối máy khách (`src/utils/apiClient.ts`) PHẢI cung cấp các kiểu dữ liệu (interfaces) và hàm tiện ích (`fetchQuotaStatus`, `fetchModelsForKey`) để giao tiếp an toàn với các endpoint quota.
- **FR-009**: Giao diện người dùng PHẢI có thành phần `QuotaPanel` hiển thị danh sách khóa, trạng thái hoạt động, đồng hồ đếm ngược cooldown/blacklist, chi tiết mức dùng theo mô hình, và bảng nhập ngưỡng giới hạn người dùng tự cấu hình.
- **FR-010**: Thành phần `ApiSettings` PHẢI tích hợp tab switcher chuyển đổi linh hoạt giữa tab cấu hình cơ bản và tab Quota & Hạn mức mà không làm mất trạng thái dữ liệu đang nhập.

### Key Entities

- **API Key Quota Snapshot**: Bản ghi thống kê mức sử dụng của một khóa gồm chuỗi khóa đã che mờ (`maskedKey`), mã băm định danh (`keyHash`), tổng số yêu cầu, số yêu cầu hôm nay (theo múi giờ Pacific), số yêu cầu trong phút hiện tại, tổng số lỗi, và chi tiết theo từng mô hình.
- **API Key Runtime Status**: Trạng thái vận hành tức thời của khóa bao gồm cờ hoạt động (`isActive`), cờ bị ngắt mạch bảo vệ (`isBlacklisted`), thời điểm hết hạn ngắt mạch (`blacklistExpiryMs`), và thời gian còn lại tính bằng giây.
- **Model Capability Info**: Danh sách mô hình AI hợp lệ hỗ trợ phương thức sinh nội dung kèm thông tin phiên bản và khả năng tương thích.
- **User Quota Preference**: Ngưỡng hạn ngạch tối đa do người dùng tự đặt (RPM tối đa, RPD tối đa) để trực quan hóa tỷ lệ phần trăm đã dùng trên giao diện.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các khóa API gửi lên từ máy khách được định danh an toàn qua mã băm SHA-256 và che mờ hiển thị, không để rò rỉ bất kỳ ký tự khóa nguyên bản nào ra phản hồi API hoặc bảng nhật ký console.
- **SC-002**: Chỉ số sử dụng theo ngày (`requestsToday`) phản ánh chính xác chu kỳ 24 giờ của múi giờ `America/Los_Angeles`, tự động hoàn trả về 0 khi bước qua mốc 00:00 PST/PDT.
- **SC-003**: Khi một khóa rơi vào trạng thái ngắt mạch bảo vệ, giao diện QuotaPanel phản ánh trạng thái cảnh báo và đồng hồ đếm ngược với độ trễ hiển thị dưới 1 giây.
- **SC-004**: Yêu cầu kiểm tra mô hình khả dụng có thời gian phản hồi từ bộ nhớ đệm dưới 10ms khi còn trong thời hạn TTL 10 phút, và tự động hủy sau đúng 15 giây nếu upstream không phản hồi.
- **SC-005**: 100% các nhánh thực thi trong dịch vụ AI (thành công, quá tải, lỗi hạn ngạch, lỗi an toàn, lỗi hệ thống) đều kích hoạt ghi nhận chính xác dữ liệu quota.
- **SC-006**: Toàn bộ các bộ kiểm tra tự động của dự án (`npx tsc --noEmit`, `npx vitest run`, `npm run build`) hoàn thành thành công 100% với 0 lỗi phát sinh.

## Assumptions

- Việc theo dõi hạn ngạch thực hiện trên bộ nhớ máy chủ (in-memory) cho phiên làm việc hiện tại, phù hợp với mô hình triển khai cá nhân/nhóm nhỏ của ứng dụng.
- Múi giờ đặt lại hạn ngạch hàng ngày của Google AI Studio là `America/Los_Angeles` (PST/PDT), do đó mọi tính toán ngày mới cho RPD căn cứ theo múi giờ này.
- Ngưỡng giới hạn cá nhân người dùng thiết lập trên giao diện phục vụ mục đích trực quan hóa cảnh báo màu sắc, không thay thế cho giới hạn cứng từ phía nhà cung cấp dịch vụ AI.

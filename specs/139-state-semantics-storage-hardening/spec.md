# Feature Specification: Gia Cố Ngữ Nghĩa Trạng Thái, Chỉ Số Vòng Đời & Toàn Vẹn Lưu Trữ (139-state-semantics-storage-hardening)

**Feature Branch**: `139-state-semantics-storage-hardening`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Yêu cầu xử lý 5 vấn đề kỹ thuật trọng tâm theo đánh giá kiểm toán:
- P1: Sửa lỗi `failedRequestsTotal` / `failedRequestsToday` hiện không bao giờ được tăng trong chu trình yêu cầu logic (Logical Request lifecycle).
- P1: Tách bạch bộ đếm `retriesTotal` / `retriesToday` khỏi hàm `recordFailure()`, chỉ tăng khi thực sự kích hoạt retry / rotate khóa.
- P1: Đưa toàn bộ các thao tác ghi dữ liệu dự án (`saveProjectToDB`) từ mọi caller (bao gồm UI hooks, Google Drive sync, batch imports) vào cùng một ranh giới tuần tự hóa (serialization boundary) để loại bỏ triệt để xung đột race condition.
- P2: Xây dựng cơ chế di trú (migration) dữ liệu cấu hình hạn mức tùy chỉnh (`customLimitsStorage`) và trạng thái hạn ngạch từ mã băm cũ (32-bit integer fallback) sang mã băm chuẩn mật mã học SHA-256 mới.
- P2: Đồng bộ hóa toàn diện hợp đồng kỹ thuật `IBilingualSplitter` và giao diện `BilingualSplitOptions` với hàm thực thi runtime `splitBilingualAdaptively`, bảo đảm hỗ trợ đầy đủ `maxTokensPerChunk` và nhất quán kiểu dữ liệu."

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Hệ thống dịch thuật vận hành theo kiến trúc thuần Client-side SPA, trực tiếp điều phối các yêu cầu từ trình duyệt người dùng tới Google Gemini API và duy trì dữ liệu trong IndexedDB cục bộ kết hợp đồng bộ tùy chọn Google Drive.

Sau các đợt tái cấu trúc thành công về phân tách module và gia cố an toàn, đợt kiểm toán kỹ thuật chuyên sâu mới nhất đã chỉ ra rằng rủi ro lớn nhất hiện tại không còn nằm ở kiến trúc module mà nằm ở **ngữ nghĩa trạng thái (State Semantics)** và **ranh giới lưu trữ (Storage Boundaries)**:

1. **Sai lệch ngữ nghĩa chỉ số yêu cầu logic (`failedRequestsTotal/Today`)**:
   - Hệ thống phân tách rõ ràng giữa **Yêu cầu logic (Logical Request)** từ người dùng và **Lượt thử nhà cung cấp (Provider Attempt)** qua từng khóa API cụ thể. Một yêu cầu logic có thể trải qua nhiều lượt thử qua các khóa khác nhau.
   - Hiện tại, hàm `recordFailure()` chỉ tăng `failedAttemptsTotal/Today` mà không hề cập nhật `failedRequestsTotal/Today`. Hệ quả là bảng điều khiển hạn ngạch ghi nhận `failedRequestsTotal` luôn bằng 0 kể cả khi một yêu cầu dịch của người dùng bị thất bại hoàn toàn. Chỉ số này phải được cập nhật ở đúng điểm kết thúc vòng đời của yêu cầu logic.

2. **Gộp nhầm số lần thử lại (`retriesTotal/Today`) vào mỗi lần thất bại**:
   - Hàm `recordFailure()` hiện tự động tăng `retriesTotal` mỗi khi một khóa gặp lỗi.
   - Điều này làm sai lệch nghiêm trọng chỉ số: các lỗi không thể thử lại (như HTTP 400 Bad Request, HTTP 401/403 AuthFailed), hoặc lỗi xảy ra ở lượt thử cuối cùng khi không còn khóa nào khác để xoay vòng, vẫn bị tính là một lần "thử lại" (retry). Chỉ số thử lại cần được tách riêng và chỉ ghi nhận khi hệ thống thực sự kích hoạt hành động rotate khóa hoặc retry gọi lại nhà cung cấp.

3. **Ranh giới tuần tự hóa lưu trữ chưa bao quát toàn bộ các đường ghi dự án**:
   - Hàng đợi `projectStorageQueue` trước đó mới chỉ được áp dụng tại hook `useProjects.ts`.
   - Các module đồng bộ Google Drive (`driveBundleSync.ts`, `driveProjectSync.ts`, `driveGranularSync.ts`) và một số nhánh khởi tạo dự án vẫn gọi trực tiếp `saveProjectToDB()`. Điều này tạo ra hai lối ghi song song độc lập, dẫn đến nguy cơ xung đột (race condition) khi tiến trình đồng bộ Drive chạy ngầm cùng lúc người dùng chỉnh sửa từ điển hoặc tên dự án trên giao diện. Cần đưa ranh giới tuần tự hóa xuống ngay bên trong `saveProjectToDB()` để tự động bảo vệ mọi caller.

4. **Thiếu cơ chế di trú (migration) cho mã băm API Key**:
   - Khi nâng cấp thuật toán băm từ số nguyên 32-bit cũ (chuỗi hex 8 ký tự lặp lại 8 lần) lên chuẩn mật mã học SHA-256 (chuỗi hex 64 ký tự), các bản ghi cấu hình hạn mức cá nhân (`customLimitsStorage`) và bản chụp trạng thái trong `sessionStorage` của người dùng cũ bị lệch mã định danh. Người dùng cập nhật ứng dụng sẽ thấy các cấu hình hạn mức cá nhân (`maxRpd`) bị mất hoặc không được nhận diện. Cần một cơ chế di trú tự động chuyển đổi các mục băm cũ sang SHA-256 mới dựa trên danh sách các khóa API đang hoạt động.

5. **Lệch chuẩn giữa hợp đồng phân đoạn song ngữ và thực thi runtime**:
   - Interface `BilingualSplitOptions` và hợp đồng `IBilingualSplitter` cần được đồng bộ nhất quán về kiểu dữ liệu và thực thi runtime, đặc biệt là việc hiện thực hóa tham số `maxTokensPerChunk` để kiểm soát kích thước khối phân đoạn khi chia nhỏ phục vụ chuốt văn.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ghi Nhận Chính Xác Vòng Đời Yêu Cầu Logic & Thất Bại Tổng Thể (Priority: P1) 🎯 MVP

Là một người dùng dịch truyện theo dõi bảng điều khiển hạn ngạch, tôi muốn chỉ số `failedRequestsTotal` và `failedRequestsToday` phản ánh chính xác số lượng yêu cầu dịch thuật thực sự thất bại (sau khi đã thử qua toàn bộ các khóa khả dụng hoặc gặp lỗi không thể cứu vãn), để tôi biết chính xác tỷ lệ hoàn thành tác vụ thực tế của phiên làm việc.

**Why this priority**: Hiện tại `failedRequestsTotal` luôn bằng 0 trên bảng điều khiển ngay cả khi yêu cầu dịch bị hỏng, làm sai lệch hoàn toàn báo cáo độ tin cậy của ứng dụng và gây nhầm lẫn cho người dùng.

**Independent Test**:
- Giả lập một yêu cầu dịch gửi qua 3 khóa API, cả 3 khóa đều trả về 429 hoặc lỗi mạng dẫn đến yêu cầu dịch thất bại hoàn toàn: `logicalRequestsTotal` tăng 1, `providerAttemptsTotal` tăng 3, `failedAttemptsTotal` tăng 3, và `failedRequestsTotal` tăng chính xác 1 đơn vị.
- Giả lập một yêu cầu dịch thất bại ở Khóa 1 (429) nhưng thành công ở Khóa 2: `logicalRequestsTotal` tăng 1, `successfulRequestsTotal` tăng 1, `failedRequestsTotal` giữ nguyên 0.

**Acceptance Scenarios**:
1. **Given** một yêu cầu logic được kích hoạt (dịch thô, chuốt văn hoặc kiểm tra chất lượng), **When** toàn bộ các lượt thử gọi API tới nhà cung cấp đều thất bại hoặc gặp lỗi nghiêm trọng không thể khắc phục, **Then** hệ thống ghi nhận đúng 1 lần thất bại vào `failedRequestsTotal` và `failedRequestsToday` cho yêu cầu logic đó.
2. **Given** một yêu cầu logic gặp lỗi ở một vài lượt thử đầu nhưng thành công ở lượt thử tiếp theo, **When** hoàn thành yêu cầu, **Then** hệ thống tăng `successfulRequestsTotal` và `successfulRequestsToday`, giữ nguyên `failedRequestsTotal` và `failedRequestsToday`.
3. **Given** người dùng mở bảng điều khiển hạn ngạch sau một phiên dịch có cả yêu cầu thành công và yêu cầu thất bại, **When** bảng điều khiển hiển thị, **Then** tổng `successfulRequestsTotal + failedRequestsTotal` phản ánh đúng số yêu cầu logic đã kết thúc.

---

### User Story 2 - Tách Biệt Bộ Đếm Thử Lại Khỏi Sự Cố Không Thử Lại (Priority: P1) 🎯 MVP

Là một người quản trị khóa API, tôi muốn chỉ số `retriesTotal` và `retriesToday` chỉ tăng khi hệ thống thực sự kích hoạt một lượt thử lại (retry) hoặc xoay vòng sang khóa API tiếp theo (key rotation), không tăng khi gặp các lỗi dứt điểm không thể thử lại (như 400 Bad Request, 401 Auth Failed), để phản ánh trung thực mức độ nghẽn và tính hiệu quả của cơ chế xoay vòng khóa.

**Why this priority**: Việc tự động tăng `retriesTotal` trong `recordFailure()` khiến các lỗi xác thực hoặc lỗi cú pháp không bao giờ được retry vẫn bị đếm là retry, đồng thời lượt thất bại cuối cùng cũng bị tính là retry dù không có lần thử tiếp theo nào được thực hiện.

**Independent Test**:
- Kích hoạt yêu cầu gửi khóa sai định dạng nhận phản hồi HTTP 401 (Auth Failed) hoặc 400 (Bad Request): `failedAttemptsTotal` tăng 1, nhưng `retriesTotal` KHÔNG tăng.
- Kích hoạt yêu cầu nhận HTTP 429 từ Khóa 1 và hệ thống tự động chuyển sang Khóa 2: `retriesTotal` tăng chính xác 1 đơn vị.

**Acceptance Scenarios**:
1. **Given** một lượt gọi API gặp lỗi không thể thử lại (HTTP 400, HTTP 401/403 Auth Failed), **When** hệ thống ghi nhận thất bại của lượt thử, **Then** `failedAttemptsTotal` tăng 1 và `retriesTotal` không tăng.
2. **Given** một lượt gọi API gặp lỗi có thể thử lại (HTTP 429, HTTP 503, sự cố mạng) và vẫn còn khóa khả dụng tiếp theo, **When** bộ điều phối quyết định chuyển sang khóa mới để thử lại, **Then** hệ thống ghi nhận đúng 1 lần thử lại vào `retriesTotal` và `retriesToday`.
3. **Given** một lượt gọi API gặp lỗi ở khóa cuối cùng trong danh sách và không thể thử lại thêm, **When** yêu cầu kết thúc, **Then** lượt thất bại này được tính vào `failedAttemptsTotal` và `failedRequestsTotal`, không làm tăng `retriesTotal`.

---

### User Story 3 - Tuần Tự Hóa Toàn Diện Mọi Nguồn Ghi Dữ Liệu Dự Án (Priority: P1) 🎯 MVP

Là một người dùng dịch truyện kết hợp tính năng đồng bộ đám mây Google Drive ngầm, tôi muốn mọi thao tác ghi dữ liệu dự án vào IndexedDB (dù phát sinh từ thao tác người dùng trên giao diện hay từ tiến trình đồng bộ ngầm của Google Drive) đều được xếp vào cùng một hàng đợi tuần tự hóa duy nhất cho từng dự án, bảo đảm dữ liệu phiên bản mới nhất không bao giờ bị snapshot cũ ghi đè do tranh chấp thứ tự hoàn thành I/O.

**Why this priority**: Hiện tại Google Drive sync gọi trực tiếp `saveProjectToDB` bỏ qua hàng đợi của UI, tạo ra hai luồng ghi song song có thể dẫn đến việc mất dữ liệu khi người dùng vừa chỉnh sửa từ điển vừa có tác vụ sync Drive ngầm hoàn tất.

**Independent Test**:
- Giả lập 2 thao tác cập nhật từ điển từ UI và 2 thao tác cập nhật dự án từ Google Drive sync kích hoạt đồng thời trong khoảng thời gian 5ms trên cùng một `projectId`: Cả 4 thao tác được tuần tự hóa an toàn thông qua ranh giới ghi nội tại của `saveProjectToDB`, bản ghi cuối cùng trong IndexedDB bảo toàn nguyên vẹn toàn bộ các thay đổi từ cả hai nguồn mà không bị ghi đè snapshot cũ.

**Acceptance Scenarios**:
1. **Given** nhiều tác vụ ghi dự án xuất phát từ các nguồn khác nhau (`useProjects`, `driveBundleSync`, `driveProjectSync`, `driveGranularSync`), **When** gọi hàm lưu trữ dữ liệu dự án `saveProjectToDB`, **Then** tất cả các tác vụ đều được tự động tuần tự hóa theo từng `projectId` trong một hàng đợi xử lý duy nhất.
2. **Given** một tác vụ ghi dự án đang xử lý I/O với IndexedDB, **When** một tác vụ ghi khác cho cùng dự án được gửi tới, **Then** tác vụ sau kiên nhẫn chờ tác vụ trước hoàn tất trước khi đọc snapshot và thực hiện cập nhật.
3. **Given** các tác vụ ghi thuộc về hai dự án khác nhau (`projectA` và `projectB`), **When** được kích hoạt đồng thời, **Then** các tác vụ của hai dự án khác nhau có thể thực thi độc lập mà không bị chặn lẫn nhau.

---

### User Story 4 - Tự Động Di Trú Dữ Liệu Cấu Hình Hạn Mức Tùy Chỉnh (Priority: P2)

Là một người dùng đã thiết lập các giới hạn cá nhân (`maxRpd`) cho các khóa API trong phiên bản trước, tôi muốn khi mở ứng dụng ở phiên bản mới sử dụng thuật toán băm SHA-256, hệ thống tự động nhận diện và di trú các cấu hình cũ sang mã băm mới, để tôi không phải mất công cấu hình lại từ đầu cho từng khóa.

**Why this priority**: Việc nâng cấp thuật toán băm không đi kèm di trú khiến các khóa cấu hình cũ bị "mồ côi" trong bộ nhớ, làm người dùng tưởng rằng ứng dụng bị lỗi xóa mất cấu hình hạn mức cá nhân.

**Independent Test**:
- Nạp vào `localStorage` cấu hình hạn mức `gemini_quota_custom_limits` cũ với mã băm 32-bit (ví dụ: `maxRpd = 100`).
- Khởi tạo ứng dụng với danh sách API keys chứa khóa tương ứng: Hệ thống tự động nhận diện bản ghi cũ, ánh xạ sang mã băm SHA-256 chuẩn (64 ký tự hex) và lưu trữ lại mà không làm mất cấu hình `maxRpd = 100`.

**Acceptance Scenarios**:
1. **Given** dữ liệu cấu hình hạn mức tùy chỉnh được lưu trữ dưới mã băm của phiên bản cũ (chuỗi hex 8 ký tự lặp hoặc mã băm không phải 64 hex), **When** ứng dụng tải cấu hình với danh sách API keys hiện tại, **Then** hệ thống tự động tính toán mã băm SHA-256 mới và di trú giá trị cấu hình tương ứng sang định danh mới.
2. **Given** quá trình di trú hoàn tất, **When** lưu lại cấu hình, **Then** dữ liệu được lưu dưới phiên bản lưu trữ mới (`gemini_quota_custom_limits_v2` hoặc tương đương) với 100% các khóa sử dụng mã băm SHA-256 chuẩn.
3. **Given** bản chụp trạng thái hạn ngạch trong `sessionStorage` chứa các định danh khóa theo thuật toán cũ, **When** bộ theo dõi nạp lại, **Then** các khóa cũ được nhận diện an toàn và chuyển đổi sang SHA-256 nếu có thể, tránh tình trạng tạo ra các bản ghi trùng lặp vô nghĩa.

---

### User Story 5 - Đồng Bộ Hóa Toàn Diện Hợp Đồng & Hiện Thực Runtime Phân Đoạn Song Ngữ (Priority: P2)

Là một lập trình viên hoặc người dùng dịch văn bản dài, tôi muốn bộ phân đoạn song ngữ tuân thủ đầy đủ hợp đồng kỹ thuật `IBilingualSplitter` và hỗ trợ tùy chọn `maxTokensPerChunk` trong `BilingualSplitOptions`, bảo đảm các khối phân đoạn song ngữ phục vụ chuốt văn vừa kiểm soát chặt chẽ kích thước token vừa giữ vẹn toàn ranh giới đoạn văn.

**Why this priority**: Sự thiếu đồng bộ giữa interface hợp đồng và hàm thực thi runtime gây khó khăn cho việc mở rộng kiến trúc và kiểm thử đơn vị, đồng thời tùy chọn giới hạn token tối đa cho mỗi khối chưa được áp dụng đầy đủ.

**Independent Test**:
- Gọi hàm `splitBilingualAdaptively` với đối tượng tùy chọn `BilingualSplitOptions` có `maxTokensPerChunk = 500`: Thuật toán tự động phân tách văn bản thành số phần thích hợp sao cho mỗi phần không vượt quá 500 token (khi số đoạn văn cho phép), đồng thời vẫn hỗ trợ hoàn hảo cách gọi truyền thống qua tham số vị trí.

**Acceptance Scenarios**:
1. **Given** hợp đồng kỹ thuật `IBilingualSplitter` và interface `BilingualSplitOptions`, **When** gọi hàm `splitBilingualAdaptively`, **Then** hàm hỗ trợ đầy đủ cả dạng truyền đối tượng tùy chọn lẫn dạng truyền tham số vị trí tương thích ngược.
2. **Given** tùy chọn `maxTokensPerChunk` được cung cấp trong `BilingualSplitOptions`, **When** văn bản đầu vào có lượng token vượt quá ngưỡng này, **Then** thuật toán tự động tính toán số phần chia mục tiêu tối thiểu để thỏa mãn giới hạn token mà không vi phạm ranh giới đoạn văn.
3. **Given** đối tượng thực thi `IBilingualSplitter`, **When** kiểm thử trong môi trường mock hoặc thay thế thành phần, **Then** lớp/đối tượng đáp ứng 100% các phương thức khai báo trong hợp đồng.

---

## Edge Cases

- **Tất cả các API Key đều bị lỗi ngay ở lượt gọi đầu tiên**: Yêu cầu logic kết thúc với `failedRequestsTotal` tăng 1, `providerAttemptsTotal` tăng theo số lượng khóa, và `retriesTotal` phản ánh đúng số lượt xoay tua hợp lệ.
- **Yêu cầu bị hủy ngang bởi người dùng (AbortController / Signal)**: Yêu cầu bị hủy không được tính là lỗi logic của nhà cung cấp (`failedRequestsTotal` không tăng do lỗi hệ thống, hoặc được phân loại là bị hủy rõ ràng).
- **Lỗi đĩa hoặc IndexedDB bị khóa trong quá trình lưu tuần tự**: Hàng đợi tuần tự hóa bắt lỗi an toàn, ném biệt lệ cho caller hiện tại nhưng KHÔNG làm tắc nghẽn chuỗi promise, cho phép các tác vụ ghi tiếp theo trong hàng đợi tiếp tục được thực thi bình thường.
- **Người dùng xóa hết các API Key trong cài đặt nhưng vẫn còn cấu hình custom limits cũ**: Quá trình migration không bị crash khi danh sách keys rỗng, dữ liệu cũ được giữ nguyên an toàn cho đến khi người dùng nạp lại keys.
- **Tham số `maxTokensPerChunk` nhỏ hơn lượng token của một đoạn văn đơn lẻ**: Thuật toán ưu tiên bảo vệ ranh giới đoạn văn, không cắt ngang giữa đoạn văn, mỗi chunk chứa ít nhất một đoạn văn trọn vẹn và không sinh ra lỗi vô tận.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Bộ theo dõi hạn ngạch (`LocalQuotaTracker`) PHẢI cung cấp phương thức `recordLogicalFailure(now?: number)` để ghi nhận chính xác thời điểm một yêu cầu logic kết thúc trong trạng thái thất bại, tăng cả `failedRequestsTotal` và `failedRequestsToday`.
- **FR-002**: Trình điều phối `geminiClient` PHẢI gọi `recordLogicalFailure()` khi toàn bộ các khóa khả dụng đều thất bại hoặc khi một lỗi nghiêm trọng không thể cứu vãn xảy ra, trước khi ném biệt lệ ra ngoài.
- **FR-003**: Bộ theo dõi hạn ngạch PHẢI cung cấp phương thức `recordRetry(key?: string, now?: number)` độc lập để ghi nhận lượt thử lại / xoay tua khóa, tăng `retriesTotal` và `retriesToday`.
- **FR-004**: Hàm `recordFailure()` trong `LocalQuotaTracker` PHẢI LOẠI BỎ việc tự động tăng `retriesTotal` và `retriesToday`.
- **FR-005**: Trình điều phối `geminiClient` PHẢI chỉ gọi `recordRetry()` khi một lượt thử thất bại được quyết định chuyển sang khóa mới hoặc kích hoạt một lượt thử lại thực tế tới nhà cung cấp.
- **FR-006**: Hàm lưu trữ dự án `saveProjectToDB()` trong `src/services/db.ts` PHẢI tích hợp cơ chế tuần tự hóa ghi (Write Serialization Queue / Promise Chain) theo từng `projectId` tại cấp cơ sở dữ liệu, bảo đảm mọi lời gọi từ bất kỳ caller nào đều được thực thi tuần tự.
- **FR-007**: Cơ chế tuần tự hóa ghi của `saveProjectToDB` PHẢI bảo đảm một tác vụ ghi thất bại không làm đóng băng hoặc làm hỏng các tác vụ ghi phía sau trong hàng đợi.
- **FR-008**: Các module đồng bộ đám mây (`driveBundleSync.ts`, `driveProjectSync.ts`, `driveGranularSync.ts`) và các hook giao diện (`useProjects.ts`) PHẢI được bảo vệ nhất quán thông qua ranh giới tuần tự hóa duy nhất của `saveProjectToDB`.
- **FR-009**: Module `customLimitsStorage.ts` PHẢI cung cấp hàm di trú (migration) tự động nhận diện các bản ghi băm theo định dạng cũ (32-bit integer hex) và chuyển đổi sang mã băm chuẩn SHA-256 (64 ký tự hex) khi có danh sách các khóa API tương ứng.
- **FR-010**: Dữ liệu cấu hình hạn mức tùy chỉnh sau khi di trú PHẢI được lưu trữ ổn định và tương thích ngược, ngăn chặn việc cấu hình cá nhân bị biến mất khi nâng cấp ứng dụng.
- **FR-011**: `LocalQuotaTracker` PHẢI hỗ trợ kiểm tra và nhận diện các mã băm cũ khi nạp dữ liệu từ `sessionStorage`, tự động ánh xạ sang SHA-256 mới nếu khóa gốc khả dụng trong danh sách quản lý.
- **FR-012**: Module phân tách song ngữ `src/services/translation/bilingualSplit.ts` PHẢI xuất khẩu và hiện thực hóa đầy đủ hợp đồng `IBilingualSplitter` cùng kiểu `BilingualSplitOptions`.
- **FR-013**: Hàm `splitBilingualAdaptively` PHẢI hỗ trợ đầy đủ thuộc tính `maxTokensPerChunk` trong `BilingualSplitOptions`, tự động điều chỉnh số phần chia mục tiêu để đáp ứng ràng buộc kích thước token mà không phá vỡ ranh giới đoạn văn.
- **FR-014**: Giao diện hàm phân tách song ngữ PHẢI duy trì chữ ký nạp chồng (overload) hỗ trợ cú pháp tham số vị trí cũ `splitBilingualAdaptively(sourceText, rawText, targetParts?)` nhằm bảo đảm tính tương thích ngược 100%.
- **FR-015**: Toàn bộ hệ thống PHẢI vượt qua 100% các bài kiểm tra chất lượng bắt buộc của dự án (`npm run lint`, `npm test`, `npm run build`) mà không có lỗi tồn đọng.

### Key Entities

- **LogicalSummaryStats**: Thực thể tóm tắt chỉ số ở tầng yêu cầu logic, bao gồm `logicalRequestsTotal/Today`, `successfulRequestsTotal/Today`, `failedRequestsTotal/Today`, `retriesTotal/Today`, `providerAttemptsTotal/Today`, `failedAttemptsTotal/Today`.
- **ProjectWriteQueue**: Cấu trúc điều phối hàng đợi ghi tuần tự theo `projectId`, quản lý chuỗi Promise để bảo đảm tính toàn vẹn dữ liệu cho từng dự án độc lập.
- **CustomLimitMigrationResult**: Kết quả thực hiện di trú cấu hình hạn mức cá nhân, ghi nhận số lượng mục đã di trú thành công từ mã băm cũ sang SHA-256 mới.
- **BilingualSplitOptions**: Đối tượng cấu hình cho bộ phân đoạn song ngữ, chứa `sourceText`, `rawText`, `targetParts` và `maxTokensPerChunk`.
- **IBilingualSplitter**: Giao diện hợp đồng chuẩn định nghĩa các phương thức phân tách song ngữ và điều tiết lưu lượng xử lý đồng thời.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các yêu cầu logic thất bại được ghi nhận chính xác vào `failedRequestsTotal` và `failedRequestsToday` (loại bỏ hoàn toàn trạng thái chỉ số luôn bằng 0).
- **SC-002**: 100% các lần tăng `retriesTotal` tương ứng với một lần thử lại hoặc xoay vòng khóa thực tế; 0% trường hợp lỗi 400 hoặc 401 bị tính là retry.
- **SC-003**: 100% các cuộc gọi `saveProjectToDB` từ mọi nguồn (UI hooks, Google Drive sync) được tuần tự hóa theo từng dự án, tỷ lệ mất mát dữ liệu do xung đột ghi đè bằng 0 (Zero Write Race Conditions).
- **SC-004**: 100% các cấu hình hạn mức cá nhân (`maxRpd`) tạo từ phiên bản cũ được di trú thành công sang mã băm SHA-256 mới khi người dùng mở ứng dụng, tỷ lệ thất thoát cấu hình bằng 0%.
- **SC-005**: 100% các cuộc gọi phân đoạn song ngữ tuân thủ đầy đủ hợp đồng `IBilingualSplitter`, hỗ trợ hoàn hảo tham số `maxTokensPerChunk` và tương thích ngược 100%.
- **SC-006**: Toàn bộ hệ thống vượt qua 100% các bài kiểm tra chất lượng bắt buộc (`npm run lint`, `npm test`, `npm run build`) với 0 cảnh báo hoặc lỗi type.

---

## Assumptions

- Người dùng cấu hình danh sách API keys trên giao diện, cho phép hệ thống tính toán mã băm tương ứng để thực hiện di trú dữ liệu cấu hình cũ một cách tự động và minh bạch.
- Tuần tự hóa theo từng `projectId` là mô hình tối ưu cho ứng dụng SPA client-side, vừa bảo vệ tính toàn vẹn dữ liệu của từng tác phẩm vừa không làm nghẽn các tác vụ của các tác phẩm khác.
- `sessionStorage` và `localStorage` tiếp tục là nơi lưu trữ phù hợp cho trạng thái hạn ngạch tạm thời và cấu hình cá nhân của người dùng trên trình duyệt.

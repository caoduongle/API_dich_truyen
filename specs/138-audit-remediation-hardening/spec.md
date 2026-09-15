# Feature Specification: Khắc Phục Kiểm Toán & Gia Cố Tính Nhất Quán (138-audit-remediation-hardening)

**Feature Branch**: `138-audit-remediation-hardening`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Yêu cầu rà soát và khắc phục các vấn đề kỹ thuật sau đợt refactor theo đánh giá kiểm toán:
- P1: Sửa lỗi ghi nhận recordFailure() hai lần trong Gemini client khi gặp lỗi HTTP hoặc biệt lệ mạng; Sửa lỗi reset trạng thái quota/circuit breaker (QuotaExhausted, RateLimited, Cooldown) thành Healthy khi reload trang; Tuần tự hóa (serialize) các thao tác lưu project vào cơ sở dữ liệu để tránh race condition; Nâng cấp thuật toán hashApiKey() trên trình duyệt sang SHA-256 chuẩn bằng Web Crypto.
- P2: Sửa docs/model-system.md phản ánh đúng kiến trúc client-direct SPA; Đồng bộ SECURITY.md với wording thực tế và loại bỏ các tuyên bố quá mức; Xóa tuyên bố 'mã hóa IndexedDB' trong .env.example; Làm rõ và thống nhất contract BilingualSplitOptions / IBilingualSplitter với hàm thực thi; Củng cố semantic alignment cho bộ phân đoạn song ngữ (bilingual splitter); Minh bạch hóa kết quả truy vấn IndexedDB giữa dữ liệu rỗng và lỗi truy cập."

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Ứng dụng dịch thuật tiểu thuyết vận hành theo mô hình thuần Client-side SPA (Single Page Application) với cơ chế giao tiếp trực tiếp từ trình duyệt tới Google Gemini API, quản lý xoay vòng khóa API và điều tiết hạn mức (RPM, TPM, RPD) hoàn toàn tại phía người dùng.

Sau đợt tái cấu trúc thành công loại bỏ các khối mã tập trung quá nhiều trách nhiệm (God Services) và module hóa các bước dịch thô, chuốt văn, đánh giá chất lượng (QA), một đợt kiểm toán kỹ thuật chuyên sâu đã phát hiện các điểm rủi ro cần xử lý dứt điểm:
1. **Ghi nhận lỗi hai lần (Double Failure Counting)**: Khi phản hồi HTTP thất bại, một số nhánh xử lý gọi hàm ghi nhận lỗi, sau đó ném biệt lệ và khối bắt lỗi ngoại lệ lại ghi nhận lỗi lần thứ hai. Hệ quả là làm tăng gấp đôi chỉ số lỗi, khiến chỉ số liên tiếp bị sai và đẩy khóa vào trạng thái quá tải/làm nguội quá sớm.
2. **Mất trạng thái làm nguội khi làm mới trang (State Reset on Reload)**: Dù có lưu thông tin vào bộ nhớ phiên, khi tải lại trang, các trạng thái cạn hạn ngạch ngày (`QuotaExhausted`) hoặc đang làm nguội tốc độ (`RateLimited`, `Cooldown`) bị gán cứng quay về trạng thái sẵn sàng (`Healthy`). Điều này khiến ứng dụng gọi lại ngay vào khóa đang bị khóa, gây lỗi 429 lặp đi lặp lại.
3. **Tranh chấp tương tranh khi lưu dữ liệu dự án (Concurrent Write Race Conditions)**: Các thao tác cập nhật dự án (như thêm/sửa từ điển, chỉnh sửa siêu dữ liệu) gọi hàm lưu trữ cơ sở dữ liệu không theo hàng đợi tuần tự. Khi người dùng thao tác liên tục, các thao tác ghi có thể hoàn thành lệch thứ tự, khiến dữ liệu cũ ghi đè lên dữ liệu mới nhất.
4. **Hàm băm định danh khóa yếu trên trình duyệt (Weak 32-bit Key Hash)**: Cơ chế băm khóa dự phòng trên trình duyệt sử dụng thuật toán số nguyên dịch bit 32-bit có không gian va chạm hẹp, tiềm ẩn nguy cơ hai khóa API khác nhau bị trùng định danh và dùng chung hạn mức/trạng thái.
5. **Lệch pha giữa tài liệu kiến trúc và mã nguồn thực tế**: Tài liệu hệ thống mô hình vẫn mô tả máy chủ trung gian Express với các endpoint cũ; chính sách bảo mật và tệp cấu hình mẫu còn chứa các thuật ngữ phóng đại ("Zero-Server-Knowledge", "mã hóa IndexedDB") chưa phản ánh trung thực cách triển khai.
6. **Lệch chuẩn giao diện phân đoạn song ngữ**: Kiểu giao diện hợp đồng phân đoạn khai báo các thuộc tính chưa được hàm xử lý thực tế tiếp nhận, đồng thời thuật toán chia tách cần được bảo đảm không gây đứt gãy ngữ nghĩa văn cảnh giữa tiếng Trung và tiếng Việt.
7. **Nhầm lẫn giữa cơ sở dữ liệu rỗng và sự cố lưu trữ**: Một số phương thức đọc dữ liệu trả về giá trị rỗng khi gặp lỗi hệ thống, gây khó khăn cho việc phân biệt giữa trạng thái chưa có dữ liệu và lỗi phần cứng/quyền hạn.

Mục tiêu của đợt hoàn thiện này là loại bỏ triệt để các sai lệch logic P1 và hoàn thiện tính nhất quán P2, nâng cao tính toàn vẹn dữ liệu, độ chính xác của bảng điều khiển hạn ngạch và tính minh bạch của tài liệu kỹ thuật.

---

## Clarifications

### Session 2026-09-15
- Q: Phần đệ quy (Divide & Conquer recursive split/retry) trong luồng dịch có bị thay đổi logic không? → A: Logic giải thuật và cấu trúc đệ quy HOÀN TOÀN KHÔNG BỊ THAY ĐỔI. Cả `rawWithContentSplitDirect` (trong `rawTranslation.ts`) và `polishWithContentSplitDirect` (trong `polishTranslation.ts`) giữ nguyên 100% cơ chế Divide & Conquer, giới hạn độ sâu `depth < 4`, cơ chế phân bổ khóa so le (`staggeredKey`), và các tầng cứu nguy (Sino-Vietnamese fallback rescue). Thay đổi duy nhất là gia cố điều kiện biên trong hàm bổ trợ `splitBilingualAdaptively` (thuộc US6) nhằm ngăn ngừa tình trạng sinh ra khối con rỗng khi số đoạn văn tiếng Trung và tiếng Việt lệch nhau nhiều, giúp quá trình đệ quy chuốt văn diễn ra ổn định và an toàn hơn.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ghi Nhận Lỗi Cuộc Gọi Chuẩn Xác & Tránh Đếm Lặp Thất Bại (Priority: P1) 🎯 MVP

Là một người dùng dịch truyện sử dụng hệ thống xoay vòng khóa API, tôi muốn mỗi cuộc gọi API thất bại chỉ được tính đúng 1 lần vào số liệu thống kê lỗi và trạng thái sức khỏe của khóa, để khóa không bị chuyển sang trạng thái cảnh báo hay bị tạm dừng oan uổng khi chưa thực sự vượt ngưỡng lỗi cho phép.

**Why this priority**: Lỗi đếm lặp làm sai lệch hoàn toàn chỉ số lỗi liên tiếp, kích hoạt ngắt mạch (circuit breaker) và tạm dừng khóa quá sớm, làm tê liệt khả năng dịch liên tục của người dùng ngay cả khi hạn mức vẫn còn.

**Independent Test**:
- Giả lập một phản hồi lỗi HTTP 429 hoặc 403: Kiểm tra bộ đếm `errorsTotal` và `consecutiveErrors` của khóa đó tăng chính xác 1 đơn vị, không tăng 2 đơn vị.
- Giả lập lỗi mạng ngắt kết nối (`TypeError: Failed to fetch`): Kiểm tra lỗi chỉ được ghi nhận đúng 1 lần trước khi chuyển khóa tiếp theo.

**Acceptance Scenarios**:
1. **Given** một yêu cầu gọi API nhận phản hồi lỗi HTTP từ nhà cung cấp (mã trạng thái không thành công), **When** hệ thống xử lý lỗi và xoay vòng hoặc ném biệt lệ cho tầng trên, **Then** hàm ghi nhận lỗi chỉ được thực thi đúng 1 lần cho lượt thử đó của khóa tương ứng.
2. **Given** một yêu cầu gọi API gặp sự cố mạng hoặc bị hủy (Fetch Exception / Abort), **When** khối bắt lỗi ngoại lệ tiếp nhận, **Then** hệ thống ghi nhận lỗi đúng 1 lần đối với lỗi mạng chưa được ghi nhận trước đó, không ghi đè hoặc lặp lại nếu lỗi đã được ghi nhận ở bước trước.
3. **Given** chuỗi các yêu cầu dịch gặp lỗi cần thử lại qua nhiều khóa, **When** bảng điều khiển hạn ngạch kết xuất thống kê, **Then** tổng số lỗi hiển thị trùng khớp hoàn toàn với số lượt thử thực tế gửi tới nhà cung cấp.

---

### User Story 2 - Bảo Toàn Trạng Thái Nghỉ Của Khóa Khi Tải Lại Ứng Dụng (Priority: P1) 🎯 MVP

Là một người dùng đang thực hiện phiên dịch truyện, khi tôi làm mới trang (refresh/reload trình duyệt) hoặc mở lại thẻ làm việc, tôi muốn hệ thống ghi nhớ chính xác các khóa API đang trong thời gian làm nguội (`RateLimited`, `Cooldown`) hoặc đã cạn hạn ngạch trong ngày (`QuotaExhausted`), không tự động đưa chúng về trạng thái sẵn sàng (`Healthy`) khi thời gian nghỉ chưa kết thúc, nhằm tránh việc lặp lại ngay các yêu cầu gây lỗi dồn dập.

**Why this priority**: Việc đặt lại trạng thái về Healthy ngay khi reload khiến ứng dụng lập tức thử lại các khóa vừa bị cạn hạn ngạch hoặc vừa bị nghẽn tốc độ, dẫn đến việc liên tục nhận lỗi 429 và làm giảm độ ổn định của toàn bộ phiên dịch.

**Independent Test**:
- Đưa một khóa vào trạng thái `QuotaExhausted` với thời gian khóa đến 00:00 PST, sau đó tải lại trạng thái lưu trữ: Khóa vẫn giữ nguyên trạng thái `QuotaExhausted` và thời điểm mở khóa dự kiến.
- Đưa một khóa vào trạng thái `RateLimited` với thời gian làm nguội còn lại 45 giây, sau đó tải lại trạng thái: Khóa vẫn giữ trạng thái `RateLimited` và thời gian làm nguội còn lại.
- Giả lập thời gian hệ thống bước qua 00:00 PST ngày mới: Khi nạp lại, trạng thái `QuotaExhausted` tự động được giải phóng về `Healthy` và bộ đếm ngày được đặt lại về 0.

**Acceptance Scenarios**:
1. **Given** một khóa API đang ở trạng thái cạn hạn ngạch ngày (`QuotaExhausted`), **When** người dùng tải lại trang trong cùng ngày (trước 00:00 PST), **Then** hệ thống phục hồi chính xác trạng thái `QuotaExhausted` cùng mốc thời gian mở khóa mà không đưa về `Healthy`.
2. **Given** một khóa API đang trong thời gian làm nguội tốc độ (`RateLimited` hoặc `Cooldown`) với mốc thời gian làm nguội chưa kết thúc, **When** ứng dụng khởi tạo lại, **Then** khóa được duy trì trạng thái làm nguội và bộ đếm thời gian tiếp tục chạy từ thời điểm còn lại.
3. **Given** một khóa API đã hết thời gian làm nguội hoặc thời điểm hiện tại đã bước sang ngày mới theo giờ Thái Bình Dương (00:00 PST), **When** hệ thống kiểm tra trạng thái khi khởi tạo, **Then** khóa được chuyển đổi an toàn sang trạng thái sẵn sàng (`Healthy`) và bộ đếm ngày được làm mới.

---

### User Story 3 - Tuần Tự Hóa Thao Tác Ghi Bộ Nhớ Tránh Tranh Chấp Dữ Liệu Dự Án (Priority: P1) 🎯 MVP

Là một dịch giả thao tác nhanh trên giao diện (thêm liên tiếp nhiều từ vào cẩm nang, sửa thông tin tác phẩm hoặc cập nhật cài đặt dự án), tôi muốn mọi thay đổi được lưu vào cơ sở dữ liệu trình duyệt theo đúng thứ tự thời gian thông qua cơ chế hàng đợi tuần tự, bảo đảm dữ liệu cũ không bao giờ ghi đè lên dữ liệu mới hơn khi các tác vụ lưu hoàn thành không đồng thời.

**Why this priority**: Tranh chấp ghi (race condition) do không chờ hoặc không tuần tự hóa các tác vụ bất đồng bộ có thể khiến từ ngữ mới thêm vào cẩm nang hoặc các sửa đổi mới nhất của người dùng bị mất mát hoàn toàn nếu một tác vụ ghi trước đó hoàn thành chậm hơn.

**Independent Test**:
- Kích hoạt 5 thao tác thêm từ điển liên tiếp trong vòng 10ms: Tất cả 5 thao tác được thực thi tuần tự trong hàng đợi ghi, bản ghi cuối cùng trong IndexedDB chứa đầy đủ toàn bộ 5 từ mới mà không bị thất thoát mục nào.
- Thử nghiệm chỉnh sửa tên dự án và thêm từ điển gần như đồng thời: Cả hai thay đổi được lưu trữ tuần tự, không có trường hợp snapshot cũ ghi đè snapshot mới.

**Acceptance Scenarios**:
1. **Given** nhiều thao tác cập nhật dữ liệu dự án phát sinh liên tiếp trong khoảng thời gian ngắn, **When** hệ thống tiến hành lưu vào cơ sở dữ liệu, **Then** các thao tác ghi được xếp vào hàng đợi xử lý tuần tự (write queue / promise chain), bảo đảm thao tác sau chỉ thực hiện khi thao tác trước đã kết thúc thành công hoặc thất bại an toàn.
2. **Given** một thao tác lưu dữ liệu đang trong quá trình thực thi với cơ sở dữ liệu, **When** người dùng thực hiện thay đổi tiếp theo, **Then** bản cập nhật mới nhận trạng thái mới nhất và được thực thi ngay sau khi tác vụ trước hoàn tất.
3. **Given** một tác vụ lưu trong hàng đợi gặp lỗi ngoại lệ lưu trữ, **When** lỗi được xử lý, **Then** hàng đợi không bị tắc nghẽn vĩnh viễn và các tác vụ hợp lệ tiếp theo vẫn được giải phóng để tiếp tục thực thi.

---

### User Story 4 - Định Danh Khóa Bằng Mã Băm Mật Mã Học Chống Va Chạm (Priority: P1)

Là một người dùng sử dụng nhiều khóa API khác nhau trong hệ thống, tôi muốn định danh băm của từng khóa API được tạo ra bằng thuật toán băm an toàn 256-bit chuẩn mực (SHA-256) trên môi trường trình duyệt, để loại bỏ triệt để nguy cơ hai khóa API khác nhau bị trùng mã băm, dẫn đến việc dùng chung hạn ngạch hoặc ghi đè trạng thái sức khỏe của nhau.

**Why this priority**: Thuật toán băm số nguyên 32-bit cũ có không gian mẫu nhỏ và tỷ lệ va chạm đáng kể. Khi xảy ra va chạm, hai khóa hoàn toàn khác nhau sẽ chia sẻ cùng một hồ sơ hạn ngạch, làm sai lệch cấu hình hạn mức tùy chỉnh và cơ chế xoay vòng.

**Independent Test**:
- Tạo mã băm cho 100 chuỗi khóa API có cấu trúc tương tự nhau: Tất cả các mã băm sinh ra đều là chuỗi thập lục phân 64 ký tự chuẩn SHA-256, không có bất kỳ cặp khóa nào bị trùng mã băm.
- Kiểm tra tính tương thích trên cả môi trường trình duyệt (Web Crypto API) và môi trường kiểm thử (Node.js Crypto): Kết quả băm của cùng một khóa trả về giá trị đồng nhất 100%.

**Acceptance Scenarios**:
1. **Given** một chuỗi khóa API được nạp vào hệ thống trên môi trường trình duyệt người dùng, **When** tạo mã định danh băm cho khóa, **Then** hệ thống sử dụng thuật toán băm mật mã học chuẩn SHA-256 để xuất ra chuỗi thập lục phân 64 ký tự duy nhất.
2. **Given** các khóa API khác nhau được cấu hình hạn mức riêng biệt, **When** hệ thống truy xuất và lưu trữ số liệu hạn ngạch theo mã băm, **Then** mỗi khóa được cô lập hoàn toàn trong không gian dữ liệu riêng của mình, không bị ảnh hưởng bởi các khóa khác.
3. **Given** mã băm đã được tạo cho một khóa trong phiên làm việc, **When** cần sử dụng lại trong các hàm đồng bộ, **Then** hệ thống tận dụng bộ nhớ đệm kết quả băm để đảm bảo hiệu năng tức thì mà không làm chậm giao diện người dùng.

---

### User Story 5 - Thống Nhất Tài Liệu Kiến Trúc & Minh Bạch Hóa Thông Điệp Bảo Mật (Priority: P2)

Là một lập trình viên đóng góp mã nguồn hoặc người dùng tìm hiểu dự án, tôi muốn tài liệu hệ thống mô hình (`docs/model-system.md`), chính sách bảo mật (`SECURITY.md`) và tệp cấu hình mẫu (`.env.example`) phản ánh trung thực 100% kiến trúc thuần Client-side SPA, loại bỏ các sơ đồ máy chủ trung gian không còn tồn tại và các tuyên bố bảo mật phóng đại, để hiểu đúng và vận hành ứng dụng một cách an toàn.

**Why this priority**: Tài liệu mô tả sai kiến trúc khiến người phát triển và công cụ hỗ trợ AI đưa ra các giải pháp lạc hậu (như tạo endpoint Express cho tác vụ client-direct), còn các tuyên bố phóng đại làm giảm uy tín kỹ thuật của dự án trước cộng đồng.

**Independent Test**:
- Đọc `docs/model-system.md`: Toàn bộ các tham chiếu đến `Express Server`, `/api/list-models`, `/api/verify-model` được thay thế bằng quy trình trực tiếp phía client qua `directGeminiClient.ts` và cơ chế lưu đệm SWR cục bộ.
- Đọc `SECURITY.md` và `.env.example`: Không còn tuyên bố "Zero-Server-Knowledge" hay "mã hóa IndexedDB", nội dung thể hiện rõ ràng cơ chế lưu trữ trình duyệt không có máy chủ trung gian.

**Acceptance Scenarios**:
1. **Given** tài liệu kiến trúc phân hệ mô hình tại `docs/model-system.md`, **When** người đọc xem sơ đồ và mô tả luồng dữ liệu, **Then** sơ đồ trình bày chính xác luồng gọi trực tiếp từ trình duyệt tới Google Gemini API kèm cơ chế lưu đệm SWR cục bộ, không chứa thành phần máy chủ trung gian hay endpoint nội bộ đã bị loại bỏ.
2. **Given** chính sách bảo mật tại `SECURITY.md`, **When** xem xét các nguyên tắc lưu trữ khóa và cấu hình mạng, **Then** thuật ngữ được diễn đạt chuẩn xác là kiến trúc Client-Direct (không trung gian máy chủ), danh sách kết nối mạng (CSP) khớp hoàn toàn với cấu hình triển khai thực tế.
3. **Given** tệp hướng dẫn cấu hình mẫu `.env.example`, **When** người dùng đọc hướng dẫn về khóa API, **Then** hướng dẫn nêu rõ khóa được lưu trữ an toàn trong bộ nhớ trình duyệt người dùng, loại bỏ từ ngữ gây hiểu lầm về việc mã hóa dữ liệu cơ sở dữ liệu khi hệ thống chưa triển khai tính năng đó.

---

### User Story 6 - Đồng Bộ Hóa Hợp Đồng & Tối Ưu Hóa Ngữ Nghĩa Bộ Phân Đoạn Song Ngữ (Priority: P2)

Là một người dùng dịch các chương văn bản dài, tôi muốn bộ chia tách văn bản song ngữ duy trì sự toàn vẹn ngữ nghĩa và ranh giới đoạn văn giữa văn bản nguồn (Trung) và văn bản dịch thô (Việt), đồng thời các định nghĩa kiểu giao diện hợp đồng kỹ thuật khớp hoàn toàn với hàm thực thi, bảo đảm quá trình chuốt văn đạt chất lượng văn học cao và mã nguồn không có sự trừu tượng hóa thừa thãi.

**Why this priority**: Lệch ranh giới đoạn văn hoặc chia cắt giữa câu làm mất ngữ cảnh chuốt văn của mô hình ngôn ngữ lớn, trong khi hợp đồng kiểu lệch với thực thi gây hiểu lầm cho người bảo trì mã nguồn.

**Independent Test**:
- Thử nghiệm phân đoạn trên văn bản có số đoạn tiếng Trung và tiếng Việt không hoàn toàn bằng nhau: Thuật toán bảo đảm mỗi khối phân đoạn đều có nội dung hoàn chỉnh theo đoạn văn nguyên vẹn, không cắt đứt giữa câu hoặc để lại khối văn bản rỗng.
- Kiểm tra tính tương thích giữa giao diện hợp đồng và hàm thực thi: Mọi tham số tùy chọn (như số phần mong muốn, ước tính token) được thống nhất và hỗ trợ nhất quán.

**Acceptance Scenarios**:
1. **Given** văn bản nguồn tiếng Trung và bản dịch thô tiếng Việt cần được phân đoạn để chuốt văn, **When** thuật toán phân đoạn song ngữ thực thi, **Then** các khối phân đoạn được ghép nối theo các khối đoạn văn hoàn chỉnh, giữ vững tính mạch lạc ngữ nghĩa và không làm đứt đoạn câu văn.
2. **Given** định nghĩa kiểu hợp đồng phân đoạn song ngữ (`BilingualSplitOptions`, `IBilingualSplitter`), **When** đối chiếu với hàm thực thi `splitBilingualAdaptively`, **Then** cấu trúc tham số và kiểu dữ liệu trả về hoàn toàn đồng nhất, có thể truyền cả dạng tham số vị trí lẫn dạng đối tượng tùy chọn một cách linh hoạt và an toàn kiểu.

---

### User Story 7 - Minh Bạch Hóa Kết Quả Truy Vấn Cơ Sở Dữ Liệu Cục Bộ (Priority: P2)

Là một lập trình viên hoặc người sử dụng hệ thống, khi ứng dụng truy vấn dữ liệu từ IndexedDB, tôi muốn phân biệt rõ ràng giữa trường hợp cơ sở dữ liệu thực sự chưa có bản ghi nào (rỗng bình thường) và trường hợp xảy ra sự cố truy cập cơ sở dữ liệu (lỗi quyền, đầy bộ nhớ, giao dịch bị từ chối), để ứng dụng có ứng xử phù hợp thay vì âm thầm coi lỗi hệ thống là không có dữ liệu.

**Why this priority**: Nuốt lỗi cơ sở dữ liệu và trả về danh sách rỗng khiến ứng dụng có thể hiển thị trạng thái "không có dự án nào", kích hoạt các luồng khởi tạo lại mặc định và có nguy cơ ghi đè dữ liệu đang có của người dùng.

**Independent Test**:
- Giả lập lỗi truy cập cơ sở dữ liệu (Storage Failure): Phương thức trả về đối tượng kết quả có chỉ báo lỗi rõ ràng (`StorageResult` với `success: false` và mã lỗi cụ thể) thay vì trả về mảng rỗng `[]` hay `null`.
- Truy vấn trên cơ sở dữ liệu rỗng thông thường: Phương thức trả về kết quả thành công với dữ liệu là mảng rỗng `[]`.

**Acceptance Scenarios**:
1. **Given** một thao tác đọc dữ liệu dự án hoặc chương từ cơ sở dữ liệu trình duyệt, **When** cơ sở dữ liệu chưa có dữ liệu nào, **Then** hệ thống trả về kết quả thành công kèm mảng rỗng, biểu thị trạng thái không có dữ liệu thông thường.
2. **Given** một thao tác đọc gặp sự cố giao dịch hoặc lỗi thiết bị lưu trữ, **When** bắt lỗi, **Then** hệ thống trả về trạng thái thất bại có cấu trúc kèm thông điệp lỗi cụ thể, ngăn chặn tầng giao diện hiểu nhầm là người dùng chưa có dự án.

---

## Edge Cases

- **Mất kết nối mạng đột ngột giữa lúc đang gửi phản hồi HTTP**: Bộ điều khiển API ghi nhận lỗi mạng đúng 1 lần cho lượt gọi hiện tại, xoay vòng thử khóa tiếp theo nếu còn khóa, và không kích hoạt các nhánh ghi lỗi trùng lặp.
- **Nhiều tab trình duyệt cùng mở và tải lại trang khi một khóa đang bị cạn hạn ngạch**: Tất cả các tab đều đọc lại trạng thái lưu trữ và nhận diện khóa đang ở trạng thái `QuotaExhausted` cho đến 00:00 PST, không có tab nào vô tình mở khóa sớm.
- **Thao tác lưu dự án gặp lỗi đĩa đầy (QuotaExceededError) khi đang xử lý hàng đợi ghi**: Hàng đợi bắt lỗi an toàn, thông báo lỗi tới người dùng qua giao diện cảnh báo dung lượng, và không làm sập các thao tác đọc tiếp theo.
- **Môi trường chạy không hỗ trợ Web Crypto API (ví dụ trình duyệt rất cũ hoặc môi trường restricted sandbox)**: Hệ thống có cơ chế tạo mã băm an toàn dự phòng với độ phân giải đủ lớn để không xảy ra va chạm định danh.
- **Văn bản nguồn hoặc văn bản thô có cấu trúc đoạn văn cực kỳ lệch (ví dụ 10 đoạn Trung nhưng bản thô chỉ có 1 đoạn dài liền)**: Thuật toán phân tách song ngữ phát hiện sự bất đối xứng và tự động ngắt câu dựa trên các dấu chấm câu tự nhiên để ghép cặp ngữ cảnh cân xứng nhất có thể.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống điều phối API (Gemini Client) PHẢI bảo đảm mỗi lượt thử gọi dịch vụ thất bại chỉ kích hoạt hàm ghi nhận lỗi (`recordFailure`) đúng 1 lần duy nhất, phân biệt rõ giữa nhánh phản hồi HTTP lỗi và nhánh biệt lệ mạng.
- **FR-002**: Hệ thống theo dõi hạn ngạch (Local Quota Tracker) PHẢI lưu trữ đầy đủ trạng thái sức khỏe (`healthState`), trạng thái ngắt mạch (`circuitBreakerStatus`), mốc thời gian làm nguội (`cooldownUntil`) và lý do chuyển trạng thái vào bộ nhớ phiên (`sessionStorage`).
- **FR-003**: Khi khởi tạo lại từ bộ nhớ lưu trữ, hệ thống PHẢI giữ nguyên trạng thái cạn hạn ngạch (`QuotaExhausted`) cho đến khi chuyển sang ngày mới theo giờ Thái Bình Dương (00:00 PST), và giữ nguyên trạng thái làm nguội (`RateLimited`, `Cooldown`) nếu mốc thời gian làm nguội chưa kết thúc.
- **FR-004**: Tất cả các thao tác lưu trữ thông tin dự án vào cơ sở dữ liệu (`saveProjectToDB`) phát sinh từ hook quản lý dự án PHẢI được điều phối thông qua hàng đợi tuần tự (Write Queue / Promise Chain), bảo đảm các lần ghi được thực thi tuần tự và không xảy ra tình trạng ghi đè bản ghi cũ lên bản ghi mới.
- **FR-005**: Hàm tạo định danh băm khóa API (`hashApiKey`) PHẢI sử dụng thuật toán băm mật mã học SHA-256 trên cả môi trường trình duyệt (thông qua Web Crypto API) và môi trường kiểm thử (thông qua Node.js Crypto), loại bỏ thuật toán băm số nguyên 32-bit cũ.
- **FR-006**: Hàm băm khóa API PHẢI hỗ trợ cơ chế lưu đệm bộ nhớ (in-memory cache) để phục vụ các lệnh tra cứu định danh tức thời mà không làm ảnh hưởng đến độ trễ giao diện.
- **FR-007**: Tài liệu phân hệ mô hình (`docs/model-system.md`) PHẢI được cập nhật để mô tả chính xác kiến trúc thuần Client-side SPA, loại bỏ toàn bộ mô tả về máy chủ Express trung gian và các endpoint nội bộ không còn tồn tại.
- **FR-008**: Tài liệu chính sách bảo mật (`SECURITY.md`) PHẢI chuẩn hóa các thuật ngữ mô tả kiến trúc thành Client-Direct, loại bỏ cụm từ "Zero-Server-Knowledge" và cập nhật danh sách miền CSP đồng bộ với cấu hình máy chủ tĩnh (`vercel.json`).
- **FR-009**: Tệp cấu hình mẫu (`.env.example`) PHẢI xóa bỏ thông tin không chính xác về việc "mã hóa IndexedDB", phản ánh đúng việc lưu trữ khóa trong bộ nhớ phiên hoặc bộ nhớ cục bộ của trình duyệt.
- **FR-010**: Giao diện hợp đồng phân đoạn song ngữ (`IBilingualSplitter`, `BilingualSplitOptions`) PHẢI được đồng bộ hóa nhất quán với hàm thực thi phân đoạn, hỗ trợ truyền tham số linh hoạt và an toàn kiểu.
- **FR-011**: Thuật toán phân đoạn song ngữ PHẢI bảo vệ ranh giới đoạn văn và câu hoàn chỉnh, xử lý linh hoạt khi số lượng đoạn văn giữa văn bản nguồn và văn bản thô có sự chênh lệch lớn.
- **FR-012**: Các phương thức thao tác cơ sở dữ liệu trong `src/services/db.ts` PHẢI duy trì ngữ nghĩa phân biệt rõ ràng giữa trường hợp dữ liệu rỗng và trường hợp gặp lỗi truy cập lưu trữ thông qua cấu trúc kết quả chuẩn hóa.

### Key Entities

- **KeyStatsSnapshot**: Bản chụp trạng thái của một khóa API, bao gồm mã băm định danh SHA-256 (64 hex), khóa hiển thị che dấu, trạng thái sức khỏe hiện tại, trạng thái ngắt mạch, thời điểm làm nguội kết thúc, bộ đếm số yêu cầu/lỗi/token theo ngày và toàn thời gian.
- **WriteQueueItem**: Một phần tử công việc trong hàng đợi ghi tuần tự của dự án, chứa dữ liệu dự án cần lưu, hàm cam kết ghi cơ sở dữ liệu và lời hứa giải quyết kết quả.
- **TranslationBilingualChunk**: Khối dữ liệu phân đoạn phục vụ chuốt văn, bao gồm chỉ số phân đoạn, tổng số phân đoạn, đoạn văn bản nguồn tiếng Trung nguyên vẹn, đoạn văn bản thô tiếng Việt nguyên vẹn, dải chỉ số đoạn văn tương ứng và ước tính lượng token.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Số lượng lỗi ghi nhận trên bảng điều khiển hạn ngạch trùng khớp 100% với số lượng lượt thử thất bại thực tế (loại bỏ hoàn toàn sai số đếm nhân đôi 2x khi gặp lỗi HTTP).
- **SC-002**: 100% các khóa API đang trong thời gian làm nguội hoặc cạn hạn ngạch ngày bảo toàn chính xác trạng thái nghỉ sau khi người dùng tải lại trang web (0% trường hợp khóa bị kích hoạt sớm gây lỗi 429 lặp lại).
- **SC-003**: 100% các thao tác cập nhật dữ liệu dự án liên tiếp được thực thi tuần tự, loại bỏ hoàn toàn hiện tượng mất mát dữ liệu do tranh chấp tương tranh ghi đè (Race Condition Data Loss = 0).
- **SC-004**: Độ dài mã băm định danh khóa API đạt chuẩn 64 ký tự thập lục phân (SHA-256) trên 100% các nền tảng trình duyệt được hỗ trợ, tỷ lệ va chạm định danh bằng 0.
- **SC-005**: 100% các tài liệu kỹ thuật (`docs/model-system.md`, `SECURITY.md`, `.env.example`) đồng bộ chính xác với kiến trúc thực tế, không còn bất kỳ tham chiếu nào đến máy chủ trung gian Express hay tính năng mã hóa chưa triển khai.
- **SC-006**: Toàn bộ hệ thống vượt qua 100% các tiêu chí kiểm tra nghiêm ngặt của dự án (`npm run lint`, `npm test`, `npm run build`) không có bất kỳ lỗi hoặc cảnh báo tồn đọng nào.

---

## Assumptions

- Người dùng sử dụng các trình duyệt hiện đại có hỗ trợ Web Crypto API (`crypto.subtle`) cho các tác vụ băm SHA-256 tiêu chuẩn; môi trường Node.js kiểm thử hỗ trợ thư viện `crypto` tích hợp sẵn.
- Ứng dụng tiếp tục hoạt động theo mô hình thuần Client-side SPA, toàn bộ dữ liệu người dùng và khóa API được quản trị trực tiếp trên máy người dùng mà không cần bất kỳ máy chủ backend nào.
- Việc lưu trữ hạn ngạch tạm thời trong `sessionStorage` tiếp tục là giải pháp phù hợp để bảo vệ dữ liệu phiên làm việc, đồng thời việc bảo toàn trạng thái nghỉ qua các lần reload bảo đảm tính bền bỉ cần thiết.

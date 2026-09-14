# Feature Specification: Ổn Định Hóa Pipeline Dịch Thuật & Tái Cấu Trúc Toàn Diện (137-pipeline-stabilization-refactor)

**Feature Branch**: `refactor/stabilization-2026-09`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: Yêu cầu ổn định hóa và tái cấu trúc hệ thống toàn diện theo các nhóm ưu tiên P0, P1, P2:
- P0: Sửa ý nghĩa RPM/TPM trong quota tracker (tách provider attempts và successful calls); sửa cooldown QuotaExhausted thành 00:00 PST chuẩn xác; phân loại lỗi 429 dựa trên HTTP status/code/details trước fallback message; sửa rủi ro lệch ranh giới đoạn văn nguồn/thô trong phân đoạn thích ứng; thêm giới hạn gọi đồng thời (concurrency limiter) thay cho Promise.all không kiểm soát.
- P1: Tái cấu trúc hàm xử lý Gemini thành các mô-đun chuyên trách; tái cấu trúc bộ dịch thuật phân tách từng giai đoạn; xử lý trùng lặp và tương tranh đồng bộ đám mây; cô lập bộ nhớ đệm thư mục theo tài khoản người dùng; minh bạch hóa lỗi lưu trữ cơ sở dữ liệu thay vì nuốt lỗi; bảo vệ tính toàn vẹn trạng thái nội dung chương.
- P2: Chuyển đổi hiển thị đối chiếu an toàn; siết chặt danh sách cho phép CSP; chuẩn hóa tập lệnh dọn dẹp đa nền tảng; dọn dẹp các thư viện phụ thuộc dư thừa.

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Hệ thống dịch thuật tiểu thuyết vận hành hoàn toàn trên trình duyệt người dùng với cơ chế kết nối trực tiếp đến API trí tuệ nhân tạo, quản lý và xoay vòng nhiều khóa API, theo dõi hạn ngạch thời gian thực, phân đoạn thích ứng cho văn bản dài, và lưu trữ dữ liệu ngoại tuyến kết hợp đồng bộ tùy chọn lên đám mây.

Qua quá trình vận hành và kiểm toán chuyên sâu, hệ thống đã bộc lộ một số sai lệch logic nghiệp vụ quan trọng cần được ổn định hóa và tái cấu trúc:
1. **Sai lệch chỉ số lưu lượng và hạn ngạch**: Số lượng yêu cầu mỗi phút (RPM) bị tính thiếu do chỉ ghi nhận khi nhận kết quả thành công thay vì ghi nhận ngay khi phát tín hiệu gọi dịch vụ.
2. **Khóa nhầm khóa API quá lâu hoặc quá sớm**: Thời gian tạm dừng khi cạn hạn ngạch ngày bị gán cứng 4 giờ thay vì căn chỉnh theo chu kỳ đặt lại chính thức lúc nửa đêm múi giờ Thái Bình Dương (00:00 PST).
3. **Phân loại lỗi thiếu bền bỉ**: Việc nhận diện lỗi cạn kiệt hạn ngạch hay giới hạn tốc độ phụ thuộc vào chuỗi thông báo vốn dễ thay đổi từ nhà cung cấp.
4. **Lệch ngữ cảnh trong phân đoạn thích ứng**: Chia tách văn bản nguồn và văn bản thô theo hai thuật toán độc lập có thể làm lệch ranh giới đoạn, khiến việc chuốt văn dựa trên ngữ cảnh sai.
5. **Đột biến lưu lượng khi phân đoạn**: Dùng cơ chế gọi đồng thời không giới hạn gây nghẽn và cạn kiệt hạn ngạch cục bộ.
6. **Mã nguồn tập trung quá nhiều trách nhiệm (God Modules)**: Các khối điều phối dịch và giao tiếp API gánh vác quá nhiều vai trò, làm tăng độ phức tạp khi bảo trì và hạn chế khả năng kiểm thử cô lập.
7. **Rủi ro xung đột dữ liệu và bảo mật**: Cần xử lý tương tranh khi tạo thư mục đồng bộ đám mây, làm rõ mã lỗi lưu trữ nội bộ, siết chặt chính sách bảo mật nội dung và loại bỏ các gói dư thừa.

Mục tiêu của đợt hoàn thiện này là đưa hệ thống đạt trạng thái vận hành ổn định, chính xác, an toàn, có khả năng tự phục hồi cao và kiến trúc mô-đun hóa rõ ràng.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Giám sát Hạn ngạch Chuẩn xác & Phục hồi Hạn ngạch Theo Giờ Chuẩn (Priority: P0) 🎯 MVP

Là một người dùng dịch truyện sử dụng nhiều khóa API, tôi muốn bảng điều khiển hạn ngạch phản ánh chính xác số lượt gọi thực tế tới nhà cung cấp (kể cả lượt gọi thất bại/thử lại) và khi một khóa chạm hạn ngạch ngày, hệ thống tự động khóa chính xác cho đến đúng thời điểm đặt lại ngày mới theo giờ Thái Bình Dương (00:00 PST) để khóa được mở lại đúng lúc mà không bị khóa oan hay thử lại quá sớm.

**Why this priority**: Đây là nền tảng quản trị tài nguyên của ứng dụng. Báo cáo sai lưu lượng dẫn đến việc điều tiết sai, gây nghẽn dịch vụ hoặc cạn kiệt tài khoản mà người dùng không nắm được.

**Independent Test**:
- Kích hoạt tiến trình dịch gặp 2 lỗi thử lại trước khi thành công: Bảng điều khiển hiển thị đúng 3 lượt thử nghiệm trong phút, đồng thời lượng token được cộng dồn chính xác sau khi thành công.
- Giả lập lỗi cạn hạn ngạch ngày vào thời điểm 22:00 PST: Thời gian khóa hiển thị đúng 2 giờ (đến 00:00 PST kế tiếp) thay vì 4 giờ.

**Acceptance Scenarios**:
1. **Given** một lượt gọi tới nhà cung cấp được khởi tạo, **When** hàm ghi nhận lượt thử được kích hoạt, **Then** bộ đếm lượt gọi và chỉ số cuộc gọi trong phút (RPM) của khóa đó tăng ngay lập tức tại thời điểm phát sinh, không phụ thuộc vào việc cuộc gọi thành công hay thất bại.
2. **Given** một lượt gọi trả về kết quả thành công kèm thông tin sử dụng token, **When** ghi nhận kết quả thành công, **Then** tổng số token sử dụng và chỉ số token trong phút (TPM) mới được cập nhật vào khóa tương ứng.
3. **Given** một khóa API nhận phản hồi cạn hạn ngạch ngày (RPD Exhausted) tại thời điểm bất kỳ trong ngày, **When** hệ thống thiết lập trạng thái tạm dừng, **Then** thời điểm kết thúc tạm dừng được tính chính xác là thời điểm 00:00 kế tiếp theo múi giờ `America/Los_Angeles`.
4. **Given** thời điểm hiện tại đã bước sang ngày mới theo giờ `America/Los_Angeles`, **When** chu kỳ kiểm tra hạn ngạch kích hoạt, **Then** các bộ đếm ngày của các khóa tự động đặt lại về 0 và các khóa bị khóa do hết hạn ngạch ngày trở lại trạng thái sẵn sàng.

---

### User Story 2 - Nhận Diện Lỗi API Bền Vững & Chuyển Đổi Khóa Linh Hoạt (Priority: P0) 🎯 MVP

Là một dịch giả đang chạy tiến trình dịch hàng loạt, tôi muốn hệ thống phân biệt chính xác giữa lỗi chạm trần tốc độ tức thời (RPM/TPM) và lỗi hết hạn mức trong ngày (RPD) dựa trên cấu trúc phản hồi kỹ thuật chuẩn của nhà cung cấp, giúp hệ thống áp dụng đúng thời gian tạm dừng ngắn cho lỗi tốc độ và chỉ đưa khóa vào thời gian nghỉ dài khi thực sự cạn hạn ngạch ngày.

**Why this priority**: Phân loại sai lỗi 429 khiến khóa chỉ bị nghẽn tốc độ vài chục giây lại bị vô hiệu hóa suốt cả ngày, làm suy giảm nghiêm trọng tốc độ dịch của người dùng.

**Independent Test**:
- Giả lập lỗi 429 với chi tiết lỗi là giới hạn tốc độ RPM: Khóa chỉ tạm dừng trong 45 giây và chuyển trạng thái RateLimited.
- Giả lập lỗi 429 với chi tiết lỗi là hết hạn mức ngày: Khóa chuyển trạng thái QuotaExhausted và hẹn giờ mở lại vào 00:00 PST.

**Acceptance Scenarios**:
1. **Given** phản hồi lỗi từ nhà cung cấp dịch vụ AI, **When** phân loại nguyên nhân lỗi, **Then** hệ thống ưu tiên kiểm tra mã trạng thái giao vận HTTP, mã lỗi kỹ thuật có cấu trúc trong chi tiết phản hồi trước khi dùng đối chiếu chuỗi văn bản thông báo làm biện pháp dự phòng.
2. **Given** lỗi được xác định là giới hạn tốc độ tức thời (RPM/TPM), **When** xử lý khóa API, **Then** hệ thống chỉ đặt thời gian làm nguội ngắn (dưới 60 giây) và tự động chuyển tiếp sang khóa tiếp theo trong danh sách khả dụng.
3. **Given** lỗi được xác định là vi phạm xác thực (401/403), **When** cập nhật sức khỏe khóa, **Then** khóa bị đánh dấu ngưng sử dụng vĩnh viễn trong phiên và hiển thị lý do rõ ràng trên bảng điều khiển.

---

### User Story 3 - Phân Đoạn Thích Ứng Khớp Ngữ Cảnh & Kiểm Soát Tải Đồng Thời (Priority: P0) 🎯 MVP

Là một người dùng dịch các chương truyện dài, khi hệ thống cần chia nhỏ văn bản để chuốt văn hoặc xử lý lại đoạn bị cắt cụt, tôi muốn các đoạn văn bản gốc và văn bản thô được ghép cặp chính xác theo từng đoạn văn tương ứng để nội dung chuốt văn không bị râu ông nọ cắm cằm bà kia, đồng thời các yêu cầu xử lý phân đoạn được thực hiện theo giới hạn lưu lượng đồng thời có kiểm soát để không gây quá tải tài nguyên.

**Why this priority**: Ghép sai râu ông nọ cắm cằm bà kia giữa văn bản tiếng Trung và bản dịch thô tiếng Việt làm hỏng hoàn toàn chất lượng văn học của chương truyện. Bắn yêu cầu ồ ạt làm kiệt quệ tài khoản người dùng trong tích tắc.

**Independent Test**:
- Đưa vào văn bản dài có 10 đoạn văn: Thuật toán phân đoạn tạo ra các khối dịch có ranh giới đoạn văn tương ứng 1:1 giữa tiếng Trung và tiếng Việt.
- Chạy phân đoạn trên 6 khối văn bản: Số lượng yêu cầu phát ra đồng thời luôn tuân thủ ngưỡng cấu hình an toàn (tối đa 1-2 yêu cầu cùng lúc), các khối còn lại xếp hàng chờ.

**Acceptance Scenarios**:
1. **Given** văn bản dài cần được chia nhỏ thành nhiều phần để chuốt văn, **When** thuật toán phân đoạn hoạt động, **Then** việc phân chia phải dựa trên ranh giới đoạn văn chung, tạo thành các khối dịch có cặp văn bản nguồn và văn bản thô tương ứng chính xác về mặt chỉ số đoạn.
2. **Given** một danh sách các phân đoạn cần xử lý hoàn thiện, **When** gửi yêu cầu tới dịch vụ AI, **Then** hệ thống điều phối thông qua bộ giới hạn tương tranh với ngưỡng an toàn thay vì thực hiện đồng thời toàn bộ cùng lúc.
3. **Given** một phân đoạn con gặp lỗi không thể phục hồi, **When** tiến trình hoàn tất các phân đoạn còn lại, **Then** hệ thống sử dụng bản dịch thô tương ứng của phân đoạn lỗi đó làm dự phòng an toàn và ghép nối lại thành bản thảo hoàn chỉnh mà không làm mất mát câu chữ.

---

### User Story 4 - Mô-đun Hóa Bộ Dịch & Trình Kết Nối Dịch Vụ AI (Priority: P1)

Là một lập trình viên duy trì dự án, tôi muốn khối mã giao tiếp dịch vụ AI và động cơ dịch thuật được phân rã thành các mô-đun nhỏ có chức năng độc lập (trình xây dựng yêu cầu, tầng vận chuyển, phân loại lỗi, chính sách thử lại, điều phối khóa, các giai đoạn dịch thô/chuốt/QA riêng biệt) để dễ dàng kiểm thử đơn vị, bảo trì và mở rộng tính năng mà không lo ảnh hưởng chéo.

**Why this priority**: Giảm độ phức tạp từ các hàm/tập tin ôm đồm hàng ngàn dòng mã (God functions/services), nâng cao độ ổn định lâu dài và chất lượng kiểm thử tự động.

**Independent Test**:
- Mỗi mô-đun (ví dụ: bộ phân loại lỗi, bộ điều phối khóa, bộ chia tách phân đoạn) có bộ kiểm thử đơn vị riêng biệt chạy độc lập và vượt qua 100%.

**Acceptance Scenarios**:
1. **Given** quy trình gọi API dịch thuật, **When** mã nguồn thực thi, **Then** trách nhiệm tạo yêu cầu, vận chuyển mạng, phân loại lỗi và thử lại được xử lý tại các mô-đun riêng biệt, có giao diện kết nối rõ ràng.
2. **Given** quy trình xử lý nội dung dịch thuật, **When** mã nguồn thực thi, **Then** các bước dịch thô, chuốt văn, đánh giá chất lượng (QA), viết lại câu và phân tách văn bản được tổ chức thành các tập tin chức năng chuyên biệt, xuất ra API thống nhất tại điểm truy cập chính.

---

### User Story 5 - Khắc Phục Xung Đột Đám Mây & Minh Bạch Hóa Lưu Trữ Cục Bộ (Priority: P1)

Là một người dùng sử dụng tính năng đồng bộ đám mây và lưu trữ ngoại tuyến, tôi muốn ứng dụng không tạo ra các thư mục trùng lặp khi chạy trên nhiều thẻ trình duyệt, bộ nhớ đệm thư mục được dọn sạch khi đổi tài khoản, và khi cơ sở dữ liệu gặp lỗi truy cập thì ứng dụng thông báo trung thực nguyên nhân thay vì âm thầm trả về danh sách rỗng khiến tôi lầm tưởng đã mất toàn bộ dự án.

**Why this priority**: Tránh làm rác tài khoản lưu trữ đám mây của người dùng và ngăn chặn hiểu lầm nguy hiểm về việc mất mát dữ liệu khi chỉ đơn thuần là lỗi tạm thời của hệ thống lưu trữ trình duyệt.

**Independent Test**:
- Mở hai thao tác kiểm tra thư mục đám mây cùng lúc: Hệ thống nhận diện thư mục sẵn có qua cơ chế kiểm tra đối soát, không tạo ra hai thư mục trùng tên.
- Giả lập lỗi truy vấn cơ sở dữ liệu: Hệ thống trả về trạng thái lỗi lưu trữ có cấu trúc thay vì trả về mảng rỗng giả mạo tình trạng không có dự án.

**Acceptance Scenarios**:
1. **Given** thao tác đảm bảo thư mục lưu trữ trên dịch vụ đám mây, **When** kiểm tra và tạo mới thư mục, **Then** hệ thống có cơ chế kiểm soát tương tranh và đối soát sau tạo để đảm bảo không sinh ra các thư mục trùng lặp.
2. **Given** người dùng đăng xuất hoặc chuyển đổi tài khoản đám mây, **When** danh tính thay đổi, **Then** các giá trị định danh thư mục đã lưu trong bộ nhớ đệm lập tức bị xóa bỏ hoàn toàn.
3. **Given** các thao tác truy vấn dữ liệu dự án từ cơ sở dữ liệu trình duyệt gặp sự cố phần cứng hoặc quyền truy cập, **When** bắt lỗi, **Then** hệ thống trả về kết quả lỗi rõ ràng để phân biệt với trường hợp người dùng thực sự chưa có dự án nào.

---

### User Story 6 - Tăng Cường Bảo Mật Giao Diện & Tối Ưu Môi Trường Dự Án (Priority: P2)

Là một thành viên phát triển ứng dụng trên các hệ điều hành khác nhau (bao gồm Windows), tôi muốn các tập lệnh biên dịch và dọn dẹp hoạt động mượt mà không phụ thuộc shell Unix, các phụ thuộc không dùng như `dotenv` được loại bỏ khỏi ứng dụng chạy trên trình duyệt, các chính sách bảo mật nội dung (CSP) được giới hạn chặt chẽ, và giao diện so sánh đối chiếu văn bản được kết xuất bằng các phần tử an toàn.

**Why this priority**: Nâng cao tính an toàn ứng dụng (AppSec), tối ưu dung lượng gói ứng dụng và đảm bảo trải nghiệm phát triển nhất quán trên mọi hệ điều hành.

**Independent Test**:
- Chạy lệnh dọn dẹp trên Windows PowerShell: Thư mục phân phối được xóa sạch sẽ không báo lỗi lệnh.
- Kiểm tra các phần tử đối chiếu văn bản: Không sử dụng các cơ chế chèn HTML thô trực tiếp mà hiển thị qua các thẻ giao diện có cấu trúc an toàn.

**Acceptance Scenarios**:
1. **Given** giao diện đối chiếu khác biệt văn bản, **When** hiển thị các từ ngữ và điểm đánh dấu, **Then** nội dung được hiển thị thông qua cấu trúc thành phần giao diện an toàn, ngăn ngừa triệt để nguy cơ chèn mã độc.
2. **Given** cấu hình bảo mật nội dung (CSP), **When** ứng dụng tải tài nguyên, **Then** danh sách kết nối chỉ giới hạn đúng các điểm cuối thực tế đang vận hành, loại bỏ các miền đại diện quá rộng.
3. **Given** môi trường phát triển trên hệ điều hành Windows, **When** thực thi lệnh dọn dẹp bản dựng, **Then** tập lệnh chạy thành công mà không phụ thuộc vào tiện ích dòng lệnh của hệ điều hành khác.
4. **Given** danh mục các thư viện phụ thuộc, **When** kiểm toán gói phần mềm, **Then** các gói phụ thuộc vốn chỉ dành cho môi trường máy chủ cũ (như `dotenv`) được gỡ bỏ hoàn toàn khỏi dự án.

---

## Edge Cases

- **Tất cả các khóa API đều cạn hạn ngạch hoặc lỗi xác thực**: Hệ thống phải thông báo trạng thái kiệt quệ toàn bộ tới người dùng, hiển thị thời gian dự kiến mở lại khóa sớm nhất (00:00 PST) và ngừng gửi yêu cầu vô ích.
- **Văn bản nguồn không có dấu ngắt đoạn rõ ràng (một khối ký tự liền mạch)**: Thuật toán phân đoạn thích ứng phải có cơ chế ngắt dòng dựa trên dấu câu tự nhiên (dấu chấm, dấu chấm phẩy, dấu chấm than) để tạo ranh giới ghép cặp an toàn.
- **Đồng hồ máy tính của người dùng bị sai lệch giờ**: Việc tính thời điểm 00:00 PST phải dựa trên mốc thời gian chuyển đổi múi giờ chuẩn, xử lý an toàn kể cả khi đồng hồ hệ thống địa phương có độ trễ hoặc chạy nhanh.
- **Mạng gián đoạn giữa chừng khi đang phân đoạn**: Bộ điều tiết lưu lượng phải bảo toàn trạng thái của các phân đoạn đã hoàn thành, cho phép tiếp tục hoặc dự phòng bản dịch thô cho phân đoạn bị gián đoạn.
- **Hai phiên làm việc trên các tab khác nhau cùng lưu dữ liệu**: Hệ thống bảo vệ tính toàn vẹn của chương đang mở bằng cách coi trạng thái cộng tác thời gian thực là nguồn chân lý duy nhất, tránh ghi đè dữ liệu cũ lên bản ghi mới.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI tách biệt rõ ràng việc ghi nhận lượt thử gọi dịch vụ (provider attempts) và lượt gọi thành công (successful calls) trong bộ theo dõi hạn ngạch.
- **FR-002**: Lượt thử gọi dịch vụ và chỉ số cuộc gọi mỗi phút (RPM) PHẢI được ghi nhận ngay tại thời điểm phát sinh yêu cầu tới nhà cung cấp, bất kể kết quả sau đó là thành công hay thất bại.
- **FR-003**: Số lượng token tiêu thụ và chỉ số token mỗi phút (TPM) PHẢI chỉ được cập nhật khi nhận được kết quả xử lý thành công từ nhà cung cấp dịch vụ.
- **FR-004**: Khi một khóa API bị cạn hạn mức ngày (RPD Quota Exhausted), thời gian làm nguội PHẢI được tính toán chính xác đến thời điểm 00:00 kế tiếp theo múi giờ `America/Los_Angeles` thay vì áp dụng khoảng thời gian cố định 4 giờ.
- **FR-005**: Hệ thống PHẢI ưu tiên phân loại lỗi API dựa trên mã trạng thái HTTP, mã trạng thái nghiệp vụ và cấu trúc chi tiết phản hồi trước khi sử dụng chuỗi văn bản thông báo lỗi làm phương án dự phòng.
- **FR-006**: Khi phân đoạn thích ứng văn bản dài hoặc thử lại phân đoạn, hệ thống PHẢI chia tách dựa trên ranh giới đoạn văn chung để đảm bảo văn bản nguồn và văn bản thô luôn ghép cặp chính xác 1:1 theo từng phân đoạn (`TranslationChunk`).
- **FR-007**: Quá trình xử lý song song các phân đoạn thích ứng PHẢI được điều tiết thông qua bộ kiểm soát lưu lượng đồng thời (concurrency limiter) với ngưỡng giới hạn an toàn có thể cấu hình, thay vì gửi đồng loạt không giới hạn.
- **FR-008**: Hàm giao tiếp dịch vụ AI trực tiếp (`callGeminiDirect`) PHẢI được tái cấu trúc thành các mô-đun chuyên biệt: xây dựng yêu cầu, vận chuyển mạng, phân loại lỗi, chính sách thử lại và điều phối khóa.
- **FR-009**: Động cơ dịch thuật (`directTranslationEngine`) PHẢI được phân rã thành các mô-đun dịch thuật độc lập (dịch thô, chuốt văn, thẩm định QA, viết lại câu, phân đoạn thích ứng, kiểm tra tính toàn vẹn) với một điểm xuất API thống nhất.
- **FR-010**: Thao tác tạo thư mục và tập tin đồng bộ đám mây PHẢI có cơ chế kiểm soát tương tranh và đối soát sau khởi tạo để triệt tiêu nguy cơ tạo bản sao thư mục/tập tin trùng lặp.
- **FR-011**: Định danh thư mục đồng bộ đám mây trong bộ nhớ đệm PHẢI được gắn chặt với danh tính người dùng xác thực và tự động xóa sạch khi người dùng đăng xuất hoặc chuyển đổi tài khoản.
- **FR-012**: Các hàm truy xuất dữ liệu từ cơ sở dữ liệu trình duyệt PHẢI phân biệt rõ ràng giữa trạng thái "không tìm thấy dữ liệu" và "lỗi truy cập cơ sở dữ liệu", trả về cấu trúc kết quả tường minh thay vì nuốt lỗi và trả về mảng rỗng.
- **FR-013**: Trạng thái cộng tác thời gian thực của chương đang biên tập PHẢI được duy trì là nguồn chân lý duy nhất (Single Source of Truth), ngăn ngừa việc các ảnh chụp dự án cũ ghi đè làm mất nội dung đang soạn thảo.
- **FR-014**: Giao diện hiển thị so sánh đối chiếu văn bản PHẢI kết xuất an toàn qua các thành phần giao diện có cấu trúc, loại bỏ việc phụ thuộc vào chèn chuỗi mã HTML trực tiếp.
- **FR-015**: Cấu hình chính sách bảo mật nội dung (CSP) PHẢI được rà soát và thu hẹp, chỉ cho phép kết nối đến các điểm cuối dịch vụ thực tế cần thiết, loại bỏ các miền đại diện quá rộng.
- **FR-016**: Tập lệnh dọn dẹp bản dựng PHẢI tương thích hoàn toàn với môi trường Windows, và các gói phụ thuộc máy chủ không còn sử dụng (như `dotenv`) PHẢI được loại bỏ khỏi tệp cấu hình dự án.

---

### Key Entities

- **Chỉ Số Sức Khỏe Khóa (KeyHealthStats)**: Theo dõi trạng thái hoạt động của từng khóa API, bao gồm số lượt thử thực tế, số lượt thành công, số lỗi, chỉ số RPM/TPM tính trên cửa sổ trượt 60 giây, trạng thái ngắt mạch (Circuit Breaker) và thời điểm hết hạn làm nguội chuẩn hóa.
- **Khối Dịch Đồng Bộ (TranslationChunk)**: Cấu trúc phân đoạn đại diện cho một phần văn bản nguồn và văn bản thô được cắt khớp chính xác theo ranh giới đoạn văn (chỉ số đoạn bắt đầu và kết thúc), đảm bảo 1:1 về ngữ cảnh.
- **Bộ Điều Tiết Lưu Lượng (ConcurrencyLimiter)**: Cơ chế kiểm soát số lượng tác vụ mạng được phép thực thi đồng thời, đưa các tác vụ vượt ngưỡng vào hàng đợi chờ và tự động xử lý tuần tự an toàn.
- **Kết Quả Thao Tác Lưu Trữ (StorageResult)**: Kiểu dữ liệu phân định rõ ràng trạng thái thành công kèm dữ liệu, trạng thái không có dữ liệu, hoặc trạng thái gặp sự cố kỹ thuật kèm mã lỗi cụ thể.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các lượt thử gọi dịch vụ API (kể cả thất bại, thử lại hoặc thành công) được ghi nhận tức thì vào chỉ số lưu lượng RPM của khóa tương ứng ngay tại thời điểm phát sinh.
- **SC-002**: Độ lệch thời gian kết thúc làm nguội của khóa khi chạm hạn ngạch ngày (RPD) so với thời điểm 00:00 PST kế tiếp là 0 giây (chính xác tuyệt đối theo chu kỳ của nhà cung cấp).
- **SC-003**: 0% trường hợp ghép lệch ranh giới đoạn văn giữa văn bản nguồn và văn bản thô trong quá trình phân đoạn thích ứng hoặc xử lý lại đoạn lỗi.
- **SC-004**: Số lượng yêu cầu dịch phân đoạn phát ra đồng thời không bao giờ vượt quá ngưỡng tương tranh an toàn được cấu hình (mặc định tối đa 2 yêu cầu đồng thời).
- **SC-005**: 0% trường hợp tạo trùng lặp thư mục ứng dụng trên dịch vụ đám mây khi người dùng mở nhiều phiên làm việc cùng lúc.
- **SC-006**: 100% các lỗi truy cập cơ sở dữ liệu nội bộ được báo cáo rõ ràng tới tầng điều phối, không bị nhầm lẫn với trạng thái không có dữ liệu.
- **SC-007**: 100% các tiêu chuẩn kiểm tra chất lượng của dự án (`npm run lint`, `npm test`, `npm run build`) vượt qua sạch sẽ, không có bất kỳ lỗi kiểu dữ liệu hay bài kiểm thử nào bị vô hiệu hóa.

---

## Assumptions

- Ứng dụng là phần mềm chạy hoàn toàn trên trình duyệt người dùng (Pure Client-Side SPA); việc điều tiết hạn ngạch và tương tranh áp dụng trong phạm vi phiên làm việc của người dùng hiện tại.
- Múi giờ đặt lại hạn ngạch ngày của dịch vụ Google Gemini API là nửa đêm (00:00) theo giờ chuẩn Thái Bình Dương (`America/Los_Angeles`).
- Trình duyệt người dùng hỗ trợ các tiêu chuẩn múi giờ quốc tế tiêu chuẩn (`Intl.DateTimeFormat`) để xác định chính xác thời điểm chuyển ngày tại Los Angeles.
- Tính năng phân đoạn thích ứng dựa trên ranh giới ngắt đoạn chuẩn (`\n\n` hoặc `\n`), và khi văn bản thiếu ngắt đoạn thì sẽ chia nhỏ theo câu trước khi chuyển sang phân đoạn an toàn.

# Feature Specification: Chờ Phục Hồi Hạn Mức Tạm Thời (RPM Cooldown) & Tự Động Tiếp Tục Khi Quét Thuật Ngữ / Xử Lý Hàng Loạt

**Feature Branch**: `168-rate-limit-cooldown-wait-recovery`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "Xử lý lỗi chạm giới hạn 15 request/phút (429 RESOURCE_EXHAUSTED, yêu cầu chờ retry delay như 36.58s) khi quét thuật ngữ sỉ: không khóa cứng toàn bộ API Key thành hết hạn mức vĩnh viễn và không bỏ qua hàng loạt chương còn lại; phải chờ hết thời gian hồi phục rồi tiếp tục hoặc dừng/báo đúng trạng thái."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phân biệt quá tải tạm thời theo phút (RPM) với cạn hạn mức ngày/vĩnh viễn và tôn trọng thời gian chờ phản hồi (Priority: P1)

Khi người dùng chạy tác vụ AI (như quét thuật ngữ hoặc dịch) và gặp lỗi giới hạn tốc độ theo phút kèm thời gian đề nghị chờ cụ thể từ nhà cung cấp dịch vụ (ví dụ: giới hạn 15 yêu cầu/phút, yêu cầu thử lại sau 36,58 giây), hệ thống phải nhận diện chính xác đây là **tạm nghỉ theo phút (tạm thời)** với đúng khoảng thời gian hồi phục được yêu cầu (cộng một khoảng đệm an toàn nhỏ), chứ không đánh dấu khóa cứng khóa hoặc báo "toàn bộ khóa đã hết hạn mức" dài hạn như lỗi hết hạn mức ngày hay lỗi xác thực. Nếu còn khóa khác khả dụng, hệ thống chuyển sang khóa kế tiếp; nếu tất cả khóa đều đang trong trạng thái tạm nghỉ theo phút có thể hồi phục trong thời gian ngắn, hệ thống tự động chờ hết thời gian hồi phục ngắn nhất rồi thử lại yêu cầu đang xử lý.

**Why this priority**: Đây là nguyên nhân gốc gây sụp đổ cả phiên quét khi chỉ một khóa hoặc bộ khóa Free Tier chạm ngưỡng RPM. Nếu không phân biệt tạm nghỉ RPM với cạn hạn mức thật và không tôn trọng thời gian chờ nhà cung cấp trả về, mọi tác vụ dài đều thất bại ngay tại điểm chạm giới hạn đầu tiên.

**Independent Test**: Có thể kiểm thử độc lập bằng cách mô phỏng một khóa chạm giới hạn tốc độ theo phút kèm thông báo chờ 36,58 giây: xác nhận hệ thống ghi nhận thời gian hồi phục tương ứng với khoảng chờ đó (không phải 5 phút), tự động chuyển khóa nếu có khóa rảnh hoặc chờ hết khoảng thời gian hồi phục rồi thực hiện lại thành công yêu cầu đó.

**Acceptance Scenarios**:

1. **Given** người dùng đang sử dụng một khóa API ở gói miễn phí (15 yêu cầu/phút) và nhận phản hồi quá giới hạn tạm thời kèm thời gian chờ đề nghị (ví dụ 36,58 giây), **When** không còn khóa nào khác đang rảnh và người dùng chưa yêu cầu dừng, **Then** hệ thống hiển thị thông báo rõ ràng đang tạm chờ hồi phục hạn mức theo phút (kèm thời gian đếm ngược dự kiến), tự động đợi hết khoảng thời gian chờ cộng đệm an toàn rồi gửi lại yêu cầu vừa bị gián đoạn.
2. **Given** người dùng có nhiều khóa API nhưng tất cả khóa đều đang tạm nghỉ theo phút với thời gian còn lại khác nhau (ví dụ khóa A còn 45 giây, khóa B còn 12 giây), **When** có yêu cầu mới cần thực thi, **Then** hệ thống chờ đúng theo khóa sẽ hồi phục sớm nhất (12 giây), mở khóa lại trạng thái sẵn sàng cho khóa đó và tiếp tục xử lý mà không báo lỗi hết hạn mức giả.
3. **Given** khóa API gặp lỗi hết hạn mức theo ngày thực sự hoặc lỗi khóa không hợp lệ/bị thu hồi, **When** hệ thống phân loại lỗi, **Then** hệ thống giữ nguyên trạng thái tạm ngừng dài hạn đối với khóa đó và không chờ vô ích như lỗi giới hạn theo phút.
4. **Given** người dùng bấm nút **Dừng** hoặc đóng tác vụ trong lúc hệ thống đang đếm ngược chờ hồi phục hạn mức, **When** tín hiệu hủy được kích hoạt, **Then** hệ thống hủy việc chờ ngay lập tức (không đợi hết mấy chục giây còn lại) và trả về trạng thái dừng sạch sẽ.

---

### User Story 2 - Điều phối nhịp độ và dừng/tiếp tục chính xác trong quy trình quét thuật ngữ hàng loạt (Priority: P1)

Trong quy trình quét thuật ngữ tự động qua nhiều chương (kể cả nhiều vòng rà soát và lượt quét lại chương lỗi), hệ thống phải điều tiết nhịp gửi yêu cầu phù hợp với hạn mức khả dụng của các khóa, đồng thời xử lý đúng tín hiệu khi toàn bộ khóa thực sự cạn hạn mức:
- Khi gặp tạm nghỉ theo phút, luồng quét **chờ phục hồi và tiếp tục đúng tại chương đang dở** (chương 47), tuyệt đối không lao qua đánh dấu lỗi hàng loạt 28 chương còn lại (chương 48–75) chỉ vì khóa đang trong thời gian chờ.
- Khi toàn bộ khóa **thực sự hết hạn mức không thể tự hồi phục trong phiên** (hoặc vượt ngưỡng chờ tối đa cho phép), luồng quét phải **dừng ngay lập tức** tại chương lỗi, bảo toàn danh sách chương chưa quét/lỗi để quét bù sau, và **không** chạy lướt qua các chương còn lại hay thông báo sai rằng "ĐÃ HOÀN TẤT THÀNH CÔNG".

**Why this priority**: Hành vi hiện tại khiến người dùng mất trọn lượt quét các chương sau (48–75), nhật ký ngập hàng chục dòng lỗi lặp lại qua cả Vòng 1, lượt quét lại và Vòng 2, rồi nhận thông báo "HOÀN TẤT THÀNH CÔNG" sai sự thật. Sửa dứt điểm luồng điều phối hàng loạt giúp quá trình quét tự động đáng tin cậy trên các bộ truyện dài hàng trăm chương.

**Independent Test**: Có thể kiểm thử độc lập bằng cách chạy quét hàng loạt trên danh sách 10 chương, mô phỏng lỗi giới hạn RPM ở chương thứ 4 và kiểm tra: (a) phiên quét chờ và hoàn tất đủ 10/10 chương khi phục hồi được, và (b) nếu tất cả khóa thực sự cạn hạn mức dài hạn ở chương thứ 4 thì phiên quét dừng ngay tại chương 4 với thông báo dừng do hết hạn mức (không nhảy sang chương 5–10 và không in thông báo hoàn tất thành công).

**Acceptance Scenarios**:

1. **Given** người dùng chạy quét thuật ngữ hàng loạt từ chương 1 đến chương 76 với 1 khóa Free Tier 15 yêu cầu/phút, **When** hệ thống chạm giới hạn tốc độ ở chương 47 kèm yêu cầu chờ 36,58 giây, **Then** hệ thống tạm dừng đúng tại chương 47, hiển thị trạng thái chờ phục hồi trên nhật ký/giao diện, tự động chờ hết thời gian hồi phục rồi tiếp tục quét thành công chương 47 và các chương 48–76.
2. **Given** người dùng chạy quét thuật ngữ nhiều vòng (Vòng 1, Vòng 2) và có lượt quét lại chương lỗi, **When** toàn bộ khóa API thực sự hết hạn mức ngày hoặc vượt quá ngưỡng chờ tối đa mà vẫn không có khóa nào hồi phục, **Then** tiến trình quét dừng ngay tại chương đang xử lý, không lặp tiếp sang các chương phía sau, không chạy tiếp Vòng 2 hay lượt quét lại chương lỗi vô ích, và hiển thị trạng thái dừng do hết hạn mức kèm số chương còn lại chưa quét.
3. **Given** người dùng cấu hình hoặc sử dụng mô hình gói miễn phí có giới hạn RPM thấp, **When** quét tuần tự nhiều chương liên tiếp, **Then** bộ điều phối giãn nhịp gửi yêu cầu hợp lý giữa các chương theo số lượng khóa khả dụng để giảm thiểu tối đa việc chạm ngưỡng 429 ngay từ đầu.
4. **Given** tiến trình quét vừa vượt qua một đợt tạm nghỉ RPM hoặc vừa lưu tiến độ định kỳ, **When** lưu trạng thái dự án, **Then** toàn bộ thuật ngữ đã trích xuất trước đó và danh sách chương chưa hoàn thành được lưu an toàn, không bị mất dữ liệu nếu người dùng dừng giữa chừng.

---

### User Story 3 - Hiển thị rõ trạng thái chờ hồi phục vs hết hạn mức và cho phép tiếp tục phần còn lại (Priority: P2)

Khi tác vụ quét hoặc xử lý hàng loạt đang tạm chờ hồi phục hạn mức hoặc phải dừng giữa chừng do hết hạn mức thực sự, người dùng nhìn thấy phân biệt rõ ràng trên nhật ký và tiến trình: đang tạm chờ bao nhiêu giây để tự chạy tiếp, hay đã dừng thật do cạn hạn mức ngày tại chương nào. Nếu phiên quét buộc phải dừng giữa chừng do hết hạn mức thực sự, danh sách chương chưa quét và chương lỗi được ghi nhận đầy đủ để người dùng có thể bấm quét tiếp phần còn lại khi có hạn mức mới mà không phải quét lại từ chương 1.

**Why this priority**: Minh bạch hóa trạng thái giúp người dùng yên tâm rằng hệ thống đang tự chờ chứ không bị treo, đồng thời tránh lãng phí hạn mức quét lại 46 chương đầu khi phiên quét bị dừng ở chương 47.

**Independent Test**: Có thể kiểm thử bằng cách mô phỏng dừng phiên quét do hết hạn mức thực sự tại chương 5/10, kiểm tra thông báo trạng thái hiển thị rõ lý do dừng và số chương chưa hoàn thành (từ chương 5 đến 10), sau đó bấm quét lại phần còn lại để xác nhận chỉ quét từ chương 5–10.

**Acceptance Scenarios**:

1. **Given** tiến trình quét đang ở trạng thái tạm chờ hồi phục RPM 37 giây, **When** người dùng theo dõi màn hình quét, **Then** nhật ký và chỉ báo tiến trình hiển thị rõ "Đang tạm chờ hồi phục hạn mức (~37s) trước khi tiếp tục chương [Tên chương]..." thay vì báo lỗi đỏ hàng loạt.
2. **Given** tiến trình quét phải dừng thực sự tại chương 47/76 do hết hạn mức ngày, **When** tiến trình kết thúc, **Then** thông báo kết quả nêu rõ đã dừng do hết hạn mức tại chương 47, số thuật ngữ đã lưu được, và đưa toàn bộ các chương chưa hoàn thành (chương 47–76) vào danh sách có thể quét tiếp một chạm.

---

### Edge Cases

- **Thời gian chờ từ nhà cung cấp quá lớn hoặc không hợp lệ**: Nếu thông báo lỗi 429 yêu cầu thời gian chờ vượt quá ngưỡng chờ tự động cho phép (ví dụ > 120 giây) hoặc lỗi thuộc nhóm cạn hạn mức theo ngày (RPD), hệ thống không treo chờ vô thời hạn mà chuyển sang trạng thái hết hạn mức thực sự và dừng phiên quét an toàn.
- **Chuỗi thời gian chờ nhiều định dạng**: Thông điệp lỗi từ nhà cung cấp có thể ghi `36.580235449s`, `45s`, `1200ms` hoặc qua header `Retry-After`; hệ thống phải phân tích chính xác mọi định dạng và làm tròn lên kèm đệm an toàn (ví dụ +1–2 giây) để không vừa hết giờ gọi lại đã bị từ chối tiếp.
- **Một yêu cầu phải chờ nhiều lần liên tiếp**: Để tránh vòng lặp vô hạn nếu khóa vẫn bị từ chối ngay cả sau khi đã chờ, mỗi yêu cầu chỉ được phép tự chờ tối đa một số lần giới hạn (ví dụ tối đa 2 lần chờ RPM cho một lượt gọi) trước khi coi là hết hạn mức tạm thời không thể phục hồi ngay.
- **Nhiều tác vụ hoặc nhiều luồng gọi đồng thời cùng chạm 429**: Khi tách đoạn hoặc chạy song song tối đa 2 luồng bị chạm giới hạn cùng lúc, hệ thống dùng chung thời điểm mở khóa của khóa đó để tránh một luồng vừa báo chờ 37s thì luồng kia lại spam gửi tiếp ngay lập tức.
- **Ngắt hủy (Abort) giữa lúc đang ngủ chờ**: Mọi bộ đếm thời gian chờ phải gắn chặt với tín hiệu hủy của người dùng/màn hình để giải phóng tài nguyên tức thì khi bấm Dừng hoặc chuyển trang.
- **Cảnh báo tiến trình kết thúc**: Chỉ được phép hiển thị thông báo hoàn tất thành công khi toàn bộ vòng quét chạy hết mà không bị dừng cưỡng bức do hủy hoặc hết hạn mức.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI phân biệt rạch ròi giữa lỗi **giới hạn tốc độ tạm thời theo phút (RPM)** có khả năng tự hồi phục sau thời gian ngắn với lỗi **cạn hạn mức theo ngày (RPD)** hoặc lỗi xác thực không tự hồi phục trong ngắn hạn.
- **FR-002**: Khi nhận lỗi giới hạn tốc độ có kèm thời gian đề nghị thử lại (từ nội dung lỗi hoặc phản hồi hệ thống), hệ thống PHẢI sử dụng chính xác khoảng thời gian chờ đó (cộng một khoảng đệm an toàn nhỏ) làm thời gian tạm nghỉ của khóa thay vì áp dụng mức phạt khóa cứng dài hạn mặc định.
- **FR-003**: Khi tất cả khóa API đều đang ở trạng thái tạm nghỉ theo phút có thời gian hồi phục nằm trong ngưỡng chờ cho phép (ví dụ tối đa 120 giây cho một lần chờ), hệ thống PHẢI tự động chờ đến khi khóa hồi phục sớm nhất sẵn sàng trở lại và thử lại yêu cầu đang thực thi, thay vì lập tức ném lỗi hết hạn mức toàn bộ khóa.
- **FR-004**: Cơ chế chờ hồi phục PHẢI có giới hạn số lần chờ lại cho mỗi yêu cầu (ví dụ tối đa 2 lần chờ) và giới hạn ngưỡng chờ tối đa để ngăn chặn vòng lặp vô hạn.
- **FR-005**: Mọi thao tác chờ hồi phục PHẢI lắng nghe tín hiệu hủy của người dùng; khi người dùng bấm Dừng hoặc rời màn hình, việc chờ phải kết thúc ngay lập tức.
- **FR-006**: Luồng quét thuật ngữ hàng loạt PHẢI nhận diện chính xác tín hiệu hết toàn bộ hạn mức (kể cả qua mã lỗi chuẩn hóa lẫn thông điệp lỗi) để **dừng ngay vòng lặp hiện tại, bỏ qua các vòng rà soát kế tiếp và bỏ qua lượt quét lại chương lỗi** khi không thể tiếp tục.
- **FR-007**: Khi luồng quét hàng loạt buộc phải dừng do hết hạn mức thực sự, hệ thống PHẢI:
  - Không chạy lướt qua các chương còn lại và không ghi hàng chục dòng lỗi lặp lại;
  - Không hiển thị thông báo "ĐÃ HOÀN TẤT THÀNH CÔNG";
  - Hiển thị thông báo dừng do hết hạn mức kèm vị trí chương dừng và lưu danh sách các chương chưa hoàn thành (từ chương dừng đến cuối phạm vi quét) để người dùng có thể quét tiếp về sau.
- **FR-008**: Khi quá trình quét tạm chờ hồi phục theo phút thành công, luồng quét PHẢI tiếp tục thực thi ngay tại chính chương đã kích hoạt việc chờ (không bỏ qua chương đó thành chương lỗi) và tiếp tục các chương còn lại.
- **FR-009**: Bộ điều phối quét thuật ngữ hàng loạt PHẢI áp dụng giãn nhịp yêu cầu hợp lý giữa các chương (tính theo trạng thái và số lượng khóa khả dụng) nhằm hạn chế tối đa nguy cơ chạm ngưỡng giới hạn yêu cầu/phút của gói miễn phí ngay từ gốc.
- **FR-010**: Nhật ký quét thuật ngữ PHẢI phân biệt rõ thông báo **đang tạm chờ hồi phục hạn mức (kèm số giây dự kiến)** với thông báo **lỗi dừng do hết hạn mức thực sự**.

### Key Entities *(include if feature involves data)*

- **Trạng thái Tạm nghỉ Khóa (Key Cooldown State)**: Lưu lý do tạm nghỉ (tạm thời theo phút RPM vs dài hạn theo ngày/xác thực), thời điểm mở khóa dự kiến dựa trên `retryDelay` thực tế, và khả năng tự hồi phục trong phiên.
- **Phiên Quét Thuật Ngữ Hàng Loạt (Bulk Glossary Scan Session)**: Theo dõi vòng quét hiện tại, chương đang xử lý, danh sách chương lỗi/chưa quét do dừng giữa chừng, trạng thái dừng chủ động/hết hạn mức và tiến trình lưu thuật ngữ định kỳ.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Khi gặp phản hồi 429 RPM yêu cầu chờ `N` giây (với `N <= 120`, ví dụ 36,58 giây) trên phiên bản chỉ có 1 khóa API, 100% trường hợp hệ thống tự chờ khoảng `N` giây (+ đệm an toàn) và hoàn tất thành công yêu cầu đó mà không báo lỗi toàn bộ khóa hết hạn mức.
- **SC-002**: Trong phiên quét hàng loạt 76 chương với tốc độ chạm giới hạn RPM ở chương 47, hệ thống không bỏ sót hay đánh dấu lỗi oan 28 chương phía sau (chương 48–75) chỉ vì khóa đang trong thời gian chờ hồi phục.
- **SC-003**: Khi tất cả khóa thực sự hết hạn mức không thể phục hồi ở chương thứ `k` trong danh sách `M` chương, số chương bị gọi thừa sau chương `k` là **0 chương**, số thông báo "HOÀN TẤT THÀNH CÔNG" sai sự thật là **0**, và toàn bộ chương chưa hoàn thành từ `k` đến `M` được giữ lại để quét bù.
- **SC-004**: Khi người dùng bấm Dừng trong lúc đang chờ hồi phục RPM, tiến trình giải phóng và chuyển về trạng thái dừng trong dưới 500ms mà không chờ hết phần thời gian đếm ngược còn lại.

## Assumptions

- Ngưỡng chờ tự động tối đa hợp lý cho một lần tạm nghỉ theo phút (RPM) mặc định là 120 giây (và tối đa 2 lần chờ tự động cho một yêu cầu); các yêu cầu chờ lâu hơn (như cạn hạn mức ngày RPD tính bằng giờ) được xem là hết hạn mức dài hạn và dừng phiên ngay để người dùng đổi khóa hoặc quay lại sau.
- Thông báo chờ hồi phục ưu tiên giữ nguyên tính phản hồi tức thì của giao diện (có thể hủy bất cứ lúc nào).
- Cải tiến này áp dụng trước hết cho bộ điều phối gọi AI lõi và luồng quét thuật ngữ hàng loạt, đồng thời giữ tương thích ngược hoàn toàn với các quy trình dịch chương tự động và bảng điều khiển hạn mức hiện có.

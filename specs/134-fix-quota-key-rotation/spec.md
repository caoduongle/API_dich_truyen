# Feature Specification: Sửa Cơ Chế Xoay Vòng API Key Khi Chạm Quota & Tránh Kẹt Khóa Lỗi (134-fix-quota-key-rotation)

**Feature Branch**: `134-fix-quota-key-rotation`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "BẮT ĐẦU DỊCH LẠI CÁC CHƯƠNG LỖI | Mô hình: 'gemini-3.5-flash-lite' ... Xử lý [1/17]: 第九十八章 侍寝 | Key xoay vòng: #7 ... ⚡ Chương '第九十八章 侍寝' lỗi tạm thời do model quá tải (có thể dịch lại ngay sẽ thành công). Bỏ qua chương lỗi và tiếp tục... Xử lý [17/17]: 第一百三十八章 捅向裆部 | Key xoay vòng: #7 ... kiểm tra lại cơ chế quota API ngay lập tức; rõ ràng vẫn chưa đạt đến giới hạn; tôi có tận 8API key ; chỉ có 1 key chạm giới hạn mà nó lại không cho chạy"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự Động Chuyển & Bỏ Qua API Key Đã Chạm Giới Hạn Sang Khóa Khả Dụng (Priority: P1)

Là một người dùng đang sử dụng danh sách gồm nhiều Gemini API Key (ví dụ: 8 API Key), khi một trong các khóa chạm giới hạn quota (HTTP 429 RESOURCE_EXHAUSTED hoặc đạt ngưỡng Max RPD), tôi muốn hệ thống tự động chuyển con trỏ xoay vòng sang các khóa API lành mạnh còn lại trong danh sách để tiếp tục dịch các chương tiếp theo, thay vì bị kẹt cứng ở khóa bị lỗi và khiến toàn bộ các chương còn lại đều thất bại.

**Why this priority**: Đây là lỗi cốt lõi người dùng phản ánh trực tiếp. Người dùng có 8 khóa, chỉ 1 khóa hết hạn ngạch nhưng vì con trỏ khóa không được cập nhật khi có lỗi, toàn bộ 17 chương tiếp theo đều bị ép chạy vào khóa lỗi (#7) và bị bỏ qua oan uổng.

**Independent Test**:
- Cấu hình ít nhất 3 khóa API, trong đó Khóa 1 bị lỗi 429 (hết hạn ngạch), Khóa 2 và Khóa 3 hoàn toàn khỏe mạnh.
- Bắt đầu dịch tự động một hàng đợi gồm 3 chương.
- Xác minh: Chương 1 sau khi phát hiện Khóa 1 cạn kiệt tự động xoay sang Khóa 2 để hoàn thành; Chương 2 và Chương 3 bắt đầu bằng Khóa 2 hoặc Khóa 3, hoàn toàn không gọi lại Khóa 1.

**Acceptance Scenarios**:

1. **Given** người dùng cấu hình $N$ API key ($N \ge 2$) và khóa hiện tại (#7) chạm giới hạn quota hoặc lỗi tạm thời, **When** chương hiện tại kết thúc (hoặc thất bại), **Then** con trỏ API key tự động tịnh tiến sang khóa tiếp theo khả dụng thay vì giữ nguyên vị trí khóa bị lỗi.
2. **Given** người dùng có nhiều khóa và bật tùy chọn "Bỏ qua chương lỗi", **When** một chương bị lỗi do khóa cạn hạn ngạch, **Then** chương tiếp theo trong hàng đợi được thử với khóa khả dụng kế tiếp thay vì lặp lại việc gọi khóa vừa bị lỗi.
3. **Given** các khóa khả dụng còn hạn ngạch trong ngày, **When** tiến trình dịch tự động vận hành, **Then** tất cả các khóa khỏe mạnh đều được luân phiên sử dụng công bằng, không dồn tải vào duy nhất một khóa.

---

### User Story 2 - Phân Biệt Chính Xác Lỗi Cạn Kiệt Toàn Bộ Khóa & Dừng Khẩn Cấp (Priority: P1)

Là một người dùng đang chạy dịch hàng loạt chương, khi THỰC SỰ toàn bộ các API Key trong danh sách đều đã hết hạn mức (`ALL_KEYS_EXHAUSTED`), tôi muốn hệ thống nhận diện đúng mã lỗi này và kích hoạt Dừng khẩn cấp ngay lập tức (Emergency Stop), thay vì hiểu nhầm là lỗi quá tải tạm thời của từng chương rồi vô ích lặp qua bỏ qua (skip) hàng chục chương trong hàng đợi.

**Why this priority**: Khi toàn bộ khóa đã hết hạn ngạch, việc tiếp tục cố gắng dịch các chương tiếp theo chỉ gây lãng phí kết nối mạng, làm hỏng trạng thái hàng đợi và spam hàng chục thông báo lỗi "quá tải tạm thời" gây hiểu lầm cho người dùng.

**Independent Test**:
- Cung cấp hàng đợi 5 chương, giả lập toàn bộ API Key đều trả về 429 RESOURCE_EXHAUSTED.
- Xác minh: Tiến trình dừng ngay lập tức tại chương đầu tiên với thông báo dừng khẩn cấp do hết quota toàn bộ khóa, không lặp qua bỏ qua 4 chương còn lại.

**Acceptance Scenarios**:

1. **Given** toàn bộ $N$ API Key đều không còn khả dụng do cạn kiệt quota, **When** hàm gọi Gemini API trả về lỗi `ALL_KEYS_EXHAUSTED`, **Then** lớp xử lý chương bảo toàn mã lỗi `ALL_KEYS_EXHAUSTED` truyền lên vòng lặp dịch.
2. **Given** vòng lặp dịch tự động nhận được lỗi có mã `ALL_KEYS_EXHAUSTED` (hoặc thông báo hết hạn mức toàn bộ), **When** lỗi được phát hiện, **Then** hệ thống đặt `allKeysExhausted = true`, ghi nhật ký lỗi dừng khẩn cấp và kết thúc vòng lặp ngay lập tức (`break`), bất kể tùy chọn "Bỏ qua chương lỗi" có đang bật hay không.
3. **Given** tiến trình dừng khẩn cấp vì hết toàn bộ khóa, **When** người dùng kiểm tra trạng thái dự án, **Then** trạng thái các chương đã hoàn thành trước đó được lưu trữ an toàn, vị trí chương chưa dịch được ghi nhớ chính xác để tiếp tục khi có quota mới.

---

### User Story 3 - Minh Bạch Hóa Nhật Ký Luân Chuyển Khóa Khi Gặp Lỗi (Priority: P2)

Là một người dùng đang theo dõi bảng nhật ký tiến trình (Terminal Console), khi hệ thống gặp lỗi hạn ngạch hoặc lỗi tạm thời trên một khóa và tự động xoay sang khóa dự phòng khác, tôi muốn thấy thông báo rõ ràng về việc chuyển khóa (ví dụ: "Khóa #7 quá tải/hạn ngạch, tự động chuyển sang Khóa #8"), để tôi nắm bắt chính xác tiến trình đang diễn ra.

**Why this priority**: Hiện tại, log chỉ in duy nhất thông báo ban đầu `Key xoay vòng: #7`, khi xoay nội bộ sang khóa khác người dùng không hề biết, dẫn đến cảm giác hệ thống "chỉ dùng 1 key mà không cho chạy".

**Independent Test**:
- Giả lập Khóa 1 trả về 429, hệ thống xoay sang Khóa 2 thành công.
- Xác minh nhật ký xuất hiện dòng thông báo việc chuyển từ Khóa 1 sang Khóa 2 trước khi hoàn thành dịch.

**Acceptance Scenarios**:

1. **Given** khóa ban đầu bị lỗi 429 hoặc 503, **When** hệ thống tự động tìm và chuyển sang khóa tiếp theo khả dụng, **Then** một thông báo dạng cảnh báo được ghi vào nhật ký giải thích lý do chuyển khóa và số thứ tự khóa mới được chọn.
2. **Given** một khóa đang trong thời gian cooldown, **When** bắt đầu chương mới, **Then** nhãn hiển thị số thứ tự khóa trong nhật ký phản ánh chính xác khóa thực tế được dùng, không hiển thị khóa đang bị khóa tạm thời.

---

### User Story 4 - Khởi Tạo Khóa Khả Dụng Khi "Dịch Lại Các Chương Lỗi" (Priority: P2)

Là một người dùng bấm nút "Dịch lại các chương lỗi", tôi muốn hệ thống tự động chọn khóa API đầu tiên đang có trạng thái khỏe mạnh làm điểm khởi đầu, thay vì giữ nguyên con trỏ khóa cũ của phiên chạy trước (vốn thường là khóa vừa gặp sự cố).

**Why this priority**: Sau khi một đợt dịch bị lỗi kết thúc ở Khóa #7, nếu bấm "Dịch lại" mà con trỏ vẫn là Khóa #7 (đang kiệt sức), đợt dịch lại sẽ lập tức vấp phải lỗi ngay từ giây đầu tiên.

**Independent Test**:
- Thiết lập con trỏ khóa ở vị trí Khóa #7 (đang ở trạng thái QuotaExhausted / Cooldown).
- Kích hoạt hàm `handleRetryFailedChapters`.
- Xác minh con trỏ khóa được điều hướng đến khóa khả dụng đầu tiên (ví dụ: Khóa #8 hoặc Khóa #1) trước khi bắt đầu vòng lặp.

**Acceptance Scenarios**:

1. **Given** có các chương lỗi cần dịch lại và con trỏ khóa hiện tại đang trỏ vào một khóa không khả dụng, **When** người dùng kích hoạt "Dịch lại các chương lỗi", **Then** hệ thống tự động định vị khóa khả dụng gần nhất và gán vào con trỏ trước khi gửi yêu cầu.

---

### Edge Cases

- **Chỉ có 1 khóa API duy nhất và khóa đó chạm 429**: Hệ thống dừng khẩn cấp ngay lập tức với thông báo hết hạn mức, không lặp lại vô tận hay skip toàn bộ hàng đợi.
- **Khóa chạm giới hạn cá nhân tự đặt (Max RPD) nhưng chưa chạm giới hạn upstream của Google**: Hệ thống coi khóa này là không khả dụng trong ngày, tự động bỏ qua để chọn khóa khác còn quota cá nhân.
- **Khóa bị Rate Limit 45 giây (RPM/TPM) so với Quota Hết Ngày (RPD)**: Khóa bị Rate Limit 45 giây sẽ tự phục hồi sau 45 giây (chuyển sang HalfOpen), trong khi khóa QuotaExhausted tạm dừng dài hơn. Hệ thống ưu tiên chọn các khóa còn xanh hoàn toàn.
- **Người dùng bấm Dừng tiến trình (Abort)**: Ngay lập tức hủy các yêu cầu mạng đang chờ, lưu dữ liệu và dừng vòng lặp, không coi việc hủy này là lỗi hạn ngạch.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Trong `useTranslationProcess.ts`, khi một chương gặp lỗi hoặc kết thúc đợt xử lý (batch) có lỗi, hệ thống MUST tự động tịnh tiến chỉ số khóa xoay vòng (`currentApiKeyIndexRef.current`) sang khóa tiếp theo thay vì giữ nguyên chỉ số của khóa vừa bị lỗi.
- **FR-002**: Trong `useTranslationProcess.ts`, hàm `handleRetryFailedChapters` MUST quét danh sách API key và khởi tạo chỉ số khóa bắt đầu tại vị trí khóa đầu tiên đang khả dụng (Healthy hoặc HalfOpen) thông qua bộ theo dõi hạn ngạch.
- **FR-003**: Trong `chapterTranslationService.ts`, khi bắt được ngoại lệ từ `translateRawDirect` hoặc `polishTranslationDirect`, nếu lỗi đó chứa mã `code === 'ALL_KEYS_EXHAUSTED'`, hệ thống MUST bảo toàn nguyên vẹn thuộc tính `code` trên đối tượng ngoại lệ ném ra ngoài, không được làm rơi rụng mã lỗi này.
- **FR-004**: Trong `useTranslationProcess.ts`, điều kiện kiểm tra dừng khẩn cấp vì cạn kiệt toàn bộ khóa MUST kiểm tra cả `(err as any)?.code === 'ALL_KEYS_EXHAUSTED'` lẫn các chuỗi văn bản thông báo đặc trưng (`Toàn bộ API Key đã hết hạn mức`), đảm bảo cờ `allKeysExhausted` được kích hoạt chuẩn xác 100%.
- **FR-005**: Khi `allKeysExhausted` được kích hoạt, hệ thống MUST lập tức ngắt vòng lặp (`break`) và hiển thị thông báo dừng khẩn cấp, tuyệt đối KHÔNG được đánh đồng lỗi này với lỗi quá tải tạm thời của một chương riêng lẻ (`isOverload`) để rồi tiếp tục bỏ qua các chương còn lại.
- **FR-006**: Trong `directGeminiClient.ts`, khi một khóa gặp lỗi 429 hoặc 503 và hệ thống thực hiện chuyển khóa tự động sang khóa kế tiếp, hệ thống MUST đảm bảo các khóa khả dụng còn lại đều được thử nghiệm tuần tự đầy đủ.
- **FR-007**: Trong `localQuotaTracker.ts`, hàm `findNextAvailableKeyIndex` MUST đảm bảo kiểm tra chính xác tính khả dụng của từng khóa dựa trên máy trạng thái sức khỏe (Health State Machine) và các ngưỡng hạn ngạch cá nhân, không đánh dấu sai khóa khỏe mạnh thành khóa không khả dụng.
- **FR-008**: Toàn bộ hệ thống kiểm tra chất lượng theo hiến pháp (`npm run lint`, `npm test`, `npm run build`) MUST vượt qua 100% không có lỗi type hay test bị bỏ qua/vô hiệu hóa.

### Key Entities

- **KeyHealthState**: Trạng thái sức khỏe runtime của một API key (`'Healthy' | 'Degraded' | 'RateLimited' | 'QuotaExhausted' | 'AuthFailed' | 'Cooldown' | 'Disabled'`).
- **SingleChapterResult**: Kết quả trả về sau khi dịch một chương đơn lẻ, bao gồm trạng thái thành công, ID chương, khóa API thành công cuối cùng (`lastKeyIndex`), và các thuật ngữ trích xuất mới.
- **AllKeysExhaustedError**: Đối tượng lỗi đại diện cho trạng thái toàn bộ danh sách API key cấu hình đều đã cạn kiệt hạn ngạch hoặc bị chặn tạm thời, mang thuộc tính nhận diện `code = 'ALL_KEYS_EXHAUSTED'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Khi có ít nhất một khóa API còn khả dụng trong danh sách $N$ khóa ($N \ge 2$), 100% các chương tiếp theo trong hàng đợi tiếp tục được xử lý bằng các khóa khả dụng mà không bị kẹt hay gián đoạn bởi các khóa đã hết hạn ngạch.
- **SC-002**: Khi 1 khóa chạm giới hạn trong số nhiều khóa, 0 chương nào bị đánh dấu lỗi oan uổng do lỗi của khóa đã cạn kiệt.
- **SC-003**: Khi toàn bộ khóa API đều cạn kiệt, hệ thống dừng tiến trình ngay lập tức sau đúng 1 lần phát hiện thay vì tiếp tục lặp qua $M$ chương trong hàng đợi.
- **SC-004**: 100% các bài kiểm tra tự động (`npm test`, `npm run lint`, `npm run build`) đều thành công sạch sẽ.

## Assumptions

- **Tính tương thích**: Việc bảo toàn thuộc tính `code === 'ALL_KEYS_EXHAUSTED'` trên `Error` không ảnh hưởng đến bất kỳ mã nguồn nào đang đọc `err.message`.
- **Mô hình AI**: Lỗi do quá tải mô hình hoặc hạn ngạch từ phía Google upstream được phản ánh chính xác thông qua mã trạng thái HTTP (429, 503) hoặc trường trạng thái JSON `RESOURCE_EXHAUSTED`, `UNAVAILABLE`.

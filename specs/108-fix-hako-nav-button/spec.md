# Feature Specification: Khắc Phục Hiển Thị Và Khả Năng Truy Cập Nút Kiểm Định Hako

**Feature Branch**: `108-fix-hako-nav-button`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "nút kiểm định hako đã bị che mất; hãy tìm cách sửa"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hiển thị trực quan, đầy đủ cả 6 phân vùng làm việc trên màn hình máy tính (Priority: P1) 🎯 MVP

Là một dịch giả hoặc biên tập viên sử dụng ứng dụng trên máy tính hoặc laptop (độ phân giải phổ biến từ 1280px đến 1440px), tôi muốn nhìn thấy trực tiếp và bấm được nút tab "Kiểm Định Hako" ngay trên thanh điều hướng chính cùng với 5 tab còn lại, để tôi có thể truy cập phân vùng kiểm định chất lượng bản dịch một cách thuận tiện mà không bị che khuất hay phải tìm kiếm khó khăn.

**Why this priority**: "Kiểm Định Hako" là một trong 6 phân vùng làm việc cốt lõi của ứng dụng. Việc nút bị tràn ra ngoài rìa hoặc bị che khuất khiến người dùng không thể nhận biết hoặc truy cập tính năng kiểm định chất lượng bản thảo qua giao diện trực quan.

**Independent Test**:
1. Mở ứng dụng trên màn hình laptop tiêu chuẩn (1280x720, 1366x768, 1440x900) với dự án có đầy đủ dữ liệu (tên truyện dài, có huy hiệu số lượng từ điển và chương).
2. Quan sát thanh điều hướng tab chính: Cả 6 tab ("Mặt Trận Dịch Thuật", "Dịch Tự Động Toàn Bộ", "Từ Điển Nhân Vật", "Lịch Sử Chương Dịch", "Quản Lý Truyện", "Kiểm Định Hako") đều hiển thị rõ ràng trong vùng nhìn thấy, không bị che khuất một phần hay toàn bộ.
3. Click trực tiếp vào nút "Kiểm Định Hako": Ứng dụng chuyển ngay vào phân vùng kiểm định chất lượng Hako.

**Acceptance Scenarios**:

1. **Given** người dùng truy cập ứng dụng trên màn hình độ phân giải từ 1280px trở lên, **When** thanh điều hướng tải xong (kể cả khi đã tải xong dữ liệu dự án và các huy hiệu đếm số lượng), **Then** toàn bộ 6 nút tab từ Tab 1 đến Tab 6 ("Kiểm Định Hako") đều hiển thị đầy đủ, không bị khuất khỏi khung nhìn.
2. **Given** dự án đang dịch có tên truyện dài hiển thị ở góc phải thanh tab, **When** hiển thị trên các màn hình có chiều ngang giới hạn, **Then** phần tên truyện tự động co gọn hợp lý, ưu tiên diện tích hiển thị trọn vẹn cho các nút điều hướng phân vùng.
3. **Given** người dùng rê chuột vào nút tab "Kiểm Định Hako", **When** hover chuột, **Then** nhãn tab và phím tắt gợi ý (Alt+6) hiển thị đầy đủ, hiệu ứng hover phản hồi tức thì và chính xác.

---

### User Story 2 - Cơ chế cuộn ngang và điều hướng dự phòng khi màn hình thu nhỏ (Priority: P1)

Là một người dùng làm việc ở chế độ chia đôi màn hình (split-screen) hoặc trên máy tính bảng / màn hình hẹp (< 1200px), tôi muốn dải tab có chỉ báo tràn rõ ràng, có nút điều hướng cuộn và menu truy cập nhanh dự phòng ("Thêm" / danh sách phân vùng), để tôi luôn chuyển đổi được đến phân vùng "Kiểm Định Hako" một cách dễ dàng ngay cả khi chiều rộng màn hình không đủ chỗ hiển thị đồng thời cả 6 tab.

**Why this priority**: Đảm bảo tính khả dụng 100% trên mọi kích thước màn hình và tình huống chia màn hình, ngăn chặn việc tab bị ẩn hoàn toàn mà không có phương thức truy cập trực quan.

**Independent Test**:
1. Thu hẹp cửa sổ trình duyệt xuống dưới 1024px.
2. Kiểm tra chỉ báo tràn: Lớp mờ chuyển sắc và nút cuộn xuất hiện ở mép phải của dải tab, báo hiệu còn nội dung phía sau.
3. Bấm nút cuộn phải hoặc mở menu danh sách phân vùng ("Thêm ▾"): Mục "Kiểm Định Hako" xuất hiện đầy đủ với biểu tượng và phím tắt, bấm vào sẽ kích hoạt tab và cuộn tab vào tầm nhìn.

**Acceptance Scenarios**:

1. **Given** dải tab không thể hiển thị hết 6 tab trên màn hình hẹp, **When** người dùng nhìn vào thanh điều hướng, **Then** hệ thống cung cấp tín hiệu trực quan rõ ràng (chỉ báo tràn / nút điều hướng) và menu chuyển nhanh dự phòng để người dùng truy cập được tab bị khuất.
2. **Given** người dùng nhấn phím tắt `Alt+6` hoặc chọn "Kiểm Định Hako" từ menu dự phòng, **When** phân vùng kiểm định được kích hoạt, **Then** thanh tab tự động cuộn mượt mà đưa nút "Kiểm Định Hako" vào vùng nhìn thấy rõ ràng.
3. **Given** người dùng cuộn dải tab, **When** dải tab chạm kịch mép phải hoặc mép trái, **Then** các nút điều hướng cuộn tương ứng tự động cập nhật trạng thái hiển thị chuẩn xác, không chặn thao tác click của người dùng.

---

### User Story 3 - Bảo toàn nhận diện thiết kế và trợ năng bàn phím (Priority: P2)

Là một người dùng thường xuyên thao tác bằng phím tắt hoặc các công nghệ trợ năng, tôi muốn mọi phân vùng làm việc giữ nguyên tính nhất quán về phím tắt, biểu tượng nhận diện và ngữ nghĩa trợ năng, để trải nghiệm làm việc không bị gián đoạn hay thay đổi bất thường.

**Why this priority**: Bảo toàn tính công thái học và chuẩn mực thiết kế của hệ thống "Mực & Chu Sa".

**Independent Test**:
1. Nhấn tổ hợp phím `Alt+6` từ bất kỳ phân vùng nào: Hệ thống chuyển ngay sang phân vùng Kiểm Định Hako.
2. Kiểm tra thuộc tính trợ năng (`role="tab"`, `aria-selected`, `aria-controls`): Đầy đủ và phản ánh đúng trạng thái tab hiện hành.

**Acceptance Scenarios**:

1. **Given** người dùng ở bất kỳ tab nào trong ứng dụng, **When** nhấn phím tắt `Alt+6`, **Then** ứng dụng chuyển sang phân vùng Kiểm Định Hako và đánh dấu tab là đang chọn.
2. **Given** các thiết bị đọc màn hình hoặc điều hướng bằng bàn phím (Tab / Shift+Tab), **When** duyệt qua dải tab, **Then** nút "Kiểm Định Hako" có thể nhận tiêu điểm (focusable) và có đầy đủ nhãn mô tả ngữ nghĩa.

---

### Edge Cases

- **Tên dự án cực dài**: Khi dự án có tiêu đề dài trên 50 ký tự, phần hiển thị tên truyện ở bên phải phải được cắt gọn thông minh (`truncate`) kèm chú thích đầy đủ khi rê chuột, không được đẩy dải tab lệch khỏi khung nhìn.
- **Dự án có số lượng thuật ngữ hoặc chương rất lớn (Badge 3-4 chữ số)**: Các huy hiệu đếm số lượng không được làm dải tab bị vỡ khung hay đè lên nút "Kiểm Định Hako".
- **Dữ liệu tải chậm (Asynchronous State Load)**: Khi dữ liệu truyện và số lượng huy hiệu được nạp từ cơ sở dữ liệu sau khi giao diện đã dựng, thanh điều hướng phải tự động nhận biết kích thước nội dung mới để căn chỉnh hiển thị chính xác, không để nút bị che khuất mà không có chỉ báo.
- **Màn hình xoay ngang / thay đổi kích thước đột ngột**: Khi người dùng phóng to, thu nhỏ trình duyệt hoặc đổi hướng màn hình, trạng thái hiển thị của các nút tab phải thích ứng tức thì mà không cần tải lại trang.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI ưu tiên không gian hiển thị cho toàn bộ 6 phân vùng làm việc chính, đảm bảo nút tab "Kiểm Định Hako" luôn hiển thị trực quan và có thể click được trên các màn hình máy tính có độ phân giải tiêu chuẩn (từ 1280px trở lên).
- **FR-002**: Hệ thống PHẢI tối ưu hóa mật độ hiển thị của thanh điều hướng tab (khoảng đệm, kích thước nhãn, khoảng cách biểu tượng) để 6 tab hiển thị gọn gàng, vừa vặn mà không chiếm dụng quá nhiều diện tích dọc.
- **FR-003**: Khối hiển thị thông tin bộ truyện đang dịch ở góc phải thanh tab PHẢI có khả năng co giãn linh hoạt và thu hẹp độ rộng tối đa khi không gian hàng ngang bị thu hẹp, không được chiếm dụng không gian của dải tab điều hướng.
- **FR-004**: Trên các kích thước màn hình hẹp (dưới 1200px hoặc khi chia đôi cửa sổ làm việc) nơi 6 tab không thể hiển thị vừa vặn trên một hàng:
  - Hệ thống PHẢI luôn duy trì một lối truy cập dự phòng rõ ràng (menu danh mục phân vùng làm việc) cho phép người dùng mở tab "Kiểm Định Hako" chỉ bằng 1 thao tác click.
  - Menu dự phòng này KHÔNG ĐƯỢC phép bị ẩn khi dải tab đang trong trạng thái bị tràn nội dung.
- **FR-005**: Hệ thống PHẢI tự động phát hiện chính xác trạng thái tràn nội dung của dải tab ngay cả khi dữ liệu (huy hiệu số đếm, tên truyện) được tải bất đồng bộ sau thời điểm khởi tạo giao diện ban đầu.
- **FR-006**: Khi xảy ra tràn nội dung, hệ thống PHẢI hiển thị chỉ báo cuộn và nút điều hướng rõ ràng ở mép dải tab, hỗ trợ cuộn mượt mà để đưa các tab bị khuất (bao gồm "Kiểm Định Hako") vào tầm nhìn.
- **FR-007**: Khi người dùng kích hoạt tab "Kiểm Định Hako" (bằng click chuột, phím tắt `Alt+6`, hoặc từ menu dự phòng), hệ thống PHẢI tự động cuộn mượt mà dải tab để nút tab này hiển thị trọn vẹn trong vùng nhìn thấy.
- **FR-008**: Hệ thống PHẢI bảo tồn đầy đủ 100% các thuộc tính nhận diện: biểu tượng chiếc khiên (`ShieldCheck`), nhãn tiếng Việt ("Kiểm Định Hako"), phím tắt (`Alt+6`), màu sắc phong cách "Mực & Chu Sa", và cấp độ xếp lớp giao diện chuẩn (`z-30`).

### Key Entities

- **Thanh Điều Hướng Phân Vùng (Workspace Tab Bar)**: Thanh điều hướng ghim cố định ở đầu trang, chứa danh sách 6 phân vùng làm việc chính của ứng dụng và thông tin tóm lược về tác phẩm đang xử lý.
- **Nút Tab Kiểm Định Hako (Hako Checker Tab)**: Nút chuyển đổi giao diện đưa người dùng tới không gian làm việc kiểm định chất lượng bản dịch theo tiêu chuẩn biên tập tiểu thuyết mạng Hako.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% người dùng trên các màn hình máy tính có độ rộng khung nhìn từ 1280px trở lên nhìn thấy rõ ràng và bấm được trực tiếp nút "Kiểm Định Hako" ngay khi mở trang, không bị che khuất hay tràn ra ngoài khung nhìn.
- **SC-002**: Trên màn hình hẹp (< 1200px hoặc chia đôi màn hình), 100% trường hợp người dùng có thể tiếp cận phân vùng "Kiểm Định Hako" trong tối đa 2 thao tác (thông qua nút cuộn ngang hoặc menu truy cập nhanh).
- **SC-003**: Thao tác nhấn phím tắt `Alt+6` đưa phân vùng "Kiểm Định Hako" vào trạng thái hoạt động và hiển thị nút tab trong vùng nhìn thấy trong vòng dưới 100ms.
- **SC-004**: 0 trường hợp nút tab bị đè lớp, mất chữ, hoặc bị khối tên truyện che lấp trên mọi kích thước màn hình từ 375px (Mobile) đến 1920px+ (Màn hình lớn).
- **SC-005**: Toàn bộ các tiêu chuẩn kiểm tra chất lượng mã nguồn (`npm run lint`, `npm test`, `npm run build`) tiếp tục đạt 100% trạng thái hoàn hảo không có lỗi hoặc cảnh báo mới.

## Assumptions

- Trình duyệt của người dùng tuân thủ các chuẩn hiển thị hiện đại (Flexbox, CSS Container/Overflow, Smooth Scrolling).
- Bản sắc trực quan tuân thủ nghiêm ngặt bảng màu và nguyên tắc thiết kế "Mực & Chu Sa" đã được định nghĩa trong tài liệu thiết kế của dự án.
- Không thay đổi hành vi logic bên trong phân vùng Kiểm Định Hako; phạm vi tính năng chỉ tập trung vào khả năng hiển thị và tiếp cận nút tab trên thanh điều hướng.

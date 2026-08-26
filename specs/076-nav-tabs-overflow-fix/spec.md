# Feature Specification: Sửa Lỗi Tràn & Hiển Thị Thanh Điều Hướng Tab Chính

**Feature Branch**: `076-nav-tabs-overflow-fix`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Sửa lỗi thanh điều hướng tab chính (src/App.tsx, ~dòng 244-386) che mất tab thứ 6 'Kiểm Tra Chất Lượng' (Alt+6) vừa thêm sau khi tích hợp tính năng kiểm định dịch. Nguyên nhân: container bọc <nav> dùng overflow-x-auto kết hợp class .scrollbar-none (src/index.css) để ẩn thanh cuộn ngang. Khi chỉ có 5 tab thì vừa khít màn hình nên không ai để ý hàng này cuộn được; nay 6 tab (mỗi tab có icon + nhãn + Kbd + có tab kèm badge số) vượt quá bề rộng khả dụng ở nhiều độ rộng cửa sổ desktop/laptop phổ biến, nội dung tràn ra ngoài mà không có dấu hiệu thị giác nào báo còn tab phía sau, khiến tab cuối trông như biến mất dù vẫn bấm được Alt+6. Người dùng: bất kỳ ai dùng ứng dụng dịch thuật, cần thấy và bấm được đủ cả 6 tab điều hướng chính trong mọi trường hợp. Hành vi mong muốn: Khi chuyển tab bằng cách bấm chuột HOẶC bằng phím tắt Alt+1 đến Alt+6, tab vừa được kích hoạt luôn tự cuộn vào vùng nhìn thấy nếu đang bị khuất; Khi hàng tab thực sự đang tràn, phải có một dấu hiệu thị giác tinh tế cho biết còn tab ở hướng đó (ví dụ lớp phủ mờ dần cùng tông màu nền hiện có ở cạnh tràn); Khối hiển thị tên truyện hiện tại (activeProject.title) ở cuối hàng phải luôn đọc được trọn vẹn, không bị bóp méo hay chồng lên tab; Phải hoạt động đúng ở cả độ rộng laptop phổ biến, màn hình rộng và mobile. Ràng buộc bắt buộc: KHÔNG đổi thứ tự, id, icon, nhãn, badge số, thuộc tính aria, hay bất kỳ phím tắt Alt+1..6 nào của các tab hiện có; KHÔNG động vào logic các tab panel hay luồng dịch; KHÔNG thêm dependency npm mới; giữ đúng thang z-index sẵn có (z-30 cho tab bar sticky)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự động cuộn tab kích hoạt vào vùng hiển thị (Priority: P1)

Là một người dùng hoặc dịch giả thao tác bằng chuột hoặc phím tắt (Alt+1 đến Alt+6), tôi muốn tab vừa được kích hoạt luôn tự động cuộn vào vùng nhìn thấy trên màn hình nếu tab đó đang bị khuất hoặc nằm ngoài biên màn hình, giúp tôi luôn biết chính xác mình đang ở phân vùng làm việc nào mà không cần cuộn thủ công.

**Why this priority**: Đây là giải pháp trực tiếp khắc phục vấn đề tab thứ 6 (Kiểm Tra Chất Lượng) trông như biến mất khi người dùng bấm phím tắt Alt+6 trên màn hình laptop có độ rộng hạn chế.

**Independent Test**: Thu nhỏ cửa sổ trình duyệt xuống độ rộng ~1024px hoặc 1280px sao cho tab 6 bị khuất bên phải; nhấn phím tắt `Alt+6` hoặc click vào tab khuất một phần; dải tab tự động trượt mượt mà đưa tab 6 vào chính giữa/vùng nhìn thấy rõ ràng.

**Acceptance Scenarios**:

1. **Given** cửa sổ trình duyệt ở độ rộng laptop (1024px - 1366px) khiến dải tab bị tràn một phần, **When** người dùng nhấn phím tắt `Alt+6` (hoặc `Alt+1` đến `Alt+5`), **Then** hệ thống tự động cuộn dải tab để nút tab được chọn xuất hiện trọn vẹn trong vùng hiển thị.
2. **Given** người dùng click chuột vào một tab đang hiển thị một phần ở mép cuộn, **When** tab đó được kích hoạt, **Then** tab tự động cuộn vào vị trí nhìn thấy thuận tiện nhất mà không làm giật trang.

---

### User Story 2 - Hiển thị chỉ báo thị giác khi dải tab bị tràn biên (Priority: P1)

Là một người dùng, tôi muốn nhìn thấy dấu hiệu thị giác tinh tế (lớp phủ mờ dần cùng tông màu nền ở cạnh trái/phải) khi có các tab khác đang nằm ngoài vùng hiển thị, để tôi nhận biết trực quan rằng thanh điều hướng còn nhiều tab có thể cuộn xem được.

**Why this priority**: Cung cấp phản hồi trực quan (visual affordance) loại bỏ cảm giác bối rối khi thanh cuộn ngang bị ẩn (`scrollbar-none`), giúp người dùng luôn biết dải tab còn nội dung tiếp nối.

**Independent Test**: Trên màn hình laptop hoặc thu nhỏ cửa sổ, quan sát mép phải dải tab: xuất hiện lớp phủ mờ nhẹ (fade gradient cùng tông `bg-parchment`); khi cuộn sang phải, mép trái xuất hiện lớp phủ mờ tương ứng và mép phải tự động biến mất khi đã cuộn tới tab cuối cùng.

**Acceptance Scenarios**:

1. **Given** dải tab có nội dung tràn về phía bên phải (chưa cuộn hết), **When** người dùng quan sát thanh điều hướng, **Then** mép phải hiển thị một lớp mờ nhẹ chuyển sắc tự nhiên từ trong suốt sang màu nền `parchment` hiện tại.
2. **Given** người dùng đã cuộn dải tab sang phải (tab 1 bị khuất về bên trái), **When** quan sát mép trái, **Then** mép trái xuất hiện lớp mờ chuyển sắc báo hiệu còn tab ở bên trái.
3. **Given** màn hình rộng (> 1600px) nơi tất cả 6 tab hiển thị vừa vặn không bị tràn, **When** dải tab không có nội dung tràn, **Then** cả hai lớp phủ mờ đều ẩn hoàn toàn.

---

### User Story 3 - Tách biệt và bảo toàn khối thông tin bộ truyện hiện tại (Priority: P2)

Là một người dùng, tôi muốn khối thông tin tên bộ truyện đang dịch (`activeProject.title`) ở góc phải thanh tab luôn hiển thị rõ ràng, cố định vị trí hợp lý và không tranh chấp không gian hay đè lên dải tab cuộn.

**Why this priority**: Đảm bảo dải tab và thông tin truyện phụ trợ cùng tồn tại hài hòa trên cùng thanh header sticky mà không gây vỡ bố cục khi tên truyện dài.

**Independent Test**: Mở một truyện có tiêu đề dài (trên 30 ký tự) trên màn hình laptop; tiêu đề truyện được cắt gọn tinh tế (`truncate`) kèm tooltip tiêu đề đầy đủ, nằm tách biệt ở góc phải mà không chèn ép dải tab.

**Acceptance Scenarios**:

1. **Given** người dùng đang mở một dự án dịch, **When** thanh tab hiển thị trên màn hình cỡ trung bình/lớn, **Then** khối tên truyện hiển thị gọn gàng ở phía bên phải ngoài luồng cuộn của dải tab, có giới hạn chiều rộng tối đa và rút gọn văn bản bằng dấu ba chấm nếu quá dài.
2. **Given** màn hình mobile nhỏ (< 640px), **When** không gian quá hẹp, **Then** khối tên truyện ẩn hoặc hiển thị thu gọn hợp lý để ưu tiên tối đa diện tích cho các tab điều hướng chính.

---

### Edge Cases

- **Thay đổi kích thước cửa sổ trình duyệt (Window Resize)**: Khi người dùng phóng to/thu nhỏ cửa sổ trình duyệt, các trạng thái tràn (trái/phải) và vị trí của tab đang kích hoạt phải được tự động tính toán lại tức thì.
- **Dự án có nhiều huy hiệu số (Pending Glossary & Chapters Count)**: Khi các huy hiệu (`Badge`) có số lượng lớn làm tăng bề rộng tab, cơ chế tự động cuộn và chỉ báo tràn vẫn tính toán chính xác kích thước thực tế của từng tab con.
- **Cuộn bằng Touch / Trackpad / Con lăn chuột ngang**: Người dùng có thể vuốt hoặc cuộn ngang dải tab tự do; các lớp mờ chỉ báo tự động bật/tắt chính xác theo vị trí cuộn thực tế (`scrollLeft`, `scrollWidth`, `clientWidth`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI duy trì một tham chiếu (`ref`) tới vùng chứa dải tab cuộn ngang và danh sách các phần tử tab điều hướng con.
- **FR-002**: Khi tab kích hoạt (`activeTab`) thay đổi (thông qua click chuột hoặc phím tắt `Alt+1` đến `Alt+6`), hệ thống PHẢI tự động cuộn phần tử tab tương ứng vào vùng nhìn thấy của container cuộn (`scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`).
- **FR-003**: Hệ thống PHẢI tự động phát hiện và theo dõi trạng thái tràn ngang của dải tab:
  - Có nội dung tràn về bên trái: `canScrollLeft = scrollLeft > 1px`.
  - Có nội dung tràn về bên phải: `canScrollRight = scrollLeft + clientWidth < scrollWidth - 1px`.
- **FR-004**: Hệ thống PHẢI hiển thị lớp phủ mờ chuyển sắc (fade overlay) tinh tế cùng tông màu nền (`bg-parchment` / `from-parchment`) ở mép trái khi `canScrollLeft === true` và ở mép phải khi `canScrollRight === true`, đảm bảo không cản trở thao tác click chuột (sử dụng `pointer-events-none`).
- **FR-005**: Lớp phủ mờ CHỈ sử dụng màu nền hiện có của hệ thống (`from-parchment to-transparent`), TUYỆT ĐỐI KHÔNG dùng dải màu sặc sỡ, không thêm biểu tượng hoặc ký tự emoji lạ.
- **FR-006**: Khối hiển thị thông tin bộ truyện hiện tại (`activeProject.title`) PHẢI được bố trí độc lập ở phía bên phải ngoài dải tab cuộn, có độ rộng co giãn tối đa (`max-w-[180px] md:max-w-[240px] lg:max-w-[320px]`) và hỗ trợ cắt gọn (`truncate`) kèm thuộc tính `title` hiển thị đầy đủ tên truyện khi di chuột.
- **FR-007**: Hệ thống PHẢI bảo toàn nguyên vẹn 100% thứ tự, định danh (`id`), biểu tượng (`lucide-react`), nhãn tiếng Việt (`t('nav.*')`), phím tắt (`Alt+1`..`Alt+6`), huy hiệu số lượng (`Badge`), và thuộc tính trợ năng (`role="tab"`, `aria-selected`, `aria-controls`) của toàn bộ 6 tab hiện có.
- **FR-008**: Hệ thống PHẢI giữ đúng cấp độ xếp lớp giao diện sticky tab bar ở mức `z-30` theo quy chuẩn thiết kế.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các thao tác kích hoạt tab bằng phím tắt `Alt+1` đến `Alt+6` hoặc click chuột đều đưa tab được chọn xuất hiện đầy đủ trong khung nhìn nhìn thấy (0% trường hợp tab bị khuất hoàn toàn mà không thấy trạng thái active).
- **SC-002**: Lớp phủ mờ chỉ báo tràn phản hồi tức thì (< 16ms) theo thao tác cuộn hoặc resize cửa sổ.
- **SC-003**: Không phát sinh thanh cuộn ngang xấu của trình duyệt trên thanh tab (duy trì tính thẩm mỹ `.scrollbar-none`).
- **SC-004**: Toàn bộ 6 tab điều hướng đều có thể truy cập và tương tác đầy đủ trên các kích thước màn hình phổ biến từ 320px (mobile) đến 1366px (laptop) và >1920px (desktop).
- **SC-005**: 0 lỗi phát sinh về typecheck (`npm run lint`), test suite (`npm test`), và đóng gói (`npm run build`).

## Assumptions

- Trình duyệt hỗ trợ phương thức DOM chuẩn `element.scrollIntoView()`.
- Màu nền của thanh điều hướng sử dụng biến/class `bg-parchment` kế thừa từ hệ thống bảng màu Mực & Chu Sa.

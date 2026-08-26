# Feature Specification: Kế Hoạch Giải Quyết Toàn Diện — Thanh Điều Hướng Tab Chính

**Feature Branch**: `076-nav-tabs-overflow-fix`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Kế hoạch giải quyết toàn diện (Implementation Plan)
Giai đoạn 1: Sửa đổi cơ chế Container & Điều hướng cuộn
- Kích hoạt Scroll Container mượt mà: Bọc dải nút tab trong một div có overflow-x: auto, ẩn thanh cuộn mặc định (scrollbar-width: none; ::-webkit-scrollbar { display: none; }). Thêm thuộc tính scroll-behavior: smooth và flex-shrink: 0 cho các item tab để không bị bóp méo nội dung.
- Thêm nút cuộn trái/phải (Scroll Chevron Buttons): Tích hợp 2 nút < và > cố định ở hai đầu dải tab. Tự động ẩn/hiện nút tương ứng khi người dùng đã cuộn kịch về đầu hoặc cuối (dựa vào scrollLeft và scrollWidth).
- Hiệu ứng Fade viền (Gradient Mask): Thêm lớp phủ gradient mờ dần ở hai mép trái/phải để báo hiệu dải tab còn phần bị ẩn.
- Auto-scroll khi chuyển tab: Khi tab active thay đổi (dù bấm chuột, nhấn Alt+1..6, hay chuyển qua mã lệnh), kích hoạt element.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }).
Giai đoạn 2: Tối ưu hoá mật độ hiển thị (Responsive Density)
- Ẩn bớt chi tiết phụ trên màn hình nhỏ/vừa (@media / Tailwind breakpoint): Ẩn phím tắt Kbd (Alt+X) trên màn hình dưới 1440px (đưa vào title/Tooltip hover thay thế). Giảm padding của từng nút tab từ px-4 py-2 xuống px-2.5 py-1.5.
- Thu gọn tiêu đề tab: Đặt tên ngắn gọn hơn khi không gian hẹp.
- Tách layout hoặc gom nhóm thông tin: Chuyển phần 'Bộ đang dịch: [Tên Truyện]' sang góc phải độc lập hoặc xuống header phụ nếu chiều ngang khung nhìn < 1200px.
Giai đoạn 3: Dropdown 'Thêm...' dự phòng (More Menu - Tùy chọn nâng cao)
- Nếu không gian màn hình quá nhỏ (Tablet / Split screen), tự động gom các tab ngoài Top 4 vào menu xổ xuống 'Thêm ▾' (chứa Tab 5: Quản Lý Truyện, Tab 6: Kiểm Tra Hako, Tab Cài Đặt...)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Container cuộn mượt mà, Nút Chevron & Auto-Scroll (Priority: P1) 🎯 MVP

Là một người dùng hoặc dịch giả thao tác bằng chuột hoặc phím tắt (Alt+1 đến Alt+6), tôi muốn dải tab cuộn ngang mượt mà, có nút điều hướng cuộn trái/phải (Chevron) trực quan ở hai đầu và tự động cuộn tab active vào vùng nhìn thấy, để tôi có thể di chuyển và nhìn thấy đầy đủ cả 6 tab làm việc một cách tiện lợi nhất.

**Why this priority**: Khắc phục triệt để vấn đề tab thứ 6 (Kiểm Tra Chất Lượng / Hako Checker) bị khuất ngoài tầm nhìn trên laptop/màn hình vừa, cung cấp cả thao tác click phím tắt, click nút Chevron lẫn cuộn chuột.

**Independent Test**:
1. Thu nhỏ màn hình xuống 1024px – 1366px: Nút Chevron phải `>` xuất hiện kèm lớp mờ gradient ở mép phải.
2. Click nút `>`: Dải tab trượt mượt mà sang phải 200px. Khi cuộn tới cuối, nút `>` tự động ẩn và nút `<` xuất hiện ở mép trái.
3. Nhấn phím tắt `Alt+6`: Dải tab tự động cuộn đưa Tab 6 vào giữa khung nhìn với viền active sáng rõ.

**Acceptance Scenarios**:

1. **Given** dải tab có nội dung tràn sang phải, **When** người dùng quan sát thanh điều hướng, **Then** nút Chevron phải `>` và lớp phủ mờ gradient hiển thị ở mép phải; nút Chevron trái `<` ẩn vì đang ở đầu dải tab.
2. **Given** người dùng click nút Chevron phải `>`, **When** thao tác click xảy ra, **Then** dải tab cuộn mượt mà sang phải một khoảng xác định (khoảng 200px).
3. **Given** người dùng nhấn phím tắt `Alt+6` (hoặc `Alt+1..5`), **When** tab kích hoạt thay đổi, **Then** hệ thống tự động gọi `scrollIntoView` mượt mà đưa tab active vào vùng nhìn thấy.
4. **Given** tất cả các item tab trong dải, **When** hiển thị trên thanh cuộn, **Then** mỗi tab đều có `flex-shrink: 0` (`shrink-0`) để nhãn, icon và badge không bao giờ bị bóp méo kích thước.

---

### User Story 2 - Tối ưu hóa mật độ hiển thị theo kích thước màn hình (Priority: P1)

Là một người dùng trên các màn hình laptop tiêu chuẩn (1366x768, 1440x900) hoặc tablet, tôi muốn mật độ hiển thị của thanh tab được tinh chỉnh gọn gàng (padding vừa vặn, ẩn nhãn phím tắt phụ khi màn hình hẹp nhưng vẫn xem được qua tooltip), để tối ưu không gian hiển thị được nhiều tab nhất có thể mà không bị chật chội.

**Why this priority**: Giảm thiểu nhu cầu phải cuộn ngang trên hầu hết các màn hình laptop thông dụng bằng cách sử dụng không gian hợp lý.

**Independent Test**:
1. Trên màn hình >= 1440px (`2xl:`): Các huy hiệu phím tắt `Kbd` (Alt+1, Alt+2...) hiển thị đầy đủ bên cạnh tên tab.
2. Trên màn hình < 1440px: Huy hiệu `Kbd` tự động ẩn để tiết kiệm không gian, di chuột vào tab hiển thị tooltip có phím tắt (ví dụ: `Kiểm Tra Chất Lượng (Alt+6)`).
3. Padding của các nút tab co giãn linh hoạt (`px-2 sm:px-2.5 2xl:px-3 py-1.5 sm:py-2`).

**Acceptance Scenarios**:

1. **Given** độ rộng màn hình < 1440px, **When** hiển thị các nút tab, **Then** huy hiệu `Kbd` ẩn đi nhưng thuộc tính `title` vẫn chứa thông tin phím tắt đầy đủ cho người dùng.
2. **Given** độ rộng màn hình >= 1440px (`2xl:`), **When** hiển thị các nút tab, **Then** huy hiệu `Kbd` hiển thị nổi bật bên cạnh nhãn tab.
3. **Given** khối "Bộ đang dịch: [Tên Truyện]", **When** hiển thị trên thanh điều hướng, **Then** khối này nằm tách biệt ở góc phải độc lập, tự động cắt ngắn (`truncate`) với tooltip đầy đủ khi tên truyện dài, không tranh chấp diện tích dải tab.

---

### User Story 3 - Menu xổ xuống "Thêm ▾" (More Dropdown Menu) dự phòng (Priority: P2)

Là một người dùng trên màn hình nhỏ (Tablet / Split-screen) hoặc người dùng muốn chuyển tab nhanh trong 1 click mà không cần quan tâm vị trí cuộn, tôi muốn có một menu xổ xuống "Thêm ▾" / "Chuyển Tab ▾" liệt kê đầy đủ danh mục các phân vùng làm việc kèm trạng thái số lượng (badge), để tôi có thể truy cập tức thì bất kỳ tab nào.

**Why this priority**: Cung cấp đường dẫn dự phòng (fallback shortcut) cực kỳ tiện lợi cho màn hình siêu nhỏ, màn hình chia đôi hoặc người dùng điều hướng bằng chuột.

**Independent Test**:
1. Thu nhỏ màn hình xuống kích thước tablet (< 768px) hoặc click vào nút dropdown "Thêm ▾" ở cuối dải tab.
2. Menu popover xổ xuống hiển thị trọn bộ danh sách 6 tab kèm biểu tượng, tên tiếng Việt, phím tắt và số lượng huy hiệu.
3. Click chọn một tab trong menu (ví dụ: "Kiểm Định Chất Lượng"): Tab đó được kích hoạt và menu tự động đóng lại.

**Acceptance Scenarios**:

1. **Given** người dùng click vào nút menu "Thêm ▾" trên thanh điều hướng, **When** menu mở ra, **Then** hiển thị danh sách đầy đủ 6 tab với biểu tượng, phím tắt và badge số lượng tương ứng.
2. **Given** menu "Thêm ▾" đang mở, **When** người dùng click vào một mục tab, **Then** hệ thống chuyển sang tab đó, tự động cuộn tab vào khung nhìn và đóng dropdown.
3. **Given** người dùng click ra ngoài menu hoặc nhấn phím `Escape`, **When** sự kiện kích hoạt, **Then** menu tự động đóng lại.

---

### Edge Cases

- **Đổi kích thước cửa sổ trình duyệt (Window Resize & Orientation Change)**: Trạng thái hiển thị của nút Chevron (<, >) và lớp phủ mờ gradient phải tự động cập nhật ngay lập tức mà không cần F5.
- **Cuộn chạm cảm ứng (Touch / Trackpad Gesture)**: Người dùng có thể vuốt ngang dải tab bằng ngón tay hoặc 2 ngón trên trackpad; các nút Chevron và gradient tự động tính toán lại vị trí sau mỗi chuyển động cuộn.
- **Tiêu đề truyện cực dài**: Khối tên truyện bên phải bị giới hạn `max-w` và `truncate` với dấu ba chấm, kèm tooltip `title` đầy đủ.
- **Dự án có số lượng thuật ngữ hoặc chương rất lớn (Badge nhiều chữ số)**: Các huy hiệu `Badge` tự co giãn trong khi nút tab vẫn giữ `shrink-0` không làm vỡ giao diện.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI bọc dải nút tab điều hướng trong một container cuộn ngang có `overflow-x: auto`, `scroll-behavior: smooth` và ẩn thanh cuộn mặc định của trình duyệt (`.scrollbar-none` / `scrollbar-width: none; ::-webkit-scrollbar: none;`).
- **FR-002**: Mỗi nút tab trong dải PHẢI có thuộc tính `flex-shrink: 0` (`shrink-0`) để đảm bảo biểu tượng, nhãn văn bản và huy hiệu không bị bóp méo khi dải tab cuộn.
- **FR-003**: Hệ thống PHẢI tích hợp 2 nút cuộn Chevron cố định ở hai đầu dải tab:
  - Nút cuộn trái `<` (`ChevronLeft`): hiển thị khi `canScrollLeft === true`, click cuộn sang trái khoảng 200px.
  - Nút cuộn phải `>` (`ChevronRight`): hiển thị khi `canScrollRight === true`, click cuộn sang phải khoảng 200px.
- **FR-004**: Hệ thống PHẢI hiển thị lớp phủ mờ chuyển sắc (Gradient Mask) tinh tế ở hai mép trái/phải (`bg-gradient-to-r/l from-parchment to-transparent`) kết hợp `pointer-events-none` và `z-10`.
- **FR-005**: Khi tab kích hoạt (`activeTab`) thay đổi (thông qua click chuột, phím tắt `Alt+1..6`, hoặc code), hệ thống PHẢI tự động cuộn mượt mà nút tab tương ứng vào vùng nhìn thấy (`element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`).
- **FR-006**: Mật độ hiển thị thích ứng (Responsive Density):
  - Phím tắt `Kbd` (Alt+1..6) PHẢI ẩn trên màn hình dưới 1440px (`hidden 2xl:inline-block`) và hiển thị trong thuộc tính `title` hover của nút tab.
  - Padding của từng nút tab PHẢI co giãn tối ưu (`px-2 sm:px-2.5 2xl:px-3 py-1.5 sm:py-2`).
- **FR-007**: Khối hiển thị thông tin bộ truyện hiện tại (`activeProject.title`) PHẢI được tách biệt độc lập ở phía bên phải ngoài dải tab cuộn, có độ rộng tối đa (`max-w-[160px] md:max-w-[220px] lg:max-w-[300px]`), cắt ngắn với dấu ba chấm (`truncate`) và hỗ trợ `title` tooltip đầy đủ.
- **FR-008**: Hệ thống PHẢI cung cấp một nút menu dropdown "Thêm ▾" (More Menu) ở góc phải dải tab để liệt kê nhanh toàn bộ 6 tab, cho phép người dùng chuyển tab tức thời chỉ trong 1 click.
- **FR-009**: Hệ thống PHẢI bảo toàn nguyên vẹn 100% thứ tự, định danh (`id`), biểu tượng (`lucide-react`), nhãn tiếng Việt (`t('nav.*')`), phím tắt (`Alt+1..6`), huy hiệu số lượng (`Badge`), và thuộc tính trợ năng (`role="tab"`, `aria-selected`, `aria-controls`) của toàn bộ 6 tab hiện có.
- **FR-010**: Hệ thống PHẢI duy trì cấp độ xếp lớp giao diện sticky tab bar ở mức `z-30` theo đúng quy chuẩn thiết kế hệ thống.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các thao tác kích hoạt tab bằng phím tắt `Alt+1` đến `Alt+6`, click chuột trực tiếp, click nút Chevron, hoặc chọn qua dropdown "Thêm ▾" đều hiển thị chính xác tab mong muốn trong vùng nhìn thấy.
- **SC-002**: Nút cuộn Chevron phản hồi tức thì (< 16ms) và ẩn/hiện mượt mà khi cuộn tới kịch biên dải tab.
- **SC-003**: 0% trường hợp tab bị co rút, bóp méo chữ hoặc che mất nhãn nhờ cơ chế `flex-shrink: 0`.
- **SC-004**: Trải nghiệm nhất quán và thẩm mỹ cao trên mọi độ rộng màn hình từ 320px (Mobile), 768px (Tablet), 1024px - 1440px (Laptop) đến 1920px+ (Desktop).
- **SC-005**: 0 lỗi phát sinh về typecheck (`npm run lint`), test suite (`npm test`), và đóng gói production (`npm run build`).

## Assumptions

- Trình duyệt hỗ trợ phương thức DOM chuẩn `element.scrollIntoView()` và `element.scrollBy()`.
- Biểu tượng `ChevronLeft`, `ChevronRight`, `MoreHorizontal` / `ChevronDown` được lấy trực tiếp từ thư viện `lucide-react` đã có sẵn trong dự án.
- Màu sắc và hiệu ứng chuyển sắc kế thừa từ hệ màu `parchment` của hệ thống thiết kế "Mực & Chu Sa".

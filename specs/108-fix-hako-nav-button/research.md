# Research & Architectural Decisions: Khắc Phục Hiển Thị Nút Kiểm Định Hako

**Feature**: `108-fix-hako-nav-button`
**Date**: 2026-09-11
**Status**: Completed

## 1. Vấn Đề Kỹ Thuật Cốt Lõi (Root Cause Analysis)

Dựa trên ảnh chụp thực tế và phân tích cấu trúc DOM tại `src/App.tsx`:
1. **Tranh chấp không gian ngang**:
   - Khung chứa chính bị giới hạn bởi `max-w-7xl` (1280px) với lề đệm `px-4 sm:px-6 lg:px-8` (chiều rộng khả dụng thực tế bên trong chỉ khoảng 1216px).
   - Khối "Bộ đang dịch: [Tên Truyện]" ở góc phải chiếm tới ~380px - 430px (tiêu đề truyện cho phép tối đa `max-w-[300px]` cộng thêm nhãn tiền tố "Bộ đang dịch: ", viền lề và khoảng cách).
   - Chiều rộng còn lại cho dải tab chỉ còn khoảng 780px.
   - 6 tab với tên tiếng Việt đầy đủ ("Mặt Trận Dịch Thuật", "Dịch Tự Động Toàn Bộ", "Từ Điển Nhân Vật", "Lịch Sử Chương Dịch", "Quản Lý Truyện", "Kiểm Định Hako") kết hợp với các huy hiệu đếm số lượng (`[386]`, `[139]`, `[3]`) đòi hỏi tổng chiều rộng tối thiểu ~980px - 1050px.
   - Do đó, tab thứ 6 ("Kiểm Định Hako") bị đẩy hoàn toàn ra ngoài biên phải của container `overflow-x-auto`.

2. **Điểm mù của menu dự phòng ("Thêm ▾")**:
   - Menu dropdown "Thêm ▾" đang được gán class `hidden sm:flex xl:hidden`.
   - Trên màn hình độ phân giải từ 1280px đến 1535px (breakpoint `xl` của Tailwind), nút này **bị ẩn cưỡng bức** vì mã nguồn giả định màn hình `xl` đã đủ rộng để hiển thị hết tất cả tab.
   - Hậu quả: Trên các màn hình laptop thông dụng (1280x720, 1366x768, 1440x900), người dùng vừa không thấy Tab 6 trên thanh tab, vừa không có nút "Thêm ▾" để chọn tab qua menu!

3. **Cơ chế nhận biết tràn (Overflow Detection) bị trễ**:
   - `useScrollOverflow` chỉ theo dõi `ResizeObserver` trên chính phần tử container `div` mà không theo dõi sự thay đổi kích thước của phần tử con `<nav>` bên trong khi dữ liệu bất đồng bộ (IndexedDB: danh sách truyện, số lượng từ điển, số lượng chương) được nạp và dựng các huy hiệu `Badge`.
   - Do `clientWidth` của container không đổi khi con mở rộng, trạng thái `canScrollRight` không được kích hoạt kịp thời để hiển thị nút Chevron phải.

---

## 2. Các Quyết Định Kiến Trúc & Thiết Kế (Architectural Decisions)

### Quyết Định 1: Tối ưu mật độ hiển thị dải tab theo cấp bậc Responsive (Responsive Tab Density)
- **Giải pháp**:
  - Tinh chỉnh padding nút tab từ `px-2.5 sm:px-3` thành `px-2 lg:px-2.5 2xl:px-3 py-1.5`.
  - Áp dụng kỹ thuật nhãn rút gọn thích ứng (Adaptive Labels) cho các màn hình < 1536px (`2xl`):
    - "Mặt Trận Dịch Thuật" → `<span className="hidden 2xl:inline">Mặt Trận </span>Dịch Thuật` (tiết kiệm ~50px)
    - "Dịch Tự Động Toàn Bộ" → `Dịch Tự Động<span className="hidden 2xl:inline"> Toàn Bộ</span>` (tiết kiệm ~55px)
    - "Từ Điển Nhân Vật" → `Từ Điển<span className="hidden 2xl:inline"> Nhân Vật</span>` (tiết kiệm ~55px)
    - "Lịch Sử Chương Dịch" → `Lịch Sử<span className="hidden 2xl:inline"> Chương Dịch</span>` (tiết kiệm ~75px)
    - "Quản Lý Truyện" → `<span className="hidden 2xl:inline">Quản Lý </span>Truyện` (tiết kiệm ~40px)
    - "Kiểm Định Hako" → giữ nguyên để nhận diện thương hiệu rõ ràng.
  - Thuộc tính `title` trên mỗi nút tab vẫn giữ trọn vẹn tên đầy đủ kèm phím tắt `Alt+X` phục vụ trải nghiệm người dùng và trợ năng.
- **Lợi ích**: Tiết kiệm ngay lập tức ~275px chiều ngang, giúp cả 6 tab nằm vừa vặn 100% trong khung nhìn trên mọi màn hình từ 1280px trở lên mà không bị ép cuộn.
- **Phương án thay thế đã đánh giá**:
  - *Chuyển Tab 6 xuống menu hamburger*: Bị loại vì Kiểm Định Hako là tính năng chính, đưa vào menu ẩn làm giảm tần suất sử dụng và giảm tính tiện lợi.
  - *Chia thanh điều hướng thành 2 hàng*: Bị loại vì vi phạm chiều cao thanh sticky bar (`h-14` + `top-14 z-30`), chiếm dụng diện tích làm việc của không gian dịch thuật.

---

### Quyết Định 2: Thu gọn linh hoạt khối "Bộ đang dịch: [Tên Truyện]"
- **Giải pháp**:
  - Giảm giới hạn chiều rộng tối đa của khung tên truyện trên các màn hình vừa:
    - Thay vì cố định `max-w-[300px]` ở `lg:`, chuyển thành `max-w-[140px] md:max-w-[180px] lg:max-w-[220px] 2xl:max-w-[300px]`.
  - Trên màn hình dưới `2xl`, ẩn bớt nhãn chữ tĩnh `{t('nav.currentBook')}: ` và thay bằng biểu tượng nhỏ hoặc chỉ hiển thị thẻ tên truyện, giúp tiết kiệm thêm ~80px.
- **Lợi ích**: Nhường thêm ~160px không gian quý giá cho dải tab điều hướng chính.

---

### Quyết Định 3: Mở rộng phạm vi hiển thị của Menu Dropdown "Thêm ▾"
- **Giải pháp**:
  - Đổi class hiển thị của menu "Thêm ▾" từ `hidden sm:flex xl:hidden` thành `hidden sm:flex 2xl:hidden` (hoặc hiển thị linh hoạt khi có cuộn tràn).
  - Đảm bảo trên các màn hình từ 640px đến 1535px, nếu có bất kỳ tình huống tràn nào xảy ra (ví dụ badge có 4 chữ số, tên truyện dài), người dùng luôn có nút "Thêm ▾" nổi bật ngay cạnh để truy cập tức thời cả 6 tab.
- **Lợi ích**: Xóa bỏ hoàn toàn "điểm mù" tại breakpoint `xl`.

---

### Quyết Định 4: Tăng cường tính phản ứng của `useScrollOverflow`
- **Giải pháp**:
  - Bổ sung quan sát phần tử con (child element `<nav>`) trong `useScrollOverflow` thông qua `ResizeObserver` hoặc `MutationObserver`.
  - Kích hoạt `checkOverflow()` mỗi khi danh sách projects, glossary count hoặc activeProject thay đổi.
  - Tối ưu hiển thị của nút cuộn phải (`ChevronRight`) và lớp phủ gradient mép phải để luôn có độ tương phản rõ ràng (`z-20`, `bg-ink/90`, viền `parchment-2`).
- **Lợi ích**: Khi dữ liệu nạp muộn, nếu xảy ra tràn, nút cuộn và hiệu ứng mờ sẽ xuất hiện lập tức.

---

## 3. Ma Trận Tác Động & Tính Tương Thích

| Thành phần | Mức độ tác động | Rủi ro | Giải pháp kiểm soát |
| :--- | :---: | :---: | :--- |
| `src/App.tsx` | Nhẹ (Chỉ cập nhật className & responsive markup thanh tab) | Thấp | Không đổi logic routing, không đổi phím tắt Alt+1..6 |
| `src/hooks/useScrollOverflow.ts` | Nhẹ (Cải thiện độ nhạy của ResizeObserver) | Thấp | Tương thích ngược 100% với các test suite hiện có |
| Thiết kế "Mực & Chu Sa" | Tuân thủ tuyệt đối | Không | Sử dụng token có sẵn (`text-polish`, `parchment`, `ink`, `z-30`) |


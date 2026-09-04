# Phase 0 Research: UI/UX Architecture & Technical Decisions

**Feature**: `084-ui-ux-optimization`  
**Date**: 2026-09-05  
**Domain**: Frontend UI/UX, Responsive Design, Web Accessibility (WCAG), Design System "Mực & Chu Sa"

---

## Technical Decisions

### Decision 1: Triệt tiêu thanh cuộn ngang (Horizontal Scroll Eradication) mà không làm hỏng `position: sticky`

- **Vấn đề**: Trong CSS, nếu đặt `overflow: hidden` hoặc `overflow-x: hidden` lên thẻ cha chứa các phần tử con dùng `position: sticky` (như Header sticky `top-0` và Tab bar sticky `top-14`), một số trình duyệt (đặc biệt là WebKit/Safari) có thể vô hiệu hóa tính năng sticky do cách tính toán context cuộn.
- **Giải pháp lựa chọn**:
  - Áp dụng `overflow-x: hidden; max-width: 100vw;` trực tiếp lên thẻ `html, body, #root` ở cấp độ toàn trang.
  - Tại container chính của ứng dụng (`#ai-story-translator-app`), sử dụng CSS class hiện đại `overflow-x: clip; max-width: 100%;` thay vì `overflow-x: hidden`.
- **Lý do**: `overflow-x: clip` triệt tiêu hoàn toàn nội dung tràn ngang mà không tạo ra BFC (Block Formatting Context) cuộn mới, do đó giữ cho `position: sticky` của Header và Tab bar hoạt động mượt mà 100% trên toàn bộ các trình duyệt.
- **Phương án đã loại trừ**: Đặt `overflow-x: hidden` lên mọi container `div` (gây lỗi mất tính năng dính sticky và làm thanh cuộn trang bị giật).

---

### Decision 2: Kiến trúc Mobile Navigation Menu (Hamburger Drawer vs Dropdown vs Bottom Bar)

- **Vấn đề**: Ứng dụng hiện có 6 phân vùng làm việc lớn (Dịch thuật, Dịch tự động, Từ điển, Lịch sử, Dự án, Kiểm định Hako). Trên mobile, thanh cuộn ngang hiện tại tốn diện tích và khó nhận biết hết tất cả các phân vùng.
- **Giải pháp lựa chọn**:
  - Xây dựng một **Mobile Drawer Menu** trượt từ trên xuống hoặc từ cạnh, được kích hoạt bằng nút Hamburger (`MoreHorizontal` / `X`) đặt tại góc trái Header bên cạnh Logo.
  - Khi mở ra, menu hiển thị toàn bộ 6 phân vùng kèm icon và phím tắt.
  - Menu có backdrop bán trong suốt (`bg-ink/80 backdrop-blur-xs`) với z-index tuân thủ thang Design System (`z-40`).
  - Khi người dùng chạm vào một tab, hàm `switchTab()` được gọi đồng thời gọi `setIsMobileMenuOpen(false)` để đóng ngay lập tức.
- **Lý do**: Tiết kiệm không gian màn hình quý giá khi đang dịch truyện, trực quan và dễ tiếp cận cho người dùng một tay trên điện thoại.
- **Phương án đã loại trừ**: Bottom Navigation Bar cố định chân trang (chiếm mất 60px chiều cao màn hình di động vốn đã chật hẹp của một công cụ soạn thảo/dịch thuật chuyên nghiệp).

---

### Decision 3: Touch Targets chuẩn WCAG & Ngăn chặn Safari iOS Auto-Zoom

- **Vấn đề**:
  1. Nút bấm kích thước nhỏ (`sm`: ~28px) rất khó bấm trúng trên màn hình cảm ứng, vi phạm tiêu chuẩn WCAG 2.5.5 (yêu cầu tối thiểu $44 \times 44\text{px}$).
  2. Safari trên iPhone tự động kích hoạt tính năng zoom màn hình khó chịu khi người dùng chạm vào bất kỳ thẻ `<input>` hoặc `<textarea>` nào có `font-size < 16px` (trong khi app đang dùng `text-xs` = 12px).
- **Giải pháp lựa chọn**:
  - Tại `Button.tsx`: Cập nhật `SIZE_STYLES` để trên mobile có chiều cao tối thiểu khả dụng (`min-h-[38px] sm:min-h-[32px]` cho sm, `min-h-[44px]` cho md), kèm vùng đệm click mở rộng.
  - Tại `src/index.css`: Thêm media query mobile:
    ```css
    @media (max-width: 640px) {
      input, select, textarea {
        font-size: 16px !important;
      }
    }
    ```
- **Lý do**: Giữ nguyên kiểu chữ nhỏ gọn (12px) thanh lịch trên màn hình máy tính desktop lớn, đồng thời loại bỏ hoàn toàn hiện tượng nhảy viewport/zoom không mong muốn trên thiết bị iPhone.

---

### Decision 4: Phản hồi Lỗi Form tại chỗ (Inline Error States) & Thông báo Thành công (Toasts)

- **Vấn đề**: Việc chỉ dựa vào một toast thông báo lướt qua khi form thất bại khiến người dùng không biết rõ ô nhập liệu nào đang thiếu thông tin.
- **Giải pháp lựa chọn**:
  - Kết hợp 2 tầng phản hồi:
    1. **Tầng thông báo toàn cục (Toast)**: Dùng `useNotifications().showToast()` thông báo trạng thái tổng quan ("Đã lưu cấu hình AI thành công!" hoặc "Vui lòng kiểm tra các trường bắt buộc").
    2. **Tầng trường nhập liệu (Inline State)**: Đánh dấu viền đỏ Chu Sa (`border-polish bg-polish/5`) và dòng chú thích lỗi nhỏ màu Chu Sa (`text-polish text-[11px]`) ngay bên dưới ô nhập liệu vi phạm.
- **Lý do**: Người dùng nhận được phản hồi ngay tại vị trí mắt đang nhìn, sửa lỗi nhanh chóng mà không cần phỏng đoán.

---

### Decision 5: Cập nhật Tiêu đề Trang (Document Title) & Meta Động không dùng thư viện ngoài

- **Vấn đề**: Không cài đặt thư viện nặng như `react-helmet` hay `@tanstack/react-router` để tuân thủ nguyên tắc Dependency Minimization trong Hiến pháp.
- **Giải pháp lựa chọn**:
  - Sử dụng React `useEffect` trực tiếp trong `App.tsx` lắng nghe `[activeTab, activeProject?.title]`.
  - Cập nhật trực tiếp `document.title = ...` và `document.querySelector('meta[name="description"]')?.setAttribute('content', ...)`.
- **Lý do**: 0 bytes tăng thêm vào bundle, tốc độ cập nhật tức thì, không gây lỗi hydration hay memory leak.

---

### Decision 6: Cấu hình Favicon phong cách Mực & Chu Sa

- **Vấn đề**: Cần một favicon vector sắc nét trên mọi mật độ điểm ảnh (Retina / 4K) nhưng vẫn đậm bản sắc cổ phong của ứng dụng.
- **Giải pháp lựa chọn**:
  - Tạo tệp `public/favicon.svg` dạng vector: nền mực `#14100D`, con dấu đỏ Chu Sa `#B8402C`, chữ Hán `譯` (Dịch) màu giấy da `#F4ECD8`.
  - Khai báo `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` và `<link rel="alternate icon" href="/favicon.ico" />` trong `index.html`.
- **Lý do**: Dung lượng siêu nhẹ (<1KB), độ sắc nét hoàn hảo ở mọi tỷ lệ thu phóng, khớp 100% với con dấu `Seal` trong Header.

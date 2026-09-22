# Chính Sách Bảo Mật

**Cập nhật lần cuối**: 22/09/2026

## Tổng quan

Ứng dụng này chạy hoàn toàn trên trình duyệt của bạn. Nội dung sách, bản dịch, và cấu
hình dự án của bạn nằm trên chính thiết bị của bạn — chúng tôi không thu thập hay lưu
trữ những nội dung đó trên máy chủ.

## Dữ liệu dịch thuật của bạn

Sách, bản dịch, bảng thuật ngữ, và cài đặt dự án được lưu trữ cục bộ trong IndexedDB của
trình duyệt bạn đang dùng. Ứng dụng hoạt động theo kiến trúc thuần Client-side (Zero Application
Backend), không có máy chủ trung gian để tiếp nhận hay lưu trữ bản thảo của bạn.

Khi bạn sử dụng các tính năng AI (dịch thô, trau chuốt, thẩm định chất lượng Hako, trích xuất
thuật ngữ), các đoạn văn bản cần xử lý sẽ được trình duyệt gửi trực tiếp qua kết nối HTTPS
đến nhà cung cấp dịch vụ AI do bạn thiết lập (Google Gemini API). Dữ liệu này tuân theo
chính sách bảo mật và điều khoản dịch vụ của nhà cung cấp AI tương ứng.

## API key AI (bắt buộc)

Để dùng tính năng dịch, bạn cần tự cung cấp API key của riêng mình cho dịch vụ AI
(Google Gemini hoặc nhà cung cấp tương thích khác). Key được lưu trong bộ nhớ phiên
(`sessionStorage`) của trình duyệt và gửi thẳng đến máy chủ của nhà cung cấp AI khi bạn thực
hiện dịch — không đi qua, không được ghi lại, và không được lưu trữ trên bất kỳ máy chủ
trung gian nào. Bạn có thể chủ động chọn lưu khóa vào `localStorage` nếu muốn ghi nhớ trên
trình duyệt cá nhân.

## Đăng nhập Google & đồng bộ Google Drive (tùy chọn)

Bạn có thể chọn đăng nhập bằng Google để sao lưu/đồng bộ dữ liệu. Nếu vậy, ứng dụng
yêu cầu hai quyền:

- **Hồ sơ cơ bản** (tên, email, ảnh đại diện) — chỉ để hiển thị tài khoản nào đang kết
  nối trong giao diện.
- **Truy cập Google Drive theo từng tệp** — ứng dụng chỉ có thể đọc và ghi các tệp do
  chính nó tạo ra để lưu bản sao dữ liệu của bạn. Ứng dụng không thể xem, liệt kê, hay
  chỉnh sửa bất kỳ tệp nào khác trong Drive của bạn.

Đăng nhập và đồng bộ Drive hoàn toàn không bắt buộc — bạn vẫn dùng được toàn bộ tính
năng dịch mà không cần đăng nhập, miễn là đã cấu hình API key riêng. Toàn bộ quá trình
xác thực và mọi thao tác với Drive diễn ra trực tiếp giữa trình duyệt của bạn và máy
chủ Google. Token đăng nhập không được gửi về hay lưu trữ trên máy chủ của chúng tôi.

## Nhật ký hạ tầng lưu trữ tĩnh & CDN

Ứng dụng không có máy chủ backend riêng để ghi nhận hay xử lý nhật ký người dùng. Tuy
nhiên, nền tảng lưu trữ web tĩnh hoặc mạng phân phối nội dung (CDN/Hosting provider như
Vercel, Render, Cloudflare) phục vụ việc tải mã nguồn HTML/JS/CSS có thể tự động ghi lại
địa chỉ IP truy cập và siêu dữ liệu yêu cầu HTTP cơ bản (thời điểm, user-agent, tệp tài
nguyên) nhằm mục đích bảo vệ hạ tầng, chống tấn công DDoS và tuân thủ an toàn mạng.

## Cookie & lưu trữ trình duyệt

Ứng dụng chỉ dùng lưu trữ trình duyệt ở mức tối thiểu cần cho hoạt động (ví dụ: ghi
nhớ tùy chọn giao diện). Không sử dụng cookie quảng cáo hay cookie theo dõi.

## Thay đổi chính sách

Chính sách này có thể được cập nhật theo thời gian. Mọi thay đổi sẽ được phản ánh trên
trang này kèm ngày cập nhật mới.

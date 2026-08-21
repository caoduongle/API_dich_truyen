# Chính Sách Bảo Mật

**Cập nhật lần cuối**: [điền ngày khi phát hành chính thức]

## Tổng quan

Ứng dụng này chạy hoàn toàn trên trình duyệt của bạn. Nội dung sách, bản dịch, và cấu
hình dự án của bạn nằm trên chính thiết bị của bạn — chúng tôi không thu thập hay lưu
trữ những nội dung đó trên máy chủ.

## Dữ liệu dịch thuật của bạn

Sách, bản dịch, bảng thuật ngữ, và cài đặt dự án được lưu trong IndexedDB và
localStorage của trình duyệt bạn đang dùng. Máy chủ của chúng tôi không nhận, không xử
lý, và không lưu trữ bất kỳ nội dung nào trong số này.

## API key AI (bắt buộc)

Để dùng tính năng dịch, bạn cần tự cung cấp API key của riêng mình cho dịch vụ AI
(Google Gemini hoặc nhà cung cấp tương thích khác). Key được lưu cục bộ trên trình
duyệt và gửi thẳng đến máy chủ của nhà cung cấp AI khi bạn thực hiện dịch — không đi
qua, không được ghi lại, và không được lưu trữ trên máy chủ của chúng tôi dưới bất kỳ
hình thức nào.

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

## Nhật ký máy chủ

Máy chủ phục vụ ứng dụng có ghi lại địa chỉ IP truy cập và một số siêu dữ liệu yêu cầu
cơ bản (thời điểm, endpoint) — phục vụ mục đích bảo mật và chống lạm dụng hạ tầng. Dữ
liệu này không được dùng cho mục đích nào khác và không được chia sẻ cho bên thứ ba.

## Cookie & lưu trữ trình duyệt

Ứng dụng chỉ dùng lưu trữ trình duyệt ở mức tối thiểu cần cho hoạt động (ví dụ: ghi
nhớ tùy chọn giao diện). Không sử dụng cookie quảng cáo hay cookie theo dõi.

## Thay đổi chính sách

Chính sách này có thể được cập nhật theo thời gian. Mọi thay đổi sẽ được phản ánh trên
trang này kèm ngày cập nhật mới.

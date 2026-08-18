# Research & Decisions: Web Chapter Export Formatting

## 1. Technical Context & Problem Analysis

### Vấn đề hiện tại
Trong hook [`src/hooks/useExportFiles.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useExportFiles.ts):
- Việc bóc tách tiêu đề (`detectedTitle`) và làm sạch nội dung (`cleanLines`) được thực hiện inline trong vòng lặp xuất file, sử dụng các biểu thức regex phức tạp (`titleRegex`, `chineseTitleRegex`, `partIndicatorRegex`) với các điều kiện so khớp lỏng lẻo.
- Khi tiêu đề chương trong bản dịch dài hoặc chứa nội dung đoạn mở đầu, thuật toán nhận diện có thể nuốt nhầm đoạn văn đầu tiên làm tiêu đề, hoặc không tách được tiêu đề khiến phần thân bị đẩy dồn lên dòng `*** ` hoặc bị lặp lại tiêu đề trong phần nội dung.
- Không có module format riêng biệt có thể viết unit test độc lập cho các định dạng xuất (`web`, `audio`, `align_jsonl`).

## 2. Architectural Decisions

### Quyết định 1: Tạo module tiện ích chuẩn hóa định dạng xuất (`src/utils/exportFormatter.ts`)
- **Giải pháp**: Tách toàn bộ logic trích xuất tiêu đề, làm sạch nội dung và định dạng tệp văn bản từ `useExportFiles.ts` sang một module thuần túy (`exportFormatter.ts`).
- **Lý do**:
  - Đảm bảo nguyên lý Single Responsibility Principle (SRP).
  - Cho phép viết Unit Test bao phủ 100% các trường hợp biên (edge cases): tiêu đề có sẵn dấu sao, tiêu đề chữ Hán, tiêu đề có phần 1/2, nội dung lặp lại tiêu đề, nội dung không có tiêu đề, v.v.
  - `useExportFiles.ts` chỉ đảm nhận nhiệm vụ điều phối (tải dữ liệu từ IndexedDB, đóng gói zip, kích hoạt download).

### Quyết định 2: Chuẩn định dạng Web Export
- Định dạng xuất chuẩn:
  ```text
  *** [Tên chương]
  [Dòng 1 của nội dung]
  [Dòng 2 của nội dung]

  *** [Tên chương 2]
  [Dòng 1 của nội dung chương 2]
  ```
- **Quy tắc**:
  1. `*** ` luôn là tiền tố bắt buộc ở đầu dòng tiêu đề.
  2. Sau `*** ` là tên chương đã được làm sạch (loại bỏ dấu sao thừa, bỏ số phần phân đoạn thừa nếu có).
  3. Xuống dòng ngay sau tiêu đề để bắt đầu nội dung thân chương.
  4. Giữa 2 chương liên tiếp luôn có đúng 2 ký tự xuống dòng `\n\n`.

## 3. Alternatives Considered

| Giải pháp | Đánh giá | Quyết định |
|---|---|---|
| Sửa regex trực tiếp trong `useExportFiles.ts` | Khó kiểm thử tự động, dễ gây hồi quy (regression) | **Loại bỏ** |
| Tách module `exportFormatter.ts` và bổ sung unit test | Dễ bảo trì, testable 100%, tuân thủ Constitution | **Được chọn** |

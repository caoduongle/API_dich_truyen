# Interface Contract: `separateChapterTitleAndBody`

## Function: `separateChapterTitleAndBody(text: string): string`

### Mục đích:
Phát hiện và tự động tách dòng nếu tiêu đề chương và câu mở đầu của chương bị dính liền trên cùng một dòng bởi dấu chấm hoặc dấu gạch nối.

### Ví dụ đầu vào:
```text
Chương 1: Đài Phát Thanh Kinh Hoàng. Đôi môi đỏ thắm, đêm tối mịt mờ; đêm nay, thuộc về sự buông thả.
```

### Đầu ra mong đợi:
```text
Chương 1: Đài Phát Thanh Kinh Hoàng

Đôi môi đỏ thắm, đêm tối mịt mờ; đêm nay, thuộc về sự buông thả.
```

### Quy tắc xử lý:
1. Nếu chuỗi bắt đầu bằng mẫu `Chương/Chapter/Hồi/Quyển/Tập [Số]...` và ngay sau đó có dấu chấm `.` theo sau là chữ viết hoa/dấu ngoặc kép của câu tiếp theo, chèn `\n\n`.
2. Nếu văn bản đã có sẵn `\n` sau tiêu đề, giữ nguyên không biến đổi.
3. Không làm thay đổi các câu văn bình thường trong thân bài.

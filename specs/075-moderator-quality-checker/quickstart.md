# Quickstart & Validation Guide: Moderator Project Quality Checker Workspace

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

---

## Prerequisites

1. Ensure development server is running (`npm run dev` and backend server).
2. Have at least one `StoryProject` created with 1 or more translated chapters (`polishedTranslation` or `rawTranslation`).
3. Ensure at least one Gemini API Key is configured in "Cấu hình AI" (Alt+,).

---

## Validation Scenarios

### Scenario 1: Chọn dự án và xem danh sách chương kiểm định

1. Nhấn `Alt+6` hoặc click vào tab **Kiểm Định Hako** trên thanh điều hướng.
2. Tại khu vực chọn dự án, chọn một dự án dịch hiện có trong danh sách.
3. **Kết quả mong đợi**:
   - Danh sách chương của dự án hiển thị tức thì (< 0.5s) từ dữ liệu cục bộ.
   - Mỗi chương hiển thị rõ: số thứ tự, tiêu đề, số từ, và nhãn trạng thái (*Đã biên tập*, *Đã dịch thô*, hoặc *Chưa dịch*).
   - Các chương chưa có bản dịch bị vô hiệu hóa chọn.

---

### Scenario 2: Chọn chương và kích hoạt kiểm định tự động (Heuristic + AI)

1. Chọn từ 1 đến 12 chương đã có bản dịch.
2. (Tùy chọn) Nhấn "+ Thêm Raw" tại một chương để xem văn bản `sourceText` tự động nạp sẵn hoặc dán đè văn bản raw khác.
3. Nhấn **"Bắt đầu kiểm định"**.
4. **Kết quả mong đợi**:
   - Thanh tiến trình hiển thị rõ bước tải và phân tích Heuristic / AI từng chương.
   - Sau khi hoàn tất, danh sách lỗi nghi vấn xuất hiện trong bảng kiểm duyệt (`HakoIssueReviewPanel`).
   - Các lỗi được phân loại chính xác: *Tên riêng không nhất quán*, *Xưng hô / Giới tính*, *Thuật ngữ*, *Sót raw*, *Trùng lặp*, *Sai nghĩa*, *Bỏ sót*, *Dịch thừa*.

---

### Scenario 3: Duyệt quyết định và kiểm tra tính lưu trữ bền vững

1. Trên các thẻ lỗi (`HakoIssueCard`), thử nhấn các nút quyết định:
   - Nhấn **"Xác nhận lỗi"** (chuyển sang màu đỏ chu sa / polish).
   - Nhấn **"Cần xem lại"** (chuyển sang màu hổ phách / amber).
   - Nhấn **"Bác bỏ"** (làm mờ thẻ).
   - Nhấn "+ Thêm ghi chú" và nhập hướng dẫn sửa lỗi cho dịch giả.
2. Tải lại trang trình duyệt (F5) hoặc chuyển sang tab khác (Alt+1) rồi quay lại tab Kiểm Định (Alt+6).
3. **Kết quả mong đợi**:
   - Toàn bộ phiên làm việc, danh sách chương đã chọn, toàn bộ lỗi phát hiện, trạng thái quyết định và ghi chú được khôi phục 100% nguyên vẹn từ IndexedDB.

---

### Scenario 4: Xuất và sao chép báo cáo Markdown vào Clipboard

1. Tại bảng kiểm duyệt lỗi, nhấn **"Xuất báo cáo"**.
2. Modal báo cáo hiển thị thống kê tổng quan (số lỗi nghiêm trọng, lớn, nhẹ, cảnh báo) và bản xem trước Markdown.
3. Nhấn **"Sao chép vào Clipboard"**.
4. **Kết quả mong đợi**:
   - Nút chuyển sang trạng thái "Đã sao chép vào Clipboard!" với biểu tượng checkmark.
   - Dán vào trình soạn thảo (Notepad / Discord) kiểm tra: báo cáo có định dạng Markdown rõ ràng, phân nhóm theo từng chương kèm trích dẫn bằng chứng và ghi chú của moderator.

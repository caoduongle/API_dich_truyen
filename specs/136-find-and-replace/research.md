# Research & Technical Decisions: Tìm và Thay Thế Văn Bản Trong Bàn Dịch (136-find-and-replace)

**Feature**: `136-find-and-replace` | **Date**: 2026-09-14

---

## 1. Bối Cảnh Kỹ Thuật & Vấn Đề Cần Giải Quyết

Trong quá trình dịch và hiệu đính chương tiểu thuyết, dịch giả cần xử lý các lỗi ngữ nghĩa hoặc xưng hô xuất hiện lặp đi lặp lại nhiều lần trong văn bản (ví dụ: thay đổi đại từ xưng hô, sửa danh xưng nhân vật, loại bỏ cụm từ dịch lủng củng).
Việc sửa thủ công từng từ tốn thời gian và dễ bỏ sót. Trình duyệt có công cụ tìm kiếm mặc định (`Ctrl+F`), nhưng không hỗ trợ thay thế (Replace / Replace All) vào ô `<textarea>` của React component.

Mục tiêu nghiên cứu:
1. Xây dựng thuật toán tìm kiếm và thay thế chuỗi an toàn, hiệu năng cao, hỗ trợ cả phân biệt chữ hoa/thường (`matchCase`).
2. Tích hợp trực tiếp vào `<textarea>` của Bàn Dịch (`rawTranslation` hoặc `polishedTranslation`), điều khiển con trỏ (`selectionRange`) và cuộn mượt đến từng vị trí.
3. Cung cấp hộp thoại "Tìm và Thay thế" nổi (floating/modal dialog) theo đúng thiết kế người dùng cung cấp và tuân thủ bảng màu "Mực & Chu Sa" (`.agents/rules/design-system.md`).

---

## 2. Các Quyết Định Thiết Kế Kỹ Thuật (Decisions & Rationale)

### Quyết định 1: Thuật toán tìm kiếm & Định vị trùng khớp (`findMatchesInText`)
- **Quyết định**: Xây dựng hàm thuần túy (pure function) `findMatchesInText(fullText: string, searchTerm: string, matchCase: boolean): MatchLocation[]`.
- **Chi tiết**:
  - Thoát (escape) toàn bộ ký tự đặc biệt của biểu thức chính quy (`[.*+?^${}()|[\]\\]`) bằng `\\$&` để người dùng có thể tìm kiếm tự do dấu câu, dấu ngoặc, ký hiệu toán học mà không gây Regex Syntax Error.
  - Sử dụng cờ `'g'` (nếu `matchCase = true`) hoặc `'gi'` (nếu `matchCase = false`).
  - Sử dụng vòng lặp `regex.exec(fullText)` để thu thập danh sách tọa độ `{ start, end }` của từng vị trí trùng khớp.
  - Xử lý chặn nếu `searchTerm` rỗng thì trả về ngay mảng rỗng `[]`.
- **Lý do**: Xử lý Regex an toàn tuyệt đối với độ phức tạp $O(N)$ tuyến tính theo độ dài chuỗi văn bản (dưới 5ms cho chương 20,000 từ).
- **Phương án thay thế bị bác bỏ**: Dùng `indexOf` thủ công trong vòng lặp `while` khi `matchCase = false` (phải gọi `toLowerCase()` toàn bộ văn bản lớn, gây tốn bộ nhớ và chậm hơn so với Regex engine của V8).

### Quyết định 2: Cơ chế điều hướng vòng tròn (`wrap-around navigation`)
- **Quyết định**: Hỗ trợ hai nút `^ Trước` và `v Sau` với cơ chế tính chỉ số xoay vòng:
  - Chỉ số kế tiếp (`next`): `(currentIndex + 1) % totalMatches`
  - Chỉ số trước đó (`prev`): `(currentIndex - 1 + totalMatches) % totalMatches`
- **Tương tác DOM**:
  - Gọi `textarea.setSelectionRange(match.start, match.end)` để bôi đen native selection.
  - Tính toán dòng tương ứng và gọi `scrollAndSelectInTextarea` hoặc điều chỉnh `textarea.scrollTop` có khoảng đệm 2 dòng trên để văn bản không bị che khuất bởi hộp thoại.
  - Kích hoạt tiêu điểm `textarea.focus()` khi người dùng muốn soạn thảo ngay.
- **Lý do**: Đáp ứng chuẩn trải nghiệm người dùng trong các trình soạn thảo chuyên nghiệp (VS Code, Word, Sublime Text).

### Quyết định 3: Cơ chế Thay thế đơn lẻ (`replaceCurrent`) và Thay thế tất cả (`replaceAll`)
- **Quyết định**:
  - **Thay thế đơn lẻ (`Thay thế`)**:
    - Lấy vị trí `matches[currentIndex]`.
    - Cắt ghép chuỗi: `newText = fullText.slice(0, start) + replaceTerm + fullText.slice(end)`.
    - Cập nhật state bản dịch (`setRawTranslation` hoặc `setPolishedTranslation`).
    - Tính toán lại vị trí các match tiếp theo, cập nhật `currentIndex` và bôi đen vị trí mới.
  - **Thay thế toàn bộ (`Thay tất cả`)**:
    - Nếu `matchCase = true`: Thay thế toàn bộ bằng `fullText.replaceAll(searchTerm, replaceTerm)`.
    - Nếu `matchCase = false`: Thay thế bằng `fullText.replace(new RegExp(escaped, 'gi'), replaceTerm)`.
    - Đếm số lượng thay thế: `count = matches.length`.
    - Hiển thị toast thông báo kết quả: `"Đã thay thế ${count} vị trí"`.
- **Lý do**: Thay thế tất cả trong một lượt duy nhất đảm bảo tính nguyên tử (atomic), không gây re-render gián đoạn, tránh đệ quy vô hạn khi từ thay thế chứa từ tìm kiếm (ví dụ thay "Kiếm" bằng "Thánh Kiếm").

### Quyết định 4: Thiết kế Giao diện Hộp thoại (`FindReplaceModal`)
- **Quyết định**: Xây dựng component `src/components/translator-workspace/FindReplaceModal.tsx`.
  - Khung dialog nổi nhẹ (`fixed` hoặc `absolute` góc trên bên phải khung soạn thảo hoặc modal nhỏ gọn giữa màn hình có thể di chuyển).
  - Thiết kế tuân thủ 100% bản sắc "Mực & Chu Sa" (`bg-ink`, viền `border-parchment-2`, tiêu đề `text-text-main`, nút xanh lục/xanh lam bo `rounded-[2px]`).
  - Có nút đóng `x` và nút `Đóng`.
  - Hỗ trợ phím tắt `Esc` để đóng, `Enter` trong ô tìm kiếm để nhảy đến kết quả kế tiếp, `Shift+Enter` để nhảy kết quả trước đó.
- **Lý do**: Tái hiện chính xác thiết kế trong ảnh người dùng cung cấp và đảm bảo thẩm mỹ nhất quán với app.

### Quyết định 5: Điền sẵn văn bản đang bôi đen (`auto-prepopulate`)
- **Quyết định**: Khi mở modal, nếu người dùng đang bôi chọn một đoạn văn bản trong textarea (`selectionStart !== selectionEnd`), tự động lấy chuỗi đó gán vào `searchTerm`.
- **Lý do**: Giúp người dùng chỉ cần bôi đen từ bị lỗi trong bài, bấm `Ctrl+H` là từ đó đã nằm sẵn trong ô tìm kiếm, chỉ việc gõ từ mới vào ô thay thế.

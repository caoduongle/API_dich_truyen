# Quickstart: Hướng Dẫn Kiểm Thử & Nghiệm Thu Tính Năng Tìm và Thay Thế (136-find-and-replace)

**Feature**: `136-find-and-replace` | **Date**: 2026-09-14

---

## 1. Mục Tiêu Kiểm Thử

Đảm bảo tính năng **Tìm và Thay thế** trong Bàn Dịch hoạt động chính xác, mượt mà và an toàn theo đúng thiết kế người dùng đã cung cấp trong ảnh chụp màn hình.

---

## 2. Kịch Bản Kiểm Thử Tự Động (Automated Testing)

### 2.1 Kiểm thử thuật toán tìm kiếm và thay thế
Chạy unit test cho các tiện ích thuần túy:
```bash
npx vitest run src/utils/__tests__/textSearch.test.ts
```
*Kỳ vọng*:
- Tìm đúng tất cả vị trí xuất hiện của chuỗi thường và chuỗi có ký tự đặc biệt Regex (`[`, `]`, `?`, `*`, `+`).
- Phân biệt chữ hoa/thường chuẩn xác khi bật hoặc tắt `matchCase`.
- Thay thế đơn lẻ và thay thế tất cả (`replaceAll`) chính xác 100%, không bị lặp vô tận khi từ thay thế chứa từ tìm kiếm.

### 2.2 Kiểm thử component hộp thoại và phím tắt
Chạy unit test giao diện:
```bash
npx vitest run src/components/translator-workspace/__tests__/FindReplaceModal.test.tsx
```
*Kỳ vọng*:
- Hiển thị đầy đủ các trường nhập và nút bấm đúng theo mockup.
- Phản ứng đúng với các sự kiện bấm "Trước", "Sau", "Thay thế", "Thay tất cả".
- Đóng hộp thoại khi bấm `Esc` hoặc nút "Đóng".

### 2.3 Bộ kiểm định chất lượng bắt buộc (Quality Gates)
```bash
npm run lint    # tsc --noEmit: Phải sạch lỗi kiểu dữ liệu
npm test        # vitest run: Toàn bộ 75+ test suites phải pass 100%
npm run build   # tsc && vite build: Đóng gói thành công
```

---

## 3. Kịch Bản Kiểm Thử Thủ Công (Manual Walkthrough)

### Kịch bản 1: Mở nhanh bằng phím tắt và điền sẵn văn bản đang bôi đen
1. Vào tab **Bàn Dịch**, nạp một chương truyện bất kỳ.
2. Dùng chuột bôi đen một từ ngữ trong ô dịch (ví dụ: bôi đen từ `"hắn"`).
3. Nhấn tổ hợp phím **`Ctrl+H`** (hoặc bấm nút biểu tượng kính lúp/thay thế trên thanh công cụ ô dịch).
4. **Xác minh**:
   - Hộp thoại "Tìm và Thay thế" hiển thị nổi bật.
   - Ô "Tìm kiếm" đã được điền sẵn chữ `"hắn"`.
   - Bộ đếm hiển thị chính xác số lượng kết quả (ví dụ: `1/14`).
   - Vị trí đầu tiên trong ô soạn thảo được bôi đen.

### Kịch bản 2: Duyệt qua các kết quả bằng nút "Sau" và "Trước"
1. Trong hộp thoại, bấm nút **`v Sau`**: Ô soạn thảo tự động cuộn đến và bôi đen vị trí thứ 2, bộ đếm chuyển thành `2/14`.
2. Bấm liên tục cho đến kết quả cuối cùng (`14/14`), sau đó bấm **`v Sau`** một lần nữa: Con trỏ tự động quay vòng về kết quả đầu tiên (`1/14`).
3. Bấm **`^ Trước`**: Con trỏ quay ngược về vị trí `14/14`.

### Kịch bản 3: Thay thế đơn lẻ (`Thay thế`)
1. Đặt từ thay thế vào ô "Thay thế bằng": `"chàng"`.
2. Bấm nút **`Thay thế`**:
   - Từ `"hắn"` tại vị trí hiện tại lập tức đổi thành `"chàng"`.
   - Vùng chọn tự động nhảy đến vị trí tiếp theo.
   - Tổng số kết quả giảm xuống còn `13`.

### Kịch bản 4: Thay thế hàng loạt tất cả (`Thay tất cả`)
1. Nhập từ tìm kiếm `"Tiêu Viêm"` và từ thay thế `"Tiêu Hỏa"`.
2. Bấm nút **`Thay tất cả`**.
3. **Xác minh**:
   - Toàn bộ các từ `"Tiêu Viêm"` trong chương được đổi thành `"Tiêu Hỏa"`.
   - Một thông báo toast hiển thị: `"Đã thay thế X vị trí"`.
   - Bấm `Ctrl+S` để lưu chương thành công vào cơ sở dữ liệu.

### Kịch bản 5: Tùy chọn "Phân biệt chữ hoa/thường"
1. Trong văn bản có cả `"Sư phụ"` và `"sư phụ"`.
2. Tích chọn checkbox **"Phân biệt chữ hoa/thường"**.
3. Nhập từ tìm kiếm `"Sư phụ"`.
4. **Xác minh**: Hệ thống chỉ đánh dấu các vị trí viết hoa chữ "S", bỏ qua hoàn toàn `"sư phụ"` chữ thường.

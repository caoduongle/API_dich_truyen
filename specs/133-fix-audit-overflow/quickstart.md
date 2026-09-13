# Quickstart & Validation Guide: UnifiedAuditPanel Overflow Fix (133-fix-audit-overflow)

Tài liệu hướng dẫn kiểm thử xác minh tính năng khắc phục lỗi che chữ và hỗ trợ cuộn xem trọn vẹn thẻ lỗi thẩm định chất lượng.

## 1. Điều Kiện Tiên Quyết (Prerequisites)

- Node.js 18+ và npm
- Trình duyệt Chrome / Edge hoặc công cụ kiểm thử tự động Vitest

---

## 2. Kịch Bản Kiểm Thử Tự Động (Automated Validation Scenarios)

### Kịch Bản 1: Kiểm thử Unit Test cho `UnifiedAuditPanel`

Chạy bộ kiểm thử chuyên biệt của component thẩm định chất lượng:

```bash
npm test -- src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx
```

**Kết quả kỳ vọng**:
- Tất cả các bài kiểm thử hiện có tiếp tục PASS 100%.
- Các bài kiểm thử bổ sung cho việc hiển thị trích đoạn dài (không chứa `line-clamp-2`, hỗ trợ `overflow-y-auto`, nút "Xem thêm / Thu gọn", ngắt từ `break-words`) pass 100%.

### Kịch Bản 2: Kiểm thử Toàn Bộ Dự Án (Full Quality Gate)

```bash
npm run lint    # Kiểm tra type TypeScript
npm test        # Chạy toàn bộ 74+ test suites
npm run build   # Build production Vite bundle
```

**Kết quả kỳ vọng**: Không có bất kỳ lỗi biên dịch nào, build production thành công.

---

## 3. Kịch Bản Kiểm Thử Thủ Công Trên Giao Diện (Manual UI Verification)

### Kịch Bản 3.1: Xác minh trích đoạn lỗi dài (>150 ký tự)

1. Mở ứng dụng trong môi trường dev (`npm run dev`).
2. Điều hướng tới tab **Dịch Thuật**.
3. Mở một chương truyện và kích hoạt bảng **Thẩm định & Kiểm duyệt chất lượng**.
4. Khi có thẻ lỗi chứa trích đoạn dài:
   - **Quan sát**: Chữ không còn bị cắt ngang ở dòng 2 kèm dấu chấm lửng vô phương cứu vãn.
   - **Thao tác 1**: Lăn con trỏ chuột hoặc vuốt cảm ứng trên ô trích đoạn -> nội dung cuộn lên xuống mượt mà từ đầu đến cuối đoạn văn.
   - **Thao tác 2**: Bấm nút "Xem thêm" -> khung trích đoạn mở rộng toàn phần để đọc trọn vẹn văn bản; nhãn chuyển thành "Thu gọn". Bấm "Thu gọn" -> trở về dạng cuộn gọn gàng.
   - **Thao tác 3**: Bôi đen chọn một cụm từ trong trích đoạn để copy -> không làm kích hoạt chuyển focus hay làm thay đổi con trỏ soạn thảo chính.

### Kịch Bản 3.2: Xác minh tin nhắn giải thích và AI rewrite preview dài

1. Gửi yêu cầu "Nhờ AI viết lại câu này" cho một câu văn dài.
2. Kiểm tra khung kết quả gợi ý viết lại của AI:
   - Toàn bộ câu văn được ngắt dòng tự nhiên (`break-words`), không bị tràn lề ngang.
   - Khung gợi ý có thanh cuộn mượt mà nếu vượt quá chiều cao tối đa `max-h-36`.

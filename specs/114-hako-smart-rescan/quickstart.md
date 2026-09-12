# Quickstart & Verification Guide: Rà Soát Lại Có Ghi Nhớ Quyết Định (114-hako-smart-rescan)

**Tài liệu liên quan**:
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/reconciliation.contract.ts](./contracts/reconciliation.contract.ts)

## 1. Môi Trường & Lệnh Kiểm Thử Tự Động

Chạy toàn bộ unit test và kiểm tra kiểu dữ liệu:
```bash
npm run lint    # Kiểm tra TypeScript type safety
npm test        # Chạy test suite Vitest
npm run build   # Kiểm tra build bundle production
```

Để chạy riêng test suite cho tính năng kiểm định chất lượng:
```bash
npx vitest run src/services/__tests__/hakoQualityEngine.test.ts
npx vitest run src/components/hako-checker/__tests__/
```

---

## 2. Kịch Bản Kiểm Thử Thủ Công (Manual Verification Scenarios)

### Kịch bản 1: Ghi nhớ lỗi Bác bỏ (`dismissed`) khi Rà soát lại
1. **Chuẩn bị**: Mở tab **Kiểm Định Hako**, chọn 1 dự án và chọn 1 chương có chứa lỗi (ví dụ: cảnh báo sót chữ Hán hoặc lặp đoạn).
2. **Thực hiện**:
   - Nhấn **Bắt đầu kiểm định**.
   - Khi kết quả hiện ra, tại 1 thẻ lỗi, nhấn nút **✕ Bác bỏ**.
   - Quan sát: Thẻ lỗi chuyển sang trạng thái mờ với nhãn "Đã bỏ qua".
   - Nhấn nút **Rà soát lại** ở góc trên bên phải thanh thống kê.
3. **Kỳ vọng**:
   - Quá trình quét hoàn tất.
   - Thẻ lỗi vừa rồi **không** bị biến thành lỗi mới "Chờ duyệt", mà vẫn giữ nguyên trạng thái "Đã bỏ qua".
   - Tỷ lệ cảnh báo trùng lặp là 0%.

---

### Kịch bản 2: Tự động chuyển Xác nhận lỗi (`confirmed`) sang Đã giải quyết (`resolved`)
1. **Chuẩn bị**: Trong danh sách lỗi kiểm định, chọn 1 lỗi sót chữ Hán (raw_leak).
2. **Thực hiện**:
   - Nhấn **✓ Xác nhận lỗi**.
   - Nhấn nút **Mở trong Bàn Dịch để sửa** trên thẻ lỗi đó.
   - Ứng dụng tự động điều hướng sang tab Bàn Dịch đúng chương đó.
   - Biên tập lại văn bản: Xóa hoặc dịch ký tự chữ Hán còn sót, sau đó bấm Lưu chương.
   - Quay lại tab **Kiểm Định Hako**, nhấn nút **Rà soát lại**.
3. **Kỳ vọng**:
   - Quá trình quét lại phát hiện đoạn văn bản đã sạch ký tự Hán.
   - Thẻ lỗi được tự động chuyển sang trạng thái **Đã giải quyết** (`resolved`) với viền xanh lá ngọc và nhãn "✓ Đã khắc phục sau khi sửa bản dịch".
   - Thanh thống kê hiển thị thông báo tổng kết: *"Đã khắc phục 1 lỗi"*.

---

### Kịch bản 3: Giữ nguyên trạng thái Cần xem lại (`review_needed`) và Ghi chú
1. **Chuẩn bị**: Tại 1 thẻ lỗi phân vân, nhấn **? Cần xem lại**.
2. **Thực hiện**:
   - Nhấn **+ Thêm ghi chú**, gõ: *"Cần kiểm tra lại ngữ cảnh hồi 3"* và bấm Lưu ghi chú.
   - Nhấn nút **Rà soát lại** (không sửa bản dịch chương đó).
3. **Kỳ vọng**:
   - Sau khi rà soát lại, thẻ lỗi vẫn duy trì trạng thái **Cần xem lại**.
   - Nội dung ghi chú *"Cần kiểm tra lại ngữ cảnh hồi 3"* được giữ nguyên vẹn 100%.

---

### Kịch bản 4: Nhận diện lỗi mới phát sinh
1. **Chuẩn bị**: Mở Bàn Dịch, cố tình chèn thêm 1 đoạn chữ Hán vào chương đã kiểm định và bấm Lưu.
2. **Thực hiện**:
   - Vào lại tab **Kiểm Định Hako**, nhấn **Rà soát lại**.
3. **Kỳ vọng**:
   - Thẻ lỗi mới xuất hiện ở trạng thái **Chờ duyệt** (`pending`).
   - Có nhãn nổi bật "Mới" để phân biệt với các lỗi đã duyệt ở lần trước.
   - Thanh thông báo hiển thị: *"Phát hiện 1 lỗi mới"*.


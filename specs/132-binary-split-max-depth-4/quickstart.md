# Quickstart: Kiểm Thử & Xác Thực Tính Năng Chia Đôi Nhị Phân 4 Cấp (Feature 132)

Tài liệu này hướng dẫn cách chạy và xác thực tính năng **Chia đôi nhị phân tới độ sâu 4 cấp, cô lập nhánh lỗi và loại bỏ phân rã từng dòng**.

---

## 1. Môi trường & Lệnh Kiểm Thử Tự Động

Mọi kiểm thử tự động được thực hiện qua Vitest:

```bash
# Chạy bộ unit tests của directTranslationEngine
npm test src/services/__tests__/directTranslationEngine.test.ts

# Chạy kiểm thử toàn bộ services
npm test src/services/

# Kiểm tra tính toàn vẹn type
npm run lint
```

---

## 2. Kịch Bản Xác Thực Cốt Lõi (Validation Scenarios)

### Kịch Bản 1: Cô lập lỗi theo nhánh con độc lập (Isolated Sub-branch Recursion)
- **Mục tiêu**: Chứng minh rằng khi chương gồm 4 đoạn mà đoạn 3 lỗi, chỉ đoạn 3 tiếp tục đệ quy chia đôi sâu hơn, đoạn 1, 2, 4 không bị gọi lại.
- **Thực hiện**:
  1. Chuẩn bị đầu vào 4 đoạn văn: `P1`, `P2`, `P3`, `P4`.
  2. Mock Gemini API trả về kết quả tốt cho `P1`, `P2`, `P4` ngay lần gọi đầu.
  3. Với `P3`, trả về kết quả sót chữ Hán (> 30% Hán tự) để kích hoạt `UNTRANSLATED_CHINESE_LEFTOVER`.
  4. Mock tiếp: Khi `P3` chia thành `P3.1` và `P3.2`:
     - `P3.1` dịch thành công.
     - `P3.2` dịch thành công ở tầng tiếp theo.
  5. **Kỳ vọng**:
     - Số lần gọi API cho `P1`, `P2`, `P4` đúng bằng 1.
     - Kết quả cuối cùng ghép nối đúng trật tự: `P1_trans` + `P2_trans` + `P3.1_trans` + `P3.2_trans` + `P4_trans`.

### Kịch Bản 2: Chia đôi nhị phân sâu đến cấp 4 (Binary Split up to Max Depth 4)
- **Mục tiêu**: Xác nhận hệ thống có thể chia nhỏ qua các cấp `depth = 0 -> 1 -> 2 -> 3`, mỗi cấp đều chia làm 2 phần con (`partsCount = 2`).
- **Thực hiện**:
  1. Gửi văn bản gặp lỗi kiểm duyệt lặp lại liên tiếp ở các cấp độ sâu 0, 1, 2.
  2. Ở `depth = 3`, API trả về bản dịch thành công.
  3. **Kỳ vọng**:
     - Danh sách sự kiện `onSplitRetry` ghi nhận độ sâu tăng dần: 0 -> 1 -> 2.
     - Thuộc tính `partsCount` ở mọi sự kiện đều bằng 2.
     - Bản dịch cuối cùng hoàn thành trọn vẹn.

### Kịch Bản 3: Chạm trần độ sâu 4 kích hoạt cứu nguy trực tiếp (Không phân rã từng dòng)
- **Mục tiêu**: Chứng minh Tier 2 (Line-by-Line) đã bị loại bỏ hoàn toàn, khi chạm trần `depth >= 4` hệ thống chuyển thẳng sang cứu nguy Hán-Việt kết hợp từ điển.
- **Thực hiện**:
  1. Gửi văn bản luôn gây lỗi qua cả 4 cấp đệ quy nhị phân.
  2. **Kỳ vọng**:
     - Không có sự kiện nào mang `tier: 'line-by-line'`.
     - Xuất hiện sự kiện `tier: 'sino-fallback'` khi chạm trần độ sâu 4.
     - Chương truyện không bị ném exception làm sập, văn bản đầu ra chứa từ ngữ phiên âm Hán-Việt & từ điển bảo toàn nội dung.

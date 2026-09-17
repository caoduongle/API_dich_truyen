# Quickstart Validation Guide: Kích Hoạt Di Trú Hạn Mức Runtime, Nhất Quán Lưu Trữ Drive & Phân Đoạn Theo Ngân Sách Token (140-runtime-migration-drive-consistency)

**Feature**: `140-runtime-migration-drive-consistency`  
**Date**: 2026-09-15  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)

---

## 1. Điều Kiện Tiên Quyết
- Môi trường Node.js >= 20
- Đã cài đặt đầy đủ các gói phụ thuộc: `npm install`
- Không có lỗi type tồn đọng: `npm run lint`

---

## 2. Các Kịch Bản Kiểm Thử Độc Lập

### Kịch Bản 1: Xác Thực Kích Hoạt Di Trú Hạn Mức Runtime (P1)
**Mục tiêu**: Đảm bảo cấu hình `maxRpd` của người dùng tạo trên mã băm 32-bit cũ được tự động chuyển đổi sang SHA-256 ngay khi nạp khóa hoặc khởi tạo scheduler.

**Lệnh kiểm thử**:
```bash
npx vitest run src/utils/__tests__/customLimitsStorage.test.ts src/services/gemini/__tests__/geminiKeyScheduler.test.ts
```

**Kỳ vọng đạt được**:
- Nạp cấu hình vào `localStorage` dưới mã băm lặp 8 ký tự (`maxRpd = 100`).
- Khởi tạo `initKeySchedule([rawKey])` hoặc nạp `migrateAndLoadApiKeys()`:
  - Cấu hình tự động chuyển sang mã băm SHA-256 chuẩn (64 ký tự hex).
  - Trạng thái `customLimits` trong `KeyScheduleState` chứa bản ghi SHA-256 với `maxRpd = 100`.
  - Mã băm cũ bị loại bỏ sạch sẽ khỏi bộ nhớ `localStorage`.

---

### Kịch Bản 2: Xác Thực Hợp Nhất Ranh Giới Tuần Tự Hóa & Giao Dịch Nguyên Tử Drive (P2)
**Mục tiêu**: Đảm bảo mọi luồng ghi dự án (UI và Drive) đều đi qua cùng một hàng đợi tuần tự hóa FIFO theo `projectId`, và thao tác tải gói dự án Google Drive bảo đảm tính nguyên tử (không partial-commit).

**Lệnh kiểm thử**:
```bash
npx vitest run src/services/__tests__/projectStorageQueue.test.ts src/services/__tests__/db.test.ts src/services/__tests__/bundleSync.test.ts
```

**Kỳ vọng đạt được**:
- `enqueueProjectSave` ủy quyền xử lý trực tiếp cho hàng đợi nội tại của `saveProjectToDB`.
- Các thao tác ghi đồng thời từ UI và Drive trên cùng một dự án được thực thi tuần tự theo thứ tự đến trước - xử lý trước (FIFO).
- Khi gọi `atomicSaveProjectBundle`, toàn bộ chapters, CRDT states và metadata dự án được lưu trên cùng một giao dịch IndexedDB.
- Khi một lỗi I/O phát sinh trong giao dịch, toàn bộ thay đổi bị rollback, không có chương hay trạng thái CRDT nào bị lưu dở dang.

---

### Kịch Bản 3: Xác Thực Phân Đoạn Song Ngữ Theo Ngân Sách Token (P3)
**Mục tiêu**: Đảm bảo `splitBilingualAdaptively` gom các đoạn văn liên tiếp theo tổng lũy kế kích thước token thực tế bám sát `maxTokensPerChunk` thay vì chỉ chia đều số đoạn văn.

**Lệnh kiểm thử**:
```bash
npx vitest run src/services/translation/__tests__/bilingualSplit.test.ts
```

**Kỳ vọng đạt được**:
- Cung cấp danh sách các đoạn văn có độ dài chênh lệch (ví dụ 150, 200, 1800, 100, 150, 200 tokens) với `maxTokensPerChunk = 1000`.
- Thuật toán gom đoạn 1 + 2 thành Chunk 1 (< 1000 tokens), đoạn 3 (1800 tokens) đứng riêng thành Chunk 2 trọn vẹn, và các đoạn 4 + 5 + 6 thành Chunk 3.
- Không có đoạn văn nào bị cắt ngang giữa chừng.
- Giữ nguyên vẹn tính tương thích ngược với cú pháp positional cũ.

---

## 3. Cổng Kiểm Tra Chất Lượng Bắt Buộc (Quality Gates)

Trước khi nghiệm thu, bắt buộc chạy và pass 100% ba lệnh sau:
```bash
npm run lint    # tsc --noEmit — 0 lỗi kiểu
npm test        # vitest run  — 100% test suites pass
npm run build   # tsc && vite build — build production thành công
```

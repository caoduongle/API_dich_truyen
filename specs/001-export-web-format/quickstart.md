# Quickstart & Verification Guide: Web Chapter Export Formatting

## 1. Prerequisites
- Đã cài đặt dependencies (`npm install`).
- Dự án có ít nhất 1 câu chuyện và các chương đã có bản dịch mẫu.

## 2. Automated Tests
Chạy bộ kiểm thử đơn vị cho module format xuất bản:
```bash
npx vitest run src/utils/__tests__/exportFormatter.test.ts
```

## 3. End-to-End Verification
1. Mở giao diện ứng dụng tại `http://localhost:3000`.
2. Chuyển sang tab **Auto-Translate** hoặc **History**.
3. Chọn tính năng **Xuất tệp sạch (.txt)**.
4. Chọn định dạng **Web**, xuất file.
5. Mở tệp `.txt` đã tải xuống và xác minh cấu trúc:
   ```text
   *** Chương 1: Tên chương 1
   Nội dung chương 1...

   *** Chương 2: Tên chương 2
   Nội dung chương 2...
   ```

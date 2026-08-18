# Quickstart & Verification Guide: Preserve Paragraph Layout

## 1. Automated Unit Tests
Chạy bộ kiểm thử đơn vị cho bộ tách tiêu đề và làm sạch đoạn văn:
```bash
npx vitest run src/utils/__tests__/textCleaner.test.ts
```

## 2. Dịch Thử Nghiệm Thực Tế
1. Mở ứng dụng `http://localhost:3000`.
2. Vào **Mặt trận dịch thuật** hoặc **Dịch tự động**.
3. Chọn 1 chương tiếng Trung có nhiều đoạn văn và bắt đầu dịch.
4. Kiểm tra văn bản **Bản dịch thô** và **Dịch biên tập**:
   - Tiêu đề nằm ở dòng đầu tiên.
   - Các đoạn văn tách biệt nhau bằng dòng trống rõ ràng, không dính liền thành một khối.

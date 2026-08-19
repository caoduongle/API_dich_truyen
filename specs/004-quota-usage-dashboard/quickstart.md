# Quickstart & Verification Guide: Quota & Usage Tracking Dashboard

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-19

## 1. Automated Verification Commands

Chạy toàn bộ các bộ kiểm tra tự động bắt buộc của dự án:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Chạy toàn bộ test suites (bao gồm quotaService unit tests mới)
npx vitest run

# 3. Build bundle production
npm run build
```

---

## 2. Unit Test Scenarios (`server/services/__tests__/quotaService.test.ts`)

- **Test 1: Key Hashing & Masking**
  - Xác nhận hàm `maskApiKey` che đúng định dạng (6 ký tự đầu + `...` + 4 ký tự cuối).
  - Xác nhận SHA-256 hash nhất quán cho cùng một chuỗi khóa và phân biệt cho các khóa khác nhau.
- **Test 2: Ghi nhận Usage theo kết quả**
  - Ghi nhận `success`, `overloaded`, `quota_exceeded`, `safety`, `error`.
  - Xác nhận `requestsTotal`, `requestsToday`, `requestsThisMinute`, `errorsTotal` tăng chuẩn xác.
- **Test 3: Rolling 1-minute window bucket**
  - Dùng Vitest fake timers (`vi.useFakeTimers()`), đẩy thời gian qua 61 giây, xác nhận `requestsThisMinute` tự động trở về 0.
- **Test 4: Daily Reset theo múi giờ `America/Los_Angeles`**
  - Giả lập thời gian trước và sau 00:00 PST (15:00 UTC), xác nhận `requestsToday` tự động reset về 0 trong khi `requestsTotal` vẫn giữ nguyên.
- **Test 5: Phân tách số liệu theo Model**
  - Gửi request với các model khác nhau (`gemini-2.5-flash`, `gemini-2.5-pro`), kiểm tra thống kê `byModel` phân tách độc lập.

---

## 3. End-to-End Manual Verification Workflow

1. **Khởi chạy máy chủ phát triển**:
   ```bash
   npm run dev
   ```
2. Mở trình duyệt tại `http://localhost:5173`.
3. Nhấp vào nút **Cấu hình AI** trên thanh công cụ điều hướng.
4. Xác nhận xuất hiện 2 tab: **"Cấu hình"** và **"Quota & Hạn mức"**.
5. Chuyển sang tab **"Quota & Hạn mức"**:
   - Kiểm tra các thẻ thông tin khóa: mã băm/masking, số lượt request, RPM, RPD.
   - Nhấn **Làm mới** để lấy dữ liệu mới nhất.
   - Nhấn **Kiểm tra Model** để xem danh sách model hỗ trợ thực tế từ Google.
   - Thử nhập ngưỡng cá nhân (RPM/RPD) và quan sát thanh tiến độ trực quan.
6. Thực hiện một tác vụ dịch thử (ví dụ: Dịch thô 1 đoạn văn), quay lại tab Quota kiểm tra số lượt request đã tăng tương ứng.

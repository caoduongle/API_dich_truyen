# Quickstart & Verification Guide: Sửa Lỗi CI/CD

**Feature**: `089-fix-ci-failures`  
**Date**: 2026-09-05  

---

## 1. Yêu Cầu Tiên Quyết
- Node.js 20+ và npm đã được cài đặt.
- Thư viện phụ thuộc đã cài (`npm ci` hoặc `npm install`).

---

## 2. Kịch Bản Xác Minh Độc Lập

### Kịch Bản 1: Kiểm Thử Độc Lập Hàm `sanitizeFilename`
Mục tiêu: Đảm bảo xử lý đường dẫn kiểu Windows thành công ngay cả trên môi trường POSIX/Linux.

```bash
npx vitest run server/utils/__tests__/fileValidation.test.ts
```

**Kết Quả Mong Đợi:**
- Test suite pass 7/7 bài kiểm thử (100%).
- Trường hợp `..\\..\\windows\\system32\\cmd.exe` trả về chính xác `"cmd.exe"`.

---

### Kịch Bản 2: Kiểm Thử Toàn Trình Thứ Tự Build Trước Test
Mục tiêu: Đảm bảo thư mục `dist/client` được tạo ra trước khi test tích hợp `quickstartVerification.test.ts` truy vấn tài nguyên tĩnh.

```bash
# Bước 1: Biên dịch và đóng gói ứng dụng
npm run build

# Bước 2: Chạy toàn bộ bộ kiểm thử tự động
npx vitest run
```

**Kết Quả Mong Đợi:**
- Lệnh `npm run build` hoàn thành với mã thoát 0, tạo `dist/client` và `dist/server/server.cjs`.
- Lệnh `npx vitest run` hoàn thành với 122/122 test files passed, **803/803 tests passed** (0 fail, 0 skip).
- Toàn bộ 5 scenarios trong `quickstartVerification.test.ts` đều pass (robots.txt, sitemap.xml, llms.txt, API fallback 404, và 0 file .map).

---

### Kịch Bản 3: Kiểm Tra Tính Toàn Vẹn Kiểu Dữ Liệu
```bash
npm run lint
```

**Kết Quả Mong Đợi:**
- `tsc --noEmit` thoát với mã 0, không có lỗi type nào trong toàn bộ dự án.

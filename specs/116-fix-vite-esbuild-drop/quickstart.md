# Quickstart: Hướng Dẫn Xác Minh Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Drop

**Feature**: `116-fix-vite-esbuild-drop`  
**Date**: 2026-09-12  

---

## 1. Điều Kiện Tiên Quyết (Prerequisites)

- Môi trường Node.js phiên bản 20+ và npm.
- Các phụ thuộc đã được cài đặt (`npm ci` hoặc `npm install`).

---

## 2. Kịch Bản Xác Minh Độc Lập (Validation Scenarios)

### Kịch bản 1: Kiểm Tra Kiểu Tĩnh (Type Check Gate)
Mục tiêu: Đảm bảo TypeScript không còn báo lỗi `TS2769` trên `vite.config.ts`.

```bash
npm run lint
```

**Kỳ vọng**:
- Lệnh chạy `tsc --noEmit` thoát với mã `0`.
- Không xuất hiện bất kỳ dòng lỗi nào liên quan đến `vite.config.ts(6,29): error TS2769: No overload matches this call`.

---

### Kịch bản 2: Kiểm Tra Đóng Gói Ứng Dụng (Production Build Gate)
Mục tiêu: Đảm bảo Vite biên dịch thành công và sinh ra thư mục sản phẩm `dist/`.

```bash
npm run build
```

**Kỳ vọng**:
- Lệnh chạy `tsc && vite build` hoàn thành thành công với mã `0`.
- Thư mục `dist/` chứa các tệp JavaScript, CSS và tài nguyên tĩnh đã được tối ưu hóa.

---

### Kịch bản 3: Chạy Toàn Bộ Bộ Kiểm Thử Tự Động (Regression Test Gate)
Mục tiêu: Đảm bảo không có bất kỳ bài kiểm thử nào bị ảnh hưởng hay thất bại.

```bash
npm test
```

**Kỳ vọng**:
- Lệnh chạy `vitest run` báo cáo 100% các test suites và tests đều vượt qua (Pass).

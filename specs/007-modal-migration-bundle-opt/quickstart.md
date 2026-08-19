# Quickstart & Verification Guide: Modal Migration & Bundle Config

**Feature**: `007-modal-migration-bundle-opt`  
**Created**: 2026-08-19  

---

## 1. Automated Verification Commands

```bash
# 1. Kiểm tra Type Safety (TypeScript compilation)
npm run lint

# 2. Chạy toàn bộ Unit & Integration Test Suites
npm test

# 3. Biên dịch Production Build (Vite + esbuild)
npm run build
```

---

## 2. Manual Verification Checklist

### Scenario A: Kiểm Tra `ImportGuidelinesModal` Trong Glossary Manager
1. Khởi động app (`npm run dev`) và mở trình duyệt tại `http://localhost:5173`.
2. Chuyển sang tab **Thuật Ngữ** (`GlossaryManager`).
3. Nhấp vào nút **"Nhập cẩm nang (.md)"**.
4. **Xác nhận**:
   - Modal hiển thị chuẩn qua `Modal.tsx` với backdrop mờ phủ toàn màn hình.
   - Tiêu đề "Đồng bộ hóa thuật ngữ từ Cẩm Nang Markdown" và biểu tượng chuẩn.
   - Bấm phím **Escape** hoặc nhấp ra ngoài backdrop: modal đóng lại mượt mà.
   - Kéo thả / chọn file `.md`: AI đọc và phân tích từ vựng bình thường.

### Scenario B: Kiểm Tra `QuickAddTermModal` Trong Translator Workspace
1. Chuyển sang tab **Dịch Thuật** (`TranslatorWorkspace`).
2. Mở một chương truyện và dùng chuột bôi đen 1 cụm từ chữ Hán (ví dụ: `萧炎`).
3. Thanh thông báo nhỏ hiện lên bên dưới textarea. Nhấp vào **"Tra cứu & Thêm nhanh"**.
4. **Xác nhận**:
   - Hộp thoại nhập liệu mở ra trong `Modal.tsx` với backdrop overlay.
   - AI điền sẵn phiên âm Hán-Việt, bản dịch đề xuất và loại từ.
   - Bấm phím **Escape** hoặc nhấp ra ngoài: modal đóng lại.
   - Nhấp **"Lưu vào từ điển"**: từ vựng được thêm thành công và hiển thị toast thông báo.

### Scenario C: Kiểm Tra Dropdown Z-Index Trong `LanguageSelector`
1. Nhấp vào nút chọn ngôn ngữ (Tiếng Việt / English / 中文) trên thanh header.
2. **Xác nhận**:
   - Menu thả xuống hiển thị mượt mà với `z-40`.
   - Khi có modal mở (`z-50`), backdrop modal che phủ toàn bộ menu dropdown, không bị đè lớp sai lệch.

### Scenario D: Kiểm Tra Bundle Build & Documentation Trong `vite.config.ts`
1. Mở file `vite.config.ts`.
2. **Xác nhận** có comment giải thích rõ ràng về:
   - Thư viện `opencc-js` và chunk `vendor-opencc`.
   - Lý do giữ `chunkSizeWarningLimit: 1200`.
   - Tính chất đồng bộ của engine Hán-Việt.
3. Chạy `npm run build`: bundle xuất ra `vendor-opencc-*.js` độc lập không gây lỗi build.

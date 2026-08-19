# Quickstart & Verification Guide: Sửa Chọn Model & Thống Kê Request Theo Model

**Feature**: `008-fix-model-selection-stats`  
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

## 2. Browser Verification Flow (Manual Verification)

### Kịch bản A: Chọn Model & Kiểm Tra Model Không Ghi Đè State
1. Chạy `npm run dev` và mở trình duyệt tại `http://localhost:5173`.
2. Mở modal **"Cấu hình AI"** (nhấp vào icon bánh răng hoặc phím tắt `Alt+,`).
3. Chọn model `Gemini 3.1 Flash Lite` (`gemini-3.1-flash-lite`).
4. Quan sát khối tóm tắt model bên dưới dropdown: hiển thị tên `Gemini 3.1 Flash Lite (Nhanh / Rẻ)`, số lượng key hỗ trợ (hoặc "Chưa kiểm tra"), RPM, tổng request.
5. Chuyển sang tab **"Quota & Hạn mức"**.
6. **Xác nhận**:
   - Banner trên cùng hiển thị thông tin dành riêng cho `Gemini 3.1 Flash Lite`.
7. Nhấn nút **"Kiểm tra Model"** ở Khóa #1.
   - **Xác nhận**: Chỉ Khóa #1 hiện spinner "Đang kiểm tra...", Khóa #2 không bị khóa.
   - Sau khi kiểm tra xong: Khóa #1 hiển thị danh sách các model khả dụng.
8. Chuyển quay lại tab **"Cấu hình AI"**.
   - **Xác nhận**:
     - Dropdown vẫn chọn đúng `Gemini 3.1 Flash Lite`.
     - Dropdown hoạt động bình thường, không bị disabled.
     - Khối tóm tắt model cập nhật số key hỗ trợ vừa kiểm tra.
9. Đổi model sang `Gemini 2.5 Flash`, bấm **"Lưu & Đóng"**.
10. Mở lại modal "Cấu hình AI": xác nhận `Gemini 2.5 Flash` vẫn là model được chọn.

### Kịch bản B: Cảnh Báo Model Không Khả Dụng
1. Kiểm tra toàn bộ các key.
2. Nếu chọn một model mà không có key nào hỗ trợ, xuất hiện hộp cảnh báo tông màu hổ phách (`amber`) thông báo rõ ràng "Model đang chọn hiện không có API key khả dụng" và nút kiểm tra lại, model không bị tự ý đổi ngầm.

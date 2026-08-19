# Quickstart & Verification Guide: Dynamic Model Registry & Selection

**Feature**: `009-dynamic-model-registry`  
**Created**: 2026-08-19  

---

## 1. Automated Verification Commands

```bash
# 1. Type Safety Check
npm run lint

# 2. Test Suites (Backend Validation + Frontend Model Registry)
npm test

# 3. Production Build
npm run build
```

---

## 2. End-to-End Functional Verification Scenarios

### Scenario A: Discovery & Quick Selection from QuotaPanel
1. Mở app, mở modal "Cấu hình AI & Bản Thảo", sang tab "Quota & Hạn mức".
2. Bấm "Kiểm tra Model" ở một API key.
3. Trong danh sách kết quả, tìm một model mới (ví dụ `gemini-2.0-flash-lite-preview-02-05`).
4. Bấm nút **"Dùng model này"** (hoặc biểu tượng check) bên cạnh model đó.
5. Xác nhận huy hiệu "Đang dùng" xuất hiện ngay cạnh model đó, banner trên cùng cập nhật tên model mới.
6. Chuyển sang tab "Cấu hình AI", kiểm tra dropdown: model mới được chọn và nằm trong nhóm `Mô hình tìm thấy từ API Key`.

### Scenario B: Adding a Custom Model
1. Trong tab "Cấu hình AI", nhấp vào nút hoặc tùy chọn "+ Nhập model tùy chỉnh...".
2. Nhập `tunedModels/my-special-model` và bấm "Thêm & Sử dụng".
3. Xác nhận model xuất hiện trong nhóm `Mô hình tự nhập (Custom)` và được chọn làm model hiện tại.
4. Đóng modal, mở lại: xác nhận model tùy chỉnh vẫn tồn tại và được chọn.

### Scenario C: Backend Route Protection
1. Gửi request `POST /api/translate-raw` với `model: "gemini-2.0-flash-lite-preview"` -> Thành công (200).
2. Gửi request `POST /api/translate-raw` với `model: "../dangerous/path"` -> Bị từ chối ngay lập tức (400).

# Quickstart & Validation Guide: Client-Direct AI Tasks

**Feature**: Chuyển Đổi Thuần Client-Side Cho 4 Tác Vụ AI Còn Lại  
**Spec**: [spec.md](./spec.md)  
**Status**: Ready for Validation  

---

## 1. Prerequisites

1. Trình duyệt hỗ trợ hiện đại (Chrome/Edge/Firefox) có kết nối Internet tới `generativelanguage.googleapis.com`.
2. Ít nhất 1 khóa Google Gemini API hợp lệ được lưu trong Cài đặt API (`ApiSettings`).
3. Môi trường Node.js >= 18.x.

---

## 2. Automated Verification

Chạy lần lượt 3 lệnh chất lượng bắt buộc:

```bash
# 1. Kiểm tra Type Safety
npm run lint

# 2. Chạy toàn bộ Test Suite (yêu cầu 803/803 tests pass)
npm test

# 3. Build Production Bundle (Vite client + Esbuild server)
npm run build
```

---

## 3. End-to-End Validation Scenarios

### Kịch bản 1: Quét thuật ngữ sỉ trực tiếp (Direct Glossary Scan)
1. Mở ứng dụng (`npm run dev`) tại `http://localhost:5173`.
2. Mở một dự án có sẵn chương truyện.
3. Chuyển sang tab **Thuật ngữ (Glossary)** -> Bấm **"Quét AI"**.
4. Mở tab **Network** trên DevTools của trình duyệt (F12).
5. **Kỳ vọng**:
   - Thấy request gửi thẳng tới `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent?key=...`.
   - **Không có** bất kỳ request nào gửi tới `/api/analyze-glossary` trên máy chủ ứng dụng.
   - Bảng kết quả hiển thị danh sách các gợi ý thuật ngữ trích xuất được.

### Kịch bản 2: Phân tích cẩm nang dịch thuật (Direct Guidelines Analysis)
1. Trong màn hình **Thuật ngữ**, bấm nút **"Nhập cẩm nang (Markdown)"**.
2. Chọn một tệp markdown có chứa thông tin phong cách hoặc bảng thuật ngữ.
3. **Kỳ vọng**:
   - Network tab hiển thị request Gemini gọi trực tiếp từ client.
   - Các trường thể loại (*genre*), tông giọng (*tone*), mô tả và danh sách thuật ngữ được tự động điền chính xác.

### Kịch bản 3: Xuất dữ liệu gióng hàng song ngữ (Direct Chapter Alignment)
1. Trong màn hình danh sách chương hoặc quản lý xuất file, chọn chức năng **Xuất dữ liệu gióng hàng (JSONL)**.
2. Kiểm tra Network tab trong suốt tiến trình.
3. **Kỳ vọng**:
   - Tệp `.jsonl` được tải xuống máy tính với các cặp câu `{"source": "...", "target": "..."}`.
   - Quá trình gióng hàng không gửi request tới `/api/align-chapter`.

### Kịch bản 4: Kiểm duyệt chất lượng bản dịch AI trong Workspace (Direct QA Critique)
1. Mở một chương trong **Không gian dịch thuật (Translator Workspace)**.
2. Đảm bảo đã bật tùy chọn **"Kiểm duyệt AI"**.
3. Bấm **"Mài giũa"** bản dịch thô.
4. **Kỳ vọng**:
   - Bản dịch mài giũa hoàn thành và tiến trình QA Critique được kích hoạt ngay sau đó.
   - Không còn gặp lỗi HTTP 400 như trước đây.
   - Thông báo kết quả kiểm duyệt hiển thị màu xanh (đạt chuẩn) hoặc màu vàng (có lưu ý kèm chi tiết lỗi).

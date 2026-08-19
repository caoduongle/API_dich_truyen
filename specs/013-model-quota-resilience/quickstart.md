# Quickstart & Validation Guide: Model Quota & System Resilience

**Feature**: `013-model-quota-resilience`  
**Date**: 2026-08-19  

---

## 1. Prerequisites & Environment Setup

1. Đảm bảo các dependency cốt lõi đã được cài đặt:
   ```bash
   npm install
   ```
2. Đảm bảo môi trường kiểm thử sẵn sàng:
   - Node.js >= 20
   - Redis (tùy chọn; nếu không có, hệ thống tự động chạy chế độ in-memory fallback)

---

## 2. Automated Quality Gates

Chạy 3 lệnh bắt buộc theo quy định Constitution:

```bash
# 1. Type-checking nghiêm ngặt (0 errors)
npm run lint

# 2. Toàn bộ Unit, Contract, Integration và Regression tests (100% pass)
npm test

# 3. Build bundle production cho cả Frontend và Backend
npm run build
```

---

## 3. End-to-End Validation Scenarios

### Scenario 1: Khám phá Model Mới & Dịch Thuật Thành Công
1. Mở Cấu hình AI (`ApiSettings.tsx`), nhấn nút tra cứu danh mục model cho API key.
2. Xác nhận danh mục model được nạp nhanh chóng (<50ms qua cache SWR).
3. Chọn một model vừa phát hiện (ví dụ `gemini-2.5-flash`).
4. Gửi dịch một đoạn văn bản tiếng Trung; xác nhận bản dịch hoàn tất thành công và backend ghi nhận quota đúng với model đã chọn.

### Scenario 2: Kiểm Thử Model Bị Khai Tử (Shutdown Migration)
1. Giả lập cấu hình chứa model cũ đã shutdown (hoặc gọi API với model không hỗ trợ).
2. Xác nhận hệ thống tự động di chuyển sang `replacementId` an toàn mà không bị crash hay trắng màn hình.

### Scenario 3: Kiểm Thử Ngắt Kết Nối Redis (Graceful Degradation)
1. Tắt dịch vụ Redis cục bộ.
2. Gửi 65 request liên tiếp trong 1 phút từ cùng 1 IP.
3. Xác nhận từ request thứ 61, hệ thống trả về mã lỗi `429 Too Many Requests` qua bộ đếm in-memory fallback, server không bị sập.
4. Bật lại Redis; xác nhận hệ thống tự động tái lập kết nối và chuyển sang Redis distributed mode.

### Scenario 4: Kiểm Thử Tính Bất Biến (Idempotency)
1. Gửi request dịch kèm header `Idempotency-Key: test-chap-1`.
2. Gửi lại request tương tự ngay sau đó; xác nhận server trả về ngay kết quả từ bộ đệm mà không phát sinh thêm lượt gọi Google API nào.

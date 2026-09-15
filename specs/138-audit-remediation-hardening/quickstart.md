# Quickstart Validation Guide: Khắc Phục Kiểm Toán & Gia Cố Tính Nhất Quán (138-audit-remediation-hardening)

Tài liệu này hướng dẫn các bước kiểm thử và xác thực độc lập cho từng nhóm chức năng được gia cố trong đợt khắc phục kiểm toán.

---

## 1. Kiểm tra Lỗi Ghi Nhận Không Bị Nhân Đôi (Single Failure Recording)

### Mục tiêu:
Xác nhận khi gọi API gặp lỗi HTTP (ví dụ: 429 hoặc 403) hoặc lỗi mạng, hàm `recordFailure` chỉ được tính đúng 1 lần cho lượt thử.

### Lệnh kiểm thử tự động:
```bash
npm test -- src/services/gemini/__tests__/geminiClient.test.ts
```

### Tiêu chí nghiệm thu:
- Bộ đếm `errorsTotal` chỉ tăng 1 đơn vị.
- Chỉ số `consecutiveErrors` chỉ tăng 1 đơn vị.
- Không có biệt lệ nào từ khối `!response.ok` bị bắt lại ở `catch` và kích hoạt lần gọi `recordFailure` thứ hai.

---

## 2. Kiểm tra Bảo Toàn Trạng Thái Nghỉ Khi Reload (State Persistence)

### Mục tiêu:
Xác nhận khi reload trang, các khóa đang trong trạng thái `QuotaExhausted`, `RateLimited`, hoặc `Cooldown` giữ nguyên thời gian làm nguội và không bị reset về `Healthy`.

### Lệnh kiểm thử tự động:
```bash
npm test -- src/services/__tests__/localQuotaTracker.test.ts
```

### Kịch bản thủ công / kiểm thử:
1. Đưa khóa vào trạng thái `QuotaExhausted`.
2. Khởi tạo lại một thực thể `LocalQuotaTracker` mới (mô phỏng tải lại trang từ `sessionStorage`).
3. Xác nhận `getKeyHealth(key).state === 'QuotaExhausted'`.
4. Giả lập thời gian bước qua 00:00 PST ngày mới.
5. Xác nhận trạng thái tự động mở lại thành `Healthy` và bộ đếm ngày được reset về 0.

---

## 3. Kiểm tra Hàng Đợi Ghi Dự Án Tuần Tự (Write Queue Serialization)

### Mục tiêu:
Xác nhận nhiều thao tác ghi dữ liệu dự án phát sinh liên tiếp được thực hiện tuần tự qua hàng đợi, ngăn chặn hiện tượng snapshot cũ ghi đè lên snapshot mới.

### Lệnh kiểm thử tự động:
```bash
npm test -- src/hooks/__tests__/useProjects.test.ts src/services/__tests__/projectStorageQueue.test.ts
```

### Kịch bản kiểm thử:
1. Kích hoạt 5 thao tác thêm từ vào cẩm nang trong vòng 10ms.
2. Kiểm tra `IndexedDB`: Toàn bộ 5 từ được lưu trữ đầy đủ trong bản ghi cuối cùng của dự án.

---

## 4. Kiểm tra Mã Băm Khóa SHA-256 Chuẩn Hóa (SHA-256 Key Hash)

### Mục tiêu:
Xác nhận hàm `hashApiKey()` tạo ra mã băm SHA-256 64 ký tự thập lục phân trên cả môi trường Node.js và trình duyệt, loại bỏ nguy cơ va chạm của hàm băm 32-bit cũ.

### Lệnh kiểm thử tự động:
```bash
npm test -- src/services/__tests__/keyHash.test.ts
```

### Tiêu chí nghiệm thu:
- Mã băm luôn có độ dài 64 ký tự hex: `/^[0-9a-f]{64}$/`.
- Hai khóa API khác nhau sinh ra hai mã băm hoàn toàn khác biệt.
- Kết quả băm cho cùng một khóa đầu vào là đồng nhất 100% giữa Node.js Crypto và Web Crypto / JS SHA-256.

---

## 5. Kiểm tra Toàn Bộ Hệ Thống (Full Verification Suite)

Chạy bộ ba lệnh bắt buộc theo Hiến pháp dự án:

```bash
npm run lint    # tsc --noEmit (Kiểm tra kiểu dữ liệu sạch)
npm test        # vitest run (Toàn bộ kiểm thử đơn vị & tích hợp pass)
npm run build   # tsc && vite build (Đóng gói production thành công)
```

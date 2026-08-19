# Research & Architecture Decisions: Dynamic Quota-Driven Pacing & Rate Limiting

**Feature**: `012-dynamic-quota-pacing`  
**Created**: 2026-08-19  

---

## 1. Vấn Đề Kỹ Thuật: Hạn Mức Tĩnh 13 RPM / 4500ms

### 1.1. Hiện Trạng Trong Codebase
- `server/services/geminiService.ts`:
  `AI_SERVICE_CONFIG.MIN_REQUEST_INTERVAL_PER_KEY_MS = 4500` được áp cứng cho mọi request của từng key:
  `nextAllowedTimeByKey.set(key, now + MIN_REQUEST_INTERVAL_PER_KEY_MS);`
- `src/hooks/useAutoTranslationQueue.ts` & `src/hooks/useTranslationProcess.ts`:
  Sử dụng các khoảng trễ sleep cố định hoặc phụ thuộc vào 4500ms từ server.
- **Hệ quả**:
  - Người dùng có tài khoản Google AI Studio Pay-as-you-go (hạn mức 60 RPM, 300 RPM hoặc cao hơn) bị kìm hãm ở tốc độ $\frac{60}{4.5} \approx 13.3$ req/phút.
  - Người dùng có hạn mức thấp hơn 15 RPM (hoặc mô hình Pro 10 RPM) dễ gặp lỗi 429 nếu gọi dồn dập.

---

## 2. Các Quyết Định Kiến Trúc & Công Thức Pacing

### 2.1. Quyết định 1: Công Thức Tính Toán Khoảng Cách An Toàn
- **Client Interval Calculation**:
  $$\text{intervalMs} = \max\left(500, \left\lceil \frac{60000}{\text{customRpm} \times 0.88} \right\rceil\right)$$
  - Hệ số an toàn $0.88$ (safety buffer 12%) giúp phòng ngừa jitter mạng và biến thiên độ trễ HTTP.
  - Sàn an toàn tối thiểu $500\text{ms}$ ngăn ngừa nghẽn socket ở phía client.
  - **Bảng ví dụ**:
    * RPM = 15 (Free tier): $\lceil 60000 / (15 \times 0.88) \rceil = 4546\text{ms} \approx 4.5\text{s}$ (~13.2 req/min).
    * RPM = 60 (Tier 1): $\lceil 60000 / (60 \times 0.88) \rceil = 1137\text{ms} \approx 1.1\text{s}$ (~52.8 req/min).
    * RPM = 120: $\lceil 60000 / (120 \times 0.88) \rceil = 569\text{ms}$ (~105 req/min).
    * RPM = 300+: $500\text{ms}$ (~120 req/min).
    * Model Pro mặc định (khi không nhập RPM): fallback 6000ms (~10 RPM).

### 2.2. Quyết định 2: Backend Dynamic Key Throttling qua Header `x-custom-rpm`
- Client gửi header `x-custom-rpm: <number>` (ví dụ `60`).
- Server tính:
  $$\text{keyMinInterval} = \text{customRpm} > 0 ? \max(400, \lceil \frac{60000}{\text{customRpm} \times 0.9} \rceil) : 4500$$
- Cập nhật `nextAllowedTimeByKey.set(key, now + keyMinInterval)`.
- Sàn tối thiểu trên server là $400\text{ms}$ để bảo vệ server process.

### 2.3. Quyết định 3: Cơ Chế Bảo Vệ Quá Tải Token (TPM Throttling)
- Trong `useAutoTranslationQueue.ts`:
  - Trước khi gửi batch hoặc request tiếp theo, kiểm tra `isTpmNearLimit(currentTpm, maxTpm)`:
    $$\text{currentTpm} \ge \text{maxTpm} \times 0.85$$
  - Nếu chạm ngưỡng 85%: Tự động tạm dừng hàng đợi, hiển thị trạng thái "Đang giãn nhịp để nạp lại hạn mức Token...", chờ 5-10 giây để các request cũ trong cửa sổ trượt 60s hết hạn rồi tiếp tục.

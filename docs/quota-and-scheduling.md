# Gemini Quota Authority, Scheduling & Multi-Key Health Management (Client-Side)

## 1. Kiến trúc Quản lý Hạn mức Phía Client (Client-Side Quota Authority)

Trong kiến trúc Pure Client-Side SPA, module `localQuotaTracker.ts` đảm nhiệm vai trò trung tâm kiểm soát tải (**Admission & Key Health Monitor**) trực tiếp trên trình duyệt, không thông qua bất kỳ server trung gian nào:

```
┌────────────────────────────────────────────────────────┐
│                   Model Registry                       │
│  - Vòng đời: Active, Deprecated, Shutdown              │
│  - Năng lực: generateContent, structuredOutput, etc.   │
│  - Danh mục client-side SWR Discovery                  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│              Direct Gemini Client (Client-Side)        │
│  - Chuẩn bị payload, ước lượng token                   │
│  - Ghi nhận logical request & provider attempt         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│          Local Quota Tracker (localQuotaTracker.ts)    │
│  - Sliding Window RPM / TPM (60 giây trượt)           │
│  - PST Midnight Daily Reset (America/Los_Angeles)      │
│  - Circuit Breaker: Closed -> Open -> HalfOpen         │
│  - Key Health State Machine                            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Gemini API Direct Execution              │
│  - Gọi trực tiếp generativelanguage.googleapis.com     │
│  - Phân loại lỗi (429, 401/403, 503) và phản hồi quota │
└────────────────────────────────────────────────────────┘
```

---

## 2. Các Quy tắc Bắt buộc Cốt lõi (Core Invariants)

1. **Sliding Window 60 Giây**: Số lượt gọi (RPM) và lượng token (TPM) được tính toán trên mảng các lần gọi gần nhất trong khoảng thời gian `now - 60,000ms`. Các bản ghi cũ hơn 1 phút sẽ tự động được thu dọn.
2. **Đồng hồ Reset Hạn mức Ngày theo Múi giờ PST**: Hạn mức ngày của Google AI Studio reset vào đúng **00:00:00 PST** (`America/Los_Angeles`). Hàm `getDayInLosAngeles()` đảm bảo việc reset hạn ngạch ngày diễn ra chính xác mà không phụ thuộc vào múi giờ của máy khách.
3. **Phân biệt Logical Request và Provider Attempt**: 1 thao tác dịch của người dùng có thể kích hoạt nhiều lượt gọi provider nếu gặp lỗi 429 hoặc cần thử lại. `localQuotaTracker` ghi nhận cả hai chỉ số độc lập.
4. **Bảo vệ Tính Ẩn danh Khóa (Key Hashing & Masking)**: Mọi định danh khóa trong hệ thống thống kê quota đều dùng mã băm SHA-256 (`hashApiKey`) và hiển thị dạng rút gọn (`maskApiKey`, ví dụ `AIzaSy...opqr`), tuyệt đối không lưu lộ khóa đầy đủ trong log.

---

## 3. Máy Trạng Thái Sức Khỏe Khóa (Key Health State Machine)

Trạng thái của từng API Key được quản lý theo mô hình Circuit Breaker:

```mermaid
stateChart-v2
    [*] --> Healthy
    Healthy --> Cooldown: Gặp lỗi 429 / 503 (1 lần)
    Healthy --> RateLimited: Đạt ngưỡng RPM cấu hình
    Healthy --> Degraded: Lỗi mạng liên tiếp (≥ 2 lần)
    Degraded --> QuotaExhausted: Lỗi 429 quota cạn kiệt
    Degraded --> Cooldown: Lỗi 503 / quá tải
    Cooldown --> HalfOpen: Hết thời gian chờ (cooldown ms)
    HalfOpen --> Healthy: Thử nghiệm thành công (≥ 2 lần liên tiếp)
    HalfOpen --> Cooldown: Thử nghiệm thất bại
    Healthy --> AuthFailed: Lỗi 401 / 403 (khóa không hợp lệ)
    Degraded --> AuthFailed: Lỗi 401 / 403
```

### Chi tiết các trạng thái:
- **`Healthy`**: Khóa hoạt động tốt, sẵn sàng nhận request mới.
- **`Degraded`**: Khóa gặp lỗi liên tiếp (chưa cạn hẳn quota), ưu tiên các khóa khác lành mạnh hơn.
- **`Cooldown`**: Khóa tạm thời bị ngắt mạch (Circuit Breaker OPEN) trong khoảng thời gian 3s – 60s để tránh làm trầm trọng thêm lỗi rate limit.
- **`QuotaExhausted`**: Khóa đã nhận phản hồi 429 Resource Exhausted, bị đình chỉ cho đến chu kỳ ngày tiếp theo (PST Midnight).
- **`AuthFailed`**: Khóa sai cú pháp, bị thu hồi hoặc không có quyền truy cập, hệ thống loại bỏ khỏi danh sách xoay vòng.
- **`HalfOpen`**: Trạng thái thử nghiệm sau khi hết thời gian Cooldown. Nếu 2 lần gọi liên tiếp thành công, khóa trở lại trạng thái `Healthy`.

---

## 4. Tích Hợp Giao Diện Trực Quan (Observability Dashboard)

Người dùng có thể theo dõi trực tiếp sức khỏe và hạn mức của từng API Key thông qua **Bảng Điều Khiển Quota (Quota Panel)**:
- Thẻ trạng thái sức khỏe theo màu (Xanh lá: Healthy, Vàng: Degraded/Cooldown, Đỏ: QuotaExhausted/AuthFailed).
- Tốc độ sử dụng thời gian thực (RPM, TPM) và tổng số request trong ngày (RPD).
- Bộ đếm thời gian Cooldown đếm ngược trực tiếp.
- Cơ chế kiểm tra sức khỏe độc lập (Test Key Health) ngay tại màn hình Cài đặt API.

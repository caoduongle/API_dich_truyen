# Model Subsystem: Registry, SWR Discovery & Lifecycle Management

## 1. Tổng quan Phân hệ Mô hình

Phân hệ quản lý mô hình (**Model Subsystem**) chịu trách nhiệm quản lý danh mục mô hình AI (Google Gemini & Custom Models), tự động cập nhật mô hình mới nhất từ Google thông qua cơ chế Stale-While-Revalidate (SWR), và di chuyển an toàn các mô hình đã ngừng hoạt động (Deprecated/Shutdown Models).

---

## 2. Danh mục Mô hình Định sẵn (Preset Models)

Hệ thống cung cấp danh mục mô hình tối ưu hóa cho dịch truyện Trung - Việt:

| Model ID | Nhãn hiển thị | Mô tả | Hạn mức mặc định (RPM / TPM / RPD) |
|:---|:---|:---|:---|
| `gemini-2.5-flash` | **Gemini 2.5 Flash** | Mô hình tiêu chuẩn, tốc độ cao, độ chính xác cao và tiết kiệm chi phí (Mặc định). | 15 RPM / 1M TPM / 1500 RPD |
| `gemini-2.5-pro` | **Gemini 2.5 Pro** | Mô hình cao cấp cho các chương có văn phong cổ trang khó hoặc ẩn dụ phức tạp. | 5 RPM / 500K TPM / 100 RPD |
| `gemini-3.1-flash-lite` | **Gemini 3.1 Flash Lite** | Tối ưu hóa độ trễ cực thấp cho các tác vụ dịch nhanh và tra từ điển. | 15 RPM / 1M TPM / 1500 RPD |
| `gemma-4-31b-it` | **Gemma 4 31B IT** | Mô hình mã nguồn mở thế hệ mới hỗ trợ dịch thuật ngữ cảnh dài. | 15 RPM / 1M TPM / 1500 RPD |

---

## 3. Cơ chế Khám phá Mô hình SWR (Stale-While-Revalidate)

Để tối ưu hóa trải nghiệm người dùng và giảm thiểu các lệnh gọi API thừa đến Google, danh mục mô hình áp dụng mô hình **SWR Lifecycle**:

```mermaid
sequenceDiagram
    participant User as Người dùng (UI)
    participant Cache as SWR Cache (LocalStorage)
    participant Registry as ModelRegistry Client
    participant DirectClient as Client-Direct (directGeminiClient.ts)
    participant Google as Google Gemini API (generativelanguage.googleapis.com)

    User->>Registry: Mở ứng dụng / Chọn Model
    Registry->>Cache: Đọc cache cục bộ
    Cache-->>Registry: Trả về danh sách model ngay lập tức (< 5ms)
    Registry-->>User: Render dropdown tức thì (Instant UI)

    alt Cache quá hạn TTL (1 giờ)
        Registry->>DirectClient: Kích hoạt revalidate ngầm (listModelsDirect)
        DirectClient->>Google: GET /v1beta/models?key=... (Client Fetch)
        Google-->>DirectClient: Danh sách model mới nhất
        DirectClient-->>Registry: Trả về danh sách đã lọc & chuẩn hóa
        Registry->>Cache: Cập nhật cache mới kèm timestamp
        Registry-->>User: Cập nhật danh sách mới (nếu có thay đổi)
    else Google API gặp lỗi (429 / Mất mạng)
        DirectClient-->>Registry: Báo lỗi revalidation
        Registry->>Cache: Giữ nguyên Stale Cache (Zero-Wipe Fallback)
        Registry-->>User: Tiếp tục sử dụng model hiện có bình thường
    end
```

### Các Đặc tính Kỹ thuật của SWR:
- **Thời gian sống (TTL)**: 1 giờ (`DISCOVERED_MODELS_TTL_MS = 3600000`).
- **Khử trùng lặp In-Flight (Deduplication)**: Nếu có nhiều component cùng yêu cầu khám phá mô hình cùng lúc, chỉ có duy nhất 1 Promise được thực thi.
- **Bảo toàn Stale Cache khi lỗi (Zero-Wipe)**: Khi Google API trả về lỗi 429 hoặc mất mạng, hệ thống **tuyệt đối không xóa** danh mục mô hình đã lưu mà tiếp tục dùng cache cũ.
- **Client-Direct**: Hoạt động hoàn toàn trên trình duyệt người dùng, gọi trực tiếp endpoint `https://generativelanguage.googleapis.com/v1beta/models` mà không thông qua bất kỳ máy chủ backend nào.

---

## 4. Quản lý Vòng đời & Tự động Chuyển đổi (Shutdown Migration)

Khi một mô hình Google bị đóng cửa hoặc ngừng hỗ trợ, hệ thống tự động nhận diện và chuyển đổi sang mô hình kế thừa tương thích:

```typescript
export const SHUTDOWN_MODEL_MIGRATIONS: Record<string, { replacementId: string; reason: string }> = {
  'gemini-1.5-flash': {
    replacementId: 'gemini-2.5-flash',
    reason: 'Mô hình "Gemini 1.5 Flash" đã chính thức ngừng hoạt động (Shutdown). Tự động chuyển sang mô hình "gemini-2.5-flash".',
  },
  'gemini-1.5-pro': {
    replacementId: 'gemini-2.5-pro',
    reason: 'Mô hình "Gemini 1.5 Pro" đã chính thức ngừng hoạt động (Shutdown). Tự động chuyển sang mô hình "gemini-2.5-pro".',
  },
};
```

---

## 5. Thêm & Xác minh Mô hình Tùy chỉnh (Custom Models)

Người dùng có thể nhập các mô hình Fine-tuned (`tunedModels/...`) hoặc mô hình Preview riêng:
1. Nhập Model ID trên giao diện Cấu hình AI.
2. Hệ thống gọi phương thức `verifyModelDirect()` trong `src/services/modelVerificationService.ts` để xác minh API Key có quyền truy cập và mô hình có hỗ trợ phương thức `generateContent` trực tiếp từ trình duyệt.
3. Khi xác minh thành công, mô hình được lưu vào danh sách tùy chỉnh trong `localStorage` và sẵn sàng để dịch.

---

## 6. Quản lý Hạn mức & Chỉ số Vòng đời Yêu cầu (Request Lifecycle Metrics)

Để bảo đảm tính minh bạch và độ tin cậy khi dịch các bộ truyện dài với nhiều khóa API xoay tua, hệ thống phân tách nghiêm ngặt giữa hai cấp độ: **Logical Request** (yêu cầu nghiệp vụ người dùng) và **Provider Attempt** (lần gọi API thực tế tới Google Gemini qua giao thức HTTP).

```mermaid
flowchart TD
    A[Bắt đầu Yêu cầu Dịch / Chuốt / QA] -->|recordLogicalStart| B(Logical Request Active)
    B --> C{Chọn API Key khả dụng}
    C -->|Thử Key n| D[Gửi HTTP Request đến Gemini]
    D -->|recordProviderAttempt| E{Kết quả phản hồi}
    E -->|200 OK| F[recordSuccess]
    F -->|Hoàn tất nghiệp vụ| G[recordLogicalSuccess]
    E -->|429 Quota / RateLimit| H[recordFailure]
    H --> I{Có thể Retry / Key khác?}
    I -->|Có| J[recordRetry & Xoay Key mới] --> C
    I -->|Hết Key / Terminal Error| K[recordLogicalFailure]
    E -->|400 / 401 Auth Failed| L[recordFailure Key bị đánh dấu AuthFailed]
    L --> M{Có Key dự phòng?}
    M -->|Có| N[recordRetry & Xoay Key tiếp theo] --> C
    M -->|Không còn Key nào| K
```

### Chi tiết các chỉ số vòng đời:

1. **Cấp Logical Request (Nghiệp vụ dịch thuật)**:
   - `logicalRequestsTotal` / `logicalRequestsToday`: Đếm số yêu cầu nghiệp vụ được bắt đầu.
   - `successfulRequestsTotal` / `successfulRequestsToday`: Đếm số yêu cầu hoàn thành thành công và trả kết quả cho người dùng.
   - `failedRequestsTotal` / `failedRequestsToday`: Đếm số yêu cầu thất bại hoàn toàn (không còn khóa nào khả dụng hoặc gặp lỗi không thể phục hồi).

2. **Cấp Provider Attempt (Giao tiếp mạng HTTP)**:
   - `providerAttemptsTotal` / `providerAttemptsToday`: Đếm từng lần phát request HTTP qua mạng tới Google endpoint.
   - `successfulAttemptsTotal` / `successfulAttemptsToday`: Số lần gọi HTTP trả về mã 200 thành công.
   - `failedAttemptsTotal` / `failedAttemptsToday`: Số lần gọi HTTP thất bại (429, 503, 401, timeout,...).

3. **Chỉ số Xoay tua & Thử lại (Retries & Rotation)**:
   - `retriesTotal` / `retriesToday`: Đếm chính xác số lần hệ thống quyết định thử lại hoặc xoay sang khóa API dự phòng. Tách biệt hoàn toàn khỏi `recordFailure()`, bảo đảm các lỗi xác thực chết (400, 401) hoặc lỗi không retry không làm tăng sai lệch chỉ số này.

4. **Bảo mật Định danh Khóa & Chuẩn hóa Băm**:
   - Sử dụng thuật toán SHA-256 (64 hex characters) để che giấu và theo dõi thống kê khóa API trực tiếp tại client.
   - Tự động nhận diện và di trú cấu hình hạn mức tùy chỉnh (`customLimits`) và thống kê phiên (`sessionStorage`) từ mã băm 32-bit cũ sang SHA-256 mới mà không làm mất dữ liệu của người dùng.

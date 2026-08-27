# Research: Fix CSP Gemini Model Discovery & Pacing Interval Delay

## 1. Technical Context & Problem Analysis

### Vấn đề 1: Content Security Policy chặn kết nối tới `generativelanguage.googleapis.com`
- **Hiện trạng**: 
  - File `server.ts` cấu hình Helmet CSP trong môi trường production với `connectSrc`:
    ```ts
    connectSrc: [
      "'self'",
      "ws:",
      "wss:",
      "https://www.googleapis.com",
      "https://accounts.google.com",
      "https://content.googleapis.com",
      "https://oauth2.googleapis.com",
      "https://apis.google.com",
    ]
    ```
  - Client gọi trực tiếp REST API của Google Gemini tại `https://generativelanguage.googleapis.com/v1beta/models` và `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` bằng header `x-goog-api-key`.
  - Do `https://generativelanguage.googleapis.com` chưa có trong allowlist của `connect-src`, trình duyệt tự động chặn kết nối trước khi request được gửi đi và ném lỗi `TypeError: Failed to fetch`.
- **Quyết định (Decision)**:
  - Bổ sung `https://generativelanguage.googleapis.com` và wildcard `https://*.googleapis.com` vào `connectSrc` trong `server.ts`.
  - Cập nhật test suite `server/__tests__/securityHeaders.test.ts` để kiểm tra `connectSrc` chứa `https://generativelanguage.googleapis.com`.
- **Lý do (Rationale)**:
  - Cho phép client-direct Gemini model discovery và client-direct translation hoạt động trơn tru trong môi trường production mà không bị CSP chặn.
- **Giải pháp thay thế đã xem xét (Alternatives Considered)**:
  - Proxy toàn bộ request qua backend: Bị từ chối vì vi phạm kiến trúc Zero-Knowledge Privacy (không gửi văn bản dịch qua server) và tăng tải máy chủ không cần thiết.

---

### Vấn đề 2: Hiển thị nhịp độ điều phối số âm (`-4445ms/call`)
- **Hiện trạng**:
  - Tại `src/components/quota-panel/GroupQuotaCard.tsx`, giao diện hiển thị:
    ```tsx
    <span>Điều phối: <strong className="text-text-main">~{group.schedulingHint?.effectiveIntervalMs || 4445}ms</strong>/call</span>
    ```
  - Khi `pacingDelay` hoặc thời gian chờ an toàn được tính toán từ `targetNextCallTime - Date.now()`, nếu thời điểm an toàn đã trôi qua trong quá khứ, kết quả sẽ là số âm.
- **Quyết định (Decision)**:
  - Chuẩn hóa giá trị `safeDelay = Math.max(0, rawDelay)`.
  - Nếu `safeDelay <= 0`, hiển thị trạng thái `"Sẵn sàng"`.
  - Nếu `safeDelay > 0`, hiển thị dạng `"~${safeDelay}ms/call"`.
- **Lý do (Rationale)**:
  - Đảm bảo tính trực quan, loại bỏ hoàn toàn các con số âm gây bối rối cho người dùng.
- **Giải pháp thay thế đã xem xét (Alternatives Considered)**:
  - Hiển thị `"0ms/call"`: Kém thân thiện hơn nhãn `"Sẵn sàng"`. Quyết định ưu tiên `"Sẵn sàng"` khi delay $\le 0$ hoặc kết hợp hiển thị khoảng cách an toàn định mức nếu đang xem cấu hình chu kỳ.

---

### Vấn đề 3: Phân loại và tối ưu hóa thông báo lỗi kết nối khi Kiểm tra Model (Client-Side)
- **Hiện trạng**:
  - Khi trình duyệt bị lỗi kết nối hoặc bị CSP chặn, `fetch()` ném `TypeError: Failed to fetch`.
  - Hàm `listModelsDirect` và `verifyModelDirect` trong `src/services/directGeminiClient.ts` hoặc hook `useModelDiscovery.ts` chưa phân loại lỗi này mà chỉ hiển thị lỗi thô.
- **Quyết định (Decision)**:
  - Bọc try/catch trong `listModelsDirect`, `verifyModelDirect`, `callGeminiDirect`, `useModelDiscovery.ts`.
  - Khi bắt được lỗi `Failed to fetch` hoặc `NetworkError` hoặc `SecurityError`, chuyển đổi thành thông điệp rõ ràng: `"Không thể kết nối đến Gemini API (Vui lòng kiểm tra mạng hoặc chính sách CSP)"`.
- **Lý do (Rationale)**:
  - Giúp người dùng ngay lập tức hiểu vấn đề thuộc về mạng/bảo mật thay vì nhầm lẫn là do sai API key.

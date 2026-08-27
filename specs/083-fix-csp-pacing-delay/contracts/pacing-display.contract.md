# Contract: Pacing Display & Error Handling UI Contract

## 1. Pacing Display Contract

### Component: `GroupQuotaCard`

#### Input Properties:
- `group.pacingDelayMs?: number` (Độ trễ chờ hiện tại tính theo ms)
- `group.schedulingHint?.effectiveIntervalMs?: number` (Khoảng cách an toàn giữa 2 request tính theo ms)

#### Output Rules:

| Trường hợp | Giá trị đầu vào | Nhãn hiển thị (`pacingLabel`) |
|---|---|---|
| Đã sẵn sàng / Trễ âm | `pacingDelayMs <= 0` hoặc `< 0` | `"Sẵn sàng"` |
| Có khoảng cách chu kỳ | `effectiveIntervalMs = 4445` (khi không có delay tức thời) | `"~4445ms/call"` |
| Độ trễ dương hợp lệ | `pacingDelayMs = 2223` | `"~2223ms/call"` |

---

## 2. Model Discovery & Verification Error Message Contract

### Modules: `directGeminiClient.ts`, `useModelDiscovery.ts`, `KeyCardItem.tsx`

#### Error Transformation Rules:

| Loại lỗi bắt được | Lỗi thô / Exception | Thông điệp hiển thị cho người dùng |
|---|---|---|
| CSP Violation / Mạng bị ngắt | `TypeError: Failed to fetch`, `SecurityError`, `NetworkError` | `"Không thể kết nối đến Gemini API (Vui lòng kiểm tra mạng hoặc chính sách CSP)"` |
| Hết hạn mức / 429 | `HTTP 429 RESOURCE_EXHAUSTED` | `"Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Chi tiết: ..."` |
| Chưa có Key | Rỗng / `NO_KEY` | `"Vui lòng cấu hình API Key cá nhân trong phần Cấu hình AI."` |

# Research: Quota & Usage Tracking Dashboard

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-19 | **Status**: Complete

## Overview & Technical Choices

### 1. In-Memory Quota & Usage Tracking Architecture

- **Decision**: Lưu trữ bộ đếm quota (`requestsTotal`, `requestsToday`, `requestsThisMinute`, `errorsTotal`) trong bộ nhớ (`Map<string, KeyQuotaStats>`) ở backend `server/services/quotaService.ts`.
- **Rationale**: 
  - Ứng dụng chạy theo mô hình cá nhân/nhóm nhỏ với backend Express. Quản lý in-memory đảm bảo độ trễ gần như bằng 0 (< 0.1ms) khi ghi nhận sau mỗi lượt gọi API, không gây bottleneck I/O.
  - Phù hợp với kiến trúc sẵn có của `geminiService.ts` (vốn đang dùng in-memory `Map` cho `blacklistedKeys` và `nextAllowedTimeByKey`).
- **Alternatives Considered**:
  - *Redis Hash*: Có hỗ trợ khi bật Redis, nhưng in-memory là phương thức độc lập, chạy được ở mọi chế độ (kể cả khi không có Redis URL).
  - *Client-side local counters*: Không đáng tin cậy vì các request dịch theo batch hoặc song song diễn ra trên server; client chỉ cần poll snapshot khi mở dashboard.

---

### 2. Timezone Normalization cho Daily Reset (RPD)

- **Decision**: Sử dụng múi giờ `America/Los_Angeles` (PST/PDT) của Google AI Studio để xác định ranh giới ngày mới (`lastResetDay: YYYY-MM-DD`).
- **Rationale**:
  - Google Gemini API tính hạn ngạch RPD (Requests Per Day) theo múi giờ Pacific Time (`America/Los_Angeles`).
  - Sử dụng `Intl.DateTimeFormat` tích hợp sẵn trong Node.js (`timeZone: 'America/Los_Angeles'`) để tính chuỗi ngày mà không cần thêm thư viện bên ngoài như `moment-timezone` hay `date-fns-tz` (tuân thủ nguyên tắc Constitution II: Dependency Minimization).
- **Formula**:
  ```ts
  function getDayInLosAngeles(date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date); // Trả về dạng YYYY-MM-DD
  }
  ```

---

### 3. API Key Security (SHA-256 Hashing & Masking)

- **Decision**:
  - Backend lưu trữ Map theo khóa `keyHash = crypto.createHash('sha256').update(key).digest('hex')`.
  - Hàm `maskApiKey(key: string)`: Nếu độ dài key >= 10, hiển thị 6 ký tự đầu + `...` + 4 ký tự cuối (ví dụ `AIzaSy...4xQ`). Nếu ngắn hơn, hiển thị `***`.
- **Rationale**:
  - Tuyệt đối ngăn chặn rò rỉ raw API key qua snapshot endpoint `/api/quota-status` hoặc log console.
  - Trình duyệt và người dùng chỉ nhìn thấy `maskedKey` và `keyHash` (để định danh UI).
  - Khi client gửi sessionToken, `resolveApiKeysMiddleware` giải mã keys nội bộ rồi truyền vào `quotaController` mà không trả raw key về client.

---

### 4. Upstream Model Discovery & Caching (`modelInfoService.ts`)

- **Decision**:
  - Tích hợp `@google/genai` hoặc trực tiếp Google API `models.list` với API key tương ứng.
  - Lọc các mô hình có `supportedGenerationMethods` chứa `generateContent`.
  - Bộ nhớ đệm TTL 10 phút (`Map<string, { timestamp: number; models: ModelInfo[] }>`) để tránh spam upstream API.
  - Sử dụng `AbortController` với timeout 15 giây (15,000ms) để hủy request nếu mạng upstream bị treo.
- **Rationale**:
  - Tránh lãng phí quota chỉ để kiểm tra model.
  - 15 giây là khoảng thời gian hợp lý đảm bảo không làm nghẽn tiến trình Express server.

---

### 5. Seamless UI Integration & Design System Compliance

- **Decision**:
  - Thêm tab switcher dạng pill/button trong `src/components/ApiSettings.tsx`: `"Cấu hình"` (Tab 1) và `"Quota & Hạn mức"` (Tab 2).
  - Component `src/components/QuotaPanel.tsx` sử dụng toàn bộ token Mực & Chu Sa: `bg-ink`, `bg-parchment-2`, `text-polish`, `font-mono` cho số liệu, `Seal` cho mô-típ nhận diện, `Badge` bo góc `[2px]`.
  - Lưu ngưỡng hạn mức người dùng tự đặt vào `localStorage` (`quota_user_custom_limits`) để hiển thị thanh đo % tiến độ (Progress bar) trực quan.
- **Rationale**:
  - Giữ nguyên luồng người dùng quen thuộc trong modal cài đặt AI mà không tạo thêm modal popup rời rạc.
  - Không phá vỡ quy chuẩn thiết kế Mực & Chu Sa.

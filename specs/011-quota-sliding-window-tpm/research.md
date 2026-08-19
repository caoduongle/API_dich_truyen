# Research & Architecture Decisions: Sliding Window Token & Request Quota Observability

**Feature**: `011-quota-sliding-window-tpm`  
**Created**: 2026-08-19  

---

## 1. Phân Tích Kỹ Thuật: Fixed Window vs. Sliding Window Log

### 1.1. Hạn chế của Cơ chế Cũ (Fixed Window theo Phút)
- Trong `server/services/quotaService.ts`, `requestsThisMinuteCount` được đếm theo `minuteKey = Math.floor(now / 60000)`.
- Khi chuyển sang phút mới (ví dụ 10:00:59 sang 10:01:00), biến đếm reset ngay về 0. Nếu client gửi 15 request ở 10:00:55 và 15 request ở 10:01:05, trong khoảng 10 giây có 30 request nhưng fixed window coi mỗi phút chỉ có 15 request -> Không phát hiện được nguy cơ chạm trần RPM/TPM tức thời.
- Chưa có trường đo lường token (`tokensThisMinute`, `tokensToday`, `tokensTotal`).

### 1.2. Giải Pháp: Sliding Window Log 60 Giây (60-second Sliding Window)
- Mỗi key và mỗi model lưu mảng `recentCalls: Array<{ timestamp: number; tokens: number }>`.
- Khi có cuộc gọi mới (`recordAttempt`):
  1. Thêm `{ timestamp: now, tokens: tokenStats?.totalTokens || 0 }` vào `recentCalls`.
  2. Lọc bỏ các phần tử có `timestamp < now - 60_000`.
  3. `requestsThisMinute = recentCalls.length`.
  4. `tokensThisMinute = recentCalls.reduce((sum, c) => sum + c.tokens, 0)`.
- **Hiệu năng & Bộ nhớ**: Kích thước của mảng `recentCalls` tối đa chỉ bằng số request trong 60 giây (vài chục đến vài trăm phần tử nhỏ), tốn chưa tới vài KB bộ nhớ và thao tác filter mất < 0.01ms.

---

## 2. Trích Xuất Token Metadata Từ Google GenAI SDK

### 2.1. Cấu Trúc Response Từ Google Gemini API
- SDK `@google/genai` (hoặc `@google/generative-ai`) trả về đối tượng `response.usageMetadata`:
  ```typescript
  interface UsageMetadata {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  }
  ```
- Trong `server/services/geminiService.ts`:
  ```typescript
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
  const totalTokens = response.usageMetadata?.totalTokenCount || (promptTokens + outputTokens);

  quotaService.recordAttempt(key, true, model, undefined, { promptTokens, outputTokens, totalTokens });
  ```

---

## 3. Quản Lý Token Theo Ngày Chuẩn PST (America/Los_Angeles)

- Múi giờ chuẩn: `America/Los_Angeles`.
- Khi ghi nhận request:
  - So sánh `currentDayKey = getDayKeyPST(now)` với `record.tokensTodayDateKey`.
  - Nếu khác ngày (PST date rollover), reset `tokensTodayCount = 0` và gán `tokensTodayDateKey = currentDayKey`.
  - Cộng dồn `tokensTodayCount += totalTokens` và `tokensTotal += totalTokens`.
- Đồng bộ hoàn hảo giữa `requestsToday` và `tokensToday`.

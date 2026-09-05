# Contract: Client Quota Tracker API

**Module**: `src/services/localQuotaTracker.ts`

---

## 1. Public Functions

### 1.1 Record Lifecycle Events
```typescript
/** Ghi nhận bắt đầu một yêu cầu dịch logic từ phía người dùng */
export function recordLogicalStart(isNewRequest: boolean = true): void;

/** Ghi nhận một lần thử gọi tới provider (Gemini API) */
export function recordProviderAttempt(): void;

/** Ghi nhận cuộc gọi thành công và cập nhật số token tiêu thụ */
export function recordSuccess(apiKey: string, model: string, tokensUsed: number, latencyMs: number): void;

/** Ghi nhận lỗi gọi API, cập nhật Circuit Breaker và kích hoạt Cooldown */
export function recordFailure(
  apiKey: string,
  model: string,
  statusCode: number,
  is429: boolean,
  isAuthError: boolean,
  is503: boolean
): void;
```

### 1.2 Inspection & Observation
```typescript
/** Lấy snapshot hạn mức đầy đủ để hiển thị trên UI QuotaPanel */
export function getSnapshot(): QuotaStatusResponse;

/** Kiểm tra xem một key cụ thể có đang khả dụng hay bị Cooldown/QuotaExhausted */
export function isKeyAvailable(apiKey: string): boolean;

/** Lấy thời gian chờ còn lại (ms) của key */
export function getKeyCooldownMs(apiKey: string): number;
```

### 1.3 Configuration & Utilities
```typescript
/** Cấu hình giới hạn RPM toàn cục do người dùng thiết lập */
export function setGlobalCustomRpm(rpm: number | null): void;

/** Lấy chuỗi ngày YYYY-MM-DD theo múi giờ PST (America/Los_Angeles) */
export function getDayInLosAngeles(timestamp?: number): string;

/** Tạo mã băm SHA-256 định danh cho API key */
export function hashApiKey(key: string): string;

/** Tạo chuỗi che mờ hiển thị an toàn (VD: AIzaSy...opqr) */
export function maskApiKey(key: string): string;

/** Reset toàn bộ trạng thái trong bộ nhớ (phục vụ unit test) */
export function resetState(): void;
```

# Data Model: Dynamic Quota Pacing & Rate Limiting

**Feature**: `012-dynamic-quota-pacing`  
**Created**: 2026-08-19  

---

## 1. Pacing Calculation Structures

```typescript
export interface PacingConfig {
  /** Khoảng cách an toàn giữa 2 request liên tiếp tính bằng mili-giây */
  intervalMs: number;
  /** Tốc độ ước tính theo phút (Requests Per Minute) */
  estimatedRpm: number;
  /** Chuỗi mô tả thời gian giãn cách (ví dụ: "1.1s" hoặc "4.5s") */
  intervalSec: string;
  /** Có đang bật chế độ tối ưu hóa theo hạn mức cá nhân hay không */
  isCustom: boolean;
}

export interface TpmProtectionStatus {
  isNearLimit: boolean;
  currentTpm: number;
  maxTpm: number;
  percentage: number;
}
```

---

## 2. Request Header & Context Integration

| Header / Context Property | Type | Description |
|:---|:---|:---|
| `x-custom-rpm` | `string` (HTTP Header) | Giá trị RPM tối đa của key/model do người dùng đặt (ví dụ: `"60"`) |
| `pacingIntervalMs` | `number` (Context) | Khoảng thời gian chờ tính toán động để các hook dịch thuật áp dụng |
| `customLimits` | `Record<string, CustomLimit>` | Bảng cấu hình hạn mức người dùng (lưu trong `localStorage.getItem('gemini_quota_custom_limits')`) |

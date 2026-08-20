# Contract: Quota Semantics & Scheduling Hint Authority

**Feature**: `039-isolate-provider-quota-fallback`  
**Date**: 2026-08-20  
**Status**: Active

---

## 1. Service Interface Contract (`IQuotaService`)

```typescript
export interface IQuotaService {
  /**
   * Đăng ký một QuotaGroup mới.
   * Nếu không có ProviderQuota đã xác minh, thuộc tính providerQuota PHẢI là undefined.
   */
  registerQuotaGroup(input: {
    id?: string;
    projectId?: string;
    name?: string;
    configuredRpm?: number;
    configuredTpm?: number;
    configuredRpd?: number;
    keyIds: string[];
    providerQuota?: ProviderQuota;
  }): QuotaGroup;

  /**
   * Cập nhật thông tin hạn mức nhà cung cấp khi có kết quả xác minh từ API.
   * Cập nhật này KHÔNG được phép ghi đè lên configuredLimits của người dùng.
   */
  updateProviderQuota(
    groupId: string,
    quota: Partial<ProviderQuota>,
    now?: number
  ): QuotaGroup | null;

  /**
   * Tính toán hoặc tái tạo SchedulingHint dựa trên thứ tự ưu tiên:
   * configured > provider > model-fallback > safe-default
   */
  deriveSchedulingHint(
    configuredLimits?: ConfiguredQuota,
    providerQuota?: ProviderQuota,
    modelId?: string,
    safetyFloorMs?: number
  ): GroupSchedulingHint;

  /**
   * Lấy snapshot dữ liệu Quota trả về cho Client.
   * providerQuota trong DTO phải là undefined nếu chưa được xác minh.
   */
  getQuotaSnapshot(keys?: string[], now?: number): KeyQuotaFullSnapshot[];
  getQuotaGroupsSnapshot(now?: number): QuotaGroupDisplayItem[];
}
```

---

## 2. API DTO Contract (`/api/quota-status`)

### Response Payload Structure
```json
{
  "timestamp": "2026-08-20T10:00:00.000Z",
  "timezone": "America/Los_Angeles",
  "currentDayPST": "2026-08-20",
  "groups": [
    {
      "id": "group_project_alpha",
      "projectId": "project-alpha",
      "name": "Project Alpha",
      "healthState": "Available",
      "configuredLimits": {
        "configuredRpm": 30
      },
      "providerQuota": null,
      "schedulingHint": {
        "effectiveIntervalMs": 2223,
        "safetyFloorMs": 400,
        "isCustom": true,
        "estimatedThroughputRpm": 27.0,
        "source": "configured",
        "pacingIntervalMs": 2223
      },
      "observedUsage": {
        "requestsTotal": 15,
        "requestsToday": 15,
        "requestsThisMinute": 2,
        "tokensTotal": 12500,
        "tokensToday": 12500,
        "tokensThisMinute": 1500,
        "errorsTotal": 0,
        "errorsToday": 0
      },
      "cooldownRemainingMs": 0,
      "keys": []
    }
  ],
  "keys": []
}
```

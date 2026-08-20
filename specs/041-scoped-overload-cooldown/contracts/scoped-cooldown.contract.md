# API & Service Contract: Scoped Overload Cooldown

**Feature**: `041-scoped-overload-cooldown`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Quản Lý Cooldown Trong `quotaService`

```typescript
export interface IQuotaServiceCooldownExtensions {
  /**
   * Kích hoạt Cooldown cho một mô hình cụ thể khi gặp 503 Overload
   */
  triggerModelCooldown(
    modelName: string,
    durationMs?: number,
    reason?: string,
    now?: number
  ): void;

  /**
   * Kiểm tra trạng thái Cooldown của một Model
   */
  getModelCooldownStatus(
    modelName: string,
    now?: number
  ): { inCooldown: boolean; remainingMs: number; reason?: string };

  /**
   * Ghi nhận sự cố hệ thống để theo dõi Provider-Wide Outage
   */
  recordUpstreamFailureEvent(
    modelName: string,
    groupId: string,
    timestamp?: number
  ): boolean;

  /**
   * Kiểm tra trạng thái Provider Outage
   */
  getProviderOutageStatus(
    now?: number
  ): { isOutage: boolean; remainingMs: number };

  /**
   * Lấy danh sách các Model đang bị Cooldown
   */
  getActiveModelCooldowns(
    now?: number
  ): Record<string, number>;
}
```

---

## 2. Hợp Đồng API Endpoint: `POST /api/quota-status`

```json
{
  "timestamp": "2026-08-20T10:30:00.000Z",
  "timezone": "America/Los_Angeles",
  "currentDayPST": "2026-08-20",
  "scheduler": {
    "selectionCount": 150,
    "queueWaitTotalMs": 2500,
    "queueWaitAvgMs": 16.7,
    "rejectedTotal": 2,
    "rejectedByReason": {
      "model_overloaded": 1,
      "group_in_cooldown": 1
    },
    "activeModelCooldowns": {
      "models/gemini-2.5-pro": 2500
    },
    "activeGroupCooldowns": {
      "group_project_1": 4200
    },
    "isProviderOutage": false
  }
}
```

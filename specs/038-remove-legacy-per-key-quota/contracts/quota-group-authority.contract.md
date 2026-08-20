# Contract: Quota Group Authority & Key Health Interface

**Feature Branch**: `038-remove-legacy-per-key-quota`  
**Created**: 2026-08-20  
**Status**: Active  
**Spec Reference**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/038-remove-legacy-per-key-quota/spec.md)

---

## 1. Quota Service Core Interface Contract

```typescript
export interface IQuotaService {
  /**
   * Đăng ký hoặc cập nhật một Quota Group đại diện cho 1 dự án
   */
  registerQuotaGroup(input: QuotaGroupConfigInput): QuotaGroup;

  /**
   * Đảm bảo API key luôn được gán vào 1 Quota Group (hỗ trợ migration/fallback)
   */
  ensureKeyGroup(key: string, customGroupId?: string, customRpm?: number): QuotaGroup;

  /**
   * Lấy thông tin chi tiết một Quota Group theo ID
   */
  getQuotaGroup(groupId: string): QuotaGroup | undefined;

  /**
   * Lấy toàn bộ danh sách Quota Groups hiện có
   */
  getAllQuotaGroups(): QuotaGroup[];

  /**
   * Đánh giá và chấm điểm danh sách Quota Group cho request dự kiến
   * Trả về danh sách GroupScoreResult đã sắp xếp theo thứ tự ưu tiên
   */
  evaluateQuotaGroups(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens?: number,
    now?: number
  ): GroupScoreResult[];

  /**
   * Chọn API Key tối ưu nhất trong một Quota Group đã chọn
   * Ưu tiên key Healthy, có thời gian nghỉ dài nhất (Least Recently Used) và ít lỗi nhất
   */
  selectBestKeyInGroup(
    groupId: string,
    candidateRawKeys?: string[],
    now?: number
  ): {
    key: string;
    keyHash: string;
    score: number;
    pacingDelayMs: number;
  } | null;

  /**
   * Đọc trạng thái Key Health hiện tại với logic tự động phục hồi TTL & PST Midnight
   */
  getKeyHealth(key: string, now?: number): {
    state: KeyHealthState;
    consecutiveErrors: number;
    consecutiveSuccesses: number;
    cooldownRemainingMs: number;
    circuitBreaker: CircuitBreakerStatus;
    isAvailable: boolean;
    transitionReason?: string;
  };

  /**
   * Ghi nhận sử dụng ở cấp độ QuotaGroup và cập nhật Health State của Key
   */
  recordGroupUsage(
    groupId: string,
    key: string,
    modelName: string,
    status: QuotaAttemptStatus,
    timestamp?: number,
    tokenStats?: TokenStats,
    latencyMs?: number
  ): void;

  /**
   * Kích hoạt Cooldown cho toàn bộ Quota Group khi gặp lỗi 429 quota exhaustion
   */
  triggerGroupCooldown(
    groupId: string,
    durationMs?: number,
    reason?: string,
    now?: number
  ): void;

  /**
   * Ghi nhận lỗi có phân loại rõ ràng theo Error Taxonomy
   */
  recordCategorizedError(
    key: string,
    modelName: string,
    error: AIErrorNormalized,
    timestamp?: number,
    latencyMs?: number
  ): void;
}
```

---

## 2. API Endpoints & Contract DTOs

### 2.1 GET `/api/v1/quota/status`

Trả về ảnh chụp toàn diện về Quota Groups, API Keys và thống kê sử dụng.

#### Response Body Schema:

```json
{
  "success": true,
  "timezone": "America/Los_Angeles (PST/PDT)",
  "currentDayPST": "2026-08-20",
  "groups": [
    {
      "id": "group_project_a",
      "projectId": "project-alpha",
      "name": "Project Alpha",
      "healthState": "Available",
      "providerQuota": {
        "rpm": 15,
        "tpm": 1000000,
        "rpd": 1500,
        "isVerified": false
      },
      "configuredLimits": {
        "configuredRpm": 15,
        "configuredTpm": 1000000,
        "configuredRpd": 1500
      },
      "observedUsage": {
        "requestsTotal": 142,
        "requestsToday": 45,
        "requestsThisMinute": 3,
        "tokensTotal": 240000,
        "tokensToday": 80000,
        "tokensThisMinute": 6000,
        "errorsTotal": 1,
        "errorsToday": 0,
        "lastRequestTimestamp": 1755678900000
      },
      "schedulingHint": {
        "effectiveIntervalMs": 4445,
        "safetyFloorMs": 400,
        "isCustom": false,
        "estimatedThroughputRpm": 13.5
      },
      "keys": [
        {
          "keyHash": "a1b2c3d4e5f6...",
          "maskedKey": "AIzaSy...4xQ1",
          "healthState": "Healthy",
          "circuitBreaker": "Closed",
          "cooldownRemainingMs": 0,
          "requestsTotal": 80,
          "requestsToday": 25,
          "errorsTotal": 0
        },
        {
          "keyHash": "f6e5d4c3b2a1...",
          "maskedKey": "AIzaSy...9zK2",
          "healthState": "Healthy",
          "circuitBreaker": "Closed",
          "cooldownRemainingMs": 0,
          "requestsTotal": 62,
          "requestsToday": 20,
          "errorsTotal": 1
        }
      ]
    }
  ],
  "summary": {
    "logicalRequestsTotal": 120,
    "logicalRequestsToday": 40,
    "successfulRequestsTotal": 118,
    "successfulRequestsToday": 40,
    "failedRequestsTotal": 2,
    "failedRequestsToday": 0,
    "retriesTotal": 5,
    "retriesToday": 2,
    "providerAttemptsTotal": 142,
    "providerAttemptsToday": 45
  }
}
```

---

## 3. Disallowed Legacy Contracts (Deny-list)

1. **KHÔNG** export hoặc sử dụng hàm `calculateKeyScore(key, model, options)` trên interface `QuotaService`.
2. **KHÔNG** truyền hoặc nhận các tham số mang ý nghĩa per-key quota như `keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`.
3. **KHÔNG** gán hoặc hiển thị các thanh đo RPM/TPM/RPD độc lập giả định rằng mỗi API key có 1 quota riêng trong giao diện frontend.

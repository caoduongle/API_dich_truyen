# Contract: Quota Group Telemetry & Configuration API

## Endpoint: GET `/api/quota-status`

### Request
- **Headers**: Optional session/auth headers.
- **Query Parameters**:
  - `modelId` (optional): Filter metrics by model ID.

### Response (200 OK)

```json
{
  "groups": [
    {
      "id": "group_proj_alpha_123",
      "projectId": "gemini-project-alpha",
      "name": "Project Alpha (Free Tier)",
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
        "tokensTotal": 284000,
        "tokensToday": 90000,
        "tokensThisMinute": 6000,
        "errorsTotal": 1,
        "errorsToday": 0,
        "lastRequestTimestamp": 1771560000000
      },
      "schedulingHint": {
        "effectiveIntervalMs": 4445,
        "safetyFloorMs": 400,
        "isCustom": false,
        "estimatedThroughputRpm": 13.5
      },
      "cooldownRemainingMs": 0,
      "keys": [
        {
          "id": "key_hash_a1",
          "maskedKey": "AIza...A1",
          "healthState": "Healthy",
          "circuitBreaker": "Closed",
          "cooldownRemainingMs": 0,
          "lastUsedAtMs": 1771560000000,
          "observedAttempts": {
            "attemptsTotal": 80,
            "attemptsToday": 25,
            "successfulAttempts": 25,
            "failedAttempts": 0,
            "consecutiveFailures": 0
          }
        },
        {
          "id": "key_hash_a2",
          "maskedKey": "AIza...A2",
          "healthState": "Healthy",
          "circuitBreaker": "Closed",
          "cooldownRemainingMs": 0,
          "lastUsedAtMs": 1771559980000,
          "observedAttempts": {
            "attemptsTotal": 62,
            "attemptsToday": 20,
            "successfulAttempts": 20,
            "failedAttempts": 0,
            "consecutiveFailures": 0
          }
        }
      ]
    }
  ],
  "logicalSummary": {
    "logicalRequestsTotal": 140,
    "successfulRequestsTotal": 140,
    "failedRequestsTotal": 0,
    "retriesTotal": 2
  },
  "schedulerTelemetry": {
    "selectionCount": 142,
    "queueWaitTotalMs": 2850,
    "queueWaitAvgMs": 20.07,
    "rejectedTotal": 12,
    "rejectedByReason": {
      "group_rate_limited": 8,
      "key_cooldown": 4
    }
  },
  "timestamp": 1771560005000
}
```

---

## Endpoint: POST `/api/quota-groups/configure`

### Request Payload

```json
{
  "groups": [
    {
      "id": "group_proj_alpha_123",
      "projectId": "gemini-project-alpha",
      "name": "Project Alpha",
      "configuredRpm": 20,
      "configuredTpm": 1000000,
      "configuredRpd": 1500,
      "keyIds": ["AIzaSyKeyA1...", "AIzaSyKeyA2..."]
    }
  ]
}
```

### Response (200 OK)

```json
{
  "status": "success",
  "updatedGroupsCount": 1,
  "groups": [
    {
      "id": "group_proj_alpha_123",
      "configuredLimits": {
        "configuredRpm": 20,
        "configuredTpm": 1000000,
        "configuredRpd": 1500
      },
      "schedulingHint": {
        "effectiveIntervalMs": 3334,
        "safetyFloorMs": 400,
        "isCustom": true,
        "estimatedThroughputRpm": 18.0
      }
    }
  ]
}
```

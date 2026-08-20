# API Contract: Scheduler Observability & Health Endpoints

## 1. Endpoint: `GET /api/quota-status`

Returns full operational diagnostics including logical request summary, scheduler telemetry, per-model latency profiles, and per-key health states.

### Request
- **Method**: `GET`
- **Headers**:
  - `Authorization`: Bearer `<session-token>` (Optional or standard auth)
  - `x-request-id`: string (Optional correlation ID)

### Response (`200 OK`)
```json
{
  "summary": {
    "logicalRequestsTotal": 12,
    "logicalRequestsToday": 12,
    "successfulRequestsTotal": 11,
    "successfulRequestsToday": 11,
    "failedRequestsTotal": 1,
    "failedRequestsToday": 1,
    "retriesTotal": 4,
    "retriesToday": 4,
    "providerAttemptsTotal": 16,
    "providerAttemptsToday": 16,
    "successfulAttemptsTotal": 11,
    "successfulAttemptsToday": 11,
    "failedAttemptsTotal": 5,
    "failedAttemptsToday": 5,
    "lastResetDay": "2026-08-20"
  },
  "scheduler": {
    "selectionCount": 32,
    "queueWaitTotalMs": 1420,
    "queueWaitAvgMs": 88.75,
    "rejectedTotal": 16,
    "rejectedByReason": {
      "in_cooldown": 6,
      "rate_limited_pacing": 8,
      "circuit_breaker_open": 2,
      "unsupported_model": 0,
      "quota_exhausted": 0
    }
  },
  "byModel": {
    "models/gemini-2.5-flash": {
      "requestsTotal": 14,
      "requestsToday": 14,
      "errorsTotal": 3,
      "errorsToday": 3,
      "totalLatencyMs": 22400,
      "avgLatencyMs": 1600.0,
      "minLatencyMs": 850,
      "maxLatencyMs": 4200,
      "tokensTotal": 35000,
      "tokensToday": 35000
    },
    "models/gemini-2.5-pro": {
      "requestsTotal": 2,
      "requestsToday": 2,
      "errorsTotal": 2,
      "errorsToday": 2,
      "totalLatencyMs": 11000,
      "avgLatencyMs": 5500.0,
      "minLatencyMs": 5200,
      "maxLatencyMs": 5800,
      "tokensTotal": 0,
      "tokensToday": 0
    }
  },
  "keys": [
    {
      "keyHash": "3a7b9c1d...",
      "maskedKey": "AIzaSyB3...9xK2",
      "healthState": "Healthy",
      "transitionReason": "Sẵn sàng hoạt động",
      "circuitBreakerState": "Closed",
      "cooldownRemainingMs": 0,
      "providerAttemptsTotal": 10,
      "providerAttemptsToday": 10,
      "requestsTotal": 10,
      "requestsToday": 10,
      "errorsTotal": 2,
      "consecutiveErrors": 0,
      "quotaEventsTotal": 1,
      "cooldownEventsTotal": 1,
      "tokensTotal": 25000,
      "tokensToday": 25000,
      "tokensThisMinute": 0
    }
  ],
  "timestamp": 1787214000000
}
```

# Interface Contract: Quota Scheduler & Key Health Management

**Contract ID**: `quota-scheduler-contract-v1`  
**Feature**: `013-model-quota-resilience`  

---

## 1. Key Health & Metrics Response (`POST /api/quota-status`)

### Request:
```json
{
  "apiKeys": ["AIzaSy..."],
  "sessionToken": "optional-session-token"
}
```

### Response (200 OK):
```json
{
  "keys": [
    {
      "keyHash": "3f4a81b...",
      "maskedKey": "AIzaSy...4f2a",
      "healthState": "Healthy",
      "requestsTotal": 42,
      "requestsToday": 42,
      "requestsThisMinute": 3,
      "errorsTotal": 0,
      "tokensTotal": 48200,
      "tokensToday": 48200,
      "tokensThisMinute": 3200,
      "lastRequestTimestamp": 1724089200000,
      "cooldownRemainingMs": 0,
      "byModel": {
        "models/gemini-2.5-flash": {
          "requestsTotal": 30,
          "requestsToday": 30,
          "requestsThisMinute": 2,
          "errorsTotal": 0,
          "tokensTotal": 35000,
          "tokensToday": 35000,
          "tokensThisMinute": 2400
        }
      }
    }
  ],
  "serverPacing": {
    "effectiveFloorMs": 400,
    "defaultIntervalMs": 4500
  }
}
```

---

## 2. Request Headers Contract

| Header | Description | Required | Example |
|---|---|---|---|
| `x-custom-rpm` | RPM cá nhân người dùng cấu hình cho key/model | No | `60` |
| `x-request-id` | Tracing Request ID | No (server sinh nếu thiếu) | `req_1724089200_a8f9` |
| `idempotency-key` | Khóa chống trùng lặp request | No | `idemp_chap_12_raw` |
| `x-session-token` | Token phiên làm việc giải mã API key trên server | No | `sess_98a7f6c...` |

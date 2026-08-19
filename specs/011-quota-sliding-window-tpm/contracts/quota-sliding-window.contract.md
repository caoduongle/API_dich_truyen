# Interface Contract: Sliding Window Token & Request Quota

**Feature**: `011-quota-sliding-window-tpm`  
**Created**: 2026-08-19  

---

## 1. HTTP Endpoint: `POST /api/quota-status`

- **Request Body**:
  ```json
  {
    "apiKeys": ["AIzaSy..."]
  }
  ```
- **Response Body**:
  ```json
  {
    "timezone": "America/Los_Angeles",
    "currentDayPST": "2026-08-19",
    "keys": [
      {
        "index": 0,
        "keyHash": "3a7b...",
        "maskedKey": "AIzaSy...1111",
        "requestsTotal": 100,
        "requestsToday": 40,
        "requestsThisMinute": 5,
        "errorsTotal": 0,
        "tokensTotal": 150000,
        "tokensToday": 60000,
        "tokensThisMinute": 7500,
        "byModel": {
          "gemini-2.5-flash": {
            "requestsTotal": 100,
            "requestsToday": 40,
            "requestsThisMinute": 5,
            "errorsTotal": 0,
            "tokensTotal": 150000,
            "tokensToday": 60000,
            "tokensThisMinute": 7500
          }
        },
        "runtime": {
          "isBlacklisted": false,
          "blacklistRemainingMs": 0,
          "isRateLimited": false,
          "nextAllowedRemainingMs": 0
        }
      }
    ]
  }
  ```

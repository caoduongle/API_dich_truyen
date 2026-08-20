# Quickstart: Secure Session Tokens (Zero URL Query Credentials)

## 1. Test Verification

```bash
# 1. Type check
npm run lint

# 2. Unit and integration tests
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Validation Scenarios

### Scenario 1: Valid Header Authentication
- Send `GET /api/session-keys/status` with `X-Session-Token: <token>`.
- Assert `200 OK` with `{ valid: true }`.

### Scenario 2: Rejection of Query Token
- Send `GET /api/session-keys/status?token=<token>`.
- Assert `400 Bad Request` with `{ code: 'DISALLOWED_URL_CREDENTIALS' }`.

### Scenario 3: Missing Token on Revoke
- Send `DELETE /api/session-keys` without headers.
- Assert `401 Unauthorized` with `{ code: 'MISSING_SESSION_TOKEN' }`.

# Quickstart: Logical Requests vs Provider Attempts

## 1. Test Verification

```bash
# 1. Type check
npm run lint

# 2. Test suite
npm test

# 3. Production build
npm run build
```

---

## 2. Validation Scenarios

### Scenario 1: One Successful Attempt
- Trigger 1 translation call that succeeds on first key.
- Verify `logicalRequests: 1`, `providerAttempts: 1`, `retries: 0`, `successfulRequests: 1`.

### Scenario 2: One Retry
- Key 1 fails (429/503), Key 2 succeeds.
- Verify `logicalRequests: 1`, `providerAttempts: 2`, `retries: 1`, `successfulRequests: 1`.

### Scenario 3: Multiple Rotation Attempts
- Key 1 fails, Key 2 fails, Key 3 succeeds.
- Verify `logicalRequests: 1`, `providerAttempts: 3`, `retries: 2`, `successfulRequests: 1`.

### Scenario 4: All Attempts Fail
- Key 1 fails, Key 2 fails, Key 3 fails.
- Verify `logicalRequests: 1`, `providerAttempts: 3`, `retries: 2`, `failedRequests: 1`, `successfulRequests: 0`.

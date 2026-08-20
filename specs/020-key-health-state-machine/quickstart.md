# Quickstart: Key Health State Machine & Recovery Engine

## 1. Test Verification

```bash
# 1. Type check
npm run lint

# 2. Test suite run (verifies state transitions and recovery policies)
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Validation Scenarios

### Scenario 1: 401 Auth Failed Non-Recovery
- Record 401 `AUTH_FAILED` error on a key.
- Verify key enters `AuthFailed` state and remains unavailable even after advancing time by 1 hour.

### Scenario 2: Rate Limited TTL Auto-Recovery
- Record 429 `RATE_LIMITED` error on a key with 5s cooldown.
- Advance time by 6s and query `getKeyHealth`.
- Verify key state automatically recovers to `Healthy` and becomes available.

### Scenario 3: Quota Exhausted Daily Rollover
- Record RPD quota exhaustion on Day 1.
- Query key on Day 2 in `America/Los_Angeles`.
- Verify key state automatically resets to `Healthy`.

# Quickstart: Shared Redis Connection Manager & Lifecycle Engine

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

### Scenario 1: Connection Consolidation
- Initialize multiple services (`rateLimiter`, `authStore`, `sessionStore`).
- Assert that `authStore['redisClient'] === sessionStore['redisClient']`.

### Scenario 2: Reconnection & Status Broadcast
- Trigger Redis disconnect/ready events on the shared manager.
- Verify status transitions propagate to subscribed listeners.

### Scenario 3: Graceful Shutdown
- Call `redisManager.close()`.
- Assert `client.quit()` executed and status transitions to `'closed'`.

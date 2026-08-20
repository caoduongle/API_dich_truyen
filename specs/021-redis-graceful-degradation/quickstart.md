# Quickstart: Redis Graceful Degradation & Differentiated Local Fallback

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

### Scenario 1: Redis Healthy Distributed Limiting
- Start Redis, send requests across distinct IPs.
- Verify distributed counter in Redis via Lua script.

### Scenario 2: Redis Outage Graceful Degradation
- Simulate Redis disconnection or query rejection.
- Send 10 requests exceeding limit.
- Verify HTTP 429 response without application crash or unhandled rejection.
- Verify error is logged once without spamming per request.

### Scenario 3: Redis Auto-Recovery
- Trigger `ready` event on Redis client.
- Send subsequent requests and verify distributed rate limiting resumes seamlessly.

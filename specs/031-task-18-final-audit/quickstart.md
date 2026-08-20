# Quickstart: Final System Audit & Validation Guide

## 1. Automated Quality Gate Validation

Execute the mandatory triumvirate of quality commands:

```bash
# 1. Typecheck: Must pass with 0 errors
npm run lint

# 2. Test Suite: Must pass 100% (59 test files / 431 tests)
npm test

# 3. Production Build: Must build client & server cleanly
npm run build
```

## 2. Server Telemetry & Health Probe Verification

Start the production server and query system readiness:

```bash
# Start server
npm run start

# In another terminal:
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/health/ready
curl -i http://localhost:3000/api/quota
```

Expected readiness output:
```json
{
  "ready": true,
  "redis": { "status": "connected" },
  "rateLimiter": { "algorithm": "sliding-window-counter" },
  "quotaScheduler": { "ready": true }
}
```

# Quickstart Guide: Architectural Hardening Verification

## 1. Verify Encrypted Session Store
```bash
# Create a secure session
curl -X POST http://localhost:3000/api/session-keys \
  -H "Content-Type: application/json" \
  -d '{"apiKeys": ["AIzaSyValidKeyForTesting123"]}'
# Response: { "success": true, "sessionToken": "...", "keyCount": 1 }
```

## 2. Verify Scoped Idempotency & Conflict Handling
```bash
# Request 1
curl -X POST http://localhost:3000/api/translate-raw \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: <SESSION_TOKEN>" \
  -H "Idempotency-Key: test-req-123" \
  -d '{"rawText": "Hello world"}'

# Request 2 (Identical key, different payload -> 409 Conflict)
curl -X POST http://localhost:3000/api/translate-raw \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: <SESSION_TOKEN>" \
  -H "Idempotency-Key: test-req-123" \
  -d '{"rawText": "Different payload text"}'
# Response: 409 Conflict { "code": "IDEMPOTENCY_PAYLOAD_MISMATCH" }
```

## 3. Verify Redis Graceful Degradation & Readiness
```bash
# Check readiness probe
curl http://localhost:3000/api/ready
# Response: { "status": "ready", "degraded": false }
```

## 4. Run Automated Test Suite
```bash
npm run lint
npm test
npm run build
```

# Quickstart: Scheduler Observability & Telemetry Verification

This guide outlines runnable scenarios to verify scheduler observability, request correlation, and safe telemetry.

---

## 1. Automated Verification Suite

Run all verification tests:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Run unit tests for scheduler observability
npx vitest run server/services/__tests__/schedulerObservability.test.ts

# 3. Run full test suite
npm test

# 4. Production build check
npm run build
```

---

## 2. Key Scenarios to Validate

### Scenario 1: Request ID Correlation Across Retries
1. Configure 2 API keys (Key 1 configured to mock 429 Rate Limit; Key 2 configured to succeed).
2. Execute a translation request with `x-request-id: req_test_correlation_01`.
3. **Verify**:
   - Both Attempt 1 and Attempt 2 are logged with `requestId = "req_test_correlation_01"`.
   - Attempt 1 has `errorCode = "RATE_LIMITED"`.
   - Attempt 2 has `status = "success"`.
   - `summary.retriesTotal = 1` and `summary.logicalRequestsTotal = 1`.

### Scenario 2: Scheduler Decision & Rejection Tracking
1. Set Key 1 to `Cooldown` and Key 2 to `Healthy`.
2. Execute a translation request.
3. Query `GET /api/quota-status`.
4. **Verify**:
   - `scheduler.rejectedByReason.in_cooldown >= 1`.
   - `scheduler.selectionCount >= 1`.

### Scenario 3: Per-Model Latency Profiling
1. Dispatch 3 requests to `models/gemini-2.5-flash` with recorded latencies (e.g. 1000ms, 2000ms, 1500ms).
2. Query `GET /api/quota-status`.
3. **Verify**:
   - `byModel["models/gemini-2.5-flash"].requestsTotal = 3`.
   - `byModel["models/gemini-2.5-flash"].avgLatencyMs = 1500`.
   - `byModel["models/gemini-2.5-flash"].minLatencyMs = 1000`.
   - `byModel["models/gemini-2.5-flash"].maxLatencyMs = 2000`.

### Scenario 4: Sensitive Data Zero-Leakage Assertion
1. Run translation with a test API key `AIzaSyDummySecretKey123456789`.
2. Inspect all captured log strings.
3. **Verify**:
   - `AIzaSyDummySecretKey123456789` NEVER appears in raw form.
   - Logs only contain `AIzaSy...6789` or the SHA-256 hash.

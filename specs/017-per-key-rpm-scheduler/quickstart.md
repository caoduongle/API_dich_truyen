# Quickstart: Quota-Aware Per-Key RPM Scheduler

## 1. Automated Test Execution

```bash
# 1. Type check
npm run lint

# 2. Test suite run (per-key scheduler, variable RPM, model routing tests)
npm test

# 3. Production build
npm run build
```

---

## 2. Validation Scenarios

### Scenario 1: Mixed RPM Pacing (Key A 15 RPM vs Key B 60 RPM)
- Verify Key A is assigned interval ~4.5s.
- Verify Key B is assigned interval ~1.1s.
- Verify sequential requests dispatched through Key B do not wait on Key A's 4.5s timer.

### Scenario 2: Capacity Exhaustion & Auto Fallback
- Exhaust Key 1's sliding window RPM (e.g. 15 requests in 60s).
- Verify scheduler automatically skips Key 1 and routes to Key 2 with 0 downtime.

### Scenario 3: Unsupported Model Routing
- Configure Key 1 with model support `['models/gemini-2.5-flash']` and Key 2 without it.
- Send request for `gemini-2.5-flash`.
- Verify scheduler routes exclusively to Key 1.

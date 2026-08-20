# Quickstart & Validation Guide: Project & Quota Group Scheduler

## Prerequisites
- Node.js environment with project dependencies installed (`npm install`).
- Backend test suite executable with Vitest (`npm test`).

---

## Runnable Verification Scenarios

### Scenario 1: Same Project Keys Share Quota Budget
1. **Setup**: Define Project Alpha with two API keys (`Key A1`, `Key A2`) and a configured limit of 15 RPM.
2. **Execute**: Send 15 requests interleaved across Key A1 and Key A2 within 60 seconds.
3. **Assert**:
   - Total observed requests for Project Alpha is 15.
   - Dispatching the 16th request is paused by the scheduler until the 60s sliding window frees capacity.
   - Pacing clock advances at the group level.

### Scenario 2: Multi-Project Independent Scaling
1. **Setup**: Define Project Alpha (Keys A1, A2, 15 RPM) and Project Beta (Keys B1, B2, 60 RPM).
2. **Execute**: Saturate Project Alpha to 15/15 requests; immediately send new requests.
3. **Assert**:
   - Scheduler recognizes Project Alpha as rate-limited/exhausted.
   - Request is immediately routed to Project Beta without wait delay.
   - Project Beta handles requests up to its independent 60 RPM capacity.

### Scenario 3: Single Key Auth Failure Isolation
1. **Setup**: Project Alpha has Key A1 (invalid key) and Key A2 (valid key).
2. **Execute**: Dispatch request through Project Alpha. Key A1 fails with HTTP 401.
3. **Assert**:
   - Key A1 transitions to `AuthFailed` / `Disabled`.
   - Key A2 remains in `Healthy` state.
   - Next request for Project Alpha automatically selects Key A2 without failing the task.

### Scenario 4: Group Cooldown on 429 & Alternate Group Failover
1. **Setup**: Project Alpha (Key A1) returns upstream 429 Quota Exceeded; Project Beta (Key B1) is healthy.
2. **Execute**: Handle 429 error and dispatch next translation task.
3. **Assert**:
   - Project Alpha enters `InCooldown` state with cooldown timer.
   - Next translation task bypasses Project Alpha and selects Project Beta.

### Scenario 5: Telemetry 4-Tier Data Classification
1. **Execute**: Fetch `/api/quota-status` after applying a custom 30 RPM limit.
2. **Assert**:
   - `configuredQuota.configuredRpm === 30`
   - `schedulingHint.effectiveIntervalMs === 2223`
   - `providerQuota.isVerified === false`
   - Group observed usage reflects aggregated totals.

---

## Test Commands

```bash
# Type check verification
npm run lint

# Automated unit & integration tests
npm test -- server/services/__tests__/keyScheduler.test.ts
npm test -- server/services/__tests__/quotaGroup.test.ts

# Production build check
npm run build
```

# Requirements Checklist: Master Infrastructure & Architectural Hardening

## User Story 1: Security & Idempotency Hardening (P0 🎯 MVP)
- [ ] AES-256-GCM encryption in `SessionStore` with `ENCRYPTION_MASTER_KEY`.
- [ ] Scoped idempotency keying `hash(sessionId + endpoint + idempotencyKey + bodyFingerprint)`.
- [ ] HTTP 409 Conflict on payload fingerprint mismatch for identical idempotency key.
- [ ] Automatic redaction of `AIzaSy...` and sensitive tokens in logs/telemetry.

## User Story 2: Quota Group & Key Health Decoupling (P0/P1 🎯 MVP)
- [ ] QuotaGroup authority managing RPM/TPM at Project level (no false capacity summing).
- [ ] Key health state machine: `HEALTHY`, `COOLDOWN`, `DEGRADED`, `AUTH_FAILED`, `DISABLED`.
- [ ] Isolation of `AUTH_FAILED` keys (401/403) without taking down the entire QuotaGroup.

## User Story 3: Model Verification & Singleflight Pipeline (P1)
- [ ] 5-state model lifecycle (`UNVERIFIED`, `VERIFIED`, `INVALID`, `DEPRECATED`, `SHUTDOWN`).
- [ ] Singleflight promise-lock in `ModelInfoService` (1 network call for $N$ concurrent verifications).
- [ ] Pure in-memory cache lookup in `validateModelMiddleware` (0 network calls in hot path).

## User Story 4: Error Taxonomy, Circuit Breaker & Concurrency Gate (P1)
- [ ] Normalized error taxonomy for upstream Google errors.
- [ ] Scoped circuit breaker cooldown per `[QuotaGroupId + ModelId]`.
- [ ] Concurrency Gate (`MAX_CONCURRENT_REQUESTS = 50`) returning 503 + `Retry-After`.

## User Story 5: Redis Graceful Degradation & Telemetry Semantics (P1/P2)
- [ ] Automatic fallback to in-memory on Redis disconnect; `/ready` returns 200 + `degraded: true`.
- [ ] Metrics disambiguation: `logicalRequests`, `providerAttempts`, `successfulRequests`, `failedRequests`, `retriesTotal`.

## User Story 6: Frontend & UX Alignment (P2)
- [ ] QuotaPanel displays Project-level vs Key activity without false capacity sum.
- [ ] ApiSettings displays model verification states and lifecycle warnings.

## Quality Gates
- [ ] `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- [ ] `npm test` (`vitest run`) passes 100%.
- [ ] `npm run build` succeeds without bundle errors.

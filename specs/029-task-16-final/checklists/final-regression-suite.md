# Final Regression Test Suite Checklist: AI Translation & Infrastructure

**Purpose**: Validate requirement quality and completeness for the comprehensive regression test suite protecting all core system improvements  
**Created**: 2026-08-20  
**Feature**: [spec.md](../spec.md)

> **Ownership Notice**: `[x]` means the reviewer determined the requirements-quality criterion is satisfied. It does NOT mean implementation work is complete. All items start unchecked (`[ ]`).

---

## 1. Model Subsystem Requirements Quality

- [ ] CHK001 Are fallback and migration requirements defined for Google Gemini models that reach end-of-life or shutdown status? [Completeness, Spec §Scenario 1.1]
- [ ] CHK002 Is the Stale-While-Revalidate (SWR) cache lifecycle explicitly quantified with 1-hour TTL and instant render thresholds? [Clarity, Spec §Scenario 1.2]
- [ ] CHK003 Are zero-registry-wipe requirements documented for transient Google API network failures and 429 quota exhaustion? [Coverage, Spec §Scenario 1.2]
- [ ] CHK004 Are verification rules and generation capability constraints explicitly specified for custom fine-tuned and preview models? [Completeness, Spec §Scenario 1.3]
- [ ] CHK005 Is deduplication priority between preset models and discovered models consistently defined across the system? [Consistency, Spec §FR-007]

---

## 2. Scheduler & Quota Subsystem Requirements Quality

- [ ] CHK006 Are RPD (Requests Per Day) quota reset requirements explicitly bound to midnight America/Los_Angeles (PST/PDT) timezone? [Clarity, Spec §Scenario 2.1]
- [ ] CHK007 Are 60-second sliding window requirements defined for tracking both Request (RPM) and Token (TPM) consumption? [Completeness, Spec §Scenario 2.2]
- [ ] CHK008 Is dynamic pacing delay calculation specified with concrete formulas based on remaining per-key capacity? [Measurability, Spec §Scenario 2.2]
- [ ] CHK009 Are key rotation and health-weighted sorting requirements defined for multi-key distribution? [Coverage, Spec §Scenario 2.3]
- [ ] CHK010 Are dynamic cooldown duration ranges (3s to 60s) and recovery triggers on successful response explicitly bounded? [Clarity, Spec §Scenario 2.3]

---

## 3. Resilience, Retry & Error Handling Requirements Quality

- [ ] CHK011 Are retry attempt limits and exponential backoff jitter requirements specified for translation requests? [Completeness, Spec §Scenario 3.1]
- [ ] CHK012 Is `requestId` preservation across all provider retry attempts explicitly required for end-to-end telemetry? [Traceability, Spec §Scenario 3.1]
- [ ] CHK013 Are fallback actions defined when encountering HTTP 429 Resource Exhausted versus HTTP 503 Service Unavailable? [Consistency, Spec §Scenario 3.2]
- [ ] CHK014 Are AbortController timeout boundaries defined for non-responsive external network requests? [Coverage, Spec §Scenario 3.3]
- [ ] CHK015 Are circuit breaker trip conditions and half-open test probe requirements documented? [Completeness, Spec §Scenario 3.2]

---

## 4. Infrastructure, Rate Limiting & Storage Security Requirements Quality

- [ ] CHK016 Are HTTP abuse protection limits maintained at 60 RPM/IP regardless of the underlying rate limiting algorithm? [Consistency, Spec §Scenario 4.1]
- [ ] CHK017 Is the 2x boundary burst prevention requirement quantified with sliding window weighted calculations? [Measurability, Spec §Scenario 4.1]
- [ ] CHK018 Are standard HTTP response headers (`X-RateLimit-*`, `Retry-After`) and 429 JSON response payloads specified? [Clarity, Spec §Scenario 4.1]
- [ ] CHK019 Are zero-downtime graceful degradation requirements specified for Redis disconnect, failover, and reconnect events? [Coverage, Spec §Scenario 4.2]
- [ ] CHK020 Is the zero-plain-key and zero-manuscript leakage invariant in browser `localStorage` strictly enforced and auditable? [Security, Spec §Scenario 4.3]
- [ ] CHK021 Are health and readiness probe endpoint contracts (`/api/health`, `/api/health/ready`) explicitly defined? [Completeness, Spec §Scenario 4.2]

---

## 5. Observability & Telemetry Requirements Quality

- [ ] CHK022 Are attempt-level telemetry requirements specified to log modelId, keyHash, latency, and errorCode without exposing secrets? [Security, Spec §Scenario 3.1]
- [ ] CHK023 Are per-model latency profiles and per-key error counter tracking requirements documented? [Coverage, Spec §Scenario 3.1]
- [ ] CHK024 Are log sanitization requirements explicitly defined to redact API keys, session tokens, and sensitive manuscript text? [Security, Spec §Scenario 4.3]

---

## Notes

- This checklist serves as the authoritative quality gate verifying that all requirements across Models, Quotas, Resilience, Infrastructure, and Telemetry are complete and unambiguous.
- All CHK items are ready for evaluation before running the regression test suite.

# Implementation Plan: Final Audit & System Quality Verification

**Feature**: System-Wide Final Architecture, Security, Model, Quota & Reliability Audit  
**Branch**: `031-task-18-final-audit` | **Spec**: [spec.md](./spec.md)

---

## 1. Technical Context & Audit Scope

This plan structures the authoritative system-wide final audit covering all 18 development tasks:
- **Architecture**: Single source of truth invariants (IndexedDB for manuscripts, SessionStore for credentials, QuotaService for quota, LocalStorage for UI prefs), unidirectional dependency flow, zero dead code or circular imports.
- **Security**: Zero plain API keys or manuscript text in `localStorage`, log redaction (`maskApiKey`, `hashApiKey`), secure session token handling (24h TTL), proxy header trust, storage integrity audit.
- **Model Subsystem**: SWR discovery cache (1h TTL, in-flight deduplication, zero-wipe on 429/network errors), shutdown model migration (`gemini-1.5-flash` -> `gemini-2.5-flash`), custom model verification (`/api/verify-model`).
- **Quota & Scheduler**: RPD PST midnight reset clock (`America/Los_Angeles`), sliding 60s RPM/TPM tracking, dynamic pacing, multi-key health state machine (`Healthy`, `Degraded`, `Cooldown`, `QuotaExhausted`).
- **Reliability & Resilience**: Redis failure graceful degradation (in-memory sliding limiter & chunk cache), 429 quota backoff, 503 overload dynamic cooldown, AbortController timeouts, unified persistent `requestId`.
- **Quality Gates**: Mandatory execution of `npm run lint` (tsc), `npm test` (vitest 431 tests), and `npm run build` (vite + esbuild).

---

## 2. Constitution & Governance Check

| Principle / Rule | Compliance Status | Rationale / Evidence |
|:---|:---|:---|
| **No Logic Breaking Changes** | **COMPLIANT** | Final audit assesses and protects existing implementations without altering working business logic. |
| **Zero Plain API Keys in LocalStorage** | **COMPLIANT** | Verified by `verifyStorageIntegrity()` test cases and clean storage audit. |
| **Sliding Window Boundary Protection** | **COMPLIANT** | Verified by `rateLimiterSlidingWindow.test.ts` (boundary burst elimination). |
| **PST Midnight Reset** | **COMPLIANT** | Verified by `finalRegressionSuite.test.ts` and `quotaService.test.ts`. |
| **All Quality Gates Mandatory** | **COMPLIANT** | `npm run lint` (0 errors), `npm test` (431/431 pass), `npm run build` (Clean build). |

---

## 3. Design Artifacts & Verification Matrix

- [research.md](./research.md): Evaluation of architectural findings and security invariants.
- [data-model.md](./data-model.md): Comprehensive system state, storage ownership, and health transition data model.
- [quickstart.md](./quickstart.md): Step-by-step verification procedures for all quality gates and health endpoints.
- [checklists/requirements.md](./checklists/requirements.md): Spec and audit quality requirements checklist.

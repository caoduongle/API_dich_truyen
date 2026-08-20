# Implementation Plan: Documentation & Architecture Map Update

**Feature**: Comprehensive Documentation & Architecture Map Update  
**Branch**: `030-task-17-documentation` | **Spec**: [spec.md](./spec.md)

---

## 1. Technical Objectives

1. **Restructure and Modernize `README.md`**:
   - Provide a clean, accurate, and comprehensive project guide for developers and users.
   - Embed Mermaid architecture diagrams highlighting the logical flow:
     `Frontend -> HTTP API -> Model Registry -> Admission Control -> Quota Scheduler -> Key Health -> Gemini`.
   - Emphasize the clear architectural boundary separating **HTTP Rate Limiter** (Abuse Protection per IP) and **Gemini Quota Scheduler** (Provider Capacity & Pacing).
   - Document commands, environment variables, multi-key rotation, SWR model discovery cache, storage ownership, and test suites.
2. **Create Detailed Subsystem Architecture Documents in `docs/`**:
   - `docs/architecture.md`: Full architectural blueprint, state ownership matrix, storage invariants, and graceful degradation mechanics.
   - `docs/model-system.md`: SWR Discovery, TTL, deduplication, custom model verification, and shutdown migration rules.
   - `docs/quota-and-scheduling.md`: PST midnight reset clock, sliding 60s RPM/TPM windows, dynamic pacing calculation, and key health states.
   - `docs/api.md`: Comprehensive API reference with HTTP rate limit headers, session tokens, request tracing, and error contracts.

---

## 2. File Modification & Creation Matrix

| File Path | Action | Description |
|:---|:---|:---|
| `README.md` | MODIFY | Complete rewrite reflecting production-grade architecture, features, and setup. |
| `docs/architecture.md` | NEW | Architectural overview, storage ownership matrix, and degradation flows. |
| `docs/model-system.md` | NEW | Model registry, SWR discovery, and lifecycle management documentation. |
| `docs/quota-and-scheduling.md` | NEW | Quota authority, PST reset clock, pacing formulas, and key rotation. |
| `docs/api.md` | NEW | API endpoint reference, headers, tracing, and error contracts. |

---

## 3. Verification Plan

### Automated Verification
- `npm run lint` (`tsc --noEmit`): Verify 0 type errors.
- `npm test`: Verify 100% tests pass across all test suites.
- `npm run build`: Verify production build succeeds without issues.

### Manual / Structural Verification
- Ensure all markdown links, code blocks, and Mermaid diagrams render cleanly and validly.
- Verify zero placeholder text or outdated package paths remain in the repository.

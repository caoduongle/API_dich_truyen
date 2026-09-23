# Implementation Plan: Runtime Hardening Completion & Architecture Polish

**Branch**: `161-runtime-hardening-completion` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/161-runtime-hardening-completion/spec.md`

## Summary

Complete the runtime architecture and error hardening improvements across 5 targeted areas:
1. **Quota Storage Ingestion Cap 100 & Helper**: Introduce shared `sanitizeRecentAttempts` / `sanitizeRecentTokens` helpers in `localQuotaTracker.ts` that apply identical filtering and cap at `.slice(-100)` during both `loadFromStorage` and `saveToStorage`.
2. **Asynchronous Debounced `recordFailure()`**: Change `recordFailure()` to use `scheduleSave(now)` instead of synchronous `flushToStorage(now)`, preserving UI responsiveness during failure cascades while maintaining durability on tab close via lifecycle listeners.
3. **Complete `GeminiRequestError` Taxonomy**: Replace monkey-patched `(err as any).code = ...` with typed `GeminiRequestError` instances for `RESOURCE_NOT_FOUND`, `BAD_REQUEST`, `ALL_KEYS_EXHAUSTED`, and `ETIMEDOUT`. Convert catch clauses to `catch (err: unknown)`.
4. **Strict Unknown Error Handling**: Eliminate `any` in error handling within `directGlossaryEngine.ts` by adding a type-safe `getErrorMessage(error: unknown)` helper and converting catch clauses to `catch (error: unknown)`.
5. **Node.js 24 LTS Migration**: Update CI workflow (`.github/workflows/ci.yml`), `Dockerfile` (`node:24-alpine`), and `README.md` to target Node.js 24 LTS.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 24 LTS (with backwards compatibility for Node 20)  
**Primary Dependencies**: React 19, Vite 6, Tailwind CSS v4, Lucide React, Vitest  
**Storage**: Client-Side `sessionStorage` (for short-term quota sliding window) and IndexedDB (via `db.ts` for chapter persistence)  
**Testing**: Vitest (`npm test`), TypeScript compiler checks (`npm run lint`), Production build (`npm run build`)  
**Target Platform**: Modern Web Browsers, Docker / Containerized Nginx, Vercel, Render  
**Project Type**: Pure Client-Side Single Page Application (SPA)  
**Performance Goals**:
- Quota failure persistence overhead < 1ms on UI thread via 300ms debounce
- Memory consumption bounded during quota hydration (maximum 100 entries per collection)
- Zero synchronous storage I/O blocks during transient 429/503 cascades  
**Constraints**:
- Maximum sliding window duration: 60 seconds
- No new external NPM dependencies (Principle II)
- Schema and interface compatibility preservation (Principle IV)  
**Scale/Scope**:
- 3 core service files touched (`src/services/localQuotaTracker.ts`, `src/services/gemini/geminiClient.ts`, `src/services/directGlossaryEngine.ts`)
- 2 infrastructure files touched (`.github/workflows/ci.yml`, `Dockerfile`)
- 1 documentation file touched (`README.md`)
- 3 test suites updated (`localQuotaTracker.test.ts`, `localQuotaDebounce.test.ts`, `geminiClient.test.ts`)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|:---|:---|:---:|
| **I. Strict Quality Gates & Verification** | All changes will be verified with `npm run lint` (`tsc --noEmit`), `npm test` (all 946+ tests must pass), and `npm run build`. No tests skipped or removed. | **PASS** |
| **II. Dependency Minimization & Reuse** | Zero new dependencies added. Reuses existing native browser APIs and built-in type helpers. | **PASS** |
| **III. Strict Concern Separation (MVC)** | Changes are strictly contained within `src/services/` (Model/Service) and build/CI files. No component or hook modifications. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | Core `src/types.ts` and IndexedDB table schemas remain unchanged. Vietnamese user-facing copy remains unaltered. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Scoped strictly to the 5 identified hardening points. Specs, research, data model, contracts, and quickstart kept in 1:1 sync. | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/161-runtime-hardening-completion/
├── spec.md              # Requirements and user stories
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions and rationale (Phase 0)
├── data-model.md        # Entities, validation, and state transitions (Phase 1)
├── quickstart.md        # Runnable verification guide (Phase 1)
├── contracts/
│   └── runtime-hardening-v2.contract.ts # Interface contracts (Phase 1)
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code Layout

```text
.github/workflows/
└── ci.yml                             # [MODIFY] Upgrade node-version to '24'

Dockerfile                             # [MODIFY] Upgrade builder stage to node:24-alpine
README.md                              # [MODIFY] Specify Node.js 24 LTS

src/
├── services/
│   ├── localQuotaTracker.ts           # [MODIFY] Sanitize helper + cap 100 on load + debounce recordFailure
│   ├── directGlossaryEngine.ts        # [MODIFY] Safe getErrorMessage + catch error: unknown
│   └── gemini/
│       └── geminiClient.ts            # [MODIFY] Complete GeminiRequestError taxonomy + catch err: unknown
└── services/__tests__/
    ├── localQuotaTracker.test.ts      # [MODIFY] Add deserialization cap 100 test
    ├── localQuotaDebounce.test.ts     # [MODIFY] Add recordFailure debounce test
    └── gemini/
        └── geminiClient.test.ts       # [MODIFY] Add GeminiRequestError assertions
```

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. All design choices conform strictly to Constitution Principles I–V.*

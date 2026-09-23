# Implementation Plan: Runtime Architecture & Security Hardening

**Branch**: `160-runtime-architecture-hardening` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/160-runtime-architecture-hardening/spec.md`

## Summary

Harden runtime architecture and security posture by addressing high-priority operational issues identified during codebase review:
1. Enforce complete HTTP security headers in Docker/Nginx (`nginx/default.conf.template`) and expand test parity to Penta-Parity across all deployment profiles.
2. Persist the 60-second rolling quota usage window across browser tab reloads in `LocalQuotaTracker`.
3. Eliminate synchronous storage I/O on the translation hot path via debounced persistence (`scheduleSave` / `flushToStorage`).
4. Prevent wasteful key rotation on AI content/safety moderation rejections (`CONTENT_BLOCKED`).
5. Erase stale QA critique issues on chapters when a subsequent QA inspection passes cleanly with 0 issues.
6. Constrain recursive glossary multi-part splitting using bounded concurrency (`mapWithConcurrencyLimit(parts, 2, ...)`).

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js LTS (20.x/24.x)  
**Primary Dependencies**: React 19, Vite 6, Tailwind CSS v4, Lucide React, Vitest  
**Storage**: Client-Side `sessionStorage` (for short-term quota window) and IndexedDB (via `db.ts` for chapter persistence)  
**Testing**: Vitest (`npm test`), TypeScript compiler checks (`npm run lint`), Production build (`npm run build`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari), Docker / Containerized Nginx, Vercel, Render  
**Project Type**: Pure Client-Side Single Page Application (SPA)  
**Performance Goals**:
- Quota persistence overhead < 1ms on hot path via 300ms debounce
- Maximum concurrency = 2 for recursive glossary splitting
- Zero synchronous I/O blocks during batch translation  
**Constraints**:
- Strict 60-second sliding window duration
- No new external NPM dependencies (Principle II)
- Schema and interface compatibility preservation (Principle IV)  
**Scale/Scope**:
- 5 core service files touched (`nginx/default.conf.template`, `src/services/localQuotaTracker.ts`, `src/services/gemini/geminiClient.ts`, `src/services/gemini/geminiErrorClassifier.ts`, `src/services/chapterTranslationService.ts`, `src/services/directGlossaryEngine.ts`)
- 1 updated test suite (`src/tests/cspParity.test.ts`) and targeted unit tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|:---|:---|:---:|
| **I. Strict Quality Gates & Verification** | All changes will be verified using `npm run lint`, `npm test` (all 931+ tests must pass), and `npm run build`. No tests skipped or removed. | **PASS** |
| **II. Dependency Minimization & Reuse** | Zero new dependencies added. Reuses existing `src/lib/concurrency.ts` (`mapWithConcurrencyLimit`) and native browser APIs. | **PASS** |
| **III. Strict Concern Separation (MVC)** | Changes are strictly contained within `src/services/` (Model/Service) and deployment config (`nginx/`). No view or hook leakage into service layers. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | Core `src/types.ts` and IndexedDB table schemas remain unchanged. Vietnamese user-facing labels remain unaltered. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Scoped strictly to runtime architecture fixes. Docs, spec, plan, contracts, and quickstart kept in 1:1 sync. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/160-runtime-architecture-hardening/
├── spec.md              # Requirements and user stories
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions and rationale (Phase 0)
├── data-model.md        # Entities and state transitions (Phase 1)
├── quickstart.md        # Runnable verification guide (Phase 1)
├── contracts/
│   └── runtime-hardening.contract.ts # Interface contracts (Phase 1)
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code Layout

```text
nginx/
└── default.conf.template          # [MODIFY] Add 8 standard security headers

src/
├── lib/
│   └── concurrency.ts             # [REUSE] mapWithConcurrencyLimit
├── services/
│   ├── localQuotaTracker.ts       # [MODIFY] Sliding window persistence & debounce
│   ├── chapterTranslationService.ts # [MODIFY] Fix stale QA issues on successful pass
│   ├── directGlossaryEngine.ts    # [MODIFY] Apply bounded concurrency to split
│   └── gemini/
│       ├── geminiClient.ts        # [MODIFY] Stop key rotation on CONTENT_BLOCKED
│       └── geminiErrorClassifier.ts # [MODIFY] Robust CONTENT_BLOCKED detection
└── tests/
    └── cspParity.test.ts          # [MODIFY] Upgrade to Penta-Parity including Nginx
```

**Structure Decision**: Confined to existing services and configuration files without introducing new directories or altering project boundaries.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. All design choices conform strictly to Constitution Principles I–V.*

# Implementation Plan: Security & Reliability Hardening

**Branch**: `154-security-reliability-hardening` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/154-security-reliability-hardening/spec.md`

## Summary

This plan establishes the execution blueprint for **Phase 1 (Security & Correctness Hardening)** as prioritized in the repository audit. It delivers immediate, high-impact security hardening with minimal architectural risk:
1. Synchronizing `docs/privacy-policy.md` and `SECURITY.md` with true client-to-Gemini data flows and CDN/hosting telemetry disclosures.
2. Eliminating plaintext API key caching from the in-memory heap in `src/utils/apiKeyHash.ts`.
3. Defaulting `rememberKeys` to `false` (ephemeral `sessionStorage` by default) with safe preservation for explicitly configured user preferences.
4. Adding an explicit 15-second timeout deadline and `AbortSignal` support to `listModelsDirect` in `src/services/directGeminiClient.ts`.
5. Standardizing structured AI response parsing via `parseGeminiStructuredResponse` in `src/lib/text.ts` and replacing raw `JSON.parse` call sites.
6. Hardening `vite.config.ts` by checking `mode === 'production'`, restricting environment ingestion to `'VITE_'`, and updating the `gemma-4-31b-it` label in `src/config/models.ts`.

Subsequent architectural refactoring (modularizing `db.ts`, `useWorkspaceState.ts`, `hakoQualityEngine.ts`) and CI quality gates are staged as follow-up specifications to keep change diffs small and reviewable.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite 6  
**Primary Dependencies**: `@google/genai`, `@tailwindcss/vite`, `motion`, `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: Client-Side IndexedDB (`src/services/db.ts`), `sessionStorage` (ephemeral credentials), `localStorage` (user UI preferences & opt-in saved keys)  
**Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari) running Pure Client-Side SPA  
**Project Type**: Single Page Application (Zero-Backend Client-Direct Architecture)  
**Performance Goals**:
- Synchronous SHA-256 calculation executes in < 0.05ms without memory caching.
- Model discovery network probes abort within 15s under stalled network conditions.
- Zero UI freezing during structured response decoding.  
**Constraints**: Pure client-side execution, no application backend, immutable core schema interfaces in `src/types.ts`.  
**Scale/Scope**: Phase 1 focused security and reliability hardening covering 6 core modules, accompanying tests, and 2 documentation manifests.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance Assessment | Status |
|:---|:---|:---|
| **I. Strict Quality Gates** | Plan requires `npm run lint`, `npm test`, and `npm run build` to pass cleanly. No tests will be skipped or removed. | **PASS** |
| **II. Dependency Minimization** | Zero new dependencies introduced. All functionality uses native browser Web APIs (`crypto.subtle`, `AbortController`, `sessionStorage`) and existing utilities. | **PASS** |
| **III. MVC Domain Boundaries** | Services and utils remain decoupled from UI components. Presentation components continue to consume business logic through custom hooks. | **PASS** |
| **IV. Schema & Text Stability** | Core interfaces in `src/types.ts` and IndexedDB storage schemas are unchanged. Vietnamese user-facing copy remains intact except for removing misleading "Local" tag on cloud API model. | **PASS** |
| **V. Atomic Commits & Docs** | Diff is strictly confined to Phase 1 hardening targets. All documentation (`privacy-policy.md`, `SECURITY.md`) is synchronized 1:1 with code reality. | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/154-security-reliability-hardening/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Technical research & decisions (Phase 0)
├── data-model.md        # Entities & state transitions (Phase 1)
├── quickstart.md        # Validation scenarios & verification commands (Phase 1)
├── contracts/           # Interface contracts (Phase 1)
│   ├── model-discovery.ts
│   ├── structured-parser.ts
│   └── credential-hashing.ts
├── checklists/
│   └── requirements.md  # Requirements quality checklist
└── tasks.md             # Implementation tasks (/speckit-tasks output)
```

### Source Code (affected paths)

```text
docs/
└── privacy-policy.md                           # Update data flow & CDN logging disclosures

SECURITY.md                                     # Update client-direct transmission disclosure

src/
├── config/
│   └── models.ts                               # Update gemma-4-31b-it label from (Local) to (API)
├── hooks/
│   └── useAIConfig.ts                          # Default rememberKeys to false (session-only)
├── lib/
│   ├── text.ts                                 # Add parseGeminiStructuredResponse
│   └── __tests__/
│       └── text.test.ts                        # Tests for parseGeminiStructuredResponse
├── services/
│   ├── directGeminiClient.ts                   # Add 15s timeout to listModelsDirect, use safe parser
│   ├── hakoQualityEngine.ts                    # Use parseGeminiStructuredResponse
│   └── __tests__/
│       └── directGeminiClient.test.ts          # Tests for timeout and cancellation
├── utils/
│   ├── apiKeyHash.ts                           # Remove raw key caching from keyHashCache
│   └── __tests__/
│       └── apiKeyHash.test.ts                  # Test keyHashCache remains free of raw keys

vite.config.ts                                  # mode === 'production', loadEnv(mode, cwd, 'VITE_')
```

**Structure Decision**:
Changes are targeted strictly to existing files without moving or reorganizing directories during Phase 1. This guarantees 100% compatibility with all existing imports, tests, and build artifacts.

---

## Complexity Tracking

> No violations of the Constitution occurred. No justification table required.

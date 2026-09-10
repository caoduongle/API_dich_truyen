# Implementation Plan: All API Keys Exhausted Fast-Break & Error Taxonomy

**Branch**: `094-all-keys-exhausted-break` | **Date**: 2026-09-10 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/094-all-keys-exhausted-break/spec.md)

**Input**: Feature specification from `specs/094-all-keys-exhausted-break/spec.md`

## Summary

In `src/services/directGeminiClient.ts`, when all API keys fail due to rate limiting (HTTP 429 / RESOURCE_EXHAUSTED), `callGeminiDirect()` currently throws an unadorned generic `Error`. Consequently, `runAiQualityScan()` in `src/services/hakoQualityEngine.ts` cannot distinguish this global exhaustion from chapter-specific issues and continues iterating through all remaining chapters, repeating futile key rotations and emitting redundant duplicate warning issues.

This plan decorates the thrown error with `err.code = 'ALL_KEYS_EXHAUSTED'` without altering Vietnamese message copy, adds an immediate circuit-breaker `break` in `runAiQualityScan` that outputs exactly 1 summary warning issue and skips remaining chapters, and preserves all previously completed chapter results.

## Technical Context

**Language/Version**: TypeScript 5.8+  
**Primary Dependencies**: Vitest, `@shared/text`  
**Storage**: None (in-memory error flow)  
**Testing**: Vitest (`npx vitest run`)  
**Target Platform**: Browser / Client-side Gemini REST client  
**Project Type**: Client-side library service  
**Performance Goals**: Instantaneous loop exit upon quota exhaustion (saving $(N - 1)$ rounds of API calls)  
**Constraints**:
- Strictly limited to:
  - `src/services/directGeminiClient.ts`
  - `src/services/hakoQualityEngine.ts`
  - `src/services/__tests__/hakoQualityEngine.test.ts`
- Do not modify translation services or other callers.
- Do not alter Vietnamese error text in `callGeminiDirect`.
- Zero new NPM dependencies.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Verification |
| :--- | :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | `npm run lint`, `npm test`, `npm run build` must pass cleanly. | **PASS** | Automated test suite passes 331 tests; new test verifies fast-break. |
| **II. Dependency Minimization** | No new dependencies added. | **PASS** | Native Error property annotation. |
| **III. Strict Concern Separation** | Only editing client error code and quality engine loop; no touching backend or translation pipeline. | **PASS** | Bounded to 2 files. |
| **IV. Immutable Core Schemas** | No changes to `src/types.ts` or DB schemas. | **PASS** | 100% compliant. |
| **V. Atomic Commits & Sync** | Minimal, reviewable diff. | **PASS** | Targeted edits. |

## Project Structure

### Documentation (this feature)

```text
specs/094-all-keys-exhausted-break/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Architectural research & error taxonomy
├── data-model.md        # Error flow & issue mapping
├── contracts/           # Interface contracts
│   └── gemini-client-taxonomy.contract.md
├── quickstart.md        # Verification guide
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
└── services/
    ├── directGeminiClient.ts                       # [MODIFY] Attach code = 'ALL_KEYS_EXHAUSTED'
    ├── hakoQualityEngine.ts                        # [MODIFY] Fast break on ALL_KEYS_EXHAUSTED
    └── __tests__/
        └── hakoQualityEngine.test.ts               # [MODIFY] Unit test for early break & call count
```

## Complexity Tracking

*No violations. All principles pass cleanly.*

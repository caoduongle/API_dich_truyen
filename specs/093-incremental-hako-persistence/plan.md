# Implementation Plan: Incremental Quality Review Session Persistence & Partial State Handling

**Branch**: `093-incremental-hako-persistence` | **Date**: 2026-09-10 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/093-incremental-hako-persistence/spec.md)

**Input**: Feature specification from `specs/093-incremental-hako-persistence/spec.md`

## Summary

In `HakoCheckerWorkspace.tsx`, quality analysis currently aggregates all heuristic and AI issues in a local in-memory array and only commits them to persistent storage (IndexedDB via `useHakoReviewSession`) once at the very end. Any user cancellation or runtime network error results in 100% data loss of all issues discovered in preceding chapters.

This plan transitions the review pipeline to **per-chapter incremental persistence** (quét và lưu tăng dần theo từng chương), introduces a `'partial'` session status across `src/types/hakoChecker.ts`, updates `updateSessionChaptersAndIssues` in `src/hooks/useHakoReviewSession.ts` to support explicit lifecycle states, and adds a fail-safe sweep in the `catch` block so that no exit path ever discards collected issues. In the UI, sessions with status `'partial'` will display an informative banner indicating progress and render the Issue Review Panel so moderators can review all issues found before the run stopped.

## Technical Context

**Language/Version**: TypeScript 5.8+  
**Primary Dependencies**: React 19, Tailwind CSS v4, Lucide React (`ShieldCheck`, `RefreshCw`, `RotateCcw`, `AlertTriangle`, `X`), `clsx`, `tailwind-merge`  
**Storage**: IndexedDB (`HakoQualityCheckerDB` -> `hako_quality_sessions` store via `src/services/hakoSessionStore.ts`)  
**Testing**: Vitest (`npx vitest run`)  
**Target Platform**: Modern desktop web browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Single-Page Application (SPA) with decoupled client-side persistence  
**Performance Goals**: < 15ms per incremental chapter save, instantaneous (< 200ms) cancellation response  
**Constraints**:
- Strictly limited to modifying:
  - `src/components/hako-checker/HakoCheckerWorkspace.tsx`
  - `src/hooks/useHakoReviewSession.ts`
  - `src/types/hakoChecker.ts`
- Do not modify translation logic or backend services.
- Zero new NPM dependencies.
- Pass `npm run lint`, `npm test`, and `npm run build`.  
**Scale/Scope**: Up to 12 selected chapters per review batch.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Verification |
| :--- | :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | `npm run lint`, `npm test`, `npm run build` must all pass cleanly without skipping or disabling tests. | **PASS** | Verified current suite passes 328 tests. Will add unit tests for abort/partial persistence. |
| **II. Dependency Minimization** | Zero new dependencies added. Existing modules reused. | **PASS** | Reusing Lucide icons, React hooks, and existing store functions. |
| **III. Strict Concern Separation** | UI and hook session management only; no touching Gemini API translation pipeline in `server/` or `src/services/`. | **PASS** | Only editing workspace component, session hook, and checker types. |
| **IV. Immutable Core Schemas & Storage Stability** | Core `src/types.ts` and IndexedDB schemas unchanged. Vietnamese UI text preserved. | **PASS** | `src/types.ts` is untouched. Only `QualityReviewSession.status` in `src/types/hakoChecker.ts` is extended with `'partial'`. |
| **V. Atomic Commits & Sync** | Modular, small diff scoped strictly to the 3 permitted files. | **PASS** | Clean, targeted modifications. |

## Project Structure

### Documentation (this feature)

```text
specs/093-incremental-hako-persistence/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 architectural analysis
├── data-model.md        # Phase 1 data entities and state machine
├── contracts/           # Phase 1 interface contracts
│   └── hako-incremental-session.contract.md
├── quickstart.md        # Phase 1 verification and manual testing guide
└── checklists/
    └── requirements.md  # Quality verification checklist
```

### Source Code (repository root)

```text
src/
├── types/
│   └── hakoChecker.ts                              # [MODIFY] Add 'partial' to QualityReviewSession.status
├── hooks/
│   ├── useHakoReviewSession.ts                     # [MODIFY] Support status parameter in updateSessionChaptersAndIssues
│   └── __tests__/
│       └── useHakoReviewSession.test.ts            # [MODIFY] Add unit tests for incremental & partial cancellation
└── components/
    └── hako-checker/
        └── HakoCheckerWorkspace.tsx                # [MODIFY] Per-chapter scan loop, catch fail-safe sweep, partial UI banner
```

**Structure Decision**: Confined strictly to the 3 allowed files plus dedicated unit test additions in `src/hooks/__tests__/useHakoReviewSession.test.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. All principles pass cleanly.*

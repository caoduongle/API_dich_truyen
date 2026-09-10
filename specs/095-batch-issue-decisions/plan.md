# Implementation Plan: Batch Issue Decisions & Shared Connection Caching

**Branch**: `095-batch-issue-decisions` | **Date**: 2026-09-10 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/095-batch-issue-decisions/spec.md)

**Input**: Feature specification from `specs/095-batch-issue-decisions/spec.md`

## Summary

In `src/services/hakoSessionStore.ts`, `openDatabase()` is currently reopened on every read/write call rather than reusing a shared connection. Additionally, in `useHakoReviewSession.ts`, updating issue decisions only supports single-issue updates (`updateIssueDecision`), causing UI bulk actions ("Duyệt nhanh tất cả" / "Bỏ qua tất cả") in `HakoIssueReviewPanel.tsx` to loop `onDecisionChange`, firing 30–50 concurrent connection requests and full-session disk writes.

This plan introduces module-level IndexedDB connection caching in `hakoSessionStore.ts`, a dedicated bulk decision update function `updateMultipleIssueDecisions()` in `useHakoReviewSession.ts` that persists to IndexedDB exactly once, and wires this function to `HakoIssueReviewPanel.tsx` via `HakoCheckerWorkspace.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: Vitest, React, Lucide React  
**Storage**: IndexedDB (`HakoQualityCheckerDB`, store `hako_quality_sessions`)  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Browser / Client-side React Web App  
**Project Type**: Client-side library service & UI components  
**Performance Goals**: Reduce $N$ sequential IndexedDB open/write operations to 1 open/write operation ($O(1)$ disk transactions for batch confirmations of $N$ issues); fast in-memory Set lookup ($O(N)$ total).  
**Constraints**:
- Strictly limited to:
  - `src/services/hakoSessionStore.ts`
  - `src/hooks/useHakoReviewSession.ts`
  - `src/components/hako-checker/HakoIssueReviewPanel.tsx`
  - `src/components/hako-checker/HakoCheckerWorkspace.tsx`
  - `src/hooks/__tests__/useHakoReviewSession.test.ts`
- Do NOT touch `src/services/db.ts` or `src/types.ts`.
- Zero new NPM dependencies.
- Pass all quality gates (`npm run lint`, `npm test`, `npm run build`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Verification |
| :--- | :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | `npm run lint`, `npm test`, `npm run build` must pass cleanly without skipped tests. | **PASS** | Automated test suite passes; new test verifies batch execution and single-write persistence. |
| **II. Dependency Minimization** | No new NPM packages added. | **PASS** | Standard React hooks and native Set/IndexedDB methods. |
| **III. Strict Concern Separation** | UI and hook changes isolated to Hako Quality Review domain; translation pipeline and backend untouched. | **PASS** | Strictly bounded to the 4 specified files. |
| **IV. Immutable Core Schemas** | No changes to `src/types.ts` or IndexedDB schema versions. | **PASS** | QualityIssue and QualityReviewSession schemas remain 100% intact. |
| **V. Atomic Commits & Sync** | Minimal, reviewable diff. | **PASS** | Targeted edits. |

## Project Structure

### Documentation (this feature)

```text
specs/095-batch-issue-decisions/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions & connection lifecycle
├── data-model.md        # Data entities & mutation flow
├── contracts/           # Interface contracts
│   └── batch-decision-store.contract.md
├── quickstart.md        # Verification guide
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── services/
│   └── hakoSessionStore.ts                         # [MODIFY] Cache dbPromise at module level with onclose cleanup
├── hooks/
│   ├── useHakoReviewSession.ts                     # [MODIFY] Add updateMultipleIssueDecisions with single persistSession
│   └── __tests__/
│       └── useHakoReviewSession.test.ts            # [MODIFY] Unit tests for batch decisions & 1-time saveSession
└── components/
    └── hako-checker/
        ├── HakoIssueReviewPanel.tsx                # [MODIFY] Call onBatchDecisionChange in handleBatchConfirm/Dismiss
        └── HakoCheckerWorkspace.tsx                # [MODIFY] Pass updateMultipleIssueDecisions to HakoIssueReviewPanel
```

## Complexity Tracking

*No violations. All principles pass cleanly.*

# Implementation Plan: Direct Jump from Hako Checker to Translator Workspace

**Branch**: `106-open-in-translator-from-hako` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/106-open-in-translator-from-hako/spec.md`

## Summary

Enable direct navigation from the Hako Checker quality audit results into the Translator Workspace (BilingualEditor) to fix issues for a specific chapter. This is achieved by:
1. Threading an `onOpenInTranslator?: (chapterId: string) => void` callback prop through `HakoCheckerWorkspace` to `HakoIssueReviewPanel`.
2. Rendering a `"Mở trong Bàn Dịch để sửa"` action button for each chapter that has detected issues in the review results.
3. In `App.tsx`, implementing `handleOpenChapterFromHakoChecker(chapterId)` which fetches the chapter via `getChapterFromDB` (read-only from `db.ts`), reuses the existing `handleGoToTranslate(chapter)` callback, and presents error toasts via `useNotifications().showToast` if the chapter is missing.

## Technical Context

**Language/Version**: TypeScript 5.8+ / React 19 / Vite

**Primary Dependencies**: React 19, `lucide-react`, `motion`, `clsx`, `tailwind-merge` (all pre-installed, no new dependencies)

**Storage**: IndexedDB (read-only via `getChapterFromDB` in `src/services/db.ts`)

**Testing**: Vitest (`vitest run`), React Testing Library

**Target Platform**: Desktop & Mobile Web Browsers (Chrome, Edge, Firefox, Safari)

**Project Type**: Web Application (React SPA + Express Backend)

**Performance Goals**: Instant UI transition (< 100ms) from button click to Translator workspace

**Constraints**:
- Strictly limited to `src/components/hako-checker/HakoCheckerWorkspace.tsx` (and `HakoIssueReviewPanel.tsx`), and `src/App.tsx`.
- Must NOT edit `src/services/db.ts`.
- Must reuse existing `handleGoToTranslate(chapter)`.
- Quality gates: `npm run lint`, `npm test`, `npm run build` must all pass.

**Scale/Scope**: 2-3 files modified, 1-2 unit test suites updated/added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Notes |
|-----------|-------|--------|-------|
| **I. Strict Quality Gates & Verification** | `tsc --noEmit`, `vitest run`, `vite build` must pass | **PASS** | Verification plan includes all three commands |
| **II. Dependency Minimization** | No new NPM packages added | **PASS** | Uses existing Button, lucide icons, useNotifications |
| **III. Strict Concern Separation** | No changes to translation pipeline or Gemini server | **PASS** | Strictly frontend navigation wiring |
| **IV. Immutable Core Schemas & Storage Stability** | No schema mutation; read-only `getChapterFromDB` | **PASS** | No changes to `db.ts` or `types.ts` |
| **V. Atomic Commits & Modular Diffs** | Changes scoped to 2-3 specific UI files | **PASS** | Isolated diff covering HakoChecker and App.tsx |

## Project Structure

### Documentation (this feature)

```text
specs/106-open-in-translator-from-hako/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── hako-translator-nav.contract.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── App.tsx                                        # [MODIFY] handleOpenChapterFromHakoChecker + pass onOpenInTranslator
├── components/
│   └── hako-checker/
│       ├── HakoCheckerWorkspace.tsx              # [MODIFY] Add onOpenInTranslator prop & thread down
│       ├── HakoIssueReviewPanel.tsx              # [MODIFY] Render "Mở trong Bàn Dịch để sửa" for chapters with issues
│       └── __tests__/
│           └── HakoIssueReviewPanel.test.tsx     # [MODIFY] Unit tests for onOpenInTranslator button
```

**Structure Decision**: Standard React component and app structure, strictly conforming to the existing repository layout.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. All gates passed.*

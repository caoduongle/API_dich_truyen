# Implementation Plan: Hako Quality Checker Selection UX, Card Numbering & Error Visibility

**Branch**: `081-hako-checker-range-card-fixes` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from [`specs/081-hako-checker-range-card-fixes/spec.md`](./spec.md)

## Summary

Enhance the "Kiểm Định Hako" moderator workspace with:
1. `chapterNumber` propagation to `QualityIssue` data model and clear `#<chapterNumber> · <chapterTitle>` headers in `HakoIssueCard` and sorted Markdown reports.
2. Range-based chapter selection ("Từ chương" ... "Đến chương") with auto-swap and 12-chapter cap integration in `HakoChapterSelector`.
3. Single chapter quick-select by number with `Enter` key support, auto-clear for rapid consecutive typing, and transient 2-3s auto-dismissing "not found" inline notifications.
4. Error banner UI in `HakoCheckerWorkspace` to surface `useHakoReviewSession` limit/error states with a dismissible ("x") button.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `clsx`, `tailwind-merge`, `motion`, `lucide-react` (Zero new external dependencies)

**Storage**: IndexedDB (`HakoQualityCheckerDB`, `hako_quality_sessions` store)

**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)

**Target Platform**: Modern Desktop/Mobile Web Browsers (Chrome, Edge, Firefox, Safari)

**Project Type**: Single-page React Web Application with Node.js/Express backend

**Performance Goals**:
- Range chapter selection execution: <50ms for 100–500+ chapters
- Single chapter selection toggle: <16ms per keystroke/submission
- Issue card render: <16ms per card without layout thrashing

**Constraints**:
- Must not add new external NPM packages (Constitution Principle II)
- Must not alter `src/types.ts` core schema or `ZHONG_VIET_TRANSLATOR_DB` storage (Constitution Principle IV)
- Must maintain 100% test coverage with zero skipped or muted tests (Constitution Principle I)
- Must not modify core AI translation/polishing logic in backend or translation pipeline (Constitution Principle III)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- **Principle I (Strict Quality Gates & Verification)**: PASS. All changes verified by `npm run lint`, `npm test` (666+ tests), and `npm run build`.
- **Principle II (Dependency Minimization & Existing Library Reuse)**: PASS. Reuses existing primitives (`Button`, `Badge`, `Seal`, `cn`, `lucide-react`).
- **Principle III (Strict Concern Separation & Domain Boundary)**: PASS. Pure UI and client-side review session engine enhancements; backend AI translation pipeline is untouched.
- **Principle IV (Immutable Core Schemas & Storage Stability)**: PASS. Core schemas in `src/types.ts` remain unchanged; only moderator types in `src/types/hakoChecker.ts` are extended.
- **Principle V (Atomic Commits & Sync)**: PASS. Single focused feature branch.

## Project Structure

### Documentation (this feature)

```text
specs/081-hako-checker-range-card-fixes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── hako-selection-ux.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── hakoChecker.ts               # Add chapterNumber to QualityIssue
├── services/
│   ├── hakoQualityEngine.ts         # Propagate chapterNumber to QualityIssue and sort Markdown report
│   └── __tests__/
│       └── hakoQualityEngine.test.ts # Unit tests for chapterNumber propagation and sorted reports
├── components/
│   └── hako-checker/
│       ├── HakoChapterSelector.tsx  # Add range select & single chapter quick-select with transient feedback
│       ├── HakoCheckerWorkspace.tsx # Pass chapterNumber in handleStartAnalysis & render error banner
│       └── HakoIssueCard.tsx        # Format title as #<chapterNumber> · <chapterTitle>
```

## Complexity Tracking

*No violations. All design requirements comply with the Constitution.*

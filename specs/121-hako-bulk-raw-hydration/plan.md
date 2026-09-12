# Implementation Plan: Hako Bulk Raw Hydration

**Branch**: `121-hako-bulk-raw-hydration` | **Date**: 2026-09-12 | **Spec**: [specs/121-hako-bulk-raw-hydration/spec.md](spec.md)

**Input**: Feature specification from `specs/121-hako-bulk-raw-hydration/spec.md`

## Summary

Implement automatic project-wide raw Chinese hydration and a dedicated one-click "⚡ Nạp Raw toàn bộ" action button in the Hako Quality Checker (`HakoChapterSelector`, `useHakoReviewSession`, `HakoCheckerWorkspace`). This eliminates the requirement for users to manually click "+ Thêm Raw" on every single chapter card (e.g. across 139 chapters), automatically populating `rawChineseContent` from IndexedDB's `sourceText` via efficient batch querying (`getChaptersByProjectFromDB`).

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19  
**Primary Dependencies**: Vite, Tailwind CSS v4, Lucide React (`Zap`, `CheckCheck`, `Loader2`), `@google/genai`  
**Storage**: Client-side IndexedDB (`CHAPTERS_STORE` index on `projectId`) via `src/services/db.ts`  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Pure Client-Side SPA (no backend server)  
**Performance Goals**: Batch raw hydration for 150+ chapters completes in < 50ms without UI freezing  
**Constraints**:
- Must not alter existing IndexedDB schema or mutate `types.ts`.
- Must follow `.agents/rules/design-system.md` for styling (no generic AI colors, reuse `Button`, `Badge`).
- Must pass `npm run lint`, `npm test`, and `npm run build` cleanly.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must all pass cleanly. No tests disabled or skipped.
- **Principle II: Dependency Minimization**: Reusing existing `lucide-react` icons (`Zap`, `Loader2`, `CheckCheck`) and existing UI primitives (`Button`, `Badge`). No new npm packages.
- **Principle III: MVC Separation & Domain Boundaries**: Database queries reside in `src/services/db.ts`; state orchestration in `src/hooks/useHakoReviewSession.ts`; presentation in `src/components/hako-checker/`.
- **Principle IV: Immutable Core Schemas & Storage Stability**: Core `src/types.ts` remains intact. Existing `ProjectReviewChapter.rawChineseContent` and `Chapter.sourceText` are utilized.
- **Principle V: Atomic Commits & Documentation**: Focused strictly on bulk raw hydration in Hako Checker.

*Status: ALL GATES PASS.*

## Project Structure

### Documentation (this feature)

```text
specs/121-hako-bulk-raw-hydration/
├── plan.md              # This file
├── research.md          # Batch retrieval & dual hydration design decisions
├── data-model.md        # State lifecycle and BulkHydrationResult
├── quickstart.md        # Verification commands and manual test flow
├── contracts/
│   └── bulk-raw-hydration-contracts.md # Extended hook and component contracts
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── hooks/
│   ├── useHakoReviewSession.ts       # Eager project raw hydration on selectProject + hydrateAllChaptersRaw action
│   └── __tests__/
│       └── useHakoReviewSession.test.ts # Tests for auto and bulk hydration
├── components/
│   └── hako-checker/
│       ├── HakoChapterSelector.tsx   # Add "⚡ Nạp Raw toàn bộ" button, auto-hydration on mount, coverage indicator
│       ├── HakoCheckerWorkspace.tsx # Pass onHydrateAllRaw callback to chapter selector
│       └── __tests__/
│           └── HakoChapterSelector.test.tsx # Tests for toolbar button and batch badge updates
```

## Complexity Tracking

*No constitution violations.*

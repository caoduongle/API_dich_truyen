# Implementation Plan: Batch Draft Management and Light Theme Contrast Hardening

**Branch**: `122-batch-draft-actions-contrast` | **Date**: 2026-09-12 | **Spec**: [specs/122-batch-draft-actions-contrast/spec.md](spec.md)

**Input**: Feature specification from `/specs/122-batch-draft-actions-contrast/spec.md`

## Summary

Expand chapter batch selection controls in `ChapterHistoryPanel.tsx` by providing 4 bulk operations ("Reset về gốc", "Xóa biên tập", "Xóa bản thô", "Thành bản thô") for multiple chapters simultaneously, and harden typography contrast across Light, Sepia, and Dark themes so that warning/reset buttons achieve >= 4.5:1 WCAG AA contrast (eliminating unreadable pale yellow text on cream backgrounds).

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite 6  
**Primary Dependencies**: `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: IndexedDB (`src/services/db.ts`)  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Pure Client-Side SPA (Web / Browser)  
**Project Type**: Web Application  
**Performance Goals**: Instant client-side bulk updates across 100+ chapters (<500ms), zero render jank  
**Constraints**: Zero new external dependencies, no schema alterations to IndexedDB, full WCAG AA contrast compliance  
**Scale/Scope**: `ChapterHistoryPanel.tsx` and unit tests in `src/components/__tests__/ChapterHistoryPanel.test.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Strict Quality Gates)**: Pass. `npm run lint`, `npm test`, and `npm run build` must pass with 0 errors.
- **Principle II (Dependency Minimization)**: Pass. Reuses existing Lucide icons (`RotateCcw`, `FileX`, `Trash2`, `Sparkles`), `useNotifications`, and `Button` primitives. Zero new packages.
- **Principle III (MVC Domain Boundary)**: Pass. Pure transformation functions remain decoupled, UI state handled in component, storage calls through `src/services/db.ts`.
- **Principle IV (Immutable Core Schemas)**: Pass. `Chapter` and `StoryProject` table schemas remain unchanged.
- **Principle V (Design System Fidelity)**: Pass. Replaces hardcoded light yellow with theme-adaptive amber/ochre (`text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/40 hover:bg-amber-100/60 dark:hover:bg-amber-950/20`), preserving the "Mực & Chu Sa" aesthetic.

## Project Structure

### Documentation (this feature)

```text
specs/122-batch-draft-actions-contrast/
├── plan.md              # Implementation plan
├── research.md          # Phase 0 research findings
├── data-model.md        # State transitions & data structures
├── quickstart.md        # Runnable validation scenarios
└── contracts/           # Interface and styling contracts
    └── batch-draft.contract.md
```

### Source Code (repository root)

```text
src/
└── components/
    ├── ChapterHistoryPanel.tsx           # [MODIFY] Add batch actions toolbar & theme-adaptive styling
    └── __tests__/
        └── ChapterHistoryPanel.test.ts   # [MODIFY] Add tests for batch operations & transformations
```

## Structure Decision

All UI changes are self-contained in `src/components/ChapterHistoryPanel.tsx`, maintaining pure client-side SPA conventions and strict MVC component boundaries.

## Complexity Tracking

*No constitution violations.*


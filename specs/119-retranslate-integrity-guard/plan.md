# Implementation Plan: Retranslate Integrity Guard and Safe Draft Preservation

**Branch**: `119-retranslate-integrity-guard` | **Date**: 2026-09-12 | **Spec**: [specs/119-retranslate-integrity-guard/spec.md](spec.md)

**Input**: Feature specification from `/specs/119-retranslate-integrity-guard/spec.md`

## Summary

Enforce true "From Scratch" re-translation semantics in `chapterTranslationService.ts`, introduce an automated Draft Integrity Guard heuristic (`isDraftTruncated`) to detect and reject cut-off or corrupted candidate drafts, isolate Phase 2 input drafts from Phase 2 outputs, introduce a dedicated `repolish` mode, and add granular draft management buttons ("Xóa bản biên tập", "Xóa bản dịch thô", "Chuyển thành bản thô") to `ChapterHistoryPanel.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite 6  
**Primary Dependencies**: `@google/genai` client SDK, `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: IndexedDB (`src/services/db.ts`)  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Pure Client-Side SPA (Web / Browser)  
**Project Type**: Web Application  
**Performance Goals**: Instant client-side heuristic evaluation (<1ms), atomic IndexedDB persistence  
**Constraints**: Zero new external dependencies, preserve IndexedDB schemas, clean `npm run lint` and `npm test`  
**Scale/Scope**: 5 files modified (`chapterTranslationService.ts`, `ChapterHistoryPanel.tsx`, `useTranslationProcess.ts`, `TranslationConfigPanel.tsx`, `AutoTranslator.tsx`), test suites updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Strict Quality Gates)**: Pass. `npm run lint`, `npm test`, and `npm run build` will be executed and must pass cleanly.
- **Principle II (Dependency Minimization)**: Pass. Reuses existing Lucide icons (`Trash2`, `RotateCcw`, `FileX`, `FileText`, `Sparkles`), `useNotifications`, and `Button` primitives. Zero new packages.
- **Principle III (MVC Domain Boundary)**: Pass. Business logic and heuristics in `src/services/chapterTranslationService.ts`, state hooks in `src/hooks/`, UI components in `src/components/ChapterHistoryPanel.tsx` and `src/components/auto-translator/`. No cross-boundary violations.
- **Principle IV (Immutable Core Schemas)**: Pass. `Chapter` and `StoryProject` table schemas unchanged.
- **Principle V (Atomic Commits & Sync)**: Pass. Scoped specifically to draft integrity and lifecycle management.

## Project Structure

### Documentation (this feature)

```text
specs/119-retranslate-integrity-guard/
├── plan.md              # Implementation plan
├── research.md          # Phase 0 research findings
├── data-model.md        # State machines & data flow
├── quickstart.md        # Validation scenarios
└── contracts/           # Interface contracts
    └── draft-lifecycle.contract.md
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── chapterTranslationService.ts      # [MODIFY] Enforce from_scratch, add isDraftTruncated & repolish logic
│   └── __tests__/
│       └── chapterTranslationService.test.ts # [MODIFY] Tests for true re-translation & integrity guard
├── components/
│   ├── ChapterHistoryPanel.tsx           # [MODIFY] Add Xóa bản biên tập, Xóa bản dịch thô, Chuyển thành bản thô
│   └── auto-translator/
│       └── TranslationConfigPanel.tsx    # [MODIFY] Add 'repolish' mode button
└── hooks/
    ├── useTranslationProcess.ts          # [MODIFY] Support 'repolish' in prepareQueue
    └── useAutoTranslationQueue.ts        # [MODIFY] AutoTranslateMode type support
```

## Structure Decision

All changes strictly follow the pure client-side SPA structure with MVC separation between `services`, `hooks`, and `components`.

## Complexity Tracking

*No constitution violations.*

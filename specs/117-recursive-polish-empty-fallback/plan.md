# Implementation Plan: Recursive Divide & Conquer Polish and Empty Response Resilience

**Branch**: `117-recursive-polish-empty-fallback` | **Date**: 2026-09-12 | **Spec**: [specs/117-recursive-polish-empty-fallback/spec.md](spec.md)

**Input**: Feature specification from `/specs/117-recursive-polish-empty-fallback/spec.md`

## Summary

Restore the recursive divide-and-conquer strategy (`polishWithContentSplitDirect`) in `directTranslationEngine.ts` when encountering empty AI responses or content safety blocks. In `chapterTranslationService.ts`, introduce prior-round result preservation during multi-round iterative polishing so that if a later round (e.g. Round 3) fails with an empty response, the high-quality text from the prior successful round is preserved and the chapter is successfully completed rather than aborted. Fix the final queue summary status check in `useTranslationProcess.ts`.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node 20+, React 19, Vite 6
**Primary Dependencies**: `@google/genai` client SDK, `lucide-react`, `clsx`, `tailwind-merge`
**Storage**: IndexedDB (`src/services/db.ts`)
**Testing**: Vitest (`npm test`)
**Target Platform**: Pure Client-Side SPA (Web / Browser)
**Project Type**: Web Application
**Performance Goals**: Sub-second leaf fallback resolution, bounded recursive depth (max 2 levels)
**Constraints**: Zero new external dependencies, preserve existing IndexedDB schemas, clean `npm run lint` and `npm test`
**Scale/Scope**: 3 files modified (`directTranslationEngine.ts`, `chapterTranslationService.ts`, `useTranslationProcess.ts`), unit test suites updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Strict Quality Gates)**: Pass. All modifications will be validated with `npm run lint`, `npm test`, and `npm run build`.
- **Principle II (Dependency Minimization)**: Pass. Reuses existing `splitTextAdaptively`, `ensureChapterTitlePreserved`, `estimateTokenCount` in `src/lib/text.ts`. Zero new packages.
- **Principle III (MVC Domain Boundary)**: Pass. Changes are strictly confined to Services (`src/services/`) and Hooks (`src/hooks/useTranslationProcess.ts`). No component UI styling modified.
- **Principle IV (Immutable Core Schemas)**: Pass. `StoryProject`, `Chapter`, and IndexedDB tables unchanged.
- **Principle V (Atomic Commits & Sync)**: Pass. Targeted change for empty response resilience.

## Project Structure

### Documentation (this feature)

```text
specs/117-recursive-polish-empty-fallback/
├── plan.md              # Implementation plan
├── research.md          # Phase 0 research findings
├── data-model.md        # State machines & data flow
├── quickstart.md        # Validation scenarios
└── contracts/           # Interface contracts
    └── translation-resilience.contract.md
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── directTranslationEngine.ts      # [MODIFY] Add recursive polishWithContentSplitDirect
│   ├── chapterTranslationService.ts    # [MODIFY] Add prior-round fallback preservation in polish loop
│   └── __tests__/
│       ├── directTranslationEngine.test.ts   # [MODIFY] Add tests for recursive split on empty error
│       └── chapterTranslationService.test.ts # [MODIFY] Add tests for round 3 empty response fallback
└── hooks/
    └── useTranslationProcess.ts        # [MODIFY] Fix final queue summary check with local allFailedIds
```

## Structure Decision

All changes align with pure client-side SPA structure under `src/services/` and `src/hooks/`.

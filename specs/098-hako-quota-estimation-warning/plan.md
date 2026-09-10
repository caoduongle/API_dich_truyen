# Implementation Plan: Hako Checker AI Quota Estimation & Advisory Warning

**Branch**: `098-hako-quota-estimation-warning` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/098-hako-quota-estimation-warning/spec.md`

## Summary

Enhance the chapter selection screen (`HakoChapterSelector.tsx`) in the Hako Quality Checker by:
1. Adding an AI API call estimate tag `"~N lượt gọi AI"` next to the action button when $N$ chapters are selected (verified: 1 chapter = 1 Gemini call in `runAiQualityScan`).
2. Querying client-side quota and health states from `localQuotaTracker.ts` and presenting an unobtrusive, non-blocking amber advisory warning if available quota is depleted or insufficient.
3. Ensuring the Start Analysis button is NEVER blocked or disabled by the advisory warning, preserving full reviewer autonomy.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19  
**Primary Dependencies**: `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: Client-side `sessionStorage` / `localStorage` (via `localQuotaTracker.ts` and `useAIConfig`)  
**Testing**: Vitest (`@testing-library/react`)  
**Target Platform**: Modern Desktop Browsers (Chrome, Edge, Firefox)  
**Project Type**: Web Application (React SPA)  
**Performance Goals**: Instant synchronous update ($< 1$ms) upon selection change without extra network calls  
**Constraints**:
- Strictly modify ONLY `src/components/hako-checker/HakoChapterSelector.tsx` (and add unit tests).
- Do NOT touch `localQuotaTracker.ts` or `hakoQualityEngine.ts`.
- Warning MUST use established design tokens (`text-amber-300`, `bg-amber-950/30`, `border-amber-800/50`).
- Warning MUST NOT disable the Start Analysis button.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: Will pass `npm run lint`, `npm test`, `npm run build`.
- [x] **II. Dependency Minimization**: Reuses existing `localQuotaTracker`, `lucide-react`, `Button`, `Badge`. No new dependencies.
- [x] **III. Strict Concern Separation**: UI only in `HakoChapterSelector.tsx`. No edits to backend, API pipeline, or DB schemas.
- [x] **IV. Immutable Core Schemas**: No changes to `types.ts` or IndexedDB.
- [x] **V. Atomic Commits & Documentation**: Contained in single component and feature spec.

## Project Structure

### Documentation (this feature)

```text
specs/098-hako-quota-estimation-warning/
├── plan.md              # Implementation plan
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model & state specifications
├── quickstart.md        # Phase 1 quickstart & verification guide
├── contracts/           # Phase 1 interface contracts
│   └── chapter-selector-quota-advisory.contract.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
└── components/
    └── hako-checker/
        ├── HakoChapterSelector.tsx               # [MODIFY] Render estimate & advisory warning
        └── __tests__/
            └── HakoChapterSelector.test.tsx      # [NEW] Unit tests for estimation and advisory warning
```

**Structure Decision**: Single React component enhancement with co-located unit test suite in `__tests__/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | Fully compliant with constitution and design system |

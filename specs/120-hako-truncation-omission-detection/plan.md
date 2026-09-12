# Implementation Plan: Hako Truncation and Omission Detection

**Branch**: `120-hako-truncation-omission-detection` | **Date**: 2026-09-12 | **Spec**: [specs/120-hako-truncation-omission-detection/spec.md](spec.md)

**Input**: Feature specification from `specs/120-hako-truncation-omission-detection/spec.md`

## Summary

Enhance the Hako Quality Inspection subsystem (`hakoQualityEngine`, `HakoCheckerWorkspace`, `HakoChapterSelector`) to deterministically catch and report truncated chapters, severe omissions, and missing text. This resolves the issue where a chapter with only 80 words (missing 90%+ of its content) slipped through with "Tổng 0 lỗi". Additionally, fulfill the promised auto-hydration of original Chinese text (`sourceText`) in the raw editing modal so the textarea is never empty ("Chưa có dữ liệu") when source text exists in IndexedDB.

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19  
**Primary Dependencies**: Vite, Tailwind CSS v4, Lucide React, `@google/genai` (direct client SDK)  
**Storage**: Client-side IndexedDB (`CHAPTERS_STORE`, `PROJECTS_STORE`) via `src/services/db.ts`  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Pure Client-Side SPA (no backend server)  
**Performance Goals**: Deterministic heuristic scan runs synchronously in < 2ms per chapter; raw modal lazy-loads in < 10ms  
**Constraints**:
- Must not alter existing translation algorithms or IndexedDB schema without explicit justification.
- Must pass `npm run lint`, `npm test`, and `npm run build` cleanly.
- Vietnamese labels and UI style must adhere to `.agents/rules/design-system.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must all pass cleanly. No tests will be skipped or deleted.
- **Principle II: Dependency Minimization**: No new npm dependencies will be added. Existing primitives (`lucide-react`, `Button`, `Badge`, `Seal`) are reused.
- **Principle III: MVC Separation & Domain Boundaries**: Heuristic and AI logic resides strictly in `src/services/hakoQualityEngine.ts`. Component state stays in `src/components/hako-checker/` and `src/hooks/useHakoReviewSession.ts`.
- **Principle IV: Immutable Core Schemas & Storage Stability**: Core schema in `src/types.ts` remains intact. Existing `QualityIssueCategory` already includes `'omission'`.
- **Principle V: Atomic Commits & Documentation**: Clear, single-feature scope targeting only Hako omission detection and raw hydration.

*Status: ALL GATES PASS.*

## Project Structure

### Documentation (this feature)

```text
specs/120-hako-truncation-omission-detection/
├── plan.md              # This file
├── research.md          # Technical decisions and root cause analysis
├── data-model.md        # QualityIssue and ProjectReviewChapter entities
├── quickstart.md        # Test commands and manual verification flows
├── contracts/
│   └── quality-inspection-contracts.md # Signatures for heuristic & AI inspection
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── hakoQualityEngine.ts         # Add length/ratio heuristic checks & loosen schema for omission
│   └── __tests__/
│       └── hakoQualityEngine.test.ts # Unit tests for omission detection
├── components/
│   └── hako-checker/
│       ├── HakoChapterSelector.tsx   # Auto-load sourceText from DB when opening raw modal & update badges
│       ├── HakoCheckerWorkspace.tsx # Pass rawChineseContent to heuristic scan & persist hydrated raw
│       └── __tests__/
│           └── HakoChapterSelector.test.tsx # Tests for raw modal loading
```

**Structure Decision**: Standard single SPA layout. Modifications limited strictly to Hako inspection components and services.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitution violations.*

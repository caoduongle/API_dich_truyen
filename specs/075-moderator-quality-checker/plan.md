# Implementation Plan: Moderator Project Quality Checker Workspace

**Branch**: `075-moderator-quality-checker` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/075-moderator-quality-checker/spec.md` (updated for direct project integration).

## Summary

Refactor the Moderator Quality Checker Workspace to inspect chapters directly from the user's existing translation projects (`StoryProject` and `Chapter` entities) instead of scraping Hako/Docln via URL proxies. The workspace enables moderators to select a translation project, choose up to 12 translated chapters, automatically bind `sourceText` as the raw Chinese text and `polishedTranslation` / `rawTranslation` as the Vietnamese translation, run hybrid rule-based heuristic checks alongside AI semantic critique, record persistent decisions (Confirm / Review Needed / Dismiss) in an isolated session store, and export structured Markdown reports for translators. All server-side scraping routes, controllers, and services are completely removed.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 22+, React 19  
**Primary Dependencies**: Express 4, Vite 6, Tailwind CSS v4, `clsx`, `tailwind-merge`, `lucide-react`, `motion`  
**Storage**: IndexedDB (`hako_quality_sessions` in `HakoQualityCheckerDB`), isolated from the main translation project stores  
**Testing**: `vitest run`, `tsc --noEmit`, `vite build`  
**Target Platform**: Modern Web Browsers + Node.js backend  
**Project Type**: Full-stack web application (React frontend + Express backend)  
**Performance Goals**: <0.5s chapter list load (local memory), <60s 12-chapter heuristic + AI analysis  
**Constraints**:
- Zero network web scraping / zero third-party dependencies on Hako/Docln.
- Read-only consumption of `StoryProject` and `Chapter` data; zero schema modifications to `src/types.ts` or `src/services/db.ts`.
- Reuses existing Gemini API keys & model configuration from `AIConfigContext`.
- Maximum 12 chapters per review batch.

## Constitution Check

*GATE: All principles evaluated and satisfied.*

| Principle | Status | Evaluation |
|---|---|---|
| **I. Strict Quality Gates** | PASS | All changes will pass `tsc --noEmit`, `vitest run`, and `vite build`. No tests skipped. |
| **II. Dependency Minimization** | PASS | No new npm packages. Reduces code complexity by removing unused scraper logic. |
| **III. Strict Concern Separation** | PASS | Quality checking logic isolated in `src/components/hako-checker/` and `src/services/hakoQualityEngine.ts`. Read-only consumption of projects. |
| **IV. Immutable Core Schemas** | PASS | No changes to `Chapter`, `StoryProject`, or existing IndexedDB stores. Reviews persisted in separate `HakoQualityCheckerDB`. |
| **V. Atomic Commits & Docs** | PASS | Full specification, data model, contracts, and quickstart documentation. |

## Project Structure

### Documentation (this feature)

```text
specs/075-moderator-quality-checker/
├── spec.md              # Feature specification
├── plan.md              # This file (Speckit implementation plan)
├── research.md          # Architectural decisions (direct project integration)
├── data-model.md        # Entities & schemas
├── quickstart.md        # Validation scenarios
├── contracts/           # Component & service contracts
│   ├── quality-checker-service.contract.md
│   ├── moderator-ui.contract.md
│   └── hako-api.contract.md (deprecated & removed)
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code Layout

```text
server/
├── routes/
│   ├── api.ts                           # [MODIFY] Remove /hako route mount
│   └── hako.ts                          # [DELETE] Removed scraping route
├── controllers/
│   └── hakoController.ts                # [DELETE] Removed scraping controller
├── services/
│   └── hakoScraperService.ts            # [DELETE] Removed scraping service
└── __tests__/
    └── hakoScraper.test.ts              # [DELETE] Removed scraper unit tests

src/
├── types/
│   └── hakoChecker.ts                   # [MODIFY] Update types for ProjectReviewChapter & QualityReviewSession
├── services/
│   ├── hakoApiService.ts                # [DELETE] Removed client scraping service
│   ├── hakoQualityEngine.ts             # [RETAIN/ADAPT] Heuristic scans + Gemini AI semantic analysis
│   └── hakoSessionStore.ts              # [RETAIN/ADAPT] Persistent IndexedDB store for review sessions
├── hooks/
│   └── useHakoReviewSession.ts          # [MODIFY] Project-based session state & chapter loading
├── components/
│   └── hako-checker/
│       ├── HakoCheckerWorkspace.tsx     # [MODIFY] Main container consuming ProjectContext & projects
│       ├── HakoChapterSelector.tsx      # [MODIFY] Project dropdown + Chapter selector (1-12 limit) with raw drawers
│       ├── HakoNovelImporter.tsx        # [DELETE] Removed URL scraping importer
│       ├── HakoIssueReviewPanel.tsx     # [RETAIN] Issue list, filters & decision actions
│       ├── HakoIssueCard.tsx            # [RETAIN] Single issue card with snippets, raw diff, notes
│       └── HakoReportExportModal.tsx    # [RETAIN] Report summary stats & formatted Markdown export
└── App.tsx                              # [RETAIN] "Kiểm Định Hako" tab (Alt+6) passing projects & AI config
```

## Complexity Tracking

*No violations to justify.*

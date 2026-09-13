# Implementation Plan: Prevent Source and Raw Translation Data Loss

**Branch**: `129-prevent-source-raw-loss` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/129-prevent-source-raw-loss/spec.md`

## Summary

Resolve the issue where original Chinese text (`sourceText`) and raw translation drafts (`rawTranslation`) were being wiped during translation, polishing, live editing, and quality audit workflows. The technical approach fixes the collaborative editing auto-save flaw in `useChapterCRDT.ts`, adds session hydration on chapter selection, routes translation engine completions to CRDT-aware setters in `useWorkspaceState.ts`, fixes nullish coalescing in `crdtDocManager.ts`, adds a defensive integrity guard in `saveChapterToDB` (`src/services/db.ts`), and adds a recovery action for damaged chapters in `ChapterHistoryPanel.tsx`.

## Technical Context

**Language/Version**: TypeScript 5.7+, React 19, Vite 6  
**Primary Dependencies**: `yjs` (v13), `y-indexeddb` (v9), `@google/genai`, `lucide-react`, `clsx`, `tailwind-merge`, `motion`  
**Storage**: Client-side IndexedDB (`CHAPTERS_STORE`, `PROJECTS_STORE`, `CRDT_STATES_STORE`, `HAKO_SESSIONS_STORE`)  
**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)  
**Target Platform**: Modern web browsers (desktop & mobile responsive)  
**Project Type**: Pure Client-side SPA  
**Performance Goals**: Debounced auto-save < 500ms, non-blocking asynchronous hydration, database writes < 50ms  
**Constraints**: Pure client-side operation, strict adherence to MVC boundaries, zero new NPM packages  
**Scale/Scope**: Projects containing hundreds of chapters (e.g. 139+ chapters as shown in user data)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Compliance Status | Notes |
|---|---|---|---|
| **I. Quality Gates** | `npm run lint`, `npm test`, `npm run build` must pass cleanly | PASSED | Full test coverage for guards and hooks will be added |
| **II. Dependency Minimization** | Zero new dependencies | PASSED | Reuses existing `yjs`, `y-indexeddb`, `lucide-react` |
| **III. MVC Boundaries** | Services (Model), Hooks (Controller), Components (View) separated | PASSED | Storage logic in `db.ts`, CRDT in `crdtDocManager.ts` & `useChapterCRDT.ts`, UI in `ChapterHistoryPanel.tsx` |
| **IV. Storage Stability** | Core schema in `types.ts` immutable; Vietnamese labels preserved | PASSED | No schema mutations; existing labels preserved |
| **V. Atomic Commits & Sync** | Modular diff, docs synchronized with codebase | PASSED | All spec, plan, and research artifacts maintained |

## Project Structure

### Documentation (this feature)

```text
specs/129-prevent-source-raw-loss/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── storage-guard-contract.md
│   └── crdt-lifecycle-contract.md
├── checklists/
│   └── requirements.md  # Requirements validation checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - to be created)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── db.ts                          # [MODIFY] Add safeguard against blanking sourceText/rawTranslation
│   └── crdtDocManager.ts              # [MODIFY] Fix nullish coalescing in mergeChapterCrdt
├── hooks/
│   ├── useChapterCRDT.ts              # [MODIFY] Add existing chapter merge in debouncedSaveToDb & hydration
│   └── useWorkspaceState.ts           # [MODIFY] Route translation completions through CRDT setters
├── components/
│   └── ChapterHistoryPanel.tsx        # [MODIFY] Visual indicator & safe restore action for corrupted chapters
└── __tests__/
    ├── services/
    │   └── dbSafeguard.test.ts        # [NEW] Unit test verifying storage guard prevents empty overwrites
    └── hooks/
        └── useChapterCRDTPreservation.test.ts # [NEW] Test verifying auto-save preserves all text stages
```

**Structure Decision**: Standard single-project structure adhering strictly to the project's established MVC client-side architecture.

## Implementation Steps

### Step 1: Storage Layer Safeguard (`src/services/db.ts`)
- In `saveChapterToDB(chapter: Chapter)`:
  - Before calling `store.put(chapter)`, retrieve existing chapter: `const existing = store.get(chapter.id)`.
  - If `existing` has non-empty `sourceText` and incoming `chapter.sourceText` is empty or missing, retain `existing.sourceText`.
  - If `existing` has non-empty `rawTranslation` and incoming `chapter.rawTranslation` is undefined or missing, retain `existing.rawTranslation`.
  - Log a console warning when the safeguard triggers.
- In `saveChaptersToDB(chapters: Chapter[])`:
  - Apply the same preservation checks across batch transactions.

### Step 2: CRDT Auto-Save Merging & Hydration (`src/hooks/useChapterCRDT.ts`)
- In `debouncedSaveToDb`:
  - Fetch `existing = await getChapterFromDB(chapId)`.
  - Merge the Y.Doc snapshot onto `existing` so `sourceText` and `rawTranslation` are never overwritten with empty values.
- In the session initialization `useEffect`:
  - Add asynchronous hydration: if `initialChapter` is null or lacks `sourceText`, fetch `getChapterFromDB(chapterId)` and seed `rawText`, `polishedText`, and `metadataMap` inside a transaction.
- In `updateMetadata`:
  - Add support for updating `sourceText`.

### Step 3: Translation Dispatch to CRDT (`src/hooks/useWorkspaceState.ts`)
- In `handleTranslateRaw`:
  - Use `handleRawTranslationChange(data.rawTranslation)` instead of standalone `setRawTranslation(...)`.
- In `handlePolishTranslation`:
  - Use `handlePolishedTranslationChange(polishedResult)` instead of standalone `setPolishedTranslation(...)`.
- In `handleLoadChapterById`:
  - Seed or sync the selected chapter's metadata and text to CRDT.

### Step 4: CRDT Merge Nullish Fix (`src/services/crdtDocManager.ts`)
- Replace `snapshot.rawTranslation ?? ...` with non-empty string check `(snapshot.rawTranslation && snapshot.rawTranslation.trim()) || ...`.
- Apply same fix for `polishedTranslation`.

### Step 5: History Panel Recovery Action (`src/components/ChapterHistoryPanel.tsx`)
- Detect chapters where `!chap.sourceText` or `!chap.rawTranslation`.
- Add an action button "Bổ sung bản gốc" to allow users to supply or re-paste the missing source text, saving it directly to DB without touching completed translations.

### Step 6: Automated Verification & Test Suite
- Write unit tests in `src/services/__tests__/dbSafeguard.test.ts` and `src/hooks/__tests__/useChapterCRDTPreservation.test.ts`.
- Run `npm run lint`, `npm test`, and `npm run build` to ensure clean verification.

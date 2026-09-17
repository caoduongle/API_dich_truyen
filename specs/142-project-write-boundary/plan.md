# Implementation Plan: Project Write Boundary Serialization & Quota Error Isolation

**Branch**: `142-project-write-boundary` | **Date**: 2026-09-17 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/142-project-write-boundary/spec.md`

## Summary

This plan hardens the project-level storage write boundary and isolates non-credential errors:
1. **Queue Serialization Across All Project Child Writes**: Route `saveChapterToDB`, `saveChaptersToDB`, `saveCrdtState`, and `saveCrdtStates` through `projectWriteChains.get(projectId)` alongside `saveProjectToDB`, `atomicSaveProjectBundle`, and `deleteProjectFromDB`.
2. **Orphan Chapter / Child Resurrection Guard**: Enforce parent project existence check in IndexedDB before executing chapter or CRDT writes, cleanly aborting writes for deleted projects.
3. **Gemini 404 Quota Health Isolation**: Omit `recordFailure()` on API keys when receiving HTTP 404 (`RESOURCE_NOT_FOUND`), preventing skew of key error statistics or false circuit breaker trips while maintaining immediate fail-fast behavior.
4. **Cross-Tab Project Write Serialization**: Provide `withProjectLock(projectId, fn)` leveraging browser `navigator.locks` with graceful in-memory fallback.

## Technical Context

**Language/Version**: TypeScript 5.8+, ECMAScript 2022+  
**Primary Dependencies**: React 19, Vite 6, Tailwind v4, Lucide React, IndexedDB (Native), Web Locks API (`navigator.locks`)  
**Storage**: Client-side IndexedDB (`novel_translator_db`: `projects`, `chapters`, `crdt_states`)  
**Testing**: Vitest v4.1+ (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Modern Evergreen Web Browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Pure Client-Side Single Page Application (SPA)  
**Performance Goals**: Sub-millisecond queue dispatch, zero UI freeze, 100% memory reclamation for settled write chains  
**Constraints**: Zero new NPM dependencies, no changes to `src/types.ts` schemas, offline-first client architecture  
**Scale/Scope**: Support 50+ chapters per project, multiple concurrent tabs, hundreds of auto-save microtasks  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Strict Quality Gates**: Verified that `npm run lint`, `npm test`, and `npm run build` will be executed and must pass with 0 errors.
- [x] **Principle II: Dependency Minimization**: Zero new NPM dependencies. Utilizes native `navigator.locks` and native ES6 `Promise` chaining.
- [x] **Principle III: MVC & Domain Separation**: Service logic strictly confined to `src/services/db.ts` and `src/services/gemini/geminiClient.ts`. No service logic leaking into components.
- [x] **Principle IV: Immutable Core Schemas**: No changes to `src/types.ts` interfaces or IndexedDB store schema structures.
- [x] **Principle V: Atomic Commits & Documentation**: Strict 1:1 documentation sync with contracts and specification.

## Project Structure

### Documentation (this feature)

```text
specs/142-project-write-boundary/
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical analysis & decisions
├── data-model.md        # Storage schema & serialization boundary mappings
├── quickstart.md        # Developer guide & test verification steps
├── contracts/           # Interface definitions & queue contracts
│   └── projectWriteQueueContract.ts
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Actionable task list (created via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── db.ts                                  # Extended projectWriteChains to chapter & CRDT writes, parent check, Web Locks
│   ├── gemini/
│   │   ├── geminiClient.ts                    # Skip recordFailure on HTTP 404 RESOURCE_NOT_FOUND
│   │   └── __tests__/
│   │       └── geminiClient.test.ts           # Unit tests verifying key health remains clean on 404
│   └── __tests__/
│       └── projectDeleteQueue.test.ts         # Comprehensive tests for concurrent chapter save vs project delete
```

## Proposed Changes by Component

### 1. Unified Project Write Boundary & Tombstone Guard (`src/services/db.ts`)
- Implement `withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T>` using `navigator.locks.request` when available.
- Refactor `saveChapterToDB(chapter)`:
  - If `chapter.projectId` is absent, resolve it by reading existing chapter from `CHAPTERS_STORE`.
  - Queue execution under `projectWriteChains.get(projectId)`.
  - Inside the transaction, query `PROJECTS_STORE.get(projectId)`. If null/undefined, abort write cleanly (no-op).
  - Attach `.finally()` to clean up map entry.
- Refactor `saveChaptersToDB(chapters)`:
  - Group chapters by `projectId`.
  - Queue each group under its respective `projectWriteChains.get(projectId)`.
  - Inside the transaction, verify parent project exists.
- Refactor `saveCrdtState(record)` and `saveCrdtStates(records)`:
  - Group by `record.projectId` and queue under `projectWriteChains.get(record.projectId)`.
  - Verify parent project exists before persisting.

### 2. Gemini 404 Non-Credential Quota Semantics (`src/services/gemini/geminiClient.ts`)
- In `executeLogicalGeminiCall()`:
  - Upon receiving HTTP 404 or `classified.category === 'RESOURCE_NOT_FOUND'`:
  - Tag `lastError` with `code = 'RESOURCE_NOT_FOUND'` and `status = 404`.
  - **Omit** `localQuotaTracker.recordFailure()` call for this attempt so key health (`errorsTotal`, `consecutiveErrors`) is not incremented.
  - Throw `lastError` immediately.
  - The outer `callGemini()` wrapper still invokes `localQuotaTracker.recordLogicalFailure()`, accurately recording the logical request failure without harming the API key.

## Verification Plan

### Automated Tests
```bash
# 1. Type checking (must be 100% error-free)
npm run lint

# 2. Focused Vitest runs:
npx vitest run src/services/__tests__/projectDeleteQueue.test.ts
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts

# 3. Full test suite:
npm test

# 4. Production build:
npm run build
```

### Manual Verification
- Verify in browser devtools: when deleting a project while auto-save is actively writing a chapter, the IndexedDB `chapters` store has 0 records remaining for that project.
- Verify in API Settings: triggering a request with an invalid/non-existent model results in immediate error display, but the API key's error counter does not increment and health stays green.


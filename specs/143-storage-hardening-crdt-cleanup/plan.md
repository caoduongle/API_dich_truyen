# Implementation Plan: CRDT Storage Cleanup, Fail-Closed Chapter Safeguard, and Transaction Durability Hardening

**Branch**: `143-storage-hardening-crdt-cleanup` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/143-storage-hardening-crdt-cleanup/spec.md`

## Summary

Harden client-side persistence boundaries by:
1. Purging all dedicated `y-indexeddb` databases (`crdt_${projectId}_${chapterId}`) upon `deleteProjectFromDB` via chapter ID query and browser database enumeration (`indexedDB.databases()`).
2. Enforcing a strict Fail-Closed policy in `saveChapterToDB` to abort saving unparented chapters lacking `projectId`, while injecting valid `projectId` in Google Drive sync workflows.
3. Shifting resolution of write transactions (`executeSaveChapterToDB`, `executeSaveChaptersToDB`, `executeSaveCrdtState`, `executeSaveCrdtStates`, `executeDeleteCrdtStatesByProject`) strictly to `transaction.oncomplete`, ensuring ACID disk durability before releasing locks and write queues.
4. Wrapping `withProjectLock` lock acquisition in `withRetry` with exponential backoff to handle transient contention or browser context interruptions.

## Technical Context

**Language/Version**: TypeScript 5.8+ / ES2022
**Primary Dependencies**: React 19, Vite, yjs, y-indexeddb, @google/genai
**Storage**: Client-side IndexedDB (`novel_translator_db` and dedicated `crdt_${projectId}_${chapterId}`)
**Testing**: Vitest with `fake-indexeddb`
**Target Platform**: Modern desktop & mobile browsers (Chrome, Edge, Firefox, Safari)
**Project Type**: Pure Client-side SPA
**Performance Goals**: Sub-5ms database deletion overhead; zero lock acquisition aborts under concurrent tab operations
**Constraints**: Zero new NPM dependencies; strictly client-side; offline-first

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must pass cleanly without skipping or disabling tests.
- [x] **Principle II: Dependency Minimization & Library Reuse**: Zero new dependencies. Uses existing `indexedDB.deleteDatabase`, `indexedDB.databases`, and internal `withRetry`.
- [x] **Principle III: Strict Concern Separation & MVC Domain Boundary**: All persistence and lock changes are encapsulated within Model/Service layers (`src/services/db.ts`, `src/services/google-drive/`).
- [x] **Principle IV: Immutable Core Schemas & Storage Stability**: Core schemas in `src/types.ts` remain immutable. No UI text changes.
- [x] **Principle V: Atomic Commits & Documentation Synchronization**: All specification, research, data model, contract, and test artifacts maintained 1:1.

## Project Structure

### Documentation (this feature)

```text
specs/143-storage-hardening-crdt-cleanup/
├── plan.md              # Implementation plan
├── research.md          # Technical analysis & decisions
├── data-model.md        # Storage topology & transaction state machine
├── quickstart.md        # Validation scenarios & test commands
├── contracts/
│   └── storageHardeningContract.ts  # Interfaces for storage hardening
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── db.ts                          # CRDT cleanup, Fail-closed save, oncomplete resolution, Web Lock retry
│   ├── google-drive/
│   │   ├── driveGranularSync.ts       # Inject projectId into downloaded chapters
│   │   └── driveProjectSync.ts        # Validate projectId before saving chapters
│   └── __tests__/
│       ├── projectDeleteQueue.test.ts # Tests for CRDT DB cleanup, fail-closed save, oncomplete durability
│       └── projectWriteLock.test.ts   # Tests for Web Lock acquisition retry with backoff
```

**Structure Decision**: Single client-side SPA repository maintaining strict MVC layering in `src/services/`.

## Complexity Tracking

*No violations of constitution detected. No unjustified complexity.*

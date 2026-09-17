# Implementation Plan: CRDT Storage Lifecycle Recovery and Invariant Hardening

**Branch**: `146-crdt-storage-lifecycle-recovery` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/146-crdt-storage-lifecycle-recovery/spec.md`

## Summary

Complete the storage integrity and CRDT lifecycle guarantees by eliminating orphan physical databases via durable deletion manifests, converting relational ownership checks from silent skips to active transaction aborts/rejections, binding deletion snapshots and destructive operations within an unbroken critical section, enforcing canonical project identities, and preventing fail-open error paths in discovery and persistence release.

## Technical Context

**Language/Version**: TypeScript 5.8+ / ES2022  
**Primary Dependencies**: React 19, Yjs (`yjs`), `y-indexeddb`, `@google/genai`, Vite  
**Storage**: Client-side IndexedDB (`novel_translator_db` with `projects`, `chapters`, `crdt_states`, and new `deletion_manifests` store, plus dedicated per-chapter `crdt_${projectId}_${chapterId}` databases)  
**Testing**: Vitest, `@testing-library/react`, fake-indexeddb  
**Target Platform**: Modern Evergreen Browsers (Chromium, Firefox, Safari)  
**Project Type**: Client-Side Single-Page Application (SPA)  
**Performance Goals**: Bounded physical deletion timeouts (5000ms), non-blocking startup manifest recovery (<100ms)  
**Constraints**: Pure client-side, zero new external npm dependencies, strictly fail-closed deletion semantics, zero silent write drops  
**Scale/Scope**: Projects with hundreds of chapters, high-frequency autosave, multiple editor tabs  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Rule 1: Strict Quality Gates & Verification**: `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build` (`tsc && vite build`) must pass cleanly with 100% test pass rate. -> **PASS**
- **Rule 2: Dependency Minimization & Existing Library Reuse**: Uses built-in IndexedDB transactions, existing Yjs primitives, and in-memory queue serialization. Zero external libraries added. -> **PASS**
- **Rule 3: Concern Separation & MVC Preservation**: Changes isolated strictly to storage/model services (`src/services/db.ts`, `src/services/dbMigration.ts`, `src/services/crdtPersistenceRegistry.ts`, `src/services/projectStorageQueue.ts`) and hooks layer (`src/hooks/useChapterCRDT.ts`, `src/hooks/useProjects.ts`). UI components remain untouched. -> **PASS**
- **Rule 4: Immutable Core Schemas**: No breaking alterations to existing stores; non-destructive schema upgrade (v4 -> v5) introduces the auxiliary `deletion_manifests` store. -> **PASS**
- **Rule 5: Atomic Commits & Documentation Synchronization**: `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `plan.md` are synchronized. -> **PASS**

## Project Structure

### Documentation (this feature)

```text
specs/146-crdt-storage-lifecycle-recovery/
├── spec.md              # Feature specification
├── research.md          # Phase 0 architectural decisions & trade-off analysis
├── data-model.md        # Phase 1 data entities and lifecycle state machine
├── contracts/           # Phase 1 TypeScript interfaces & contracts
│   └── crdtStorageLifecycleContracts.ts
├── quickstart.md        # Phase 1 runnable test and verification scenarios
├── plan.md              # This implementation plan
└── tasks.md             # Phase 2 actionable task breakdown
```

### Source Code Layout

```text
src/
├── config/
│   └── constants.ts              # STORAGE_CONFIG.DB_VERSION bump to 5
├── services/
│   ├── dbMigration.ts            # DELETION_MANIFESTS_STORE constant and v5 upgrade handler
│   ├── db.ts                     # Deletion manifest persistence, startup recovery, strict ownership rejection, canonical projectId checks
│   ├── crdtPersistenceRegistry.ts # Safe persistence destruction retaining references on error
│   └── projectStorageQueue.ts    # runInProjectExclusiveSection for atomic snapshot + delete
├── hooks/
│   ├── useChapterCRDT.ts         # Project identity assertion during CRDT hydration
│   └── useProjects.ts            # Execute undo backup capture and deletion in exclusive section
└── services/__tests__/
    └── projectDeleteQueue.test.ts # Exhaustive tests for manifest recovery, ownership rejection, and edge cases
```

## Proposed Changes

### Component 1: Schema Upgrade & Deletion Manifest Store (`src/config/constants.ts`, `src/services/dbMigration.ts`)
- In `src/config/constants.ts`: Bump `STORAGE_CONFIG.DB_VERSION` from 4 to 5.
- In `src/services/dbMigration.ts`:
  - Export `DELETION_MANIFESTS_STORE = 'deletion_manifests'`.
  - In `handleDBUpgrade`: add upgrade block for v5 creating `deletion_manifests` store with `keyPath: 'id'` and indexes for `status` and `projectId`.

### Component 2: Deletion Manifest Lifecycle & Startup Recovery (`src/services/db.ts`)
- Implement `recordDeletionManifest(manifest: DeletionManifestRecord)`: persists manifest with `status: 'pending'` before catalog commits.
- Implement `removeDeletionManifest(id: string)`: removes manifest after all physical databases confirm deleted.
- Implement `recoverPendingDeletions()`:
  - Scans `deletion_manifests` for `pending` entries.
  - Calls `executeDeleteDatabase` for all target `physicalDbNames`.
  - Removes resolved manifests.
- In `initDB()`: invoke `recoverPendingDeletions()` upon successful database opening (safely non-blocking in background or during bootstrap).
- In `executeDeleteProjectFromDB` and `executeDeleteChaptersByProjectFromDB`:
  - Generate and persist `DeletionManifestRecord` into `deletion_manifests` prior to committing primary record deletions.
  - Once physical deletions resolve, remove manifest entry.

### Component 3: Strict Fail-Closed Rejection & Transaction Abort for Ownership (`src/services/db.ts`)
- In `executeSaveChapterToDB` and `executeSaveChaptersToDB`:
  - When `existing && existing.projectId && existing.projectId !== incomingProjectId`:
    - Call `transaction.abort()`.
    - Reject promise: `reject(new Error(`Relational integrity violation: Cannot re-parent chapter ${chapter.id} from project "${existing.projectId}" to "${incomingProjectId}".`))`.
- In `executeSaveCrdtState` and `executeSaveCrdtStates`:
  - Query `chaptersStore.get(record.chapterId)`.
  - If `!chapter`:
    - Call `transaction.abort()`.
    - Reject promise: `reject(new Error(`Relational integrity violation: Chapter "${record.chapterId}" does not exist in store.`))`.
  - If `chapter.projectId !== record.projectId`:
    - Call `transaction.abort()`.
    - Reject promise: `reject(new Error(`Relational integrity violation: Chapter "${record.chapterId}" belongs to project "${chapter.projectId}", not "${record.projectId}".`))`.

### Component 4: Unified Critical Section for Deletion Snapshot and Removal (`src/services/projectStorageQueue.ts`, `src/hooks/useProjects.ts`)
- In `src/services/projectStorageQueue.ts`:
  - Implement `runInProjectExclusiveSection<T>(projectId: string, action: () => Promise<T>): Promise<T>`.
  - Appends `action` to `projectWriteChains.get(projectId)`.
- In `src/hooks/useProjects.ts`:
  - In `handleDeleteProject`: wrap snapshot capture (`getChaptersByProjectFromDB`, `getCrdtStatesByProject`) and deletion execution into `runInProjectExclusiveSection(id, async () => { ... })`.
  - In `handleDeleteChapterHistory`: wrap chapter snapshot read and `deleteChapterFromDB` into `runInProjectExclusiveSection(projectId, async () => { ... })`.

### Component 5: Canonical `projectId` in Chapter Operations & Hydration Guard (`src/services/db.ts`, `src/hooks/useChapterCRDT.ts`)
- In `deleteChapterFromDB(id, projectId)`:
  - Query `getChapterFromDB(id)`.
  - If chapter exists:
    - If `projectId && projectId !== chapter.projectId`:
      - Reject promise with `new Error(\`Mismatched projectId for chapter \${id}: expected \${chapter.projectId}, got \${projectId}\`)`.
    - Use `chapter.projectId` as the canonical project ID for queuing and CRDT DB deletion.
- In `useChapterCRDT.ts`:
  - In `getCrdtState(chapterId)` callback:
    - Assert `if (crdtRecord.projectId !== projectId)`: log warning and abort `Y.applyUpdate`.

### Component 6: Fail-Closed Discovery & Persistence Release (`src/services/db.ts`, `src/services/crdtPersistenceRegistry.ts`)
- In `deleteProjectCrdtDatabases`:
  - Remove error swallowing around chapter ID discovery. If reading cursor or store fails, propagate error and reject.
- In `destroyCrdtPersistence(dbName)`:
  - Do NOT delete from `activePersistences` before all provider `.destroy()` promises complete.
  - If any provider throws, retain the provider entry and propagate the error so retries can re-attempt cleanup.

### Component 7: Test Hardening & Quickstart Verification
- Update `src/services/__tests__/projectDeleteQueue.test.ts`:
  - Add tests for durable deletion manifest persistence and `recoverPendingDeletions()`.
  - Update ownership tests to assert `await expect(saveChapterToDB(...)).rejects.toThrow(...)`.
  - Assert `await expect(saveCrdtState(...)).rejects.toThrow(...)` when chapter is missing or project mismatched.
  - Test `deleteChapterFromDB` rejection on mismatched `projectId`.
  - Test discovery error fail-closed rejection.
- Update `src/hooks/__tests__/useProjects.test.ts` to test exclusive critical section.
- Verify quickstart scenarios and align test paths (`useChapterCRDTHydration.test.ts`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

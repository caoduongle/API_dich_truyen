# Phase 0: Outline & Research

## Technical Context Unknowns Resolved

There were no unknown dependencies or missing technical constraints; all architectural parameters were defined in the project structure (TypeScript, React, IndexedDB).
The only ambiguity regarding `saveProjectToDB` was resolved during specification: **metadata-only references in `project.chapters` are allowed** to support partial/lazy syncing from Google Drive.

## Research Findings & Decisions

### 1. `atomicSaveProjectBundle` Integrity
- **Decision**: In `atomicSaveProjectBundle`, before putting CRDT states into the store, we will verify that the chapter ID is present in the `chapters` array being saved in the bundle. Additionally, we verify that `rec.projectId === project.id` and the chapter itself has `projectId === project.id`. If a CRDT state does not correspond to a chapter in the bundle, or has a mismatched projectId, the transaction will be aborted.
- **Rationale**: The bundle contains the complete state (project metadata + all chapters). Therefore, all valid CRDT states MUST belong to one of the chapters being saved. By validating against the bundle's chapters, we prevent orphan CRDT states or cross-project data contamination within the transaction.
- **Alternatives considered**: Querying `CHAPTERS_STORE` inside the transaction. Rejected because the bundle itself is the source of truth for the chapters being saved, and querying the DB adds unnecessary overhead and complexity when the chapters are already provided in memory.

### 2. `deleteChapterFromDB` Fail-Closed
- **Decision**: Update `deleteChapterFromDB(id, fallbackProjectId?)` to strictly fail if `getChapterFromDB(id)` throws an error. If the chapter does not exist (e.g., returns `undefined`), it will reject with a "not found" error. It will no longer fall back to the provided `projectId` if the canonical chapter cannot be retrieved.
- **Rationale**: Allowing deletion to proceed with a fallback projectId when the canonical chapter is missing or inaccessible risks performing phantom deletions or leaving mismatched manifest records. Fail-closed ensures data safety.
- **Alternatives considered**: Silently returning success if the chapter is already missing (idempotent). Rejected because a lookup error might indicate DB corruption, not just absence, so an explicit error is safer.

### 3. `saveProjectToDB` Metadata Guard
- **Decision**: No changes needed to `saveProjectToDB` regarding non-existent chapters.
- **Rationale**: The clarification phase established that metadata-only references (chapters in `project.chapters` that don't exist in `CHAPTERS_STORE`) are permitted to support lazy/partial Drive syncs. The existing validation logic which checks `project.chapters` structure is sufficient.

### 4. `getCrdtState` Canonical Project API
- **Decision**: Change the signature to `getCrdtState(chapterId: string, expectedProjectId?: string)`. If `expectedProjectId` is provided, the function will return `null` if the fetched CRDT state's `projectId` does not match the expected one.
- **Rationale**: External callers, particularly Google Drive sync (`driveBundleSync.ts`), fetch CRDT states using remote chapter IDs. If there is a collision or stale data, returning a state belonging to a different project would cause data corruption during merge. The expected project ID acts as a safeguard.
- **Alternatives considered**: Making `expectedProjectId` mandatory. Rejected because it requires refactoring all internal hooks and callers which might safely rely on just the chapter ID if they already verified ownership.

### 5. Spec/Task/Repo Hygiene
- **Decision**: Remove one-off scripts like `append_converge.cjs`, `clean_test.cjs`, etc., from the repository.
- **Rationale**: Keeps the codebase clean. (Already executed via terminal). Update `tasks.md` in Feature 147 to accurately reflect completed state.

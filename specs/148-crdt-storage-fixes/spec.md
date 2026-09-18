# Feature Specification: crdt-storage-fixes

**Feature Branch**: `[148-crdt-storage-fixes]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Fix 4 remaining CRDT storage vulnerabilities and 1 hygiene issue from previous commit: 1. atomicSaveProjectBundle creates orphan crdt states. 2. deleteChapterFromDB fail-opens on lookup error. 3. saveProjectToDB lacks ownership validation for project.chapters. 4. getCrdtState API needs expectedProjectId guard. 5. Remove one-off scripts and fix tasks hygiene."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Atomic Save Project Bundle Consistency (Priority: P1)

Ensure `atomicSaveProjectBundle` prevents the creation of orphan or mismatched CRDT states, maintaining strict canonical ownership rules.

**Why this priority**: Prevents corruption where CRDT states belong to non-existent chapters or cross project boundaries.

**Independent Test**: Can be independently tested by attempting to save a bundle with a CRDT state for a chapter that does not exist in the store, or does not belong to the given project. The transaction should abort.

**Acceptance Scenarios**:

1. **Given** a project bundle containing a CRDT state for chapter `C_NOT_EXIST` that is not in the canonical store, **When** `atomicSaveProjectBundle` is called, **Then** the transaction aborts and no orphan state is created.
2. **Given** a project bundle containing a CRDT state for chapter `C2` (where `C2` belongs to Project `A`), but the bundle is for Project `B`, **When** `atomicSaveProjectBundle` is called, **Then** the transaction aborts.

---

### User Story 2 - Fail-Closed Chapter Deletion (Priority: P1)

Ensure `deleteChapterFromDB` strictly enforces fail-closed semantics when it cannot retrieve or verify the canonical chapter before deletion.

**Why this priority**: Continuing deletion without canonical verification can lead to accidental deletion of physical DB records or mismatched manifest operations.

**Independent Test**: Can be tested by inducing a lookup error or requesting deletion of a non-existent chapter, then verifying the function rejects instead of proceeding with the caller's projectId.

**Acceptance Scenarios**:

1. **Given** a request to delete chapter `C`, **When** the DB lookup throws an error, **Then** the deletion process rejects and stops immediately.
2. **Given** a request to delete a non-existent chapter `C`, **When** the deletion is called, **Then** the function explicitly rejects or returns "not found".
3. **Given** a chapter `C` exists but lacks a valid `projectId`, **When** deletion is called and invariant requires cleanup, **Then** the deletion rejects.

---

### User Story 3 - Project Chapters Metadata Ownership Guard (Priority: P2)

Ensure that `saveProjectToDB` validates ownership of all chapter IDs referenced in `project.chapters` metadata against the canonical chapter store.

**Why this priority**: Prevents relational inconsistency where catalog metadata references chapters belonging to a different project.

**Independent Test**: Can be tested by saving a project whose `project.chapters` references a chapter belonging to another project. The save should fail.

**Acceptance Scenarios**:

1. **Given** a project `B` being saved with `project.chapters` referencing chapter `C`, and `C` belongs to project `A`, **When** `saveProjectToDB` is called, **Then** the transaction aborts.
2. **Given** a project being saved with `project.chapters` referencing a non-existent chapter, **When** `saveProjectToDB` is called, **Then** the save succeeds and the metadata-only reference is allowed, enabling lazy/partial chapter sync from Drive.

---

### User Story 4 - Strict CRDT State Retrieval API (Priority: P2)

Ensure that `getCrdtState` receives and validates an expected project ID to prevent accidental usage of cross-project CRDT states (e.g., during Drive import).

**Why this priority**: Closes a loop where callers like Google Drive sync might blindly merge a retrieved CRDT state that actually belongs to a different project due to ID collision.

**Independent Test**: Can be tested by calling `getCrdtState(chapterId, wrongProjectId)`. It should reject or return null.

**Acceptance Scenarios**:

1. **Given** `getCrdtState` is called with `chapterId` and `expectedProjectId`, **When** the state belongs to a different project, **Then** the API returns null or rejects.

---

### User Story 5 - Cleanup and Spec Hygiene (Priority: P3)

Clean up temporary developer scripts and sync the `tasks.md` history for Feature 147.

**Why this priority**: Reduces repository clutter and avoids confusion from self-contradicting task logs.

**Independent Test**: Can be verified by listing root directory files and checking the commit history.

**Acceptance Scenarios**:

1. **Given** the root directory, **When** viewed, **Then** temporary one-off `.cjs` scripts (like `append_converge.cjs`, `clean_test.cjs`, etc.) are removed.
2. **Given** `specs/147-crdt-atomic-manifest-hardening/tasks.md`, **When** viewed, **Then** the task history accurately reflects the completed tests without self-contradictions.

---

### Edge Cases

- What happens when a chapter doesn't exist in `CHAPTERS_STORE` but is referenced in `project.chapters` during `saveProjectToDB`?
- How does the system handle legacy callers of `getCrdtState` that haven't been updated to pass `expectedProjectId`? (Should they fail or is it an optional parameter?)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `atomicSaveProjectBundle` MUST validate every CRDT record before persisting: the chapter MUST exist, `chapter.projectId` MUST match `rec.projectId`, and `rec.projectId` MUST match `project.id`.
- **FR-002**: `deleteChapterFromDB` MUST reject if canonical chapter lookup fails.
- **FR-003**: `deleteChapterFromDB` MUST reject if the chapter does not exist or lacks a `projectId` (unless explicitly handled).
- **FR-004**: `saveProjectToDB` MUST verify ownership of all chapter IDs referenced in `project.chapters` against the canonical store if they exist.
- **FR-005**: `getCrdtState` MUST accept an `expectedProjectId` parameter and reject/return null if the state's project ID mismatches.
- **FR-006**: Temporary scripts (e.g., `append_*.cjs`, `clean_test.cjs`) MUST be removed from the repository.
- **FR-007**: Feature 147 `tasks.md` MUST be updated to resolve contradictory states.

### Key Entities

- **Project Bundle**: A combined object containing a project, its chapters, and its CRDT states, saved atomically.
- **CRDT State**: Operational transformation state corresponding to a specific chapter and project.
- **Chapter**: Canonical record of a chapter belonging to a project.
- **Project Metadata**: Catalog-level information including the ordered list of chapters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of invalid cross-project CRDT states in project bundles are rejected during atomic save.
- **SC-002**: 100% of chapter deletions fail-closed on DB lookup errors, preventing unintended data loss.
- **SC-003**: No new metadata-only chapter references can be created pointing to chapters owned by other projects.
- **SC-004**: Zero temporary/one-off `.cjs` scripts remain in the repository root.

## Assumptions

- We assume that `getCrdtState` can safely make `expectedProjectId` mandatory for external callers (or make it optional but strongly recommended, depending on caller refactoring).
- We assume that aborting IndexedDB transactions is the preferred method for enforcing these invariants.

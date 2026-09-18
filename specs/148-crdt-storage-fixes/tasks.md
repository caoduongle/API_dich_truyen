# Tasks: CRDT Storage Fixes — Orphan Guard, Fail-Closed Delete, Canonical API

**Feature**: `148-crdt-storage-fixes`
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)
**Date**: 2026-09-18

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup required — this feature modifies existing code in `src/services/db.ts` and its callers.

- [x] T001 Review current `atomicSaveProjectBundle()`, `deleteChapterFromDB()`, `getCrdtState()`, and `saveProjectToDB()` in `src/services/db.ts` to confirm line ranges and exact current logic before making changes.

**Checkpoint**: Codebase understood, ready for implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No blocking prerequisites — all four user stories target independent functions and can proceed directly.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Atomic Save Project Bundle CRDT Consistency (Priority: P1) 🎯 MVP

**Goal**: Prevent `atomicSaveProjectBundle()` from creating orphan CRDT states by validating that every CRDT record corresponds to a chapter present in the bundle's `chapters` array and that all `projectId` fields match.

**Independent Test**: Save a bundle with a CRDT state for a chapter ID not in the `chapters` array → transaction aborts. Save a bundle with a CRDT state whose `chapterId` belongs to a different project → transaction aborts.

### Implementation for User Story 1

- [x] T002 [US1] Modify `atomicSaveProjectBundle()` in `src/services/db.ts` (~line 531): before calling `executeAtomicSaveProjectBundle`, build a `Set<string>` of chapter IDs from the `chapters` array. For each item in `crdtStates`, verify: (a) `item.chapterId` exists in the chapter ID set, (b) the corresponding chapter's `projectId === project.id`, (c) `item.projectId === project.id` (already partially checked). Throw and abort if any CRDT record fails these checks.
- [x] T003 [US1] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `atomicSaveProjectBundle` rejects when a CRDT state references a `chapterId` not present in the bundle's `chapters` array (orphan detection).
- [x] T004 [US1] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `atomicSaveProjectBundle` rejects when a CRDT state references a chapter whose `projectId` doesn't match `project.id` (cross-project CRDT contamination).
- [x] T005 [US1] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: `atomicSaveProjectBundle` now rejects orphan or cross-project CRDT states before persisting.

---

## Phase 4: User Story 2 — Fail-Closed Chapter Deletion (Priority: P1)

**Goal**: Make `deleteChapterFromDB()` strictly fail-closed when canonical chapter lookup errors occur or when the chapter does not exist, instead of silently falling back to the caller-provided `projectId`.

**Independent Test**: Induce a DB lookup error → function rejects. Request deletion of a non-existent chapter → function rejects with "not found".

### Implementation for User Story 2

- [x] T006 [US2] Modify `deleteChapterFromDB()` in `src/services/db.ts` (~line 1374): replace the `try { ... } catch { // silent }` block around `getChapterFromDB(id)` with a propagating error. If the lookup throws, reject the entire deletion.
- [x] T007 [US2] Modify `deleteChapterFromDB()` in `src/services/db.ts` (~line 1394): after the lookup, if `storedChapter` is `null` (chapter not found), throw an explicit error such as `Chapter "${id}" not found in canonical store` instead of proceeding.
- [x] T008 [US2] Remove the fallback logic `const resolvedProjectId = storedChapter?.projectId || projectId;` in `src/services/db.ts` (~line 1394) — the `resolvedProjectId` must always come from the canonical `storedChapter.projectId`.
- [x] T009 [US2] Update `useProjects.ts` in `src/hooks/useProjects.ts` (~line 405): ensure the `deleteChapterFromDB` caller handles the new rejection correctly (e.g., the undo flow at line 396 already fetches the chapter first, so if the chapter doesn't exist, the early return at line 402 prevents reaching `deleteChapterFromDB`).
- [x] T010 [US2] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `deleteChapterFromDB` rejects when `getChapterFromDB` throws a DB error (not silent swallow).
- [x] T011 [US2] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `deleteChapterFromDB` rejects with "not found" when the chapter does not exist in the store.
- [x] T012 [US2] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: `deleteChapterFromDB` is now fail-closed — no deletion proceeds without canonical verification.

---

## Phase 5: User Story 3 — Project Chapters Metadata Ownership Guard (Priority: P2)

**Goal**: Add ownership validation in `saveProjectToDB()` for all chapter IDs in `project.chapters` metadata. If a referenced chapter exists in the canonical store but belongs to a different project, the transaction aborts. Non-existent chapters are allowed (lazy sync).

**Independent Test**: Save a project whose `project.chapters` references a chapter owned by another project → transaction aborts. Save a project referencing a non-existent chapter → succeeds.

### Implementation for User Story 3

- [x] T013 [US3] Modify the internal `saveProjectToDB` implementation in `src/services/db.ts` (~line 370): after building `normalizedChaptersMeta`, iterate over all entries. For each `ChapterMetadata.id`, issue a `chaptersStore.get(id)` inside the transaction. If the chapter exists AND `existing.projectId !== project.id`, abort the transaction with a relational integrity error. If the chapter does not exist, allow it (metadata-only reference for lazy sync).
- [x] T014 [US3] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `saveProjectToDB` rejects when `project.chapters` metadata references a chapter owned by a different project.
- [x] T015 [US3] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `saveProjectToDB` succeeds when `project.chapters` metadata references a non-existent chapter (lazy sync allowed).
- [x] T016 [US3] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: `saveProjectToDB` prevents cross-project metadata references while permitting lazy chapter sync.

---

## Phase 6: User Story 4 — Strict CRDT State Retrieval API (Priority: P2)

**Goal**: Add an optional `expectedProjectId` parameter to `getCrdtState()`. When provided, the function returns `null` if the CRDT state's `projectId` doesn't match. Update Drive sync callers to pass the expected project ID.

**Independent Test**: Call `getCrdtState(chapterId, wrongProjectId)` → returns `null`. Call `getCrdtState(chapterId)` without expected project ID → returns the state as before (backward compatible).

### Implementation for User Story 4

- [x] T017 [US4] Modify `getCrdtState()` signature in `src/services/db.ts` (~line 1638): change to `getCrdtState(chapterId: string, expectedProjectId?: string)`. After retrieving the record, if `expectedProjectId` is provided and `result.projectId !== expectedProjectId`, return `null`.
- [x] T018 [P] [US4] Update `driveBundleSync.ts` in `src/services/google-drive/driveBundleSync.ts` (~lines 44, 193): pass the known `projectId` as `expectedProjectId` to `getCrdtState(chap.id, projectId)`.
- [x] T019 [P] [US4] Update `useChapterCRDT.ts` in `src/hooks/useChapterCRDT.ts` (~line 185): pass `projectId` to `getCrdtState(chapterId, projectId)` and remove the manual `crdtRecord.projectId !== projectId` check at line 188 (now handled by the API).
- [x] T020 [P] [US4] Update `useProjects.ts` in `src/hooks/useProjects.ts` (~line 398): pass the known project ID to `getCrdtState(chapId, activeProjectId)`.
- [x] T021 [US4] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `getCrdtState(chapterId, wrongProjectId)` returns `null` when expected project ID mismatches.
- [x] T022 [US4] Add test in `src/services/__tests__/projectDeleteQueue.test.ts`: verify that `getCrdtState(chapterId)` without `expectedProjectId` returns the state regardless of project ID (backward compatibility).
- [x] T023 [US4] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: `getCrdtState` API now guards against cross-project state retrieval.

---

## Phase 7: User Story 5 — Cleanup and Spec Hygiene (Priority: P3)

**Goal**: Remove temporary one-off `.cjs` scripts from the repository root and fix contradictions in Feature 147's `tasks.md`.

**Independent Test**: Verify no `append_*.cjs` or `clean_test.cjs` files exist at the repo root. Verify Feature 147 `tasks.md` is internally consistent.

### Implementation for User Story 5

- [x] T024 [US5] Verify that the one-off `.cjs` scripts (`append_converge.cjs`, `append_us3_tests.cjs`, `append_us4_tests.cjs`, `append_us4_pt2_tests.cjs`, `append_us4_pt2_tests_fix.cjs`, `append_us5_test.cjs`, `clean_test.cjs`) have been removed from repo root (already executed earlier — confirm with `git status`).
- [x] T025 [US5] Update `specs/147-crdt-atomic-manifest-hardening/tasks.md` to fix contradictory task states: mark T030/T031 correctly based on their actual implementation status in `projectDeleteQueue.test.ts`, and resolve the Phase 9 `T037 [x] ... (missing)` contradiction.
- [x] T026 [US5] Run `npm run lint && npm test && npm run build` — all must pass cleanly.

**Checkpoint**: Repository is clean, spec history is accurate.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories.

- [x] T027 Run full suite: `npm run lint && npm test && npm run build` — final green check.
- [x] T028 Run `quickstart.md` validation scenarios to confirm all 4 storage fixes work end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — review only.
- **Foundational (Phase 2)**: No blocking prerequisites.
- **User Stories (Phases 3–7)**: Independent of each other — can proceed in parallel or sequentially.
  - **US1 (Phase 3)** and **US2 (Phase 4)** are P1 — prioritize first.
  - **US3 (Phase 5)** and **US4 (Phase 6)** are P2 — can run in parallel with US1/US2.
  - **US5 (Phase 7)** is P3 — housekeeping, can be done last.
- **Polish (Phase 8)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1**: Independent. Targets `atomicSaveProjectBundle` only.
- **US2**: Independent. Targets `deleteChapterFromDB` only.
- **US3**: Independent. Targets `saveProjectToDB` metadata validation only.
- **US4**: Independent. Targets `getCrdtState` signature + callers.
- **US5**: Independent. Repo hygiene only.

### Parallel Opportunities

- T018, T019, T020 in US4 can run in parallel (different files).
- US1 and US2 can be implemented in parallel (different functions in `db.ts`).
- US3, US4, US5 can each run in parallel with any other story.

---

## Parallel Example: User Story 4

```bash
# Launch all caller updates in parallel (different files):
Task: "Update driveBundleSync.ts to pass expectedProjectId"
Task: "Update useChapterCRDT.ts to pass expectedProjectId"
Task: "Update useProjects.ts to pass expectedProjectId"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Review
2. Complete Phase 3: US1 — atomicSaveProjectBundle CRDT guard
3. Complete Phase 4: US2 — deleteChapterFromDB fail-closed
4. **STOP and VALIDATE**: `npm run lint && npm test && npm run build`
5. The two P1 vulnerabilities are closed.

### Incremental Delivery

1. US1 + US2 → P1 fixes closed → Validate
2. Add US3 → metadata ownership guard → Validate
3. Add US4 → getCrdtState canonical API → Validate
4. Add US5 → repo hygiene → Validate
5. Each story adds safety without breaking previous fixes.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USn] label maps task to specific user story for traceability
- All changes are in `src/services/db.ts` and its direct callers — no schema changes
- Existing tests in `projectDeleteQueue.test.ts` must continue to pass after each phase

---

## Phase 9: Convergence

- [x] T029 CRITICAL: Restore CRDT hydration project mismatch warning in `getCrdtState` or `useChapterCRDT` to fix regression test failure in `src/hooks/__tests__/useChapterCRDTHydration.test.ts` per Constitution I (partial)
- [x] T030 Run `npm run lint && npm test && npm run build` — all quality gates must pass cleanly per Constitution I (partial)

# Tasks: Prevent Source and Raw Translation Data Loss

**Feature**: `129-prevent-source-raw-loss`  
**Date**: 2026-09-13  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup & Test Environment Readiness

**Purpose**: Project initialization and test harness setup for storage fixtures.

- [x] T001 Verify test runner and build environment readiness in `package.json`
- [x] T002 [P] Create test fixtures and mock chapter generator in `src/services/__tests__/storageFixtures.ts`

---

## Phase 2: Foundational Storage & CRDT Core Guards (Blocking Prerequisites)

**Purpose**: Core storage integrity guards and document merge fixes that MUST be complete before user story implementation.

**⚠️ CRITICAL**: All user stories depend on these database and CRDT safeguards to prevent empty string overwrites.

- [x] T003 Implement defensive safeguard in `saveChapterToDB` preventing empty `sourceText` and undefined `rawTranslation` overwrites in `src/services/db.ts`
- [x] T004 Implement batch safeguard in `saveChaptersToDB` protecting non-empty fields during bulk updates in `src/services/db.ts`
- [x] T005 [P] Fix nullish coalescing `??` logic in `mergeChapterCrdt` to prevent empty strings from wiping local raw/polished translations in `src/services/crdtDocManager.ts`
- [x] T006 [P] Unit tests verifying storage safeguards in `src/services/__tests__/dbSafeguard.test.ts`

**Checkpoint**: Foundation ready - storage layer actively rejects destructive empty overwrites.

---

## Phase 3: User Story 1 - Total Text Preservation During Translation & Editing (Priority: P1) 🎯 MVP

**Goal**: Guarantee that translating raw text, polishing, manual editing, and CRDT background auto-saves never wipe out `sourceText` or `rawTranslation`.

**Independent Test**: Load a chapter, translate raw, polish, make live edits, wait for auto-save, and verify via `getChapterFromDB` that `sourceText`, `rawTranslation`, and `polishedTranslation` all contain complete content.

### Tests for User Story 1

- [x] T007 [P] [US1] Unit and integration tests for CRDT auto-save preservation in `src/hooks/__tests__/useChapterCRDTPreservation.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Implement existing-chapter load and non-destructive merge in `debouncedSaveToDb` in `src/hooks/useChapterCRDT.ts`
- [x] T009 [US1] Implement asynchronous session hydration when `chapterId` changes without `initialChapter` in `src/hooks/useChapterCRDT.ts`
- [x] T010 [US1] Extend `updateMetadata` in `useChapterCRDT.ts` to support preserving and updating `sourceText`
- [x] T011 [US1] Route `handleTranslateRaw` results through CRDT-aware setter `handleRawTranslationChange` in `src/hooks/useWorkspaceState.ts`
- [x] T012 [US1] Route `handlePolishTranslation` results through CRDT-aware setter `handlePolishedTranslationChange` in `src/hooks/useWorkspaceState.ts`
- [x] T013 [US1] Seed and synchronize selected chapter metadata to CRDT during `handleLoadChapterById` in `src/hooks/useWorkspaceState.ts`

**Checkpoint**: User Story 1 fully functional and testable independently - translation and live editing no longer wipe `sourceText` or `rawTranslation`.

---

## Phase 4: User Story 2 - Integrity Guard During Quality Auditing & Auto-Fixes (Priority: P2)

**Goal**: Ensure that applying quality audit corrections (rule-based auto-fixes and AI sentence rewrites) only modifies the targeted translation stage and leaves `sourceText` and `rawTranslation` 100% intact.

**Independent Test**: Mount `UnifiedAuditPanel`, click "Sửa ngay" on an issue, verify `handleApplyAuditFix` applies the fix to `polishedTranslation` while `sourceText` and `rawTranslation` remain untouched in DB.

### Tests for User Story 2

- [x] T014 [P] [US2] Integration test verifying that audit auto-fix (`handleApplyAuditFix`) preserves original `sourceText` and `rawTranslation` in `src/components/translator-workspace/__tests__/UnifiedAuditPanelPreservation.test.tsx`

### Implementation for User Story 2

- [x] T015 [US2] Validate and harden `handleApplyAuditFix` in `src/hooks/useWorkspaceState.ts` ensuring activeStage targeting leaves unedited stages untouched
- [x] T016 [US2] Verify and ensure that opening chapters from `HakoCheckerWorkspace` via `onOpenInTranslator` preserves chapter integrity when editing in `src/App.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently - audit auto-fixes are strictly non-destructive.

---

## Phase 5: User Story 3 - Missing Source & Raw Data Detection and Recovery (Priority: P3)

**Goal**: Identify chapters in history that previously lost `sourceText` or `rawTranslation` and provide a safe in-app recovery mechanism to re-supply the original Chinese text without touching completed translations.

**Independent Test**: View a chapter with missing `sourceText` in `ChapterHistoryPanel`, trigger "Bổ sung bản gốc", provide Chinese text, verify `sourceText` is restored while existing `polishedTranslation` is completely preserved.

### Tests for User Story 3

- [x] T017 [P] [US3] Unit tests for chapter recovery modal and state update in `src/components/__tests__/ChapterHistoryPanelRecovery.test.tsx`

### Implementation for User Story 3

- [x] T018 [US3] Add visual indicator badge and detection helper for chapters with missing `sourceText` or `rawTranslation` in `src/components/ChapterHistoryPanel.tsx`
- [x] T019 [US3] Implement "Bổ sung / Khôi phục bản gốc" modal and action in `src/components/ChapterHistoryPanel.tsx` allowing users to re-attach original text safely without affecting existing translations

**Checkpoint**: All three user stories functional independently - historical damaged chapters can be diagnosed and recovered.

---

## Phase 6: Polish & Quality Gates Verification

**Purpose**: Complete validation against non-negotiable project constitution quality gates.

- [x] T020 Run type checking verification via `npm run lint` (`tsc --noEmit`)
- [x] T021 Run complete test suite verification via `npm test` (`vitest run`)
- [x] T022 Run production bundle build verification via `npm run build` (`tsc && vite build`)
- [x] T023 Run quickstart validation scenarios from `specs/129-prevent-source-raw-loss/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories.
- **User Story 1 (Phase 3 - MVP)**: Depends on Phase 2 - delivers core data preservation.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and integrates with US1 CRDT setters.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and US1 for safe recovery persistence.
- **Polish & Quality Gates (Phase 6)**: Depends on all user stories being complete.

### Parallel Opportunities

- `T002` (test fixtures) and `T005` (crdtDocManager fix) can run in parallel with `T003`/`T004`.
- `T006` (guard tests) can run in parallel with `T007` (CRDT preservation tests).
- `T014` (US2 test) and `T017` (US3 test) can be developed in parallel with implementation tasks once foundational phase completes.

---

## Parallel Example: User Story 1

```bash
# Launch test and implementation tasks for User Story 1:
Task: "Unit and integration tests for CRDT auto-save preservation in src/hooks/__tests__/useChapterCRDTPreservation.test.ts"
Task: "Extend updateMetadata in useChapterCRDT.ts to support preserving and updating sourceText"
```

---

## Implementation Strategy

### MVP First (Phases 1-3)
1. Complete Phase 1 (Setup) and Phase 2 (Foundational DB & CRDT Guards).
2. Complete Phase 3 (User Story 1: CRDT auto-save merge & translation dispatch).
3. **STOP and VALIDATE**: Test User Story 1 independently. At this point, no chapter will ever lose `sourceText` or `rawTranslation` during translation or live editing.

### Incremental Delivery (Phases 4-6)
4. Add User Story 2 (Audit panel auto-fix hardening).
5. Add User Story 3 (History panel visual detection & recovery action).
6. Execute Phase 6 Quality Gates (`npm run lint`, `npm test`, `npm run build`).

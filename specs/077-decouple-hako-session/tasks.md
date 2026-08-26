# Tasks: Decouple Quality Review Session & JIT Content Loading

**Branch**: `077-decouple-hako-session` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare type foundations and test environments for session decoupling.

- [X] T001 Define `HakoChapterMeta`, `HakoChapterFull`, and update `ProjectReviewChapter` in `src/types/hakoChecker.ts`
- [X] T002 [P] Create initial unit test scaffolding in `src/hooks/__tests__/useHakoReviewSession.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core storage sanitization and schema isolation that MUST be complete before user stories can run.

- [X] T003 Implement `sanitizeSession` helper in `src/services/hakoSessionStore.ts` to prune heavy text strings from session records
- [X] T004 Apply `sanitizeSession` to `saveSession`, `getSession`, `getLatestSession`, and `listSessions` in `src/services/hakoSessionStore.ts`

**Checkpoint**: Foundation ready — session persistence is guaranteed to be lean (< 50 KB) and backward-compatible with legacy stored sessions.

---

## Phase 3: User Story 1 - Instant Chapter Selection & Responsive Workspace (Priority: P1) 🎯 MVP

**Goal**: Deliver 0ms instant chapter selection and project loading for novels with hundreds of chapters (139+ chapters) without tab freezing or lag.

**Independent Test**: Load a 139-chapter project, rapidly click 10+ chapter checkboxes within 1 second; verify selection state toggles in < 10ms with zero UI hitching or tab termination.

### Tests for User Story 1
- [X] T005 [P] [US1] Unit test verifying instant `selectProject` execution without fetching full text for unselected chapters in `src/hooks/__tests__/useHakoReviewSession.test.ts`
- [X] T006 [P] [US1] Unit test verifying synchronous `< 10ms` checkbox toggle state in `src/hooks/__tests__/useHakoReviewSession.test.ts`

### Implementation for User Story 1
- [X] T007 [US1] Refactor `selectProject` in `src/hooks/useHakoReviewSession.ts` to map `project.chapters` directly to `HakoChapterMeta` without calling `getChapterFromDB` for all chapters
- [X] T008 [US1] Optimize `toggleChapterSelection`, `selectChapterRange`, and `clearChapterSelection` in `src/hooks/useHakoReviewSession.ts` to update React state synchronously
- [X] T009 [US1] Update `src/components/hako-checker/HakoChapterSelector.tsx` to consume lightweight chapter metadata and provide immediate checkbox feedback

**Checkpoint**: User Story 1 complete — Chapter browsing and selection works at 60fps with zero memory bloat or tab crashes.

---

## Phase 4: User Story 2 - Lightweight Session Persistence & Storage Sanitization (Priority: P2)

**Goal**: Ensure all session save/load cycles persist only lightweight metadata and auto-sanitize legacy bloated sessions from IndexedDB.

**Independent Test**: Inspect stored session entries in IndexedDB after selecting 12 chapters in a 200-chapter project; payload size must be < 50 KB without `vietnameseContent` strings.

### Tests for User Story 2
- [X] T010 [P] [US2] Unit test verifying session payload size and absence of `vietnameseContent` in saved records in `src/hooks/__tests__/useHakoReviewSession.test.ts`
- [X] T011 [P] [US2] Unit test verifying automatic sanitization of legacy multi-MB session records in `src/hooks/__tests__/useHakoReviewSession.test.ts`

### Implementation for User Story 2
- [X] T012 [US2] Wire `persistSession` in `src/hooks/useHakoReviewSession.ts` to ensure metadata-only payloads are committed to storage
- [X] T013 [US2] Add runtime fallback in `src/services/hakoSessionStore.ts` to guarantee error resilience during storage read/write

**Checkpoint**: User Story 2 complete — Storage transactions are lightweight and resilient against legacy bloated data.

---

## Phase 5: User Story 3 - Just-In-Time (JIT) Chapter Content Loading for Analysis (Priority: P3)

**Goal**: Load full Vietnamese and Chinese text only for the selected chapters (max 12) at the moment analysis is triggered, passing text directly to heuristic and AI engines in memory.

**Independent Test**: Select 12 chapters in a large project and click "Bắt đầu kiểm định"; verify full text is retrieved JIT for the 12 IDs, analyzed, and issues are saved without persisting full text back to the session store.

### Tests for User Story 3
- [X] T014 [P] [US3] Unit test verifying JIT loading and scanning of up to 12 selected chapters in `src/services/__tests__/hakoQualityEngine.test.ts`

### Implementation for User Story 3
- [X] T015 [US3] Refactor `handleStartAnalysis` in `src/components/hako-checker/HakoCheckerWorkspace.tsx` to retrieve full text via `getChapterFromDB` exclusively for `selectedChapterIds`
- [X] T016 [US3] Update `updateSessionChaptersAndIssues` in `src/hooks/useHakoReviewSession.ts` to record detected issues and chapter status while discarding raw text from session state
- [X] T017 [US3] Add loading spinner feedback in `src/components/hako-checker/HakoCheckerWorkspace.tsx` during JIT text retrieval

**Checkpoint**: User Story 3 complete — Heuristic and AI analysis receive 100% full text on-demand with zero persistent storage pollution.

---

## Phase 6: User Story 4 - Debounced / Non-Blocking Selection Synchronization (Priority: P4)

**Goal**: Debounce IndexedDB writes during rapid user checkbox interactions so repetitive clicks never queue redundant storage I/O.

**Independent Test**: Rapidly click 10 checkboxes in sequence; verify UI updates instantly on every click while only a single debounced storage write executes after 300ms of inactivity.

### Tests for User Story 4
- [X] T018 [P] [US4] Unit test verifying debounced persistence invocation on rapid selection toggles in `src/hooks/__tests__/useHakoReviewSession.test.ts`

### Implementation for User Story 4
- [X] T019 [US4] Implement a 300ms debounce timer for session persistence in `src/hooks/useHakoReviewSession.ts`

**Checkpoint**: User Story 4 complete — Maximum responsiveness and zero storage write contention.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Execute end-to-end quality gates and compliance checks across all modified modules.

- [X] T020 Run TypeScript static type checking via `npm run lint` (`tsc --noEmit`)
- [X] T021 Run all test suites via `npm test` (`vitest run`)
- [X] T022 Run production bundle compilation via `npm run build`
- [X] T023 [P] Execute end-to-end validation according to `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user stories.
- **Phase 3 (User Story 1)**: Depends on Phase 2.
- **Phase 4 (User Story 2)**: Depends on Phase 2 & 3.
- **Phase 5 (User Story 3)**: Depends on Phase 2 & 3.
- **Phase 6 (User Story 4)**: Depends on Phase 3 & 4.
- **Phase 7 (Polish)**: Depends on all User Stories completion.

### Parallel Opportunities
- T001 and T002 can be developed in parallel.
- T005, T006, T010, T011, T014, T018 (all test tasks) can run in parallel before implementations.
- T020, T021, T022, T023 can run in the final verification phase.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Setup) & Phase 2 (Foundational).
2. Complete Phase 3 (User Story 1) — verify instant project load and instant checkbox toggle.
3. Validate MVP independently: tab crashes and UI freezes are immediately resolved.

### Incremental Delivery
1. Add User Story 2 (Lightweight persistence & sanitization) $\to$ disk footprint drops by 95%.
2. Add User Story 3 (JIT text loading on analysis start) $\to$ quality scanning operates with full accuracy.
3. Add User Story 4 (Debounced persistence) $\to$ rapid clicks produce zero I/O bottleneck.
4. Run full Constitution Quality Gates (lint, test, build).

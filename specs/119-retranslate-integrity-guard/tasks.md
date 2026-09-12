# Tasks: Retranslate Integrity Guard and Safe Draft Preservation

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify dependencies and test harness readiness

- [ ] T001 Review and verify feature branch configuration and test harnesses for translation engine and history panel in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions and signatures required across services and UI components

**CRITICAL**: Foundational tasks must complete before user story implementation

- [ ] T002 Define isDraftTruncated interface signature in src/services/chapterTranslationService.ts
- [ ] T003 Update AutoTranslateMode union type to include 'repolish' in src/services/chapterTranslationService.ts and src/hooks/useAutoTranslationQueue.ts

**Checkpoint**: Core types ready - user story implementation can proceed

---

## Phase 3: User Story 1 - True Re-Translation From Scratch (Priority: P1) 🎯 MVP

**Goal**: Ensure 'from_scratch' mode unconditionally executes Phase 1 raw translation directly from sourceText without bypassing or reusing corrupt drafts.

**Independent Test**: Call executeSingleChapterTranslation on a chapter with a partial draft using mode 'from_scratch'; verify translateRawDirect runs from sourceText.

### Tests for User Story 1 🧪
- [ ] T004 [US1] Unit test for autoTranslateMode === 'from_scratch' ensuring Phase 1 raw translation always executes from sourceText in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 1
- [ ] T005 [US1] Refactor executeSingleChapterTranslation in src/services/chapterTranslationService.ts to execute Phase 1 unconditionally when autoTranslateMode === 'from_scratch'

**Checkpoint**: User Story 1 complete - chapters can be cleanly re-translated from scratch without reusing partial drafts.

---

## Phase 4: User Story 2 - Truncated Draft Integrity Guard (Priority: P1)

**Goal**: Detect severely truncated candidate drafts (<35% length ratio or paragraph collapse) and trigger fallback raw translation.

**Independent Test**: Evaluate a 100-character draft against 1000-character sourceText; verify isDraftTruncated returns true and logs integrity warning.

### Tests for User Story 2 🧪
- [ ] T006 [P] [US2] Unit tests for isDraftTruncated with length ratios, paragraph count checks, and short texts in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 2
- [ ] T007 [US2] Implement isDraftTruncated function in src/services/chapterTranslationService.ts
- [ ] T008 [US2] Integrate draft integrity check and log warning [Cảnh báo toàn vẹn] before candidate draft reuse in src/services/chapterTranslationService.ts

**Checkpoint**: User Story 2 complete - silent draft corruption and truncation propagation are blocked.

---

## Phase 5: User Story 3 - Strict Separation & Immutability of Raw vs Polished Drafts (Priority: P2)

**Goal**: Ensure Phase 2 polishing inputs are strictly sourced from rawTranslation and rawTranslation remains immutable when Phase 1 is skipped.

**Independent Test**: Run Phase 2 polish on an existing raw translation; verify rawTranslation in DB remains identical byte-for-byte.

### Tests for User Story 3 🧪
- [ ] T009 [US3] Unit tests verifying rawTranslation immutability when Phase 1 is skipped in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 3
- [ ] T010 [US3] Isolate firstDraft candidate selection strictly from chapter.rawTranslation in src/services/chapterTranslationService.ts
- [ ] T011 [US3] Ensure DB save preserves existing chapter.rawTranslation untouched if Phase 1 was bypassed in src/services/chapterTranslationService.ts

**Checkpoint**: User Story 3 complete - raw translations are protected against corruption by polishing output.

---

## Phase 6: User Story 4 - Re-polish Only Mode ('Chỉ chuốt lại từ bản dịch thô') (Priority: P2)

**Goal**: Provide a dedicated 'repolish' mode that re-polishes existing valid raw translations without re-spending tokens on Phase 1.

**Independent Test**: Execute queue with mode 'repolish'; verify Phase 1 is bypassed if raw draft is valid, or falls back to Phase 1 if raw draft is truncated.

### Tests for User Story 4 🧪
- [ ] T012 [US4] Unit tests for repolish mode queue processing and fallback on truncated raw draft in src/services/__tests__/chapterTranslationService.test.ts

### Implementation for User Story 4
- [ ] T013 [US4] Implement canReuseRaw condition for repolish mode in src/services/chapterTranslationService.ts
- [ ] T014 [US4] Update queue preparation logic in src/hooks/useTranslationProcess.ts to support repolish
- [ ] T015 [US4] Add 3-button mode selector (Tiếp tục, Từ đầu, Chuốt lại) with icons in src/components/auto-translator/TranslationConfigPanel.tsx
- [ ] T016 [US4] Connect mode state and handlers in src/components/AutoTranslator.tsx

**Checkpoint**: User Story 4 complete - users can safely re-polish raw translations on demand.

---

## Phase 7: User Story 5 - Granular Draft Controls in Chapter History Viewer (Priority: P2)

**Goal**: Provide 'Xóa bản biên tập', 'Xóa bản dịch thô', and 'Chuyển thành bản thô' actions in Chapter History.

**Independent Test**: Verify pure state transformations update chapter fields, status, and timestamps as expected.

### Tests for User Story 5 🧪
- [ ] T017 [P] [US5] Unit tests for state transformations (transformChapterDeletePolished, transformChapterDeleteRaw, transformChapterPromotePolishedToRaw) in src/components/__tests__/ChapterHistoryPanel.test.ts

### Implementation for User Story 5
- [ ] T018 [US5] Implement pure state transformation functions in src/components/ChapterHistoryPanel.tsx
- [ ] T019 [US5] Add handleDeletePolishedTranslation action handler with confirmation in src/components/ChapterHistoryPanel.tsx
- [ ] T020 [US5] Add handleDeleteRawTranslation action handler with confirmation in src/components/ChapterHistoryPanel.tsx
- [ ] T021 [US5] Add handlePromotePolishedToRaw action handler with confirmation in src/components/ChapterHistoryPanel.tsx
- [ ] T022 [US5] Render granular draft control buttons conforming to design system tokens in src/components/ChapterHistoryPanel.tsx

**Checkpoint**: User Story 5 complete - users have granular management over chapter draft states.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: System-wide verification and quality gate enforcement

- [ ] T023 [P] Execute static type validation via npm run lint (tsc --noEmit)
- [ ] T024 [P] Run full test suite via npm test (vitest run)
- [ ] T025 Execute production build via npm run build (tsc && vite build)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup - blocks all User Stories.
- **User Stories (Phase 3-7)**:
  - **US1 (P1)**: Independent after Phase 2.
  - **US2 (P1)**: Integrates with US1 / can run in parallel after Phase 2.
  - **US3 (P2)**: Integrates with US1 and US2.
  - **US4 (P2)**: Depends on US1, US2, and US3.
  - **US5 (P2)**: Independent UI/state layer, can run after Phase 2.
- **Polish (Phase 8)**: Depends on completion of all stories.

### Parallel Opportunities
- T006 [US2] and T017 [US5] can be authored in parallel with US1 tests.
- T018-T022 [US5] (ChapterHistoryPanel) can be executed in parallel with backend service changes (US1-US4).
- T023 and T024 can be run in parallel.

---

## Parallel Example: User Story 2 & 5

```bash
# Run tests for US2 and US5 in parallel:
npx vitest run src/services/__tests__/chapterTranslationService.test.ts
npx vitest run src/components/__tests__/ChapterHistoryPanel.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2)
1. Complete Phase 1 & Phase 2 (Foundational types).
2. Complete Phase 3 (US1 - True Re-Translation) & Phase 4 (US2 - Integrity Guard).
3. Validate with unit tests: Corrupted/truncated chapters cannot overwrite raw text and 'from_scratch' recovers full text.

### Incremental Delivery
1. Add US3 (Raw immutability guard).
2. Add US4 ('repolish' mode and 3-way toggle).
3. Add US5 (ChapterHistoryPanel draft actions).
4. Run full quality gates (lint, test, build).

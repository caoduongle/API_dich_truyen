# Tasks: Batch Draft Management and Light Theme Contrast Hardening

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify component dependencies and test setup

- [x] T001 Review and verify component dependencies and test setup for ChapterHistoryPanel in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core batch processing types and state helpers in ChapterHistoryPanel

**CRITICAL**: Foundational tasks must complete before user story implementation

- [x] T002 Define shared batch action types and state helpers in src/components/ChapterHistoryPanel.tsx

**Checkpoint**: Foundational structures verified - user story implementation can proceed

---

## Phase 3: User Story 1 - Batch Draft Management in Chapter History (Priority: P1) 🎯 MVP

**Goal**: Enable bulk deletion of polished drafts, bulk deletion of raw drafts, bulk promotion to raw, and bulk reset across all selected chapters.

**Independent Test**: Select multiple chapters with mixed states; execute batch delete polished; verify only chapters with polished drafts are modified and raw drafts remain intact.

### Tests for User Story 1 🧪
- [x] T003 [P] [US1] Unit tests for bulk chapter state transformation helpers in src/components/__tests__/ChapterHistoryPanel.test.ts

### Implementation for User Story 1
- [x] T004 [US1] Implement handleDeleteSelectedPolished batch handler in src/components/ChapterHistoryPanel.tsx
- [x] T005 [US1] Implement handleDeleteSelectedRaw batch handler in src/components/ChapterHistoryPanel.tsx
- [x] T006 [US1] Implement handlePromoteSelectedPolishedToRaw batch handler in src/components/ChapterHistoryPanel.tsx
- [x] T007 [US1] Connect batch handlers to showConfirm, IndexedDB bulk updates, and onUpdateProject metadata synchronization in src/components/ChapterHistoryPanel.tsx

**Checkpoint**: User Story 1 complete - all 4 batch actions execute atomically across selected chapters.

---

## Phase 4: User Story 2 - High-Contrast Light & Sepia Theme Typography (Priority: P1)

**Goal**: Guarantee WCAG AA contrast (>= 4.5:1) for all draft and warning action buttons in Light and Sepia themes, eliminating unreadable yellow text.

**Independent Test**: Inspect rendered button styles in light mode; verify text color resolves to dark amber text-amber-800 with contrast >= 7:1 against cream background.

### Tests for User Story 2 🧪
- [x] T008 [P] [US2] Audit and test theme contrast tokens for warning/draft action buttons in src/components/__tests__/ChapterHistoryPanel.test.ts

### Implementation for User Story 2
- [x] T009 [US2] Update single-chapter action button styles from hardcoded text-amber-300 to theme-adaptive text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/40 hover:bg-amber-100/60 dark:hover:bg-amber-950/20 in src/components/ChapterHistoryPanel.tsx
- [x] T010 [US2] Apply theme-adaptive high-contrast styles to all batch action buttons in src/components/ChapterHistoryPanel.tsx

**Checkpoint**: User Story 2 complete - text is crisp and legible across Light, Sepia, and Dark themes.

---

## Phase 5: User Story 3 - Responsive Batch Action Toolbar & Safe Selection Feedback (Priority: P2)

**Goal**: Render a responsive batch actions toolbar below the chapter list header with progress notifications and detail view refresh.

**Independent Test**: Select chapters and trigger a bulk action; verify responsive toolbar wrapping, immediate detail view synchronization, and informative toast feedback.

### Implementation for User Story 3
- [x] T011 [US3] Design and render responsive batch action toolbar (flex flex-wrap gap-1.5) below sidebar header in src/components/ChapterHistoryPanel.tsx
- [x] T012 [US3] Add informative toast notifications summarizing affected chapter counts upon bulk completion in src/components/ChapterHistoryPanel.tsx
- [x] T013 [US3] Refresh active chapter detail view if inspected chapter is modified in src/components/ChapterHistoryPanel.tsx

**Checkpoint**: User Story 3 complete - batch toolbar is responsive and user receives clear operational feedback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: System-wide verification and quality gate enforcement

- [x] T014 [P] Run static type checking via npm run lint (tsc --noEmit)
- [x] T015 [P] Run full test suite via npm test (vitest run)
- [x] T016 Run production build via npm run build (tsc && vite build)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup - blocks all User Stories.
- **User Stories (Phase 3-5)**:
  - **US1 (P1)**: Independent after Phase 2.
  - **US2 (P1)**: Styling tokens can be applied in parallel with or immediately following US1.
  - **US3 (P2)**: Integrates with US1 and US2.
- **Polish (Phase 6)**: Depends on completion of all stories.

### Parallel Opportunities
- T003 [US1] and T008 [US2] can be executed in parallel.
- T009 [US2] and T010 [US2] can be developed alongside T004-T007 [US1].
- T014 and T015 can be run in parallel.

---

## Parallel Example: User Story 1 & 2

```bash
# Run unit tests for ChapterHistoryPanel:
npx vitest run src/components/__tests__/ChapterHistoryPanel.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2)
1. Complete Phase 1 & Phase 2 (Setup & Types).
2. Complete Phase 3 (US1 - Batch Draft Management) & Phase 4 (US2 - Contrast Hardening).
3. Validate: Multi-chapter batch deletion and promotion work seamlessly, and text contrast is sharp in Light mode.

### Incremental Delivery
1. Add US3 (Responsive Toolbar & Feedback).
2. Run full quality gates (lint, test, build).

---

## Phase 7: Convergence

- [x] T017 Replace hardcoded text-amber-300 button styles with theme-adaptive text-amber-800 dark:text-amber-300 styling in src/components/ChapterHistoryPanel.tsx per FR-007 (contradicts)
- [x] T018 Implement responsive batch action toolbar with 4 bulk operations in src/components/ChapterHistoryPanel.tsx per FR-001 / US3/AC1 (missing)
- [x] T019 Implement bulk delete polished handler handleDeleteSelectedPolished with confirmation, IndexedDB persistence, metadata synchronization, and detail refresh in src/components/ChapterHistoryPanel.tsx per FR-003 / US1/AC1 (missing)
- [x] T020 Implement bulk delete raw handler handleDeleteSelectedRaw with confirmation, IndexedDB persistence, metadata synchronization, and detail refresh in src/components/ChapterHistoryPanel.tsx per FR-004 / US1/AC2 (missing)
- [x] T021 Implement bulk promote polished to raw handler handlePromoteSelectedPolishedToRaw with confirmation, IndexedDB persistence, metadata synchronization, and detail refresh in src/components/ChapterHistoryPanel.tsx per FR-005 / US1/AC3 (missing)
- [x] T022 Wire post-operation toast feedback summarizing affected chapter counts in src/components/ChapterHistoryPanel.tsx per US3/AC2 (missing)


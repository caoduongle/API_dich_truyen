# Tasks: Hako Truncation and Omission Detection

**Input**: Design documents from `specs/120-hako-truncation-omission-detection/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)
**Branch**: `120-hako-truncation-omission-detection`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update interface contracts and inputs for quality scanning

- [ ] T001 Update HeuristicScanInput interface and scan option contracts in src/services/hakoQualityEngine.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core length and paragraph heuristic validation logic required across inspection pipelines

⚠️ **CRITICAL**: Foundational logic must be defined before user stories can integrate omission guards

- [ ] T002 Implement length and paragraph ratio validation logic in src/services/hakoQualityEngine.ts

**Checkpoint**: Core omission algorithms available for heuristic and AI pipelines

---

## Phase 3: User Story 1 - Heuristic Length & Omission Guard in Hako Checker (Priority: P1) 🎯 MVP

**Goal**: Automatically and deterministically detect truncated or incomplete chapters during heuristic scanning without needing AI calls.

**Independent Test**: Provide an 80-word Vietnamese draft with a 2,000-character Chinese raw text to `runHeuristicQualityScan`; verify an `omission` issue with `critical` severity is returned with explicit metrics.

### Tests for User Story 1
- [ ] T003 [P] [US1] Add unit tests for truncation and omission heuristics in src/services/__tests__/hakoQualityEngine.test.ts

### Implementation for User Story 1
- [ ] T004 [US1] Implement omission detection rules (4A, 4B, 4C) in runHeuristicQualityScan in src/services/hakoQualityEngine.ts
- [ ] T005 [US1] Connect raw Chinese content and translation type to runHeuristicQualityScan in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: User Story 1 complete — truncated chapters are instantly flagged during heuristic scan

---

## Phase 4: User Story 2 - Seamless Raw Chinese Resolution in Hako Session (Priority: P1)

**Goal**: Automatically hydrate original Chinese source text from IndexedDB into the raw modal and review session, fulfilling the UI promise "Văn bản raw được tự động nạp từ sourceText của dự án".

**Independent Test**: Open the raw modal in `HakoChapterSelector`; verify that the textarea auto-populates with `sourceText` from IndexedDB and displays character count instead of "Chưa có dữ liệu".

### Tests for User Story 2
- [ ] T006 [P] [US2] Add unit tests for raw Chinese modal auto-loading in src/components/hako-checker/__tests__/HakoChapterSelector.test.tsx

### Implementation for User Story 2
- [ ] T007 [US2] Import getChapterFromDB and implement JIT sourceText fetching in src/components/hako-checker/HakoChapterSelector.tsx
- [ ] T008 [US2] Persist hydrated rawChineseContent in review session state in src/components/hako-checker/HakoCheckerWorkspace.tsx

**Checkpoint**: User Stories 1 AND 2 work together — raw content is auto-populated and immediately available to scans

---

## Phase 5: User Story 3 - AI Audit Schema & Prompt Hardening for Omission (Priority: P2)

**Goal**: Ensure Gemini AI deep critique is prompted to check chapter completeness, and prevent silent discarding of omission issues due to missing `vietnameseSnippet`.

**Independent Test**: Simulate Gemini returning an omission issue where `vietnameseSnippet` is empty; verify that `runAiQualityScan` retains the issue and sets an appropriate anchor snippet.

### Tests for User Story 3
- [ ] T009 [P] [US3] Add unit tests for omission issues without vietnameseSnippet in src/services/__tests__/hakoQualityEngine.test.ts

### Implementation for User Story 3
- [ ] T010 [US3] Update Gemini AI audit prompt and system instruction for omission verification in src/services/hakoQualityEngine.ts
- [ ] T011 [US3] Relax issue schema and parser fallback for omission category in src/services/hakoQualityEngine.ts

**Checkpoint**: User Stories 1, 2, and 3 complete — both heuristic and AI passes reliably detect omissions

---

## Phase 6: User Story 4 - One-Click Navigation to Translation Workspace for Recovery (Priority: P3)

**Goal**: Provide direct action button on omission issue cards to navigate directly into Translator Workspace with the affected chapter selected for rapid retranslation.

**Independent Test**: Click "Mở trong Bàn Dịch để sửa" on an issue card; verify `onOpenInTranslator(chapterId)` triggers with the correct chapter ID.

### Tests for User Story 4
- [ ] T012 [P] [US4] Add unit tests for onOpenInTranslator navigation button in src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx

### Implementation for User Story 4
- [ ] T013 [US4] Verify onOpenInTranslator action button wiring in src/components/hako-checker/HakoIssueCard.tsx and src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Full end-to-end loop from defect detection to single-click restoration workflow

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Execute strict Constitution quality gates across the entire codebase

- [ ] T014 [P] Run npm run lint (tsc --noEmit) to verify TypeScript types across all modified files
- [ ] T015 [P] Run npm test (vitest run) to verify all test suites pass with 100% success rate
- [ ] T016 Run npm run build (tsc && vite build) to verify production bundle generation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 by feeding raw content to heuristic scan
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Hardens AI scan independently of heuristic pass
- **User Story 4 (P3)**: Can start after US1 - Provides recovery navigation from detected issues

### Within Each User Story

- Tests written first, verified to fail before implementation
- Services and data logic before UI components
- Story complete before marking checkpoint

### Parallel Opportunities

- T003, T006, T009, T012 (unit tests across separate test files) can be authored in parallel
- US1 and US2 can be developed concurrently once Phase 2 foundational logic is in place
- Verification tasks T014 and T015 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch test authoring for User Story 1:
Task: "Add unit tests for truncation and omission heuristics in src/services/__tests__/hakoQualityEngine.test.ts"

# Concurrently prepare workspace caller:
Task: "Connect raw Chinese content and translation type to runHeuristicQualityScan in src/components/hako-checker/HakoCheckerWorkspace.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003 - T005)
4. **STOP and VALIDATE**: Test User Story 1 independently with Chapter 138 test cases

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (MVP) → Heuristic omission detection operational
3. Add User Story 2 → Raw Chinese auto-hydrated from IndexedDB
4. Add User Story 3 → AI scan hardened against silent omission drops
5. Add User Story 4 → Direct recovery navigation to Translator Workspace
6. Polish → 100% Constitution quality gates verified

---

## Notes

- `[P]` tasks = different files, no dependencies
- `[Story]` label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Strict adherence to Constitution Principle I (lint, test, build) enforced in Phase 7

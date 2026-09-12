# Tasks: Fix AI Configuration Modal Lag & API Key Lifecycle

**Feature Branch**: `118-fix-api-key-config-lag`  
**Input Documents**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/key-config-interaction.contract.md](contracts/key-config-interaction.contract.md), [quickstart.md](quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify baseline development environment, testing harnesses, and quality gate tools.

- [x] T001 Inspect and verify environment, test harness, and baseline quality gates in package.json
- [x] T002 [P] Review API settings modal architecture and component hierarchy in src/components/layout/ApiSettingsModal.tsx and src/components/ApiSettings.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and hooks guards that MUST be in place before user story work.

**⚠️ CRITICAL**: Blocking prerequisites to stabilize background requests and state synchronization.

- [x] T003 Define LocalKeyDraftItem and ModelSupportAssessment data contracts and helper types in src/components/api-settings/KeyListSection.tsx
- [x] T004 [P] Update src/hooks/useModelDiscovery.ts to add minimum length guard (validKeys length >= 25) and stabilize revalidation dependencies
- [x] T005 [P] Update src/hooks/useModelObservability.ts to support optional enabled flag to prevent duplicate background quota calls

**Checkpoint**: Core guards ready — user story implementations can proceed.

---

## Phase 3: User Story 1 - Smooth Modal Launch & Responsive Key Input (Priority: P1) 🎯 MVP

**Goal**: Decouple key input typing from root application re-renders to deliver 60 FPS typing with zero lag, no dropped keystrokes, and zero premature network discovery queries.

**Independent Test**: Open AI configuration modal, rapidly type or paste a 39-character key into an input field, verify instantaneous text rendering without UI freeze or premature HTTP requests.

### Tests for User Story 1

- [x] T006 [P] [US1] Unit test for debounced key input and partial-key discovery filtering in src/components/__tests__/KeyListSectionLagFix.test.ts

### Implementation for User Story 1

- [x] T007 [US1] Implement isolated KeyInputRow subcomponent in src/components/api-settings/KeyListSection.tsx with local draft state and 300ms debounce propagation
- [x] T008 [US1] Refactor KeyListSection in src/components/api-settings/KeyListSection.tsx to memoize child row items and support batch updates
- [x] T009 [US1] Optimize handleBatchUpdateKeys and handleUpdateKeyIndex in src/hooks/useAIConfig.ts to avoid redundant state updates
- [x] T010 [US1] Update src/components/QuotaPanel.tsx to pass enabled flag to useModelObservability when externalObservability is provided

**Checkpoint**: User Story 1 is functional and testable with smooth 60 FPS key inputs.

---

## Phase 4: User Story 2 - Persistent & Reliable Credential Retention Across Sessions (Priority: P1)

**Goal**: Ensure API keys survive page refreshes, tab closures, and browser restarts when the user opts in to browser retention, fully compliant with storage audit rules.

**Independent Test**: Configure keys, enable browser retention, close/reopen tab, verify keys remain restored in active pool and Quota tab.

### Tests for User Story 2

- [x] T011 [P] [US2] Unit test for persistent credential retention via app_ui_prefs in src/components/__tests__/KeyListSectionLagFix.test.ts

### Implementation for User Story 2

- [x] T012 [US2] Update src/hooks/useAIConfig.ts to load and persist API keys safely in app_ui_prefs when rememberKeys is enabled
- [x] T013 [US2] Add rememberKeys toggle checkbox in src/components/api-settings/KeyListSection.tsx with clear persistence indicator
- [x] T014 [US2] Wire rememberKeys state and setter through src/components/layout/ApiSettingsModal.tsx and src/components/ApiSettings.tsx

**Checkpoint**: User Story 2 functions reliably with opt-in browser key persistence.

---

## Phase 5: User Story 3 - Accurate Model Support & Key Availability Feedback (Priority: P2)

**Goal**: Ensure the Model Summary card accurately reflects key availability for standard preset models without false negative "Model đang chọn hiện không có API key nào hỗ trợ" warnings.

**Independent Test**: With 1 or more keys configured, select Gemini 2.5 Flash and verify the badge displays "Sẵn sàng sử dụng" with no amber warning alert.

### Tests for User Story 3

- [x] T015 [P] [US3] Unit test for preset model support assessment in src/components/__tests__/KeyListSectionLagFix.test.ts

### Implementation for User Story 3

- [x] T016 [US3] Update computeModelStatsSummary in src/utils/modelRegistry.ts to presume preset models as ready when keys are present
- [x] T017 [US3] Refactor status badge and tone logic in src/components/api-settings/ModelSummaryCard.tsx for preset models
- [x] T018 [US3] Eliminate false negative warning banner for preset models in src/components/api-settings/ModelSummaryCard.tsx

**Checkpoint**: User Story 3 displays truthful model readiness without false alarms.

---

## Phase 6: User Story 4 - Direct Connection Check & Immediate Health Feedback (Priority: P3)

**Goal**: Provide an on-demand "Kiểm tra kết nối" button for each key slot to instantly test key validity and quota status against Google Gemini API.

**Independent Test**: Click "Kiểm tra" button on any key row; verify loading spinner, followed by green "Khóa hợp lệ" badge or descriptive error tooltip.

### Tests for User Story 4

- [x] T019 [P] [US4] Unit test for single-key connection verification ping in src/components/__tests__/KeyListSectionLagFix.test.ts

### Implementation for User Story 4

- [x] T020 [US4] Implement on-demand connection ping button in src/components/api-settings/KeyListSection.tsx using verifyModelDirect
- [x] T021 [US4] Integrate connection test error handling and feedback indicators in src/components/api-settings/KeyListSection.tsx

**Checkpoint**: User Story 4 provides instant visual feedback for key health.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification and quality assurance across the entire feature set.

- [x] T022 Run lint check with npm run lint across modified codebase in package.json
- [x] T023 Run unit test suite with npm test to verify all tests pass in package.json
- [x] T024 Run production build verification with npm run build in package.json
- [x] T025 Validate manual test scenarios per specs/118-fix-api-key-config-lag/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1). BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) and User Story 1 (Phase 3).
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2).
- **User Story 4 (Phase 6)**: Depends on User Story 1 (Phase 3).
- **Polish (Phase 7)**: Depends on all user stories being implemented.

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel.
- **Phase 2**: T004 and T005 can run in parallel.
- **Phase 3**: T006 (test) runs in parallel with foundational test setups; T007 and T010 touch separate components.
- **Phase 4**: T011 (test) can run in parallel.
- **Phase 5**: T015 (test) can run in parallel with T016/T017/T018.
- **Phase 6**: T019 (test) can run in parallel.
- **Phase 7**: T022, T023, T024 run sequentially as mandatory verification gates.

---

## Parallel Example: User Story 1

```bash
# Launch unit test creation in parallel:
Task: T006 [P] [US1] Unit test for debounced key input and partial-key discovery filtering in src/components/__tests__/KeyListSectionLagFix.test.ts

# Implement independent components:
Task: T007 [US1] Implement isolated KeyInputRow subcomponent in src/components/api-settings/KeyListSection.tsx
Task: T010 [US1] Update src/components/QuotaPanel.tsx to pass enabled flag to useModelObservability
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocking guards on discovery)
3. Complete Phase 3: User Story 1 (smooth 60 FPS input & debounced sync)
4. **VALIDATE**: Verify typing lag is eliminated completely

### Incremental Delivery

1. Setup + Foundational -> Guards active
2. Add User Story 1 -> Zero typing lag (MVP!)
3. Add User Story 2 -> Keys persisted across browser sessions
4. Add User Story 3 -> Preset models report ready, no false negative warnings
5. Add User Story 4 -> Ping test button gives immediate feedback
6. Final Polish -> Quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly

---

## Phase 8: Convergence

**Purpose**: Address remaining gaps and contract alignments identified during convergence assessment.

- [x] T026 Wrap KeyInputRow in React.memo and wire onBatchUpdateKeys from useAIConfig through ApiSettingsModal and ApiSettings to KeyListSection per contracts/key-config-interaction.contract.md: Section 1 (partial)
- [x] T027 Update computeModelStatsSummary in src/utils/modelRegistry.ts to set availableKeyCount to effectiveTotalKeys for active preset models when hasChecked is false per contracts/key-config-interaction.contract.md: Section 3 (partial)
- [x] T028 Export LocalKeyDraftItem and ModelSupportAssessment types in src/components/api-settings/KeyListSection.tsx per data-model.md: Section 1 (partial)
- [x] T029 Update QuotaPanel.tsx overview banner badge to reflect preset model readiness when keys exist per contracts/key-config-interaction.contract.md: Section 3 (partial)


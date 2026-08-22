# Tasks: Empty Default Google Drive Inputs in Advanced Settings

## Feature Overview
- **Branch**: `062-empty-default-drive-inputs`
- **Spec**: [`specs/062-empty-default-drive-inputs/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/062-empty-default-drive-inputs/spec.md)
- **Plan**: [`specs/062-empty-default-drive-inputs/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/062-empty-default-drive-inputs/plan.md)

---

## Phase 1: Setup & Pre-Verification

**Purpose**: Verify baseline quality gates and test suite before making edits.

- [x] T001 Verify baseline test suite passes via `npm test`

---

## Phase 2: Foundational (Service Layer Enhancements)

**Purpose**: Add dedicated methods for reading user custom credentials from `localStorage` without `.env` fallback.

- [x] T002 [P] Implement `getCustomClientId()` in `src/services/googleAuthService.ts`
- [x] T003 [P] Implement `getCustomPickerApiKey()` in `src/services/googlePickerService.ts`

---

## Phase 3: User Story 1 - Clean Empty Input Fields with Informative Placeholders (Priority: P1) 🎯 MVP

**Goal**: Ensure Advanced Settings input fields are blank `""` by default, displaying helpful guidance placeholders.

**Independent Test**: Open Google Sync modal without custom keys and expand Advanced Settings; verify both inputs are empty `""` and placeholders instruct that empty inputs use system defaults.

### Implementation
- [x] T004 [US1] Initialize input states with `getCustomClientId()` and `getCustomPickerApiKey()` in `src/components/google-sync/GoogleSyncModal.tsx`
- [x] T005 [US1] Add explicit empty-fallback placeholders to inputs in `src/components/google-sync/GoogleSyncModal.tsx`

**Checkpoint**: Standard users expanding settings see clean empty inputs and no exposed default keys.

---

## Phase 4: User Story 2 - Smooth Custom Key Persistence & Clear Revert Behavior (Priority: P2)

**Goal**: Save custom overrides, restore them on reopen, and clear inputs to `""` on "Mặc định" reset.

**Independent Test**: Save custom keys, verify persistence, click "Mặc định", and verify inputs reset to `""` and custom `localStorage` keys are deleted.

### Implementation & Testing
- [x] T006 [US2] Update `handleResetClientId` and `handleResetPickerKey` to reset inputs to empty string in `src/components/google-sync/GoogleSyncModal.tsx`
- [x] T007 [P] [US2] Add unit tests for `getCustomClientId`, `getCustomPickerApiKey`, and empty default inputs in `src/components/google-sync/__tests__/GoogleSyncModal.test.ts`

**Checkpoint**: Custom credentials are fully editable, persistent, and revert cleanly to blank inputs.

---

## Phase 5: Polish & Quality Gates

**Purpose**: Strict Constitution quality assurance and end-to-end verification.

- [x] T008 [P] Verify type safety with zero type errors via `npm run lint` (`tsc --noEmit`)
- [x] T009 [P] Execute entire unit test suite via `npm test` (`vitest run`)
- [x] T010 Execute production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T011 Verify quickstart manual scenarios from `specs/062-empty-default-drive-inputs/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002 [P], T003 [P])
   │
   ▼
Phase 3: User Story 1 (T004, T005) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T006, T007 [P])
   │
   ▼
Phase 5: Polish & Quality Gates (T008 [P], T009 [P], T010, T011)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Complete T001 (baseline check).
2. Complete T002 + T003 in services.
3. Complete T004 + T005 in `GoogleSyncModal.tsx`.
4. Verify inputs open completely blank with guidance placeholders.

### Full Delivery
5. Complete Phase 4 (reset handler updates & unit tests).
6. Complete Phase 5 (all Constitution quality gates).

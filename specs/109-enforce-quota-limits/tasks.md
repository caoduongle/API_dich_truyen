# Tasks: Enforce Personal Quota Limits & Smart Key Selection

**Feature**: `109-enforce-quota-limits`  
**Input**: Design artifacts from `specs/109-enforce-quota-limits/`  
**Status**: Completed  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing test baseline and test harnesses

- [X] T001 Inspect existing test suites in `src/services/__tests__/directGeminiClient.test.ts` and `src/services/__tests__/clientKeyRotation.test.ts`
- [X] T002 Verify baseline test execution via `npm test src/services/__tests__/directGeminiClient.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and helper utilities required across all user stories

**⚠️ CRITICAL**: Must be completed before User Story implementation begins

- [X] T003 Define `KeyHealthResult` and `isCustomLimitReached` extensions in `src/services/localQuotaTracker.ts` and `src/utils/apiClient.ts`
- [X] T004 Implement `getStoredCustomLimits(): Record<string, CustomLimit>` helper in `src/services/directGeminiClient.ts` to safely load custom limits from `localStorage` (`gemini_quota_custom_limits`)

**Checkpoint**: Foundation ready - User Story implementation can proceed

---

## Phase 3: User Story 1 - Personal Daily Quota Limit Enforcement (Priority: P1) 🎯 MVP

**Goal**: Stop dispatching requests to API keys that have reached user-configured `maxRpd` limits, and auto-route to healthy keys.

**Independent Test**: Configure Key #1 with `maxRpd: 5`. Record 5 requests. Execute a new translation call. Verify Key #1 is skipped, Key #2 is invoked, and 0 HTTP calls are made with Key #1.

### Tests for User Story 1
- [X] T005 [P] [US1] Create unit tests for personal limit enforcement in `src/services/__tests__/directGeminiClient.test.ts`

### Implementation for User Story 1
- [X] T006 [US1] Update `getKeyHealth` in `src/services/localQuotaTracker.ts` to evaluate `customLimit.maxRpd` and mark `isAvailable: false`, `isCustomLimitReached: true` when `requestsToday >= maxRpd`
- [X] T007 [US1] Implement `findNextAvailableKeyIndex` in `src/services/localQuotaTracker.ts` to locate the first available candidate key respecting custom limits
- [X] T008 [US1] Integrate `findNextAvailableKeyIndex` into `callGeminiDirect` in `src/services/directGeminiClient.ts` to abort with `ALL_KEYS_EXHAUSTED` if all configured keys have reached their personal limits

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently (MVP ready).

---

## Phase 4: User Story 2 - Pre-Call Health Inspection & Prevention of Redundant Errors (Priority: P1)

**Goal**: Inspect key availability prior to issuing network requests; bypass exhausted or cooling down keys with 0 HTTP calls and 0 increments to `errorsTotal`.

**Independent Test**: Mark Key #1 as `QuotaExhausted`. Send 10 consecutive translation requests. Verify Key #1 receives 0 HTTP fetch attempts, Key #1's `errorsTotal` remains unchanged, and Key #2 handles all requests.

### Tests for User Story 2
- [X] T009 [P] [US2] Create unit tests for pre-call key health inspection and error non-increment in `src/services/__tests__/clientKeyRotation.test.ts`

### Implementation for User Story 2
- [X] T010 [US2] Refactor `callGeminiDirect` dispatch loop in `src/services/directGeminiClient.ts` to evaluate `getKeyHealth` before `fetch()`, skipping ineligible keys without recording provider attempts or error counts
- [X] T011 [US2] Update rotation advancement in `src/services/directGeminiClient.ts` so post-failure fallback directly advances to the next available healthy key

**Checkpoint**: At this point, User Stories 1 AND 2 are fully integrated and tested.

---

## Phase 5: User Story 3 - Transparent UI Indication of Limit Status (Priority: P2)

**Goal**: Distinguish between user-configured personal limit reached vs upstream provider 429 in the Quota Panel.

**Independent Test**: Open Quota Panel with a key that reached `maxRpd: 500`. Verify the badge shows "Đạt giới hạn ngày (Tự đặt)" with tooltip explanation.

### Implementation for User Story 3
- [X] T012 [P] [US3] Update `getQuotaStatus` in `src/services/localQuotaTracker.ts` to pass `isCustomLimitReached` in snapshot data
- [X] T013 [P] [US3] Update `KeyCardItem.tsx` in `src/components/quota-panel/KeyCardItem.tsx` to render distinct badge for personal limit reached
- [X] T014 [US3] Add unit test in `src/components/__tests__/QuotaPanelHealthBadges.test.ts` for personal limit reached badge rendering

**Checkpoint**: All user stories functional and visually transparent.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gate verification and end-to-end regression validation

- [X] T015 Run type check verification via `npm run lint` (`tsc --noEmit`)
- [X] T016 Run full test suite via `npm test`
- [X] T017 Run production build verification via `npm run build`
- [X] T018 Execute validation scenarios from `specs/109-enforce-quota-limits/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; blocks all User Stories.
- **User Story 1 (Phase 3 - MVP)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (extends `callGeminiDirect` pre-call inspection).
- **User Story 3 (Phase 5)**: Depends on Phase 3 & 4 (consumes `isCustomLimitReached`).
- **Polish (Phase 6)**: Runs after all user stories are complete.

### Parallel Opportunities
- T005 [US1] and T009 [US2] (unit tests) can be drafted in parallel.
- T012 [US3] and T013 [US3] can be implemented in parallel.
- T015, T016, T017 run sequentially in the quality gate.

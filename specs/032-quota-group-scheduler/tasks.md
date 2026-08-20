# Tasks: Project & Quota Group Scheduler Architecture

**Feature**: `specs/032-quota-group-scheduler/spec.md`  
**Plan**: `specs/032-quota-group-scheduler/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish data models, shared types, and test utility harnesses for Quota Group architecture.

- [X] T001 Update shared models and data structures in `shared/models.ts` for `QuotaGroup`, `ApiKeyEntity`, `QuotaDataClassification` (`providerQuota`, `configuredQuota`, `observedUsage`, `schedulingHint`), and `GroupHealthState`
- [X] T002 [P] Create mock factories and test harness utilities in `server/services/__tests__/quotaGroupTestUtils.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Quota Group state management that MUST be complete before user stories can be implemented.

- [X] T003 Refactor `server/services/quotaService.ts` to replace per-key independent quota tracking with `QuotaGroup` collection, group-level sliding windows (RPM/TPM), and PST midnight RPD resets
- [X] T004 [P] Implement 4-tier data classification enforcement in `server/services/quotaService.ts` ensuring `providerQuota.isVerified` defaults to `false` and is never conflated with `configuredQuota` or `schedulingHint`
- [X] T005 [P] Implement backward compatibility and auto-grouping logic in `server/services/quotaService.ts` for unassigned or legacy raw API key arrays

---

## Phase 3: User Story 1 - Project-Level Quota Accounting & Shared Group Capacity (Priority: P1) 🎯 MVP

**Goal**: Group API keys from the same Google Cloud project under a single Quota Group with shared rate limits (RPM, TPM, RPD) so that sibling keys share a unified quota budget.

**Independent Test**: Configure Project A with 2 API keys (Key A1, Key A2) and 15 RPM. Send 15 requests interleaved across Key A1 and Key A2; verify that Project A reaches 15/15 RPM and both keys are temporarily paused by group-level rate pacing.

### Tests for User Story 1 🧪

- [X] T006 [P] [US1] Write unit tests in `server/services/__tests__/quotaGroup.test.ts` for same-project keys sharing sliding-window RPM and TPM consumption

### Implementation for User Story 1

- [X] T007 [US1] Implement group sliding-window consumption, token accumulation, and group-level pacing advancement in `server/services/quotaService.ts`
- [X] T008 [US1] Integrate group-level pacing clock and shared token/request accounting in `server/services/geminiService.ts` dispatch loop

---

## Phase 4: User Story 2 - Multi-Project Quota Isolation & Independent Scaling (Priority: P2)

**Goal**: Support multiple distinct Quota Groups (e.g. Project Alpha and Project Beta) with independent sliding windows, allowing linear throughput scaling and zero cross-project throttling.

**Independent Test**: Configure Project Alpha (15 RPM) and Project Beta (60 RPM). Saturate Project Alpha to 15/15 RPM; verify that new requests immediately route to Project Beta without queuing delay.

### Tests for User Story 2 🧪

- [X] T009 [P] [US2] Write unit tests in `server/services/__tests__/quotaGroup.test.ts` for multi-project isolation (Project A exhausted while Project B remains active and independent)

### Implementation for User Story 2

- [X] T010 [US2] Implement multi-group registry, independent group sliding window tracking, and group scoring in `server/services/quotaService.ts`
- [X] T011 [US2] Implement multi-group scheduling and concurrent capacity utilization in `server/services/geminiService.ts`

---

## Phase 5: User Story 3 - Hierarchical Scheduler Flow & Key Health Isolation (Priority: P3)

**Goal**: Implement the 5-stage hierarchical decision pipeline (`Request -> Model Compatibility -> Quota Group Eligibility -> Quota Group Scoring -> Key Health Selection -> Upstream Dispatch`) with granular key health tracking and group-level 429 cooldown rotation.

**Independent Test**: In Project A with Key A1 (auth failed) and Key A2 (healthy), verify Key A1 is disabled while Key A2 continues serving requests. On upstream 429, verify Project A enters group cooldown and rotates to Project B.

### Tests for User Story 3 🧪

- [X] T012 [P] [US3] Write unit tests in `server/services/__tests__/quotaGroup.test.ts` for key health isolation (401 auth failure disables only the failed key, 503 triggers key cooldown, 429 triggers group cooldown and group rotation)

### Implementation for User Story 3

- [X] T013 [US3] Implement hierarchical candidate evaluation and scoring (`filterEligibleGroups`, `scoreQuotaGroups`, `selectBestKeyInGroup`) in `server/services/quotaService.ts`
- [X] T014 [US3] Implement hierarchical execution flow, key health transitions (`AuthFailed`, `Cooldown`, circuit breaker), and group 429 rotation in `server/services/geminiService.ts`

---

## Phase 6: User Story 4 - Strict Four-Tier Quota Data Classification & Observability (Priority: P4)

**Goal**: Expose Quota Group telemetry and nested key health across REST APIs and frontend UI components, strictly separating `providerQuota`, `configuredQuota`, `observedUsage`, and `schedulingHint`.

**Independent Test**: Query `/api/quota-status` and inspect UI in `QuotaPanel.tsx`: verify group-level RPM/TPM gauges, nested key health badges, and explicit distinction between configured limits vs. observed usage.

### Tests for User Story 4 🧪

- [X] T015 [P] [US4] Write contract tests in `server/services/__tests__/quotaGroupTelemetry.test.ts` verifying `/api/quota-status` response schema and 4-tier data classification

### Implementation for User Story 4

- [X] T016 [US4] Update `/api/quota-status` endpoint in `server/routes/` and `server/services/quotaService.ts` to return structured Quota Group telemetry and nested key health
- [X] T017 [P] [US4] Update frontend API client and types in `src/utils/apiClient.ts` and `src/utils/modelRegistry.ts` for Quota Group structures
- [X] T018 [P] [US4] Update `src/components/QuotaPanel.tsx` to render Quota Group cards (RPM/TPM/RPD gauges) with nested key health badges and clear data classification labels
- [X] T019 [P] [US4] Update `src/components/ApiSettings.tsx` to support Project / Quota Group configuration (setting project-level RPM hints instead of per-key limits)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Refactor existing regression test suites, verify all constitution quality gates, and execute quickstart validation scenarios.

- [X] T020 [P] Update existing test suites in `server/services/__tests__/keyScheduler.test.ts` and `server/services/__tests__/finalRegressionSuite.test.ts` to align with the Quota Group architecture
- [X] T021 [P] Run full quality gate checks (`npm run lint`, `npm test`, `npm run build`) and fix any type or test regressions
- [X] T022 Execute quickstart validation scenarios from `specs/032-quota-group-scheduler/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup (T001, T002)
   │
   ▼
Phase 2: Foundational (T003, T004, T005) [BLOCKS ALL USER STORIES]
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
Phase 3: User Story 1 (P1)    Phase 4: User Story 2 (P2)    Phase 5: User Story 3 (P3)
(T006 -> T007 -> T008)         (T009 -> T010 -> T011)        (T012 -> T013 -> T014)
   │                              │                              │
   └──────────────────────────────┼──────────────────────────────┘
                                  ▼
                     Phase 6: User Story 4 (P4)
                     (T015 -> T016, T017, T018, T019)
                                  │
                                  ▼
                     Phase 7: Polish & Verification
                     (T020, T021, T022)
```

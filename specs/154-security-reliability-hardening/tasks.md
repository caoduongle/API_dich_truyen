# Implementation Tasks: Security & Reliability Hardening

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `154-security-reliability-hardening`

## Phase 1: Setup & Baseline Verification

**Purpose**: Verify existing environment and baseline test pass status before applying changes.

- [X] T001 Verify baseline build, types, and test suite health before changes via `npm run lint` and `npm test`

---

## Phase 2: Foundational (Core Utilities & Contracts)

**Purpose**: Shared utilities and contracts that block user story implementation.

- [X] T002 [P] Implement `parseGeminiStructuredResponse` and schema validator utility in `src/lib/text.ts`
- [X] T003 [P] Eliminate raw key retention in `keyHashCache` within `src/utils/apiKeyHash.ts`

---

## Phase 3: User Story 1 - Transparent Privacy Disclosures & Credential Ephemerality (Priority: P1) 🎯 MVP

**Goal**: Align privacy/security documentation with actual client-direct Gemini data flows, prevent raw secrets from persisting in the memory heap, and default `rememberKeys` to `false` (ephemeral `sessionStorage` by default).

**Independent Test**:
- Inspect `docs/privacy-policy.md` and `SECURITY.md` to confirm clear differentiation between zero application backend and direct browser-to-provider transmission.
- Run `vitest run src/utils/__tests__/apiKeyHash.test.ts` to confirm `keyHashCache` never retains raw secrets.
- Verify that fresh sessions in `src/hooks/useAIConfig.ts` default to `rememberKeys: false` and store keys exclusively in `sessionStorage`.

### Implementation for User Story 1

- [X] T004 [P] [US1] Align data flow and hosting access log disclosures in `docs/privacy-policy.md`
- [X] T005 [P] [US1] Correct client-to-Gemini direct transmission statements in `SECURITY.md`
- [X] T006 [US1] Change `rememberKeys` default to `false` and preserve explicit user preferences in `src/hooks/useAIConfig.ts`
- [X] T007 [P] [US1] Update default `rememberKeys` state to `false` in `src/components/api-settings/KeyListSection.tsx`
- [X] T008 [P] [US1] Add unit tests verifying zero raw secret retention in memory cache in `src/utils/__tests__/apiKeyHash.test.ts`
- [X] T009 [US1] Update storage audit tests to assert session-only default credentials in `src/utils/__tests__/storageAudit.test.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable. Privacy policies are honest and credentials do not linger in memory or persistent storage by default.

---

## Phase 4: User Story 2 - Bounded Service Discovery & Resilient External Ingestion (Priority: P1)

**Goal**: Prevent indefinite network hangs during model catalog discovery with a 15s timeout, safely decode structured AI responses without crashing on malformed JSON, and correct misleading model labels.

**Independent Test**:
- Run `vitest run src/services/__tests__/directGeminiClient.test.ts` to verify 15s timeout abort and external `AbortSignal` cancellation.
- Run `vitest run src/lib/__tests__/text.test.ts` to verify `parseGeminiStructuredResponse` handles markdown wrappers and invalid JSON gracefully.
- Check `src/config/models.ts` to ensure `gemma-4-31b-it` is labeled `(API)` rather than `(Local)`.

### Implementation for User Story 2

- [X] T010 [P] [US2] Add 15-second `AbortController` timeout and signal support to `listModelsDirect` in `src/services/directGeminiClient.ts`
- [X] T011 [P] [US2] Update `gemma-4-31b-it` label from `(Local)` to `(API)` in `src/config/models.ts`
- [X] T012 [US2] Replace raw `JSON.parse` with `parseGeminiStructuredResponse` in `src/services/directGeminiClient.ts`
- [X] T013 [US2] Replace raw `JSON.parse` with `parseGeminiStructuredResponse` in `src/services/hakoQualityEngine.ts`
- [X] T014 [P] [US2] Add unit tests for `parseGeminiStructuredResponse` error handling and fallbacks in `src/lib/__tests__/text.test.ts`
- [X] T015 [P] [US2] Add unit tests for `listModelsDirect` timeout abort and external signal handling in `src/services/__tests__/directGeminiClient.test.ts`

**Checkpoint**: User Stories 1 AND 2 are complete. External network discovery cannot hang indefinitely, and structured responses are safely ingested.

---

## Phase 5: User Story 3 - Production Build Hygiene & Scoped Environment Isolation (Priority: P2)

**Goal**: Enforce production console/debugger stripping based on build `mode === 'production'` and restrict environment variable loading to `VITE_` prefixed variables.

**Independent Test**:
- Execute `npm run build` and verify successful bundle output without errors.
- Confirm console/debugger stripping is keyed on `mode === 'production'`.

### Implementation for User Story 3

- [X] T016 [US3] Configure esbuild drop using `mode === 'production'` and restrict `loadEnv` to `'VITE_'` prefix in `vite.config.ts`
- [X] T017 [US3] Verify production bundle creation and console stripping via `npm run build`

**Checkpoint**: Build configuration conforms to least-privilege variable exposure and strict mode checking.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: End-to-end verification, regression checks, and quality gate assurance.

- [X] T018 Run quickstart validation test scenarios per `specs/154-security-reliability-hardening/quickstart.md`
- [X] T019 Run full automated quality gate (`npm run lint`, `npm test`, `npm run build`) to confirm zero regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — executes first to verify clean baseline.
- **Foundational (Phase 2)**: Core parser and hashing utilities in `src/lib/text.ts` and `src/utils/apiKeyHash.ts` — blocks User Stories 1 and 2.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion. Can run in parallel with US1.
- **User Story 3 (Phase 5)**: Independent build configuration hardening.
- **Polish (Phase 6)**: Depends on all user story implementations being completed.

### Parallel Opportunities

```bash
# Parallel Phase 2 Foundations:
Task T002: Implement parseGeminiStructuredResponse in src/lib/text.ts
Task T003: Eliminate raw key retention in src/utils/apiKeyHash.ts

# Parallel Documentation & UI Tasks for User Story 1:
Task T004: Update docs/privacy-policy.md
Task T005: Update SECURITY.md
Task T007: Update KeyListSection.tsx
Task T008: Add unit tests in apiKeyHash.test.ts

# Parallel Tasks for User Story 2:
Task T010: Timeout support in directGeminiClient.ts
Task T011: Update models.ts label
Task T014: Add parser tests in text.test.ts
Task T015: Add discovery tests in directGeminiClient.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Focus)
1. Complete T001 (Baseline check).
2. Complete Foundational T002 and T003.
3. Complete User Story 1 (T004 through T009) to achieve immediate data privacy disclosure alignment and eliminate in-memory raw credential retention.
4. Validate User Story 1 independently.

### Incremental Delivery
1. Add User Story 2 (T010 through T015) to guarantee network deadline bounding and structured response ingestion safety.
2. Add User Story 3 (T016 and T017) to harden Vite build configuration.
3. Execute Polish (T018 and T019) to verify all quality gates pass cleanly without regressions.

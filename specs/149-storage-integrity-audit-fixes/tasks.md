---
description: "Task list for storage integrity, security parity & hygiene remediation"
---

# Tasks: Storage Integrity, Security Parity & Hygiene Remediation

**Input**: Design documents from `specs/149-storage-integrity-audit-fixes/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Date**: 2026-09-20  

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All descriptions specify exact file paths

---

## Phase 1: Setup & Environment Standardization

**Purpose**: Establish baseline compiler checks and environment configuration prerequisites.

- [x] T001 [P] Standardize runtime documentation to Node.js 20 LTS in `README.md`
- [x] T002 [P] Repair UTF-8 mojibake encoding corruption in `specs/147-crdt-atomic-manifest-hardening/tasks.md`
- [x] T003 [P] Create `specs/README.md` architecture index categorizing historical specs (001–092) as superseded legacy backend specs

---

## Phase 2: Foundational Concurrency & Database Atomicity (Blocking Prerequisites)

**Purpose**: Hardening storage write serialization and in-transaction validation before updating high-level services and UI.

**⚠️ CRITICAL**: No high-level service or export logic should proceed until database serialization invariants are locked.

- [x] T004 [P] Refactor `src/services/projectStorageQueue.ts` to execute database writes lazily inside the queue chain and remove unused import `enqueueProjectWrite`
- [x] T005 Update `src/services/db.ts` to execute chapter ownership validation inside the same single `readwrite` transaction in `executeSaveProjectToDB`
- [x] T006 Update `src/services/db.ts` to execute chapter foreign key validation inside the same single `readwrite` transaction in `executeAtomicSaveProjectBundle`
- [x] T007 Run existing storage tests to verify queue serialization and atomicity: `npx vitest run src/services/__tests__/projectStorageQueue.test.ts src/services/__tests__/db.test.ts src/services/__tests__/projectDeleteQueue.test.ts`

**Checkpoint**: Foundation ready — database writes are strictly serialized per `projectId` and validation is TOCTOU-free.

---

## Phase 3: User Story 1 - Storage Queue Consolidation & Execution Order Guarantee (Priority: P1) 🎯 MVP

**Goal**: Guarantee strict FIFO write ordering per `projectId`, zero zombie project resurrection, and eliminating eager promise execution.

**Independent Test**: Concurrent saves and deletes queued against the same `projectId` must execute sequentially in FIFO order without resurrection.

### Tests for User Story 1
- [x] T008 [US1] Add unit test cases in `src/services/__tests__/projectStorageQueue.test.ts` asserting lazy promise execution and FIFO order

### Implementation for User Story 1
- Handled in foundational task T004 in `src/services/projectStorageQueue.ts` with direct delegation to `src/services/db.ts`.

**Checkpoint**: User Story 1 is functional, lazy, and verified with dedicated test coverage.

---

## Phase 4: User Story 2 - Atomic In-Transaction Validation & TOCTOU Elimination (Priority: P1)

**Goal**: Execute chapter ownership and foreign key invariant checks inside the active `readwrite` transaction, aborting atomically on invariant violations.

**Independent Test**: Attempting to save chapters belonging to another project or orphaned chapter IDs must immediately trigger `transaction.abort()` and reject without partial commits.

### Tests for User Story 2
- [x] T009 [US2] Add unit tests in `src/services/__tests__/db.test.ts` verifying that relational validation failure in `executeSaveProjectToDB` and `executeAtomicSaveProjectBundle` aborts the active transaction atomically

### Implementation for User Story 2
- Handled in foundational tasks T005 and T006 in `src/services/db.ts`.

**Checkpoint**: User Stories 1 and 2 work independently with full atomic rollback guarantees.

---

## Phase 5: User Story 3 - Gemini API Key Storage Policy Reconciliation (Priority: P1)

**Goal**: Align API key persistence documentation with application behavior and add a shared-workstation warning in the UI.

**Independent Test**: Inspect `localStorage` vs `sessionStorage` under `rememberKeys` toggle states, and confirm UI warning is present in the API Settings modal.

### Implementation for User Story 3
- [x] T010 [P] [US3] Add shared device warning label in `src/components/api-settings/KeyListSection.tsx` below the `rememberKeys` toggle
- [x] T011 [P] [US3] Update `README.md`, `SECURITY.md`, and `docs/architecture.md` to document the reconciled API key persistence policy

**Checkpoint**: API key persistence policy is 100% transparent and consistently documented across code, docs, and UI.

---

## Phase 6: User Story 4 - Public URL & Canonical Origin Decoupling (Priority: P1)

**Goal**: Remove hardcoded Render domain and make canonical, OpenGraph, JSON-LD, and robots.txt URLs resolve dynamically via `VITE_PUBLIC_URL`.

**Independent Test**: Build output in `dist/index.html` and `public/robots.txt` must interpolate `VITE_PUBLIC_URL` or default origin cleanly.

### Implementation for User Story 4
- [x] T012 [P] [US4] Decouple hardcoded Render URLs in `index.html` using `%VITE_PUBLIC_URL%` interpolation or dynamic origin fallback via `vite.config.ts`
- [x] T013 [P] [US4] Decouple sitemap URL from Render domain in `public/robots.txt`

**Checkpoint**: Application metadata and crawler directives are completely portable across Render, Vercel, Netlify, and custom domains.

---

## Phase 7: User Story 5 - Documentation & Route Feature Parity (Priority: P1)

**Goal**: Remove nonexistent export format claims (DOCX) and synchronize route listings in documentation for AI agents and search engines.

**Independent Test**: Verify `public/llms.txt` accurately lists only supported export formats (`.txt`, `.json`, `.epub`) and valid application routes.

### Implementation for User Story 5
- [x] T014 [P] [US5] Remove DOCX claim and correct client route list in `public/llms.txt`

**Checkpoint**: Documentation parity achieved with zero false capability claims.

---

## Phase 8: User Story 6 - Real EPUB Exporter Test Suite & Concurrency Optimization (Priority: P1)

**Goal**: Validate full generated EPUB 3 archive structure and optimize chapter loading with bounded concurrency.

**Independent Test**: Exporting an EPUB must produce a valid ZIP package containing `mimetype`, `META-INF/container.xml`, `OEBPS/content.opf`, `OEBPS/nav.xhtml`, `OEBPS/toc.ncx`, and valid chapter XHTMLs.

### Implementation for User Story 6
- [x] T015 [US6] Implement bounded concurrent batch chapter fetching in `src/hooks/useEpubExport.ts`
- [x] T016 [US6] Refactor `src/hooks/__tests__/useEpubExport.test.ts` to remove unused imports and add integration tests inspecting the generated ZIP package structure

**Checkpoint**: EPUB export produces compliant EPUB 3 archives with bounded memory/connection usage.

---

## Phase 9: User Story 7 - Multi-Platform CSP Parity Automated Test (Priority: P2)

**Goal**: Prevent security policy drift across deployment targets with an automated quad-parity test.

**Independent Test**: Running `vitest run src/tests/cspParity.test.ts` must pass, verifying directive equality across `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`.

### Tests for User Story 7
- [x] T017 [US7] Create automated CSP parity test in `src/tests/cspParity.test.ts` asserting directive equality across `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`

**Checkpoint**: All 4 deployment targets are locked to identical CSP policies.

---

## Phase 10: User Story 8 - Compiler Guards & Repository Hygiene (Priority: P2/P3)

**Goal**: Enforce strict TypeScript compiler checks without any unused locals, unused parameters, or switch fallthroughs.

**Independent Test**: `npm run lint` must exit code 0 with strict compiler flags enabled in `tsconfig.json`.

### Implementation for User Story 8
- [x] T018 Enable `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` in `tsconfig.json`

**Checkpoint**: Strict type safety enforced across the entire codebase.

---

## Phase 11: Polish & Quality Gates Verification

**Purpose**: Execute mandatory quality gates per `AGENTS.md` and repository requirements.

- [x] T019 Run full verification suite: `npm run lint`, `npm test`, `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — executed first.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories to ensure database integrity.
- **User Stories (Phases 3 to 10)**: All depend on Foundational phase completion.
  - Can proceed sequentially in priority order (P1 → P2 → P3).
- **Polish (Phase 11)**: Final verification gate across all stories.

### User Story Dependencies

- **US1 (Storage Queue)**: Foundation-level, independent.
- **US2 (TOCTOU In-Transaction Validation)**: Integrates with US1 write queue in `db.ts`.
- **US3 (API Key Disclosure & Warning)**: Independent (UI + docs).
- **US4 (Origin Decoupling)**: Independent (`index.html`, `public/robots.txt`, `vite.config.ts`).
- **US5 (LLMs.txt Route Parity)**: Independent (`public/llms.txt`).
- **US6 (EPUB Bounded Batch & Tests)**: Independent (`src/hooks/useEpubExport.ts`).
- **US7 (CSP Parity Test)**: Independent test (`src/tests/cspParity.test.ts`).
- **US8 (Compiler Guards)**: Cross-cutting, validates all files.

### Parallel Opportunities

- Tasks T001, T002, T003 in Setup can run in parallel.
- Tasks T010, T011, T012, T013, T014 in User Stories 3, 4, and 5 can run in parallel (different files, no blocking dependencies).
- Tasks T015/T016 (EPUB export) and T017 (CSP parity) can run in parallel.

---

## Parallel Example: User Story 1 & 6

```bash
# Launch storage queue and EPUB export tests:
Task: "Add unit test cases in src/services/__tests__/projectStorageQueue.test.ts"
Task: "Integration test for EPUB package structure in src/hooks/__tests__/useEpubExport.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2 Only)

1. Complete Phase 1: Setup & Environment Standardization
2. Complete Phase 2: Foundational Concurrency & Database Atomicity
3. Complete Phase 3 & 4: User Story 1 & 2 (Storage write serialization and atomic in-transaction validation)
4. **VALIDATE**: Run `npx vitest run src/services/__tests__/projectStorageQueue.test.ts src/services/__tests__/db.test.ts`

### Incremental Delivery

1. Setup + Foundational → Database core hardened
2. US1 & US2 → Storage queue FIFO & zero TOCTOU (MVP)
3. US3 → API key transparency & workstation warning
4. US4 & US5 → Origin decoupling & documentation parity
5. US6 → Bounded concurrency chapter loading & EPUB 3 validation tests
6. US7 → Multi-platform CSP quad-parity automated test
7. US8 → Strict compiler guards enabled in `tsconfig.json`
8. Phase 11 → Full quality gates verification (`npm run lint`, `npm test`, `npm run build`)

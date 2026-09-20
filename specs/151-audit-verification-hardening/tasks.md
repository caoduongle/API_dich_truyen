# Tasks: Production Verification & Integrity Hardening

**Feature**: `151-audit-verification-hardening`  
**Input**: Design documents from `specs/151-audit-verification-hardening/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)  
**Date**: 2026-09-20  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configure test dependencies for standards-compliant XML parser environment.

- [x] T001 Install `jsdom` and `@types/jsdom` as devDependencies in `package.json` for Vitest DOMParser environment support

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core public origin utility and build configuration loader required by multiple user stories.

> [!IMPORTANT]
> This phase must complete before User Story 1 and User Story 3 can consume production URL utilities.

- [x] T002 Create `src/config/publicOrigin.ts` implementing `resolvePublicOrigin`, URL scheme validation (`http://` / `https://`), base path normalization, and HTML/sitemap transformation per `specs/151-audit-verification-hardening/contracts/public-origin.contract.ts`
- [x] T003 Update `vite.config.ts` to import and use `src/config/publicOrigin.ts` for public origin resolution, base path handling, and sitemap transformation

**Checkpoint**: Foundation ready — production origin utility and Vite configuration are integrated.

---

## Phase 3: User Story 1 — Sub-Path Aware Public URL Architecture & Containerization (Priority: P1) 🎯 MVP

**Goal**: Unify origin and base path (`origin + base`) for sitemap and canonical links, adapt root-relative asset URLs in `index.html` to `%BASE_URL%`, support Docker build args, and document them.

**Independent Test**: Build the project with custom `VITE_PUBLIC_URL` and `VITE_BASE_URL` and verify that `dist/index.html` and `dist/sitemap.xml` emit `https://example.com/subpath/...` and static asset links resolve relative to base path.

### Implementation for User Story 1

- [x] T004 [US1] Update `index.html` to use `%BASE_URL%` for public static asset references (`/favicon.svg`, `/theme-init.js`, `/site.webmanifest`, `/og-image.svg`) and `%VITE_CANONICAL_URL%` for canonical `<link>` and OpenGraph tags
- [x] T005 [P] [US1] Update `Dockerfile` to accept `ARG VITE_PUBLIC_URL` and `ARG VITE_BASE_URL=/`, exporting them as `ENV VITE_PUBLIC_URL` and `ENV VITE_BASE_URL` before `RUN npm run build`
- [x] T006 [P] [US1] Update `README.md` to document `VITE_PUBLIC_URL` in the environment variables table and add Docker build instructions with `--build-arg`
- [x] T007 [US1] Run `npm run lint && npm run build` to verify User Story 1 compiles and transforms assets cleanly

**Checkpoint**: User Story 1 complete — sub-path deployments and Docker container builds dynamically receive origin and base configurations.

---

## Phase 4: User Story 2 — True XML Parser Verification & Chapter Order Preservation in EPUB (Priority: P1)

**Goal**: Equip EPUB tests with a real XML parser (DOMParser), eliminate heuristic regex fallback, tighten `mimetype` and compression assertions, and preserve `proj.chapters` manifest sequence during EPUB export.

**Independent Test**: Run `src/hooks/__tests__/useEpubExport.test.ts` to confirm all XML documents are validated by DOMParser with 0 `parsererror` elements, `mimetype` is byte-exact, and chapters created out of chronological order export in the sequence defined by `proj.chapters`.

### Implementation for User Story 2

- [x] T008 [US2] Update `src/hooks/useEpubExport.ts` to sort chapters based on the `proj.chapters` array order (using `proj.chapters` index map) with `createdAt` as fallback
- [x] T009 [US2] Update `src/hooks/__tests__/useEpubExport.test.ts` to add `/** @vitest-environment jsdom */` and remove the regex/stack fallback parser from `assertXmlWellFormed`, enforcing genuine `DOMParser` validation
- [x] T010 [US2] Tighten assertions in `src/hooks/__tests__/useEpubExport.test.ts`: assert `mimetype` is byte-exact `application/epub+zip` without trailing whitespace (no `.trim()`) and compression is strictly `STORE`
- [x] T011 [US2] Add test in `src/hooks/__tests__/useEpubExport.test.ts` verifying that chapters created out of order chronologically are exported in the exact sequence specified by `proj.chapters`
- [x] T012 [US2] Run `npm test -- src/hooks/__tests__/useEpubExport.test.ts` to verify User Story 2 passes all XML well-formedness and ordering assertions

**Checkpoint**: User Story 2 complete — EPUB export strictly preserves manifest order and automated tests validate IDPF compliance with a genuine XML parser.

---

## Phase 5: User Story 3 — Production Public Origin Module & End-to-End Build Verification (Priority: P2)

**Goal**: Refactor `src/tests/originConfig.test.ts` to test `src/config/publicOrigin.ts` directly, and add build integration tests verifying dynamic transformation.

**Independent Test**: Run `src/tests/originConfig.test.ts` to verify that production utility functions handle all edge cases (protocol schemes, subpaths, trailing slashes) and build output transformations.

### Implementation for User Story 3

- [x] T013 [US3] Update `src/tests/originConfig.test.ts` to import and test `src/config/publicOrigin.ts` directly (testing protocol scheme validation, subpath join, trailing slash normalization, HTML and sitemap transformation)
- [x] T014 [US3] Add build integration test in `src/tests/originConfig.test.ts` validating that `dist/index.html` and `dist/sitemap.xml` contain transformed URLs without unreplaced placeholders
- [x] T015 [US3] Run `npm test -- src/tests/originConfig.test.ts` to verify User Story 3 passes

**Checkpoint**: User Story 3 complete — public origin tests exercise real production code and confirm build-time artifact fidelity.

---

## Phase 6: User Story 4 — Database Write Queue Final State Verification (Priority: P2)

**Goal**: Verify that concurrent interleaved operations (`save A1 -> save A2 -> delete A -> save A3`) leave the database record in the deterministic final state (`A3`) with zero resurrection.

**Independent Test**: Run `src/services/__tests__/db.test.ts` to assert that after the interleaved sequence completes, the stored project has `title === 'A3'`.

### Implementation for User Story 4

- [x] T016 [US4] Update `src/services/__tests__/db.test.ts` in the FIFO serialization sequence test to maintain an in-memory project store in `mockProjectsStore`
- [x] T017 [US4] Add assertion in `src/services/__tests__/db.test.ts` verifying that after interleaved `[save A1, save A2, delete A, save A3]`, the store contains `A3` (`storedProjects.get(projectId)?.title === 'A3'`) with zero resurrection
- [x] T018 [US4] Run `npm test -- src/services/__tests__/db.test.ts` to verify User Story 4 passes

**Checkpoint**: User Story 4 complete — database serialization invariants are verified against stored persistent state.

---

## Phase 7: User Story 5 — Specification & Documentation Bookkeeping Reconciliation (Priority: P3)

**Goal**: Align all completed specification and checklist status notes.

**Independent Test**: Inspect `specs/150-post-audit-hardening/` to confirm completion status consistency.

### Implementation for User Story 5

- [x] T019 [US5] Verify and confirm `specs/150-post-audit-hardening/spec.md` and checklist notes reflect completed and verified implementation status

**Checkpoint**: User Story 5 complete — documentation and specification bookkeeping are fully aligned.

---

## Phase 8: Polish & Quality Gate Clearance

**Purpose**: Run full end-to-end quickstart validation and mandatory quality gates across the entire repository.

- [x] T020 Run `specs/151-audit-verification-hardening/quickstart.md` verification scenarios across all 5 test scenarios
- [x] T021 Run full quality gate: `npm run lint && npm test && npm run build` — 0 errors, 0 warnings, 0 skipped tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS User Story 1 and User Story 3.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (Public origin utility).
- **User Story 2 (Phase 4)**: Depends on Phase 1 (`jsdom` devDependency) — can run in parallel with US1 or sequentially.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and Phase 3.
- **User Story 4 (Phase 6)**: Independent of US1/US2/US3 — can run in parallel or sequentially.
- **User Story 5 (Phase 7)**: Independent documentation check — parallel-safe.
- **Polish (Phase 8)**: Depends on all user stories (Phases 3–7) being completed.

### Parallel Opportunities

- Within Phase 3: `T005` (`Dockerfile`) and `T006` (`README.md`) modify different files and can run in parallel.
- User Story 2 (`T008`–`T012`) and User Story 4 (`T016`–`T018`) touch completely disjoint files (`useEpubExport` vs `db.test.ts`) and can proceed in parallel.
- User Story 5 (`T019`) can proceed in parallel with any other story.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`T001`).
2. Complete Phase 2: Foundational (`T002`, `T003`).
3. Complete Phase 3: User Story 1 (`T004`–`T007`).
4. **STOP and VALIDATE**: Test `dist/index.html` and `dist/sitemap.xml` with custom origin and subpath.

### Incremental Delivery

1. Phase 1 + 2: Foundational setup complete.
2. Phase 3 (US1): Sub-path portability & Docker build args delivered.
3. Phase 4 (US2): Real XML parser verification & chapter order preservation delivered.
4. Phase 5 (US3): Production public origin module & build verification delivered.
5. Phase 6 (US4): FIFO queue final state verified in database tests.
6. Phase 7 (US5): Documentation bookkeeping reconciled.
7. Phase 8: Full quality gate clearance (`npm run lint && npm test && npm run build`).

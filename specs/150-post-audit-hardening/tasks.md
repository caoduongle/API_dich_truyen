# Tasks: Post-Audit Integrity & Quality Hardening

**Feature**: `150-post-audit-hardening`  
**Input**: Design documents from `specs/150-post-audit-hardening/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)  
**Date**: 2026-09-20  

---

## Phase 1: Setup & Shared Infrastructure

**Purpose**: Document configuration parameters and remove deprecated duplicate test assets.

- [x] T001 [P] Document `VITE_PUBLIC_URL` with origin usage instructions in `.env.example`
- [x] T002 [P] Remove deprecated duplicate test file `src/config/__tests__/cspParity.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core configuration loader required for build-time origin preprocessing across all deployment targets.

> [!IMPORTANT]
> This phase must complete before User Story 1 can transform dynamic sitemap and HTML assets.

- [x] T003 Update `vite.config.ts` to call `loadEnv(mode, process.cwd(), '')` inside `defineConfig(({ mode }))`, strip trailing slashes from `publicUrl`, and export `process.env.VITE_PUBLIC_URL`

**Checkpoint**: Foundation ready — `vite.config.ts` dynamically evaluates environment files during config initialization.

---

## Phase 3: User Story 1 — Public Origin Portability & Sitemap Decoupling (Priority: P1) 🎯 MVP

**Goal**: Decouple `sitemap.xml` and HTML metadata so deployments to custom domains or alternate hosting providers dynamically resolve the configured `VITE_PUBLIC_URL`.

**Independent Test**: Configure a custom `VITE_PUBLIC_URL` in `.env`, run `npm run build`, and assert that `dist/index.html` and `dist/sitemap.xml` contain the custom origin and zero unreplaced `%VITE_PUBLIC_URL%` tokens or hard-coded fallback domains.

### Implementation for User Story 1

- [x] T004 [US1] Update `public/sitemap.xml` to replace hard-coded `https://api-dich-truyen.onrender.com` URLs with `%VITE_PUBLIC_URL%` token across all 6 route entries
- [x] T005 [US1] Add `sitemap-transform-public-url` plugin in `vite.config.ts` implementing `closeBundle()` to replace `%VITE_PUBLIC_URL%` in `dist/sitemap.xml` at build time and `configureServer()` to serve transformed XML in dev mode
- [x] T006 [US1] Add automated test in `src/tests/originConfig.test.ts` verifying origin resolution, trailing slash normalization, HTML token replacement, and sitemap transformation per `specs/150-post-audit-hardening/contracts/origin-config.contract.ts`
- [x] T007 [US1] Run `npm run lint && npm test && npm run build` to verify User Story 1 passes all quality gates cleanly

**Checkpoint**: User Story 1 complete — public origin is fully portable and decoupled from hard-coded vendor domains.

---

## Phase 4: User Story 2 — EPUB XML Structure Validation & Safe Download Lifecycle (Priority: P2)

**Goal**: Enforce strict IDPF EPUB 3.0 container compliance by validating XML well-formedness with DOM parser verification, verifying uncompressed `mimetype` at archive index 0, and deferring object URL revocation.

**Independent Test**: Run `src/hooks/__tests__/useEpubExport.test.ts` to assert that all generated XML/XHTML descriptors parse with 0 `parsererror` elements, `mimetype` is entry index 0 with `STORE` compression, and `URL.revokeObjectURL` is deferred.

### Implementation for User Story 2

- [x] T008 [US2] Update `src/hooks/useEpubExport.ts` to defer `URL.revokeObjectURL(url)` via `setTimeout(() => URL.revokeObjectURL(url), 1000)` instead of immediate synchronous cleanup
- [x] T009 [US2] Implement XML structural well-formedness helper with `DOMParser` and fallback tag/attribute validator in `src/hooks/__tests__/useEpubExport.test.ts` per `specs/150-post-audit-hardening/contracts/epub-validation.contract.ts`
- [x] T010 [US2] Add assertions in `src/hooks/__tests__/useEpubExport.test.ts` verifying that `Object.keys(zip.files)[0] === 'mimetype'` and `zip.files['mimetype'].options.compression === 'STORE'`
- [x] T011 [US2] Add assertions in `src/hooks/__tests__/useEpubExport.test.ts` parsing `container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, `cover.xhtml`, and chapter XHTMLs, confirming 0 `parsererror` nodes
- [x] T012 [US2] Add assertion in `src/hooks/__tests__/useEpubExport.test.ts` verifying that `URL.revokeObjectURL` is deferred via timer rather than invoked synchronously before download dispatch
- [x] T013 [US2] Run `npm run lint && npm test && npm run build` to verify User Story 2 passes all quality gates cleanly

**Checkpoint**: User Story 2 complete — EPUB archives conform to IDPF packaging standards and file downloads execute safely across browsers.

---

## Phase 5: User Story 3 — Test Suite Consolidation & Database Write Queue Invariant Verification (Priority: P2)

**Goal**: Retain `src/tests/cspParity.test.ts` as the sole canonical CSP test, extract in-memory `validateBundleInput` helper in `src/services/db.ts`, and test strict FIFO DB serialization for `save A1 -> save A2 -> delete A -> save A3`.

**Independent Test**: Run `src/tests/cspParity.test.ts` to verify Quad-Parity across all 4 platforms, and run `src/services/__tests__/db.test.ts` to verify FIFO execution order and absence of project resurrection.

### Implementation for User Story 3

- [x] T014 [US3] Extract `validateBundleInput()` in `src/services/db.ts` to validate bundle CRDT/chapter consistency in-memory before opening IDB transaction per `specs/150-post-audit-hardening/contracts/bundle-validation.contract.ts`
- [x] T015 [US3] Add unit tests for `validateBundleInput()` in `src/services/__tests__/db.test.ts` validating orphan CRDT state detection and project ID mismatches
- [x] T016 [US3] Add integration test in `src/services/__tests__/db.test.ts` for FIFO database write queue executing interleaved sequence `save A1 -> save A2 -> delete A -> save A3`, verifying exact chronological completion and final state A3
- [x] T017 [US3] Verify `src/tests/cspParity.test.ts` passes cleanly as the sole authoritative CSP parity test suite across `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`
- [x] T018 [US3] Run `npm run lint && npm test && npm run build` to verify User Story 3 passes all quality gates cleanly

**Checkpoint**: User Story 3 complete — test responsibilities are deduplicated and database serialization invariants are verified by direct tests.

---

## Phase 6: User Story 4 — UX Copy Realignment, Architecture Documentation & Specification Bookkeeping (Priority: P3)

**Goal**: Realign API Settings quota copy to accurately convey Project/Quota Group mechanics, remove obsolete IndexedDB encryption claims from documentation, and reconcile historical task markers and specification statuses.

**Independent Test**: Inspect `KeyListSection.tsx`, `docs/architecture.md`, `specs/147/tasks.md`, and `specs/149/` to confirm text accuracy and status alignment.

### Implementation for User Story 4

- [x] T019 [P] [US4] Update quota description copy in `src/components/api-settings/KeyListSection.tsx` line 327 to neutrally describe rate limits as managed per Project / Quota Group with keys providing health pool failover
- [x] T020 [P] [US4] Update `docs/architecture.md` line 8 to remove obsolete claim `"hoặc mã hóa trong IndexedDB"`, aligning with active storage policy (`sessionStorage` / `localStorage`)
- [x] T021 [P] [US4] Mark task `[x] T032` in `specs/147-crdt-atomic-manifest-hardening/tasks.md` to reconcile task bookkeeping
- [x] T022 [P] [US4] Update status metadata in `specs/149-storage-integrity-audit-fixes/spec.md` (to `Status: Completed`) and `quickstart.md` (to `Status: Completed`)
- [x] T023 [US4] Run `npm run lint && npm test && npm run build` to verify User Story 4 passes all quality gates cleanly

**Checkpoint**: User Story 4 complete — documentation, UI copy, and task bookkeeping are completely reconciled.

---

## Phase 7: Polish & Quality Gate Clearance

**Purpose**: Run full end-to-end quickstart validation and mandatory quality gates across the entire repository.

- [x] T024 Run `specs/150-post-audit-hardening/quickstart.md` verification scenarios across all 5 test scenarios
- [x] T025 Run full quality gate: `npm run lint && npm test && npm run build` — 0 errors, 0 warnings, 0 skipped tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS User Story 1.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (Foundational config loading).
- **User Story 2 (Phase 4)**: Independent of US1 — can run in parallel with US1 or sequentially.
- **User Story 3 (Phase 5)**: Depends on T002 (removal of duplicate CSP test) — can run in parallel with US1/US2.
- **User Story 4 (Phase 6)**: Independent of other stories — parallel-safe documentation and UI copy edits.
- **Polish (Phase 7)**: Depends on all user stories (Phases 3–6) being completed.

### Parallel Opportunities

- Within Phase 1: `T001` and `T002` modify different directories and can run in parallel.
- Within Phase 4: `T008` (hook edit) and `T009`–`T012` (test suite enhancements) can proceed in parallel.
- Within Phase 6: `T019`, `T020`, `T021`, and `T022` all modify completely distinct files and can run in parallel.
- User Story 1, User Story 2, User Story 3, and User Story 4 can proceed in parallel once Foundational Phase 2 is complete.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`T001`, `T002`).
2. Complete Phase 2: Foundational (`T003`).
3. Complete Phase 3: User Story 1 (`T004`–`T007`).
4. **STOP and VALIDATE**: Test `dist/index.html` and `dist/sitemap.xml` with custom origin.
5. Deployable MVP ready.

### Incremental Delivery

1. Setup + Foundational → Base environment loader active.
2. Deliver US1 (Origin & Sitemap Decoupling) → Origin portability achieved.
3. Deliver US2 (EPUB XML & Mimetype Hardening) → E-book packaging compliance verified.
4. Deliver US3 (Test Consolidation & DB FIFO Queue Verification) → Single CSP authority & DB serialization verified.
5. Deliver US4 (UX Copy, Architecture Docs & Bookkeeping) → Full documentation & UI fidelity.
6. Polish & Final Quality Gate (`T024`, `T025`) → Feature complete.

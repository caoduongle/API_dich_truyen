# Tasks: CI Runtime Parity & Container Integrity Hardening

**Feature**: `152-ci-runtime-audit-fixes`  
**Input**: Design documents from `specs/152-ci-runtime-audit-fixes/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`)  
**Date**: 2026-09-21  

---

## Phase 1: Setup (Dependency Compatibility Fix)

**Purpose**: Restore CI green by fixing the jsdom/Node 20 runtime incompatibility that blocks all automated test verification.

- [x] T001 Downgrade `jsdom` from `"^30.1.0"` to `"29.1.1"` in `package.json` devDependencies
- [x] T002 Remove `"@types/jsdom": "^30.0.0"` from devDependencies in `package.json`
- [x] T003 Regenerate `package-lock.json` by running `npm install` to resolve dependency tree for jsdom@29.1.1
- [x] T004 Run `npm test -- src/hooks/__tests__/useEpubExport.test.ts` to verify jsdom environment worker starts successfully on Node 20 without `markAsUncloneable` errors

---

## Phase 2: Foundational (Build Config Normalization)

**Purpose**: Align the Vite build configuration to use the normalized base path from `publicOrigin.ts`, eliminating divergence between path normalization and build tool input.

> [!IMPORTANT]
> This phase must complete before User Story 2 (Docker sub-path) and User Story 3 (build artifact verification) can be validated end-to-end.

- [x] T005 Update `vite.config.ts` line 22: change `base: process.env.VITE_BASE_URL || '/'` to `base: publicConfig.basePath` so Vite receives the normalized base path with guaranteed leading and trailing slashes
- [x] T006 Update `src/utils/__tests__/customDomainAssets.test.ts` line 28: change the string assertion from `base: process.env.VITE_BASE_URL || '/'` to match the new `base: publicConfig.basePath` code in `vite.config.ts`
- [x] T007 Run `npm run lint && npm run build` to verify build compiles cleanly with the normalized base path

**Checkpoint**: Foundation ready — jsdom is compatible with Node 20, and Vite base path uses the same normalized value as HTML/sitemap transformations.

---

## Phase 3: User Story 1 — Reliable CI Quality Gate Execution on Standardized Runtime (Priority: P1) 🎯 MVP

**Goal**: Ensure all test workers launch successfully and all test assertions execute to completion on the Node 20 LTS baseline, eliminating the `Failed to start forks worker` error.

**Independent Test**: Run `npm run lint && npm test && npm run build` on Node 20 LTS. Confirm 0 worker crashes, 0 unhandled errors, and exit code 0 across all test files.

### Implementation for User Story 1

- [x] T008 [US1] Run the full quality gate `npm run lint && npm test && npm run build` end-to-end on Node 20 and verify all test files (including `src/hooks/__tests__/useEpubExport.test.ts`) execute through to assertion completion with 0 worker failures
- [x] T009 [US1] Verify that the CI workflow `.github/workflows/ci.yml` `node-version: '20'` is compatible with the resolved jsdom@29.1.1 dependency tree — no changes needed to CI config

**Checkpoint**: User Story 1 complete — CI pipeline runs all tests to completion on Node 20 LTS without runtime crashes.

---

## Phase 4: User Story 2 — Reliable Containerized Hosting on Custom Sub-Paths (Priority: P1)

**Goal**: Enable Docker containers to correctly serve static assets and handle SPA routing when deployed under custom sub-path prefixes (e.g. `/dichtruyen/`).

**Independent Test**: Build a Docker image with `--build-arg VITE_BASE_URL=/dichtruyen/`, run the container, and verify that requests to `/dichtruyen/assets/...` return actual JS/CSS files (not HTML fallback) and that SPA routes like `/dichtruyen/auto-translate` return `index.html`.

### Implementation for User Story 2

- [x] T010 [US2] Create `nginx/default.conf.template` with Nginx configuration using `${VITE_BASE_URL}` envsubst variable: `location ${VITE_BASE_URL}` block with `alias /usr/share/nginx/html/;`, `try_files $uri $uri/ ${VITE_BASE_URL}index.html;`, and `location = /favicon.svg` with `access_log off` and `log_not_found off`
- [x] T011 [US2] Update `Dockerfile` runner stage: remove the `RUN echo 'server { ... }' > /etc/nginx/conf.d/default.conf` block, add `ENV VITE_BASE_URL=${VITE_BASE_URL:-/}`, and add `COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template`
- [x] T012 [US2] Verify Docker build with root path: run `docker build -t test-root .` and confirm `curl http://localhost:8080/` returns `200 text/html`
- [x] T013 [US2] Verify Docker build with sub-path: run `docker build --build-arg VITE_BASE_URL=/dichtruyen/ -t test-subpath .` and confirm `/dichtruyen/` returns `200 text/html` and SPA routes fall back correctly

**Checkpoint**: User Story 2 complete — Docker containers correctly serve assets under both root and sub-path deployments.

---

## Phase 5: User Story 3 — Deterministic Build Verification and Normalized Base Path Alignment (Priority: P2)

**Goal**: Eliminate false-positive build artifact tests that silently skip when `dist/` is absent, ensuring test failures clearly indicate missing build output.

**Independent Test**: Run `npm test -- src/tests/originConfig.test.ts` after `npm run build`. Verify tests unconditionally assert artifact existence and content correctness. Delete `dist/` and re-run to confirm tests fail explicitly.

### Implementation for User Story 3

- [x] T014 [US3] Update `src/tests/originConfig.test.ts` "Build Artifacts Output Verification" describe block: replace `if (fs.existsSync(distIndexPath)) { ... }` with `expect(fs.existsSync(distIndexPath)).toBe(true)` followed by content assertions, ensuring test fails when `dist/index.html` is missing
- [x] T015 [US3] Update `src/tests/originConfig.test.ts` sitemap verification: replace `if (fs.existsSync(distSitemapPath)) { ... }` with `expect(fs.existsSync(distSitemapPath)).toBe(true)` followed by content assertions, ensuring test fails when `dist/sitemap.xml` is missing
- [x] T016 [US3] Run `npm run build && npm test -- src/tests/originConfig.test.ts` to verify build artifact tests pass with existing dist output and fail without it

**Checkpoint**: User Story 3 complete — build artifact verification tests produce deterministic pass/fail results.

---

## Phase 6: User Story 4 — Strict EPUB Packaging Compliance & Origin Hardening (Priority: P3)

**Goal**: Enforce strict STORE compression verification at the binary header level for EPUB mimetype, harden origin URL parsing with `new URL()`, and reconcile specs/151 bookkeeping.

**Independent Test**: Run EPUB and origin config test suites. Verify that EPUB compression is checked via raw ZIP bytes (not JSZip property), origin validation rejects malformed URLs, and specs/151 task tracking accurately reflects verified CI status.

### Implementation for User Story 4

- [x] T017 [P] [US4] Update `src/hooks/__tests__/useEpubExport.test.ts`: replace `expect(compression === 'STORE' || compression === null).toBe(true)` with binary header verification — read `new Uint8Array(arrayBuffer)` bytes 8-9 and assert compression method equals `0` (STORE)
- [x] T018 [P] [US4] Update `src/config/publicOrigin.ts` `normalizeOrigin()`: replace regex-only `/^https?:\/\//i` validation with `new URL()` parsing — extract `parsed.origin` (protocol + hostname + port), verify `parsed.protocol` is `http:` or `https:`, and fall back to `DEFAULT_PUBLIC_URL` on parse error or invalid protocol
- [x] T019 [US4] Update `src/tests/originConfig.test.ts`: add edge-case tests for the hardened `normalizeOrigin()` — test `https://` (empty host) → default, `https:///` (triple slash) → default, `https://example.com/foo/bar` → `https://example.com`, `https://example.com:8080` → preserved with port
- [x] T020 [US4] Update `specs/151-audit-verification-hardening/tasks.md`: add cross-reference note to T001 noting jsdom version was corrected in spec 152, and add note to T021 indicating full quality gate was re-verified after spec 152 dependency fix
- [x] T021 [US4] Run `npm test -- src/hooks/__tests__/useEpubExport.test.ts src/tests/originConfig.test.ts` to verify EPUB binary STORE assertion and origin hardening edge cases pass

**Checkpoint**: User Story 4 complete — EPUB compliance is verified at the binary level, origin validation is strict, and bookkeeping is reconciled.

---

## Phase 7: Polish & Quality Gate Clearance

**Purpose**: Run full end-to-end validation and mandatory quality gates across the entire repository.

- [x] T022 Run `specs/152-ci-runtime-audit-fixes/quickstart.md` verification scenarios 1 through 5
- [x] T023 Run full quality gate: `npm run lint && npm test && npm run build` — 0 type errors, 0 test failures, 0 worker crashes, 0 build errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. **BLOCKS everything else.**
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS User Story 2 and User Story 3.
- **User Story 1 (Phase 3)**: Depends on Phase 1 + Phase 2 — validates the full quality gate.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (normalized base path in Vite). Independent of US1 validation.
- **User Story 3 (Phase 5)**: Depends on Phase 2 (normalized base path). Requires `npm run build` to have been run.
- **User Story 4 (Phase 6)**: Depends on Phase 1 (jsdom fix). Independent of US2/US3.
- **Polish (Phase 7)**: Depends on all user stories (Phases 3–6) being completed.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Setup + Foundational. No cross-story dependencies.
- **User Story 2 (P1)**: Depends only on Foundational (base path alignment). No cross-story dependencies.
- **User Story 3 (P2)**: Depends only on Foundational. Requires `dist/` from prior build.
- **User Story 4 (P3)**: Can start after Setup (Phase 1). No cross-story dependencies. T017 and T018 are parallel.

### Parallel Opportunities

- Within Phase 1: T001 and T002 modify the same file (`package.json`) — must be sequential.
- Within Phase 6: T017 (`useEpubExport.test.ts`) and T018 (`publicOrigin.ts`) modify different files and can run in parallel.
- User Story 2 (Phase 4) and User Story 3 (Phase 5) modify different files and can run in parallel after Phase 2.
- User Story 4 (Phase 6) T017–T020 can proceed in parallel with Phases 4 and 5.

---

## Parallel Example: User Story 4

```bash
# Launch parallel tasks for User Story 4 together:
Task T017: "Binary STORE verification in src/hooks/__tests__/useEpubExport.test.ts"
Task T018: "Harden normalizeOrigin() with new URL() in src/config/publicOrigin.ts"

# Then sequential:
Task T019: "Add origin edge-case tests in src/tests/originConfig.test.ts" (depends on T018)
Task T020: "Update specs/151 bookkeeping in specs/151-audit-verification-hardening/tasks.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004) — fix jsdom dependency.
2. Complete Phase 2: Foundational (T005–T007) — align Vite base path.
3. Complete Phase 3: User Story 1 (T008–T009) — validate full quality gate.
4. **STOP and VALIDATE**: Run `npm run lint && npm test && npm run build` — CI must be green.

### Incremental Delivery

1. Phase 1 + 2: Dependency fix + base path alignment complete.
2. Phase 3 (US1): CI quality gate restored → **MVP delivered**.
3. Phase 4 (US2): Docker sub-path routing delivered.
4. Phase 5 (US3): Build artifact test hardening delivered.
5. Phase 6 (US4): EPUB binary verification + origin hardening + bookkeeping delivered.
6. Phase 7: Full quality gate clearance.

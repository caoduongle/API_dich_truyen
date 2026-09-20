# Feature Specification: Production Verification & Integrity Hardening

**Feature Branch**: `151-audit-verification-hardening`

**Created**: 2026-09-20

**Status**: Completed

**Input**: User audit review on HEAD `a1254b80e64a1c519c82e3c265e103a3e28dc770` covering:
1. EPUB test environment XML parser compliance (replacing heuristic regex fallback with genuine XML parser).
2. Production public origin utility isolation and true build integration testing (`originConfig.test.ts`).
3. Docker build arguments for `VITE_PUBLIC_URL` and `VITE_BASE_URL`.
4. Sub-path deployment URL unification (`VITE_BASE_URL` + `VITE_PUBLIC_URL`) for canonical links, sitemaps, and public root-relative assets in `index.html`.
5. Database write queue FIFO verification asserting deterministic final storage state (`A3`) and no resurrection.
6. Documentation alignment in `README.md` for `VITE_PUBLIC_URL` and Docker build instructions.
7. Tightening of EPUB test assertions (`mimetype` exact string without trailing newline, `STORE` compression invariant).
8. Validation of URL schemes (`http://` or `https://`) for `VITE_PUBLIC_URL`.
9. Bookkeeping reconciliation for `specs/150-post-audit-hardening`.
10. Preservation of user/project chapter sequence order during EPUB generation.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sub-Path Aware Public URL Architecture & Containerized Deployment (Priority: P1)

As a site deployer hosting the application on custom domains, sub-path directories (e.g., `https://example.com/dichtruyen/`), or within containerized Docker environments,
I want the build pipeline, sitemap generator, HTML metadata, and container images to unify origin and base path configurations while validating URL scheme integrity,
So that canonical search engine links, sitemaps, OpenGraph metadata, and public static assets resolve seamlessly to the exact application path without 404 errors, domain drift, or container fallback issues.

**Why this priority**:
Currently, setting a sub-path via `VITE_BASE_URL` (e.g., `/dichtruyen/`) creates an SEO mismatch because sitemaps and HTML canonical links emit only the origin root (e.g., `https://example.com/auto-translate` instead of `https://example.com/dichtruyen/auto-translate`). Furthermore, root-relative links in `index.html` (such as `/theme-init.js` and `/favicon.svg`) break when the app is served from a nested path. In Docker builds, the absence of build arguments prevents `VITE_PUBLIC_URL` from entering the bundle, causing container deployments to fall back to the default vendor URL. Resolving this provides true multi-host and sub-path portability across both bare-metal and Docker environments.

**Independent Test**:
Can be fully tested by:
1. Configuring a custom origin (`https://example.com`) and sub-path (`/subpath/`), executing the build, and verifying that all sitemap `<loc>` tags, canonical `<link>`, and OpenGraph URLs emit `https://example.com/subpath/...`.
2. Inspecting `index.html` to verify public static asset paths (`theme-init.js`, `favicon.svg`, `site.webmanifest`, `og-image.svg`) adapt to the base path.
3. Supplying an invalid URL scheme (e.g., `ftp://` or `abc`) and verifying that the system safely normalizes or falls back to a valid HTTP/HTTPS origin.
4. Verifying Dockerfile accepts `VITE_PUBLIC_URL` and `VITE_BASE_URL` build arguments.

**Acceptance Scenarios**:
1. **Given** `VITE_PUBLIC_URL="https://example.com"` and `VITE_BASE_URL="/dichtruyen/"`, **When** the application and sitemap are generated at build time, **Then** all generated canonical URLs and sitemap `<loc>` entries begin with `https://example.com/dichtruyen/`.
2. **Given** a nested sub-path configuration, **When** `index.html` is generated, **Then** all static asset references (including `/theme-init.js`, `/favicon.svg`, `/site.webmanifest`, and `/og-image.svg`) resolve relative to the configured base path rather than assuming root hosting.
3. **Given** a `VITE_PUBLIC_URL` without a valid HTTP or HTTPS protocol scheme (e.g., `not-a-url` or `javascript:...`), **When** evaluating configuration, **Then** the resolver rejects or normalizes the invalid scheme, safely falling back to the default secure origin.
4. **Given** a Docker container build, **When** build arguments `VITE_PUBLIC_URL` and `VITE_BASE_URL` are provided, **Then** the container image builds static assets reflecting those arguments instead of hardcoded defaults.
5. **Given** the repository documentation (`README.md`), **When** reviewed by a deployer, **Then** the environment variables table documents `VITE_PUBLIC_URL`, and the Docker deployment guide includes instructions for passing build arguments.

---

### User Story 2 - True XML Parser Verification & Chapter Order Preservation in EPUB (Priority: P1)

As an e-book reader exporting translated works into EPUB packages,
I want the automated test suite to validate generated EPUB descriptors using a genuine standards-compliant XML parser (rather than heuristic regex fallbacks), and I want the exporter to preserve the novel's defined chapter order,
So that exported digital books are guaranteed to be 100% compliant with IDPF EPUB specifications, e-readers never reject books due to malformed XML, and chapters always appear in the user's intended reading sequence.

**Why this priority**:
EPUB readers require strict XML compliance. The previous test suite fell back to an in-house regex/stack checker when run in Node environments without a global `DOMParser`, meaning real XML syntax bugs could slip into production. Furthermore, sorting exported chapters strictly by `createdAt` timestamp breaks the intended chapter sequence whenever chapters are reordered or imported out of order. Resolving this guarantees true IDPF compliance and reading fidelity.

**Independent Test**:
Can be fully tested by:
1. Executing EPUB export tests in an environment equipped with a real XML DOM parser, confirming that all XML files (`container.xml`, `content.opf`, `toc.ncx`, `nav.xhtml`, and chapter documents) are parsed by the XML parser without fallback.
2. Creating a project with chapters whose chronological creation order differs from their list index order (e.g., Chapter 1 created after Chapter 2), exporting to EPUB, and confirming that the package spine, table of contents, and navigation documents follow the project's explicit chapter sequence.
3. Asserting that `mimetype` is exact (no trailing newline) and uncompressed (`STORE`).

**Acceptance Scenarios**:
1. **Given** the EPUB export test suite, **When** verifying XML well-formedness, **Then** tests parse documents through a genuine XML parser engine that reports zero parse errors, with zero reliance on heuristic regex fallbacks.
2. **Given** a novel project where chapters have been reordered independently of their creation timestamps, **When** exporting to EPUB, **Then** the resulting book order strictly matches the project's chapter sequence rather than chronological creation timestamps.
3. **Given** the generated EPUB zip archive, **When** verifying the `mimetype` entry, **Then** its content is byte-exact `application/epub+zip` without trailing whitespace or newlines, and its compression is strictly uncompressed (`STORE`).

---

### User Story 3 - Production Public Origin Module & End-to-End Build Verification (Priority: P2)

As a maintainer and automated test auditor,
I want the URL resolution and sitemap/HTML transformation logic to reside in production source code rather than being redefined inside the test file, and I want an end-to-end integration test validating the build output,
So that production code is the single source of truth, test suites cannot pass with out-of-sync logic, and continuous integration proves that environment configuration actually propagates to build artifacts.

**Why this priority**:
In the previous audit pass, `src/tests/originConfig.test.ts` duplicated origin resolution logic locally inside the test file, creating a risk where `vite.config.ts` could be broken while the test remained green. Moving this logic into a dedicated production module (`src/config/publicOrigin.ts` or `src/utils/publicOrigin.ts`) and importing it into both Vite config and unit/integration tests guarantees architectural fidelity and eliminates circular test validity.

**Independent Test**:
Can be tested by running unit tests directly against the production origin module and executing a build verification test that inspects the generated output files (`dist/index.html`, `dist/sitemap.xml`) to confirm dynamic transformation.

**Acceptance Scenarios**:
1. **Given** the public origin and transformation logic, **When** inspected in the codebase, **Then** it resides in a dedicated production utility module imported by `vite.config.ts`.
2. **Given** `originConfig.test.ts`, **When** executed, **Then** it exercises the production utility module directly rather than maintaining internal duplicate logic.
3. **Given** an automated test invoking the build or evaluating build outputs, **When** supplied with distinct environment inputs, **Then** it asserts that the generated build artifacts reflect the transformed values.

---

### User Story 4 - Database Write Queue Final State Verification (Priority: P2)

As an application user storing novel projects locally in IndexedDB,
I want concurrent saves and deletions to guarantee that the final database state reflects the last queued operation deterministically,
So that no deleted projects are ever resurrected and subsequent updates are never overwritten by stale preceding operations.

**Why this priority**:
The existing FIFO test demonstrated that functions were called in chronological order, but did not assert that the underlying database records achieved the exact expected state (`A3`) upon completion. Verifying that the final record exists, matches the last write, and has no resurrection closes the gap between operational order and state persistence.

**Independent Test**:
Can be tested by executing concurrent interleaved operations (`save A1 -> save A2 -> delete A -> save A3`) against the database service and asserting that `getProjectFromDB(projectId)` returns project `A3` with no resurrective artifacts.

**Acceptance Scenarios**:
1. **Given** a series of concurrent interleaved save and delete operations targeting a single project, **When** all operations settle, **Then** the database record reflects the final operation (`A3`) with complete fidelity.
2. **Given** a deletion followed by a save in the same queue window, **When** resolved, **Then** the project is not permanently lost due to a delayed delete racing ahead of the final save.

---

### User Story 5 - Specification & Documentation Bookkeeping Reconciliation (Priority: P3)

As a contributor navigating the repository documentation and completed specifications,
I want all specification status markers and checklists in `specs/150-post-audit-hardening` to reflect completed verification,
So that documentation accurately conveys that audit hardening has been fully designed, implemented, and tested.

**Why this priority**:
A minor wording inconsistency in `specs/150-post-audit-hardening/spec.md` checklist stated the spec was ready for planning even though implementation had completed and passed. Aligning this maintains 1:1 documentation integrity per Constitution Principle V.

**Independent Test**:
Can be verified by reviewing `specs/150-post-audit-hardening/spec.md` and checklist notes to confirm completion status consistency.

**Acceptance Scenarios**:
1. **Given** `specs/150-post-audit-hardening/spec.md`, **When** reviewing status notes and checklist summaries, **Then** they consistently state that specification and implementation are completed.

---

## Edge Cases

- What happens if `VITE_BASE_URL` is set without leading or trailing slashes (e.g. `dichtruyen`)?
  The public origin utility must normalize base path strings to ensure a leading slash and trailing slash are present when combining with origins (e.g. `https://example.com/dichtruyen/`).
- What happens if `VITE_PUBLIC_URL` has multiple trailing slashes (e.g. `https://example.com///`)?
  Trailing slashes must be stripped before joining with the normalized base path to prevent generating double or triple slashes.
- What happens if a project has an empty `chapters` array or chapters without `createdAt` timestamps?
  The EPUB chapter sorter must preserve whatever order is present in `proj.chapters`, falling back safely to index order or 0 timestamp without throwing errors.
- What happens if a test runs in an environment where `jsdom` or `DOMParser` encounters an XML syntax error?
  The XML parser must throw or expose `parsererror` nodes, causing the test assertion to fail immediately and report the malformed XML snippet.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST extract public origin resolution, base path combination, and sitemap/HTML transformation logic into a dedicated production module (`src/config/publicOrigin.ts` or equivalent).
- **FR-002**: The public origin utility MUST validate that `VITE_PUBLIC_URL` starts with a valid web protocol scheme (`http://` or `https://`), falling back safely to the documented default production URL if the scheme is missing or invalid.
- **FR-003**: The build configuration and sitemap generator MUST unify origin and base path such that canonical links, OpenGraph URLs, and sitemap `<loc>` elements resolve to `origin + base_path` (e.g., `https://example.com/dichtruyen/`).
- **FR-004**: Public static asset links in `index.html` (including `theme-init.js`, `favicon.svg`, `site.webmanifest`, and `og-image.svg`) MUST resolve relative to the application base path rather than assuming root hosting.
- **FR-005**: The `Dockerfile` MUST declare build arguments `ARG VITE_PUBLIC_URL` and `ARG VITE_BASE_URL` and forward them to build environment variables so container images can be built for arbitrary domains and subpaths.
- **FR-006**: Repository documentation (`README.md`) MUST document `VITE_PUBLIC_URL` in the environment variables table and describe Docker build argument usage.
- **FR-007**: The EPUB test suite MUST execute in an environment equipped with a standards-compliant XML parser engine (e.g., via a designated test environment or genuine parser), strictly asserting that zero XML syntax or structure errors exist, with zero fallback to heuristic regex parsers.
- **FR-008**: EPUB archive test assertions MUST enforce that `mimetype` is byte-exact `application/epub+zip` without trailing whitespace or newlines, and its compression is strictly uncompressed (`STORE`).
- **FR-009**: EPUB chapter packaging MUST preserve the chapter sequence defined in the project's `chapters` manifest, using chapter list order as the primary sort authority before falling back to creation timestamp.
- **FR-010**: Database write queue integration tests MUST verify that an interleaved sequence (`save A1 -> save A2 -> delete A -> save A3`) leaves the underlying storage in the deterministic final state (`A3`), proving no data resurrection.
- **FR-011**: Specification documentation in `specs/150-post-audit-hardening` MUST align checklist completion summaries to reflect verified implementation status.

---

### Key Entities *(include if feature involves data)*

- **Canonical Application URL**: The unified public web address representing the application's root route, calculated as `normalized(VITE_PUBLIC_URL) + normalized(VITE_BASE_URL)`. Used as the base prefix for all sitemap routes, OpenGraph metadata, and canonical `<link>` tags.
- **Chapter Manifest Order**: The ordered array of chapter descriptors (`proj.chapters`) representing the author's intended book structure, distinct from the physical creation timestamps of individual chapter objects.
- **Public Origin Utility**: A standalone production module providing deterministic URL normalization, protocol validation, and template placeholder replacement for build-time and dev-server workflows.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated URLs in sitemaps, canonical tags, and OpenGraph tags correctly reflect both custom origin and nested base path when configured.
- **SC-002**: 100% of EPUB descriptor verification assertions in automated tests are executed by a real XML DOM parser, with 0 regex heuristic fallbacks active during test execution.
- **SC-003**: 100% of EPUB export tests verify that chapter order in the generated spine and table of contents matches the project's chapter list order even when chapters are created chronologically out of sequence.
- **SC-004**: Docker container builds successfully accept and bake custom `VITE_PUBLIC_URL` and `VITE_BASE_URL` arguments into the final static distribution without falling back to defaults.
- **SC-005**: Database FIFO queue integration test asserts both chronological execution order and final stored state (`A3`) with 0 resurrected records.
- **SC-006**: All repository quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors, 0 test failures, and 0 warnings.

---

## Assumptions

- The EPUB test environment can run with Vitest's environment options (e.g., `jsdom`) or an equivalent real XML parser that satisfies the requirement for zero regex fallback while keeping dependencies compliant with project governance.
- Sub-path deployments expect web servers (such as Nginx, Caddy, or static hosts) to serve the built assets from the matching sub-path route or rewrite accordingly.
- The `chapters` array on a `StoryProject` object is the definitive ordering of chapters intended by the user, while `createdAt` is metadata for audit and history tracking.

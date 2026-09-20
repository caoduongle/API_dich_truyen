# Feature Specification: CI Runtime Parity & Container Integrity Hardening

**Feature Branch**: `152-ci-runtime-audit-fixes`

**Created**: 2026-09-21

**Status**: Completed

**Input**: User description: "/speckit-specify Tôi đã rà soát lại HEAD mới nhất fdffaa7a652968e5c9c148d0cccd7219254d5345 và đối chiếu trực tiếp với lỗi GitHub Actions bạn gửi. Kết luận ngay: Lỗi Action hiện tại không nằm ở logic EPUB, DB hay Vitest assertion. Nó là lỗi tương thích runtime do chính commit mới thêm jsdom@30.1.0 nhưng repo vẫn chạy Node 20... Khuyến nghị sửa: Cách A (Giữ Node 20, hạ jsdom xuống 29.1.1, regenerate lockfile), sửa Docker Nginx subpath routing, bỏ false-positive conditional check trong originConfig.test.ts, truyền normalized base path vào Vite config, thắt chặt assertion STORE cho EPUB, reconcile specs/151 bookkeeping, và harden normalizeOrigin() bằng URL validation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable CI Quality Gate Execution on Standardized Runtime (Priority: P1)

Developers and continuous integration systems require all automated test suites to execute reliably against the standardized project runtime baseline (Node.js 20 LTS) without runtime compatibility crashes or worker startup failures, guaranteeing that all tests (including DOM and EPUB validation) run through to actual assertion completion.

**Why this priority**: Continuous integration is currently blocked by a runtime worker startup failure caused by dependency mismatch on Node 20 LTS. Until this is resolved, test verification cannot run to completion in automated release workflows.

**Independent Test**: Execute the full quality gate (`npm run lint`, `npm test`, `npm run build`) in an environment matching the Node 20 LTS baseline. Confirm that all test workers launch successfully, all test files execute without unhandled worker crashes, and all assertions pass cleanly with exit code 0.

**Acceptance Scenarios**:

1. **Given** a continuous integration workflow running on the project's standardized Node 20 LTS baseline, **When** automated tests are executed via `npm test`, **Then** the test runner successfully initializes all worker threads without missing runtime API errors, and all test files execute through to assertion completion.
2. **Given** test suites requiring XML document parsing (DOMParser), **When** tests execute within their designated environment, **Then** all XML well-formedness and parsing assertions execute cleanly without unhandled worker aborts.

---

### User Story 2 - Reliable Containerized Hosting on Custom Sub-Paths (Priority: P1)

System operators deploying the application in containerized environments (Docker / Nginx) need to host the application either at the web root (`/`) or under arbitrary sub-paths (e.g. `/dichtruyen/`) without static assets returning 404 or falling back to `index.html`, ensuring all JavaScript modules, stylesheets, and icons load reliably.

**Why this priority**: Deploying to sub-path environments currently causes static asset requests to fail in Nginx because asset paths include the sub-path prefix while the web root does not map that prefix, breaking the single-page application at runtime.

**Independent Test**: Build and run the container image configured with a sub-path prefix, request static assets (scripts, styles, favicons) under the sub-path prefix, and verify that HTTP 200 is returned with genuine asset content rather than the HTML fallback.

**Acceptance Scenarios**:

1. **Given** a container image built with a configured sub-path prefix (e.g. `VITE_BASE_URL=/dichtruyen/`), **When** an HTTP request is made for a static asset under that prefix (e.g. `/dichtruyen/assets/app.js`), **Then** the container web server successfully serves the asset file with appropriate MIME type instead of falling back to `index.html`.
2. **Given** a user navigating directly to a deep client-side URL under the configured sub-path prefix (e.g. `/dichtruyen/auto-translate`), **When** the page is requested, **Then** the server serves the single-page application `index.html` document with correct relative asset paths.

---

### User Story 3 - Deterministic Build Verification and Normalized Base Path Alignment (Priority: P2)

Developers and release auditors require build verification tests to affirmatively prove that production build artifacts exist and have been correctly transformed, rather than silently passing when artifacts are absent. Additionally, the build configuration must consistently feed the normalized base path into the build engine.

**Why this priority**: Testing build artifacts using conditional existence guards creates false positives where tests pass even if build output was never generated. Furthermore, passing unnormalized base path values to the build tool risks edge-case build errors.

**Independent Test**: Run build configuration and artifact verification tests with and without compiled output. Verify that missing output causes explicit test failures, and compiled output contains correctly resolved paths and meta tags without placeholder tokens.

**Acceptance Scenarios**:

1. **Given** a build output verification test, **When** executed against the distribution directory, **Then** the test affirmatively asserts the existence of required output files (`dist/index.html`, `dist/sitemap.xml`) and fails if they are missing.
2. **Given** an environment variable specifying a base path in arbitrary format (e.g. `dichtruyen` or `/dichtruyen`), **When** resolved by the build configuration, **Then** the exact normalized base path (guaranteeing both leading and trailing slashes) is supplied to the build tool's base setting.

---

### User Story 4 - Strict EPUB Packaging Compliance & Origin Hardening (Priority: P3)

Readers and digital publishing platforms require exported EPUB files to strictly comply with the IDPF/EPUB standard by storing the `mimetype` file completely uncompressed (compression method STORE / 0) as the first entry in the archive. Furthermore, web origin configuration must strictly validate web protocols, hosts, and ports, and project bookkeeping must accurately reflect CI status.

**Why this priority**: Digital book readers reject or flag EPUB archives whose `mimetype` file is compressed or ambiguous. Permissive test assertions (`STORE || null`) weaken standards enforcement. Hardening URL origin parsing and reconciling bookkeeping completes end-to-end repository integrity.

**Independent Test**: Generate an EPUB export archive and inspect its binary header to verify that the `mimetype` local file header specifies compression method 0 (`STORE`). Execute origin validation unit tests against diverse valid and malformed URLs to confirm strict origin parsing.

**Acceptance Scenarios**:

1. **Given** an exported EPUB book package, **When** inspecting the binary archive headers, **Then** the first file is `mimetype` and its compression method is strictly 0 (uncompressed `STORE`).
2. **Given** a public origin string provided via configuration or environment, **When** evaluated by the origin normalization utility, **Then** structurally valid web origins (protocol, host, optional port) are preserved and malformed inputs (invalid scheme, empty hostname) safely fall back to the default origin.
3. **Given** previous specification task tracking records, **When** reviewed after resolving CI runtime issues, **Then** all status records accurately reflect genuine, verified quality gate completion.

---

### Edge Cases

- What happens when a container is built with root base path (`/`) versus custom sub-path (`/subapp/`)? The container web server configuration must dynamically support both root and sub-path asset routing without broken asset paths.
- What happens when `dist/` is empty or cleaned before running tests? Build artifact integration tests must fail with clear error messages indicating that distribution artifacts are required, rather than passing vacuously.
- What happens when an origin configuration contains extra paths, query strings, or trailing slashes (e.g. `https://example.com/foo/bar?baz=1/`)? The origin normalizer must extract and retain only the true origin (`https://example.com`), discarding extra paths, search queries, or trailing slashes.
- What happens when an e-book reading tool reads the exported EPUB? The uncompressed `mimetype` at byte offset 30 with length 20 enables immediate magic-number identification without decompressing the stream.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project test infrastructure MUST maintain full runtime compatibility with the standardized Node.js 20 LTS baseline, eliminating worker startup failures in continuous integration.
- **FR-002**: The test environment for document parser tests MUST provide a genuine XML Document Object Model parser (DOMParser) without requiring a runtime higher than the Node 20 LTS baseline.
- **FR-003**: The containerized deployment configuration (Dockerfile / Nginx) MUST correctly route and serve static assets when the application is built with a custom sub-path prefix, preventing asset 404s and improper fallback to `index.html`.
- **FR-004**: Build artifact verification tests MUST unconditionally assert that distribution files (`dist/index.html`, `dist/sitemap.xml`) exist and contain fully replaced canonical URLs without unreplaced placeholder tokens.
- **FR-005**: The build tool configuration MUST supply the normalized base path representation (with guaranteed leading and trailing slashes) to the build tool's `base` configuration option.
- **FR-006**: The EPUB generation and test suite MUST enforce and verify that the package's `mimetype` entry is stored with compression method 0 (`STORE`) at the binary header level, rejecting compressed or ambiguous representations.
- **FR-007**: The web origin validation utility MUST parse candidate origin strings to verify the presence of a valid HTTP/HTTPS protocol and valid hostname, extracting only the canonical origin component (`protocol//hostname[:port]`) and falling back to default origin on invalid input.
- **FR-008**: Project documentation and task tracking records MUST be synchronized to reflect actual verified quality gate status upon CI green clearance.

### Key Entities

- **Runtime Baseline**: The agreed system execution environment (Node.js 20 LTS) defining compatibility constraints for dependencies, build scripts, container images, and CI workflows.
- **Public Origin & Base Configuration**: The unified configuration entity encapsulating normalized public origin, normalized base path, and computed canonical application URL.
- **Container Server Configuration**: The Nginx web server configuration defining request handling, path prefix mapping, static asset resolution, and single-page application fallback rules.
- **EPUB Package Archive**: The standard ZIP-based container for digital books requiring an initial uncompressed `mimetype` entry followed by XML package manifests, navigation documents, and chapter XHTML files.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Continuous integration pipeline runs to 100% completion on the Node 20 LTS runtime baseline with 0 worker crashes and 0 unhandled runtime errors across all test files.
- **SC-002**: 100% of automated tests across all test suites pass with genuine assertions, eliminating all conditional existence guards that could produce false-positive test passes.
- **SC-003**: Containerized application successfully serves static assets under custom sub-path deployments with 100% of asset requests returning HTTP 200 and appropriate content types.
- **SC-004**: EPUB export verification achieves 100% compliance with strict binary archive checks confirming compression method 0 (`STORE`) on the MIME type descriptor.
- **SC-005**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors, 0 test failures, and 0 build errors.

## Assumptions

- The project remains standardized on Node.js 20 LTS across all environments (local development, Dockerfiles, and GitHub Actions CI).
- The application architecture remains a pure client-side SPA with local IndexedDB persistence, requiring zero server-side application runtimes.
- Custom sub-path deployments provide the base path at build time via `VITE_BASE_URL` build arguments.
- Standard browser DOM parsing capabilities in test environments can be provided by compatible test environment libraries matching the Node 20 LTS baseline.

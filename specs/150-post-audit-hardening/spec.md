# Feature Specification: Post-Audit Integrity & Quality Hardening

**Feature Branch**: `150-post-audit-hardening`

**Created**: 2026-09-20

**Status**: Completed

**Input**: User audit review on commit `8351259619033dee3a3f42922c10c60164222c70` following the storage integrity audit fixes. Identified follow-up items across origin portability, EPUB integrity verification, test deduplication, DB queue sequence proofs, documentation accuracy, and specification bookkeeping.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Public Origin Portability & Sitemap Decoupling (Priority: P1)

As a site deployer hosting the application on custom domains or diverse static hosting providers (such as Cloudflare Pages, Vercel, Netlify, or local previews),
I want the public base origin in build configuration, environment files, search engine sitemaps, and HTML metadata to dynamically reflect the configured target origin rather than a hard-coded fallback domain,
So that canonical links, OpenGraph previews, and search engine crawlers always index the genuine hosting location without vendor or domain lock-in.

**Why this priority**:
Currently, environment configuration files (`.env`, `.env.local`, `.env.production`) are not guaranteed to be evaluated during configuration preprocessing unless explicitly loaded from disk. Furthermore, the XML sitemap hard-codes an external vendor URL, causing canonical and SEO drift when deployed to alternate domains. Resolving this completes the portability guarantee required for multi-cloud and static hosting deployments.

**Independent Test**:
Can be fully tested by configuring an alternate public origin in `.env`, building the production bundle, and verifying that both `index.html` metadata and `sitemap.xml` URLs emit the configured origin without any trace of the default fallback domain.

**Acceptance Scenarios**:
1. **Given** an environment configuration file containing a custom `VITE_PUBLIC_URL`, **When** the application configuration is evaluated at build time, **Then** the value is actively loaded from the environment file and injected into all public metadata placeholders.
2. **Given** no custom public URL is defined, **When** building the application, **Then** the system falls back safely to the documented default production origin without trailing slash irregularities.
3. **Given** the search engine sitemap, **When** inspecting published URL entries, **Then** each route location uses the configured public origin rather than an immutable hard-coded origin.
4. **Given** the template environment file (`.env.example`), **When** inspected by a new deployer, **Then** it clearly documents the public URL variable and its intended purpose.

---

### User Story 2 - EPUB XML Structure Validation & Safe Download Lifecycle (Priority: P2)

As an offline reader exporting translated novels into digital books (EPUB),
I want exported EPUB packages to adhere strictly to open e-book format standards and ensure download transfers complete reliably across all browsers,
So that reading applications parse the files without XML syntax errors or corrupted compression headers, and mobile/desktop browsers do not encounter prematurely severed download streams.

**Why this priority**:
EPUB readers require strict XML compliance in package descriptors (`content.opf`, `container.xml`, `nav.xhtml`, `toc.ncx`) and a precise uncompressed `mimetype` entry as the first archive entry. Verifying XML well-formedness via actual parser engines in automated tests prevents syntactically broken XML from going undetected. Additionally, deferring blob URL cleanup prevents premature memory revocation while browsers process the download.

**Independent Test**:
Can be tested by exporting a novel with complex characters (HTML entities, quotes, angle brackets) into an EPUB archive, then using an XML DOM parser in automated tests to confirm zero parse errors across all XML descriptor documents, verifying zip file headers, and observing that download object URLs are retained until download dispatch is finalized.

**Acceptance Scenarios**:
1. **Given** a generated EPUB archive, **When** automated tests parse `container.xml`, `content.opf`, `nav.xhtml`, and `toc.ncx`, **Then** the parser produces a valid document object tree with no syntax or structure error elements.
2. **Given** the internal file hierarchy of the EPUB archive, **When** entries are enumerated, **Then** the `mimetype` file is positioned as the very first entry and stored without compression.
3. **Given** an e-book download action initiated by the user, **When** the browser triggers the file save dialog, **Then** the underlying resource URL remains valid across the dispatch cycle before being released from browser memory.

---

### User Story 3 - Test Suite Consolidation & Database Write Queue Invariant Verification (Priority: P2)

As a core maintainer and contributor,
I want a single canonical security parity test suite and concrete automated tests proving first-in, first-out (FIFO) database write ordering and invariant validation separation,
So that continuous integration maintains clear test responsibilities without duplicate test suites, and database mutation sequences are verifiably race-free.

**Why this priority**:
Having two test suites with overlapping responsibilities checking Content Security Policy headers creates maintenance confusion. In addition, while storage queue consolidation was implemented, having an end-to-end integration test that verifies an interleaved sequence (`save A1 -> save A2 -> delete A -> save A3`) directly against the database serialization queue proves that operations cannot execute out of order or resurrect deleted records. Separating bundle input validation from stored database checks also improves architectural clarity.

**Independent Test**:
Can be tested by executing the consolidated security parity test suite to verify full coverage across all deployment targets, and running an automated test dispatching concurrent, interleaved saves and deletes against a project to observe strict chronological execution.

**Acceptance Scenarios**:
1. **Given** deployment configuration files across supported hosting platforms, **When** running security parity verification, **Then** a single authoritative test suite validates byte-for-byte and directive-level consistency across all target platforms.
2. **Given** multiple asynchronous write and delete requests targeting the same project ID, **When** submitted concurrently, **Then** the database executes them in strict FIFO order, ensuring subsequent saves do not race ahead of preceding deletions.
3. **Given** an incoming bundle containing projects, chapters, and collaboration states, **When** validated by storage services, **Then** in-memory input structural checks and stored relational database checks operate as clean, distinct validation phases.

---

### User Story 4 - UX Copy Realignment, Architecture Documentation & Specification Bookkeeping (Priority: P3)

As a user configuring API credentials or a developer reading system architecture documents,
I want user interface text and architecture documentation to accurately reflect actual technical mechanics, and completed historical specification tasks to be properly reconciled,
So that users understand how quota grouping and key rotation function, documentation does not make outdated claims about storage encryption, and project specification status indicators are fully consistent.

**Why this priority**:
User interface labels that imply adding more keys to the same quota bucket expands rate limits mislead users; wording should neutrally convey that quotas belong to projects/quota groups while keys serve as health rotation pools. Architecture documents must not claim keys are encrypted in IndexedDB when they are governed by session/local storage preferences. Finally, completed specifications must reflect finalized statuses to avoid confusion for future contributors.

**Independent Test**:
Can be tested by reviewing the API Settings interface copy for accurate quota phrasing, inspecting architecture documentation for storage policy fidelity, and verifying specification task markers and status badges in specification records.

**Acceptance Scenarios**:
1. **Given** the API key configuration panel, **When** reviewing explanatory notes on rate limits, **Then** the text clearly explains that quotas are managed per Project / Quota Group for redundancy and load coordination, rather than claiming each additional key unconditionally multiplies quota limits.
2. **Given** system architecture documentation (`docs/architecture.md`), **When** reviewing credential storage descriptions, **Then** it accurately specifies storage in browser session/local storage according to user preference, without referencing nonexistent IndexedDB encryption.
3. **Given** the task lists and specifications for completed audit hardening features (`specs/147`, `specs/149`), **When** inspected, **Then** all executed tasks are marked complete and overall feature statuses are marked as completed.

---

### Edge Cases

- What happens if the environment file contains a `VITE_PUBLIC_URL` with one or more trailing slashes?
  The system must trim trailing slashes before substitution to avoid generating double-slash paths (e.g., `https://example.com//sitemap.xml`).
- What happens if an exported chapter contains broken XML entities, unclosed tags, or raw `<` and `&` characters?
  The exporter's character escaping must sanitize all content, ensuring that XML parsers do not encounter unescaped markup in titles, descriptions, or body paragraphs.
- What happens if an asynchronous database write operation fails or rejects mid-sequence in the write chain?
  The write queue must catch and settle the failed promise so that subsequent queued writes for the same project are not permanently blocked or leaked in memory.
- What happens if a user toggles credential persistence off while keys exist in storage?
  The system must clear persistent keys immediately, ensuring no orphaned keys remain in persistent browser storage.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Build configuration MUST actively load environment variables from environment configuration files during build-time preprocessing to ensure custom public URLs are respected.
- **FR-002**: The template environment file (`.env.example`) MUST document the public origin configuration variable (`VITE_PUBLIC_URL`) with description and usage notes.
- **FR-003**: Search engine sitemap resources (`sitemap.xml`) MUST dynamically utilize the configured public URL origin rather than relying on an immutable hard-coded third-party domain.
- **FR-004**: Automated tests for digital book export (EPUB) MUST parse generated metadata and structural descriptors (`container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`) using an XML parser engine to verify document well-formedness and absence of syntax errors.
- **FR-005**: Automated EPUB archive tests MUST verify that the archive's `mimetype` file is positioned as the first entry and is recorded without compression (`STORE`).
- **FR-006**: Exported file download flows MUST defer object URL revocation until after download dispatch has been handed off to the browser.
- **FR-007**: Security header parity tests MUST be consolidated into a single authoritative test suite covering all target deployment platforms, eliminating redundant and overlapping test files.
- **FR-008**: Database storage tests MUST include an explicit chronological test verifying strict FIFO execution order for interleaved operations (`save` -> `delete` -> `save`) on the same project identifier.
- **FR-009**: Storage service bundle processing MUST separate in-memory structural validation from stored database invariant checks.
- **FR-010**: User interface copy in the API Settings panel MUST accurately describe rate limits as belonging to Project / Quota Groups with keys providing failover health pools, rather than claiming each key linearly increases quota limits.
- **FR-011**: System architecture documentation MUST accurately state API credential storage policies without claiming credentials are encrypted in IndexedDB.
- **FR-012**: Specification records for completed audit hardening features (`specs/147`, `specs/149`) MUST reconcile task checkboxes and status indicators to reflect their completed implementation state.

---

### Key Entities

- **Public Origin Descriptor**: Represents the canonical web origin used for search engine indexing, social sharing metadata, and sitemaps. Comprises protocol, host, and optional port without trailing slashes.
- **EPUB Archive Package**: Represents the standardized e-book container. Contains the uncompressed `mimetype` preamble, Open Container Format metadata (`container.xml`), publication package manifest and spine (`content.opf`), navigation document (`nav.xhtml`), NCX table of contents (`toc.ncx`), styling stylesheets, and XHTML chapters.
- **Project Write Queue**: The in-memory per-project Promise chain orchestrating serialized database mutations. Guarantees FIFO execution order and deterministic cleanup upon completion or failure.
- **Quota Group & Key Health Pool**: The domain model where rate limits (RPM/TPM) attach to the Google Cloud Project / Quota Group entity, while individual API keys within that group provide liveness, load rotation, and failover resilience.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated URLs in build outputs (`index.html`, `sitemap.xml`, OpenGraph tags) match the public URL specified in the active environment configuration file when provided.
- **SC-002**: XML parser validation in the EPUB test suite passes with 0 syntax warnings and 0 parser error nodes across all exported XML and XHTML components.
- **SC-003**: 100% of EPUB export test cases confirm that `mimetype` is the first archive entry and is stored uncompressed.
- **SC-004**: Consolidated security header parity test suite passes with 100% policy equality across all deployment configurations without duplicate test suites.
- **SC-005**: Database FIFO sequence test demonstrates 0 instances of out-of-order execution or state resurrection across concurrent interleaved save/delete operations.
- **SC-006**: Technical documentation and user interface text achieve 100% consistency with active runtime storage and quota architecture.
- **SC-007**: Full verification quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors, 0 test failures, and 0 warnings.

---

## Assumptions

- Deployments using static web servers can either serve pre-substituted static files generated at build time or leverage standard web server origin routing.
- The browser test environment provides a functional XML DOM parser (`DOMParser` with `application/xml` mime type) capable of reporting parser error elements.
- The existing storage queue implementation in `db.ts` (`projectWriteChains`) provides the necessary concurrency serialization primitives; additions are focused on verification tests and validation helper separation.
- Changes to API Settings user interface copy are targeted exclusively at clarifying rate limit mechanics in Vietnamese without altering underlying translation pipeline functionality.

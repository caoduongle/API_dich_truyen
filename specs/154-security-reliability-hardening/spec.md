# Feature Specification: Security, Reliability, and Architectural Hardening

**Feature Branch**: `154-security-reliability-hardening`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: Comprehensive security audit, privacy documentation alignment, credential lifetime reduction, model discovery timeout, structured response parsing normalization, build configuration hardening, and domain architectural refactoring.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transparent Privacy Disclosures & Credential Ephemerality (Priority: P1)

As a privacy-conscious translator using the translation tool,
I want transparent documentation explaining exactly where my manuscript data travels and I want my sensitive API keys to be held only ephemerally by default,
So that I can trust the software with my literary works and ensure my credentials do not persist in browser storage or linger in memory beyond their intended lifetime.

**Why this priority**:
User trust and compliance depend entirely on accurate privacy statements. Describing the application as "data never leaves the browser" when text is transmitted directly to external AI providers is factually inaccurate. Additionally, retaining raw secrets in memory caches or defaulting to persistent browser storage poses immediate data exposure risks on shared or public workstations.

**Independent Test**:
- Verify that documentation explicitly distinguishes between "no intermediate application backend" and "direct client-to-provider AI transmission".
- Verify that entering an API key defaults to session-only storage without writing to persistent browser storage unless explicitly opted into.
- Verify that removing or clearing an API key immediately removes all references from in-memory caches without residual heap retention.

**Acceptance Scenarios**:

1. **Given** a user reading the privacy policy and security documentation, **When** they inspect the data flow disclosures, **Then** the text explicitly clarifies that:
   - Manuscript and project data are persisted locally on the client device.
   - Translation and AI assistance requests transmit the required text segments directly from the browser to the designated AI provider.
   - Cloud synchronization sends files directly to the user's personal cloud storage.
   - No intermediate application server receives, logs, or stores manuscript content.
   - Static hosting platforms and content delivery networks may record standard HTTP access metadata.
2. **Given** a new user configuring an AI API key for the first time, **When** they do not explicitly enable "Remember keys on this browser", **Then** the credential is saved exclusively in ephemeral session storage and never written to long-term browser storage.
3. **Given** an active session with cached API key operations, **When** the user removes a key or ends the session, **Then** all internal lookup tables and digest caches discard raw secret representations so that sensitive plaintexts do not remain resident in memory.

---

### User Story 2 - Bounded Service Discovery & Resilient External Ingestion (Priority: P1)

As a translator managing AI models and translation batches,
I want model discovery requests to have bounded network deadlines and AI responses to be strictly validated before consumption,
So that a hanging network call or unexpected AI response format never freezes the user interface or crashes my active workspace.

**Why this priority**:
Network calls without explicit deadlines can hang indefinitely under adverse connection conditions, blocking user workflow. Similarly, directly ingesting unstructured external AI responses without safe decoding and schema verification can lead to unhandled runtime exceptions and data loss during drafting.

**Independent Test**:
- Simulate a hanging network request to the AI model discovery endpoint and ensure it reliably terminates within 15 seconds with a user-friendly diagnostic message.
- Provide malformed or partial structured JSON responses to the ingestion parser and verify graceful degradation without uncaught exceptions.

**Acceptance Scenarios**:

1. **Given** a user initiating model catalog discovery, **When** the external network or service takes longer than 15 seconds to respond, **Then** the discovery request automatically aborts and informs the user with an actionable timeout notice.
2. **Given** an external AI response containing structured output (such as terminology, critique, or alignment data), **When** the response text contains malformed formatting, markdown code fences, or invalid schema attributes, **Then** the application safely parses and validates the payload, falling back to a structured default rather than raising unhandled runtime errors.
3. **Given** a model listing in the catalog, **When** the model is hosted via external cloud APIs rather than on-device compute, **Then** user-facing labels must not describe it as "Local" to avoid confusing users about execution boundaries.

---

### User Story 3 - Production Build Hygiene & Scoped Environment Isolation (Priority: P2)

As a release engineer and maintainer,
I want the application build process to strictly follow designated build modes and restrict environment variable exposure to only application-prefixed variables,
So that developer tooling and staging configurations do not leak unexpected variables or alter production asset stripping.

**Why this priority**:
Build predictability and least-privilege exposure prevent secret leakage from ambient shell environments into static client bundles.

**Independent Test**:
- Execute builds with different mode configurations (staging, production) and confirm console/debugger stripping behaviors correspond strictly to the target mode.
- Verify that environment loading only pulls variables matching designated application prefixes.

**Acceptance Scenarios**:

1. **Given** a production bundle build command, **When** the build pipeline processes assets, **Then** stripping directives check the explicit build mode parameter rather than ambient process environment flags.
2. **Given** the configuration file reading environment variables, **When** variables are loaded from the workspace, **Then** only variables scoped with the designated application prefix are exposed to the build context.

---

### User Story 4 - Modular Storage & Decoupled State Architecture (Priority: P2)

As a software contributor extending the application,
I want client-side storage, workspace state orchestration, and quality review logic decomposed into focused domain modules,
So that individual components have clear single responsibilities, lower cognitive load, and reduced regression risk during maintenance.

**Why this priority**:
Core storage, workspace state, and quality evaluation modules have grown beyond 30–80 KB each. Decomposing them into coherent sub-domain packages stabilizes development, improves automated test isolation, and simplifies future upgrades.

**Independent Test**:
- Verify that storage operations (project management, chapter management, batch synchronization, deletion lifecycle) are encapsulated in dedicated domain stores behind a unified facade.
- Verify that all existing unit and integration tests continue to pass without regression.

**Acceptance Scenarios**:

1. **Given** storage requests for project metadata, chapters, bundles, and deletion manifests, **When** components interact with storage, **Then** they access specialized sub-domain modules through an export facade while maintaining identical contracts and transaction guarantees.
2. **Given** the workspace state management system, **When** editor interactions, panel views, hotkeys, and audit reviews take place, **Then** state is handled by domain-specific state hooks composed cleanly into the workspace controller.

---

### User Story 5 - Automated Quality Gates & Consolidated Security Controls (Priority: P3)

As a project maintainer,
I want comprehensive automated quality gates and unified security headers,
So that code quality, test coverage, secret leakage prevention, and browser security policies are maintained continuously across all deployment targets.

**Why this priority**:
Preventing security regressions and policy drift across multiple deployment descriptors (Vercel, Render, static headers) requires a single authoritative source of truth and rigorous automated verification.

**Independent Test**:
- Run automated security header parity verification to ensure all deployment targets share identical rules generated from a common definition.
- Verify CI execution checks type safety, linting, unit test coverage, and comprehensive secret detection.

**Acceptance Scenarios**:

1. **Given** Content Security Policy definitions for multiple hosting targets, **When** headers are configured, **Then** all target files derive their rules from a single authoritative definition.
2. **Given** the continuous integration pipeline, **When** a pull request is analyzed, **Then** automated jobs verify type checking, code style conventions, test coverage thresholds, and multi-pattern credential scanning.

---

### Edge Cases

- What happens if a user previously had API keys saved in persistent storage prior to the default changing to session-only?
- What happens if an external AI provider experiences a regional outage or high latency during batch translation or model discovery?
- What happens if a model discovery request is canceled by the user navigating away before the 15-second timeout expires?
- What happens if an AI service returns empty or partially truncated JSON due to provider token limits?
- What happens if multiple browser tabs access the modularized storage layer concurrently?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system documentation (including privacy policy and security overview) MUST accurately reflect that translation and AI analysis transmit manuscript text directly from the browser to the configured AI service provider, and that no intermediate application backend stores or processes this content.
- **FR-002**: System credential storage MUST default to disabled persistent storage (`rememberKeys = false`), retaining keys strictly in ephemeral session storage. For existing client installations, previously configured preferences are preserved, while any unconfigured preference or new browser session defaults strictly to session-only storage.
- **FR-003**: In-memory credential utilities MUST NOT maintain plaintext API keys as keys in global or module-level persistent lookup maps. Once an API key is unmounted or removed, no lingering reference shall remain in memory caches.
- **FR-004**: When checking or discovering available AI models from external service endpoints, the system MUST enforce an absolute timeout deadline of 15 seconds, terminating the request and releasing network resources if the provider does not respond within this window.
- **FR-005**: All call sites ingesting structured external AI outputs (including terminology extraction, quality evaluation, and translation alignment) MUST utilize a standardized safe parser and schema validation boundary, gracefully handling malformed syntax or missing attributes without throwing unhandled exceptions.
- **FR-006**: Model catalog metadata MUST display accurate execution indicators; models hosted on external cloud APIs MUST NOT be labeled as "Local" in user-facing menus.
- **FR-007**: Build configurations MUST derive asset optimization and debugging removal decisions from the active build mode rather than ambient process environment variables, and MUST restrict environment variable loading to application-scoped prefixes.
- **FR-008**: Architectural scope and phased delivery MUST deliver Phase 1 (Security & Correctness Hardening) as the immediate functional release, with Phase 2 (Architecture Decomposition for db.ts, workspace state, quality engine) and Phase 3 (Automated Quality Gates & Unified CSP Source) staged as follow-up specifications.
- **FR-009**: Storage operations MUST maintain strict transactional integrity, atomic write boundaries, and web lock concurrency protections while separating concerns into dedicated domain stores (connection, project, chapter, bundle, deletion manifests, CRDT).
- **FR-010**: Workspace state orchestration MUST partition state concerns into discrete sub-domain hooks (selection, editor, panels, audit, persistence, hotkeys) composed through a unified workspace controller.
- **FR-011**: Quality review orchestration MUST isolate rule evaluation, prompt composition, AI critique, issue normalization, and session persistence into dedicated domain sub-modules.
- **FR-012**: The build and verification pipeline MUST define distinct commands for type checking, linting, test suite execution, and coverage reporting.
- **FR-013**: Security headers across all deployment manifests MUST be synchronized with an authoritative security configuration source of truth.

### Key Entities

- **Client Credential Session**: Represents an active user session containing configured API keys, scoped by default to the lifetime of the browser tab, with explicit user opt-in required for persistent device storage.
- **Data Flow Disclosure**: Formal documentation specifying the boundary between local client storage (IndexedDB), external direct AI processing, user-controlled cloud backup (Google Drive), and static hosting telemetry.
- **Model Discovery Probe**: A network operation querying provider model catalogs, governed by an abort controller with a strict 15-second deadline.
- **Structured Response Boundary**: A validation gateway that accepts raw external AI text, cleans formatting artifacts, safely decodes JSON, and verifies schema conformance before passing typed objects to application domains.
- **Domain Storage Store**: Individual specialized storage managers operating within IndexedDB under a unified transaction and concurrency facade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user-facing privacy and security documentation accurately describes direct browser-to-AI data transmission without conflicting claims.
- **SC-002**: 0 raw API keys remain stored in persistent browser storage for unconfigured or new user sessions by default.
- **SC-003**: 0 raw API keys remain cached in global module maps after key removal or session invalidation.
- **SC-004**: 100% of model catalog discovery requests either complete successfully or abort within 15 seconds under high latency or network stall conditions.
- **SC-005**: 100% of structured AI responses across translation, glossary, and QA engines pass through safe parsing without triggering uncaught runtime exceptions on malformed input.
- **SC-006**: Automated quality verification (`npm run lint`, `npm test`, `npm run build`) passes cleanly with zero type errors, zero test regressions, and zero build failures.

## Assumptions

- The application continues to operate strictly as a client-side Single Page Application without any proprietary application backend.
- Direct communication with Google Gemini API and Google Drive v3 REST API remains the designated integration model.
- Client browsers support modern standard APIs including `AbortController`, `sessionStorage`, `localStorage`, and `IndexedDB`.
- Changes to storage internal structure preserve existing schema compatibility and data integrity for existing user projects.
- Existing Vietnamese language user interface labels and text copy remain unchanged unless explicitly targeted for accuracy corrections (such as removing misleading "Local" model tags).

# Feature Specification: Runtime Architecture & Security Hardening

**Feature Branch**: `160-runtime-architecture-hardening`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Rà soát API_dich_truyen ở trạng thái main hiện tại, gồm cấu trúc repo, các service chính, Gemini pipeline, IndexedDB/CRDT, Google Drive/OAuth, cấu hình deployment, CI và test suite. Khắc phục các vấn đề runtime architecture và security: Nginx security headers parity, Quota sliding-window persistence, không rotate key khi gặp Safety/Content filter, sửa stale QA issues, giới hạn concurrency trong glossary splitting, và debounce quota storage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uniform Deployment Security Protections (Priority: P1)

As a self-hosted translator deploying the application using containerized Nginx or Docker, I want the web server to enforce the exact same security headers (Content Security Policy, framing restrictions, MIME sniffing guards, and cross-origin isolation) as cloud-hosted deployments, so that my workspace, session data, and translation credentials remain safeguarded against clickjacking, content injection, and cross-origin credential leaks regardless of hosting environment.

**Why this priority**: Security guarantees must never degrade between development, containerized self-hosting, and cloud targets. Inconsistent security postures leave self-hosted users vulnerable to attacks that cloud environments already mitigate.

**Independent Test**: Can be fully verified by deploying or inspecting the containerized web server configuration, validating that all required security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy) match cloud production targets identically.

**Acceptance Scenarios**:

1. **Given** a user accesses the application served via a containerized web server, **When** examining HTTP response headers for any HTML page or static asset, **Then** all standard protective security headers (Content Security Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Cross-Origin policies, and Permissions Policy) are actively served with identical directive values to cloud platforms.
2. **Given** a third-party website attempts to frame or embed the application running on the containerized server, **When** the browser processes the response, **Then** embedding is blocked by the browser due to anti-framing and CSP directives.

---

### User Story 2 - Quota Usage Continuity Across Tab Reloads (Priority: P1)

As an active novel translator running multi-chapter translation workflows, I want my short-term rate-limit counters (requests per minute and tokens per minute) to survive page reloads or tab closures within their active 60-second sliding window, so that refreshing my browser does not reset local quota metrics to zero and cause accidental rate-limit penalties with translation providers.

**Why this priority**: When translators reload a tab after submitting several translation requests, resetting the 60-second window gives a false impression that the full quota capacity is immediately available, leading to burst requests that trigger upstream provider rate limits (HTTP 429).

**Independent Test**: Can be fully verified by making a sequence of translation attempts within a 60-second window, reloading the browser tab, and checking that the reported requests-per-minute and tokens-per-minute counters retain recent consumption for the remainder of that 60-second window.

**Acceptance Scenarios**:

1. **Given** a user has initiated 8 requests within the past 30 seconds, **When** the user reloads or reopens the browser tab within the same minute, **Then** the local quota monitor restores the recent usage window and reflects the 8 recent attempts rather than resetting to 0.
2. **Given** requests recorded in the sliding window age beyond 60 seconds, **When** the user inspects quota status or triggers another request, **Then** expired timestamps are automatically pruned, keeping memory and storage bounded.

---

### User Story 3 - Preserving Translation Keys on Content Moderation Blocks (Priority: P1)

As a translator processing raw text that contains sensitive keywords or triggers AI safety/content filters, I want the system to immediately halt retries and clearly notify me of the content moderation block without rotating through all other configured API keys, so that I do not exhaust alternative quota allowances or risk provider penalties for repeating the same blocked prompt.

**Why this priority**: Content filter rejections are deterministic prompt-level outcomes, not provider key failures or transient network errors. Cycling through multiple API keys for the same blocked text burns rate limits and quotas across all configured keys without any chance of succeeding.

**Independent Test**: Can be tested by providing a prompt that triggers a provider safety rejection and verifying that the translation engine halts on the initial key with an informative content filter notification, with zero retry attempts logged against subsequent keys.

**Acceptance Scenarios**:

1. **Given** multiple translation API keys configured, **When** an AI request is blocked due to provider safety or content moderation policies, **Then** the system immediately marks the request as blocked, halts further execution, displays a clear content moderation notification, and does NOT rotate to subsequent API keys.
2. **Given** a temporary server overload (503) or rate limit (429) occurs, **When** the failure is evaluated, **Then** the system continues its standard rotation to alternative available keys as intended.

---

### User Story 4 - Fresh and Reliable Quality Assurance (QA) Critique State (Priority: P1)

As a translator reviewing and revising chapter translations, I want the Quality Assurance (QA) critique system to clear outdated critique issues when a subsequent QA inspection passes cleanly, so that I am never confused by obsolete warnings after successfully addressing all detected translation issues.

**Why this priority**: Displaying stale critique issues on an already corrected chapter destroys user trust in the AI QA tooling and forces translators to repeatedly re-verify chapters they have already fixed.

**Independent Test**: Can be tested by running QA on a chapter with known translation omissions (generating critique issues), updating the translation to resolve the issues, re-running QA to obtain a clean pass, and verifying that the chapter's active QA issue list is completely cleared.

**Acceptance Scenarios**:

1. **Given** a chapter containing previous QA critique issues, **When** a new AI QA critique run succeeds and identifies 0 issues, **Then** the chapter's QA issues list is updated to empty, removing all stale issue indicators from the workspace.
2. **Given** a chapter with existing QA critique issues, **When** a subsequent QA critique run fails due to a network or service interruption, **Then** the existing issues are preserved until a successful inspection completes.

---

### User Story 5 - Throttled Concurrency for Deep Glossary Term Extraction (Priority: P2)

As a translator analyzing dense chapters for terminology extraction, I want recursive multi-part text splitting to process sub-segments using bounded concurrency rather than unrestricted parallel calls, so that bursts of simultaneous requests do not overwhelm the current API key or trigger abrupt rate limiting.

**Why this priority**: When large text segments fail initial extraction and split into multiple sub-segments, firing all sub-requests concurrently on a shared API key causes sudden request spikes, destabilizing the quota scheduler and increasing 429 errors.

**Independent Test**: Can be tested by providing a large text block that triggers adaptive multi-part splitting during glossary analysis, verifying that parallel sub-requests are strictly capped at a configured concurrency limit (maximum 2 concurrent calls) rather than executing all parts simultaneously.

**Acceptance Scenarios**:

1. **Given** a glossary extraction task that splits a chapter into 4 text fragments, **When** the fragments are processed, **Then** at most 2 requests execute concurrently, queueing remaining fragments until in-flight calls complete.
2. **Given** one fragment in a multi-part split encounters an unrecoverable content error, **When** other fragments succeed, **Then** successful terminology suggestions from valid fragments are preserved and combined seamlessly.

---

### User Story 6 - Responsive Workspace During High-Frequency Translation (Priority: P2)

As a translator performing rapid translation iterations or bulk chapter processing, I want quota state tracking to persist asynchronously and batched rather than performing blocking storage writes on every attempt, so that the translation workspace remains smooth and responsive without micro-stutters during heavy network traffic.

**Why this priority**: Repeated synchronous serialization and storage writes on every request attempt, retry, success, and failure create unnecessary CPU overhead in the critical translation path.

**Independent Test**: Can be tested by simulating rapid consecutive translation events and verifying that storage updates are debounced and coalesced, while ensuring that all accumulated metrics are flushed immediately when the browser tab transitions to hidden or closed.

**Acceptance Scenarios**:

1. **Given** rapid consecutive translation events occurring within hundreds of milliseconds, **When** quota state is recorded, **Then** in-memory state updates instantly while storage persistence is debounced within a controlled window (250ms–500ms).
2. **Given** pending in-memory quota changes that have not yet been written to storage, **When** the user closes or navigates away from the tab, **Then** pending updates are flushed immediately so no usage data is lost.

---

### Edge Cases

- **System Clock Discrepancies**: What happens if the client system clock jumps forward or backward during an active 60-second sliding window? The sliding window must discard timestamps occurring in the future relative to current time and prune timestamps older than 60 seconds, preventing negative or perpetual intervals.
- **Corrupted Storage State**: What happens if the persisted sliding window data in local session storage is malformed or truncated? The loader must fail gracefully, initialize an empty window, and continue tracking ongoing requests without crashing the application.
- **Simultaneous Safety and Rate Limits**: What happens if a response payload contains both a safety block flag and an ambiguous HTTP status? Content moderation rejection classification must take precedence over generic key rotation, ensuring no other keys are consumed.
- **Tab Abrupt Termination**: What happens if the browser is abruptly terminated (e.g., process kill) during an unpersisted debounce interval? The in-memory updates within the 250ms–500ms debounce buffer may be dropped, but historical persisted baseline remains intact and daily counters are preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deployment configuration for containerized web hosting MUST serve HTTP security headers that strictly match all cloud hosting profiles (Vercel, Render, static hosts), including Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy, and Cross-Origin-Resource-Policy.
- **FR-002**: Automated regression tests MUST enforce parity across all supported deployment configurations (Vercel, Render, Static Headers, Development Server, and Containerized Web Server), failing the build if any configuration deviates in directives or values.
- **FR-003**: The local quota tracking system MUST persist recent attempt timestamps and token consumption buckets within a compact sliding window across browser page reloads.
- **FR-004**: The sliding window state MUST strictly enforce a maximum duration of 60 seconds, automatically pruning data older than 60 seconds to keep storage footprints bounded.
- **FR-005**: Storage persistence for local quota tracking MUST be debounced to prevent synchronous storage writes on every single API attempt, while providing a flush mechanism on page lifecycle events (pagehide/visibilitychange).
- **FR-006**: When an AI provider response indicates that text was rejected by safety filters, content moderation, or prompt blocking, the request dispatcher MUST classify the error as a content-level block.
- **FR-007**: When an error is classified as a content-level block, the system MUST NOT rotate the request to any alternate API key and MUST immediately surface a clear content warning to the user.
- **FR-008**: Key rotation MUST only be triggered for key-specific errors (such as invalid key authentication 401/403, key-level rate exhaustion 429, or transient provider failures 500/503).
- **FR-009**: The chapter translation workflow MUST distinguish between a failed QA critique execution (e.g., network error) and a successful QA critique execution that discovered zero issues.
- **FR-010**: When a QA critique run successfully completes with zero detected issues, any prior QA issues recorded on that chapter MUST be cleared.
- **FR-011**: In recursive multi-part glossary splitting, concurrent requests to translation providers MUST be constrained to a bounded concurrency pool (maximum 2 simultaneous requests) rather than unbounded parallel execution.
- **FR-012**: If one sub-request fails with a content-level block during recursive glossary analysis, successful terminology results from any remaining valid sub-requests MUST be preserved and aggregated.

### Key Entities

- **Quota Sliding Window**: Represents fine-grained rate-limit consumption over a rolling 60-second horizon. Contains compact timestamp entries for request attempts and timestamped token volume buckets for active models and keys.
- **Deployment Security Profile**: The canonical collection of HTTP response header names and directive values that must be enforced consistently across all production deployment environments.
- **AI Request Error Classification**: Structured categorisation of request failures into Content Block (non-retryable, no key rotation), Key Auth Failure (key invalidated), Rate Limit (key temporarily paused), Transient Service Error (retried on alternate key), or Bad Request (prompt/schema invalid).
- **QA Critique Audit State**: The outcome record of an AI quality inspection on a chapter, tracking whether the inspection was executed successfully, the timestamp of the last successful inspection, and the active list of flagged issues.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% parity of HTTP security header names and directive values across all supported deployment targets (Vercel, Render, Static Headers, Vite preview, and Nginx container), verified by automated parity test suites.
- **SC-002**: 100% of request attempt counts and token volumes incurred within 60 seconds prior to a page reload remain accurately reflected in rate-limit indicators immediately following tab reload.
- **SC-003**: 0 redundant API calls executed across alternative API keys when a prompt triggers AI safety or content moderation rejections.
- **SC-004**: 100% of stale QA issues cleared from chapter state upon any successful QA critique run that reports 0 issues.
- **SC-005**: Maximum concurrent provider requests during multi-fragment glossary term extraction never exceeds 2, eliminating burst-induced provider rate limit spikes.
- **SC-006**: Quota storage writes during high-frequency translation batches reduced by over 70% through asynchronous persistence debouncing without losing state on tab exit.

## Assumptions

- **PST Reset Boundary**: Daily quota limits continue to be anchored at 00:00 PST (Pacific Standard Time) in accordance with Gemini API daily quota rollover behavior.
- **Client-Side Storage Availability**: Session storage is available in the user's browser environment for temporary quota tracking; if unavailable or disabled, the tracker falls back gracefully to in-memory tracking for the active session.
- **Single-Origin Deployment**: Containerized deployments serve the frontend SPA on a dedicated or reverse-proxied origin where Nginx directives can apply headers to all HTML and asset responses.
- **Architectural Refactoring Phasing**: Large-scale structural module decoupling (such as decomposing monolithic storage and state management files) will follow in subsequent implementation phases once core runtime correctness and security parity are established.

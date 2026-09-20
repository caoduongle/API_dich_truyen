# Feature Specification: AI Pipeline Safety and Response Validation Hardening

**Feature Branch**: `155-ai-pipeline-safety-hardening`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User review of commit `5c968836` identifying remaining P1/P2 priorities: UI privacy statement alignment, prompt sanitization in sentence rewrite, standardized structured response validation across translation services, general transport timeout deadline, and documentation synchronization.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - UI Privacy Transparency & Prompt Input Sanitization (Priority: P1)

As an author and translator using the editor workspace,
I want the application interface to accurately describe data transmission without exaggerated privacy claims, and I want all text injected into AI prompts to be strictly sanitized,
So that I have an honest understanding of how my data is handled, and malicious or formatting artifacts in text excerpts cannot hijack AI instructions.

**Why this priority**:
User interface labels must not claim "100% private" when manuscript excerpts are legitimately transmitted to external AI providers for processing. Furthermore, unsanitized inputs in editorial rewrite features expose users to prompt injection or corrupted outputs when excerpting complex texts.

**Independent Test**:
- Inspect the API settings modal and key management screens to verify the privacy copy accurately discloses direct browser-to-provider transmission without "100% private" claims.
- Submit text containing invisible control characters, prompt overriding cues, or zero-width spaces into sentence rewriting and confirm all inputs are properly sanitized before dispatch.

**Acceptance Scenarios**:

1. **Given** a user navigating to the API settings key management view, **When** they read the explanatory message, **Then** the text states that the application communicates directly from the browser to the AI provider without intermediate application servers, omitting misleading claims of "100% private".
2. **Given** a user triggering a sentence rewrite on an excerpt containing hidden Unicode or prompt injection sequences, **When** the rewrite request is constructed, **Then** the excerpt, context, and review issue messages are stripped of zero-width and control characters before entering the AI prompt.

---

### User Story 2 - Resilient Structured Output Validation Across Translation Services (Priority: P1)

As a translator processing multi-chapter novels,
I want all AI structured responses across raw translation, contextual polishing, quality critique, and sentence rewriting to undergo rigorous schema validation,
So that unexpected output structures, malformed types, or missing attributes from the AI provider never trigger unhandled runtime exceptions or interrupt translation batches.

**Why this priority**:
External AI responses are inherently untrusted external data. While raw syntax errors may be caught, non-string types (such as numbers or objects returned for expected text fields) cause catastrophic failures on string methods like `.trim()`. Enforcing type predicates across all four core translation stages guarantees system stability.

**Independent Test**:
- Inject mocked AI outputs containing non-string or malformed structures into raw translation, polish translation, QA critique, and sentence rewrite pipelines, verifying that each pipeline falls back safely or reports actionable diagnostic errors without crashing.

**Acceptance Scenarios**:

1. **Given** a raw translation response from the AI provider, **When** the payload contains non-string translation attributes or missing fields, **Then** the parser validates the structure and applies safe fallbacks without throwing unhandled exceptions.
2. **Given** a polish translation response with entity extraction, **When** the AI returns corrupted entity lists or malformed translated text, **Then** the output is safely validated against the expected schema before downstream normalization.
3. **Given** an AI QA critique response, **When** the critique list contains invalid issue formats, **Then** the response validator filters out malformed issues and preserves valid entries.
4. **Given** a sentence rewrite response, **When** the response lacks a valid string for the rewritten sentence, **Then** the system detects the invalid shape and falls back gracefully with a clear error notification.

---

### User Story 3 - General Transport Timeout & Connection Liveness Safeguards (Priority: P2)

As a translator operating under variable network conditions,
I want all external AI requests to have an automatic timeout ceiling,
So that hanging network connections or stalled remote endpoints never keep the translation queue in an indefinite waiting state.

**Why this priority**:
While model discovery currently enforces a 15-second deadline, translation requests relying on the underlying transport can remain stalled indefinitely if remote servers hold connections open without terminating. A generous but deterministic deadline (such as 60 seconds) ensures queue progress resumes.

**Independent Test**:
- Simulate a network connection that accepts the request but never sends data back, verifying that the transport automatically aborts after 60 seconds and releases pending queues.

**Acceptance Scenarios**:

1. **Given** an AI generation request dispatched via the network transport, **When** the remote endpoint does not respond within the designated deadline (60s default), **Then** the transport automatically cancels the request and throws a clear timeout notice.
2. **Given** an active translation request where the user presses Stop, **When** the external abort signal fires, **Then** the transport immediately cancels the fetch request and cleans up active timers.

---

### User Story 4 - Model Subsystem Documentation & Pipeline Maintenance (Priority: P2)

As a contributor or maintainer auditing system configuration,
I want the technical documentation to accurately reflect active authentication protocols and model quota limits, and I want dependency audits to remain clean,
So that operational references match production behavior and security scanners report minimal residual vulnerabilities.

**Why this priority**:
Documentation drift misleads contributors and operators regarding how credentials are sent and how quotas are scheduled. Maintaining dependency currency prevents security alerts from accumulating.

**Independent Test**:
- Review `docs/model-system.md` to confirm model discovery is documented using HTTP header authentication (`x-goog-api-key`) rather than URL query parameters, and model quota limits match active configuration.
- Run security auditing tools to verify that dependencies are up to date and known vulnerabilities are resolved or mitigated.

**Acceptance Scenarios**:

1. **Given** a developer consulting `docs/model-system.md`, **When** they inspect the model discovery sequence diagram and quota tables, **Then** the documentation matches the actual HTTP header authentication and model limits defined in the application source code.
2. **Given** the project continuous integration workflow, **When** the automated audit step executes, **Then** dependencies pass security verification without unaddressed high or critical vulnerabilities.

---

### Edge Cases

- What happens if the AI returns a valid JSON string that contains valid keys but values are unexpected types (e.g., `{"rawTranslation": null}` or `{"issues": "none"}`)?
- What happens if a user submits a sentence rewrite on an empty string or whitespace-only snippet?
- What happens if a translation request exceeds the 60-second deadline due to an exceptionally large chapter chunk?
- What happens if the user cancels an in-flight request precisely at the moment the transport timeout triggers?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The user interface (including `KeyListSection`) MUST state that translation requests travel directly from the client browser to Google Gemini without intermediate application servers, and MUST NOT claim that translation is "100% private".
- **FR-002**: All user-provided and context-derived inputs entering the sentence rewrite prompt (including target text, surrounding context, and critique messages) MUST be sanitized to remove zero-width characters, invisible control codes, and directional overrides prior to prompt interpolation.
- **FR-003**: The raw translation service MUST validate that incoming AI structured responses contain a valid string for the translation body, safely handling non-string attributes or missing fields without uncaught runtime exceptions.
- **FR-004**: The contextual polishing service MUST validate that incoming AI structured responses conform to the expected schema for polished text and discovered entities, ensuring non-string fields do not pass to downstream string utilities.
- **FR-005**: The quality critique service MUST validate that incoming AI critique responses conform to the critique schema, ensuring the issue list is an array and each item has valid string properties.
- **FR-006**: The sentence rewrite service MUST validate that the AI response contains a non-empty string for the rewritten sentence through the structured response parser, falling back or failing gracefully if the shape is invalid.
- **FR-007**: The general AI transport layer MUST enforce an automatic timeout ceiling of 60 seconds for all generation requests, while properly chaining caller-provided abort signals and cleaning up timer resources upon completion or cancellation.
- **FR-008**: System documentation in `docs/model-system.md` MUST be updated to accurately describe HTTP header authentication (`x-goog-api-key`) instead of query parameters and reflect the active quota metadata for all catalog models.
- **FR-009**: Project dependencies MUST be audited and updated where feasible to resolve reported moderate vulnerabilities in testing frameworks without introducing breaking changes.
- **FR-010**: All automated verification suites (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly without regression.

### Key Entities

- **Structured Response Validator**: A typed predicate function that inspects unknown AI outputs and asserts shape conformance before domain consumption.
- **Sanitized Editorial Context**: An excerpt payload cleaned of invisible characters, Unicode tag sequences, and potential prompt override directives before AI processing.
- **Transport Request Deadline**: A timed abort controller that guarantees external HTTP requests do not outlive the allowable network deadline.
- **Model Registry Documentation**: Authoritative architectural documentation detailing API endpoints, authentication headers, and default quota limits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 occurrences of misleading "100% private" claims remain in user interface components.
- **SC-002**: 100% of text fields interpolated into the sentence rewrite prompt pass through input sanitization.
- **SC-003**: 100% of structured response call sites across raw translation, polish translation, QA critique, and sentence rewrite utilize schema validation predicates.
- **SC-004**: 100% of network requests dispatched through the general AI transport terminate within 60 seconds if the provider connection stalls.
- **SC-005**: 100% parity between `docs/model-system.md` authentication descriptions and actual source code transport implementations.
- **SC-006**: Automated quality checks (`npm run lint`, `npm test`, `npm run build`) complete with zero errors and zero test regressions.

## Assumptions

- The 60-second general transport timeout is sufficient for typical literary chapter translation chunks (up to 2,000–3,000 words); callers with exceptional workloads may supply custom timeout values if necessary.
- Updating documentation and copy does not alter underlying translation logic or existing project storage formats.
- Schema validation functions return type predicates (`data is T`) allowing clean TypeScript type narrowing without runtime overhead.
- Moderate vulnerabilities in development testing tools can be updated or overridden in `package.json` without breaking Vitest test runners.

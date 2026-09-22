# Feature Specification: AI Pipeline Deep Hardening and Structural Resilience

**Feature Branch**: `156-ai-pipeline-deep-hardening`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User review of commit `090b0398` identifying remaining P1/P2 priorities: preventing structured parser schema bypass to raw JSON text, entity runtime schema validation and preventing runtime crashes in workspace state, universal prompt sanitization across project configurations and glossary terms, cumulative logical request transport deadline propagation across key rotations, quota documentation and scheduler assumption clarity, model catalog freshness, test framework vulnerability remediation, and strongly typed translation pipeline boundaries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resilient Structured Output & Schema Bypass Elimination (Priority: P1)

As a reader and translator translating novel chapters,
I want the application to strictly validate all structured data returned by external AI providers,
So that if a provider returns valid JSON with an invalid schema or missing translation attributes, the system never mistakenly displays raw JSON machine code as the translated chapter text.

**Why this priority**:
Treating schema-invalid JSON payloads as plain text allows raw JSON strings (such as `{"foo": "..."}`) to be injected into the user's chapter manuscript. This corrupts reading chapters and bypasses the safety guarantees of structured response parsing.

**Independent Test**:
- Inject mocked provider responses containing valid JSON with missing or unexpected keys into the raw and polish translation services.
- Verify that the system identifies the schema mismatch, rejects the payload with an explicit structural error, and does not fall back to treating the raw JSON string as chapter translation.

**Acceptance Scenarios**:

1. **Given** an AI translation response consisting of syntactically valid JSON that lacks translation fields, **When** the response is processed by the translation service, **Then** the service rejects the payload and reports a structural failure without copying raw JSON syntax into the chapter content.
2. **Given** an AI translation response consisting of non-JSON plain text, **When** structured JSON parsing fails completely, **Then** the service safely applies plain-text recovery heuristics only if the text does not contain serialized JSON syntax.

---

### User Story 2 - Comprehensive Discovered Entity Validation & Crash Prevention (Priority: P1)

As an editor managing novel terminology in the workspace,
I want all vocabulary and character entities extracted during translation to undergo strict item-level validation,
So that missing attributes (such as pronunciation or notes) from external AI models are assigned safe default values and cannot cause unexpected runtime exceptions in the workspace interface.

**Why this priority**:
Downstream workspace controllers perform text operations (such as `.trim()`) on entity fields. If an AI provider omits optional fields like `pinyin` or `note`, unhandled runtime exceptions crash the workspace and prevent the user from reviewing terms or saving chapters.

**Independent Test**:
- Supply mocked translation outputs with entity arrays containing incomplete fields, missing strings, or non-string values.
- Verify that all entities are safely normalized, type-checked, and consumed by workspace state without throwing runtime exceptions.

**Acceptance Scenarios**:

1. **Given** an AI translation response containing extracted entities with missing `pinyin`, `vietnamese`, or `note` attributes, **When** the entities are validated, **Then** every item is sanitized and guaranteed to have valid string values before reaching workspace state.
2. **Given** an entity item with non-string or malformed properties, **When** the validator processes the item list, **Then** invalid entries are either normalized to safe defaults or filtered out so downstream trimming operations never encounter undefined properties.

---

### User Story 3 - Universal Manuscript Context & Instruction Sanitization (Priority: P1)

As an author configuring translation guidelines and glossaries,
I want all project-level guidelines, genre directives, tone parameters, custom instructions, and dictionary entries to be sanitized against hidden characters, control codes, and prompt-injection markers before being sent to the AI model,
So that malicious or corrupted text in external manuscripts or project configurations cannot alter AI behavior or disrupt translation prompts.

**Why this priority**:
Manuscripts and project instructions imported from third-party sources can contain invisible Unicode formatting, directional override characters, or prompt override attempts. Omitting sanitization on project-level configurations leaves a security hole in the prompt pipeline.

**Independent Test**:
- Configure project descriptions, additional instructions, genre/tone fields, and glossary terms with zero-width characters, directional overrides, and control sequences.
- Verify that all assembled prompts sent to the external provider are sanitized and free of disruptive non-printable characters.

**Acceptance Scenarios**:

1. **Given** project translation guidelines or additional instructions containing invisible Unicode control codes, **When** raw, polish, or QA critique prompts are generated, **Then** all interpolated configuration fields are sanitized before transmission.
2. **Given** glossary entries containing zero-width spaces or directional overrides in Chinese or Vietnamese fields, **When** dictionary tables are embedded into prompts, **Then** all terms and annotations are sanitized.

---

### User Story 4 - Cumulative Request Timeout Across Key Rotations (Priority: P2)

As a translator processing chapters under fluctuating network conditions,
I want all translation requests with multiple configured API keys to enforce a cumulative deadline for the entire logical request,
So that stalled network connections across multiple keys cannot accumulate into minutes of frozen queues.

**Why this priority**:
Currently, a 60-second timeout applies per key attempt. With five configured keys, five stalled attempts can block the interface for up to 300 seconds. A cumulative deadline guarantees that the entire request finishes or fails within an acceptable timeframe.

**Independent Test**:
- Simulate hanging connections across multiple API keys in rotation and verify that the entire request terminates when the cumulative deadline expires, passing remaining time bounds to subsequent attempts.

**Acceptance Scenarios**:

1. **Given** multiple configured API keys where network calls stall without returning data, **When** a translation is executed, **Then** the entire multi-key operation aborts when the cumulative request deadline (60s) is exceeded.
2. **Given** a first key attempt that stalls for 25 seconds before failing, **When** rotating to the second key, **Then** the second attempt is bounded by the remaining time (35s) rather than resetting to a full 60 seconds.

---

### User Story 5 - Model Catalog Freshness, Quota Clarity & Security Hygiene (Priority: P2)

As a translator reviewing model options and security posture,
I want model labels to accurately describe current capabilities without outdated superlatives, I want system documentation and UI text to distinguish local scheduler assumptions from provider-side project limits, and I want dependencies updated against known security advisories,
So that I have an accurate understanding of available models and system security remains uncompromised.

**Why this priority**:
Documentation and UI claims suggesting that adding multiple keys from the same project multiplies Google quota misleads users. Keeping model descriptions and dependencies current avoids operational confusion and resolves security scanner warnings.

**Independent Test**:
- Verify model catalog labels and verification timestamps in configuration and documentation.
- Inspect quota explanatory copy in UI and documentation to verify that local rate limits are clearly identified as scheduler defaults.
- Run dependency audit to confirm testing framework vulnerabilities are resolved.

**Acceptance Scenarios**:

1. **Given** a user viewing model selection and quota dashboards, **When** they inspect model options and limits, **Then** preset models reflect accurate labels (e.g. premium preset) and quota limits are clearly identified as local scheduler defaults.
2. **Given** the project dependency tree, **When** security audits run, **Then** testing dependencies meet or exceed patched version thresholds with no unaddressed moderate advisories.

---

### Edge Cases

- What happens if the AI returns a valid JSON object that has none of the expected keys and contains only unrelated properties? The parser must identify a schema mismatch and throw a structural error, prohibiting plain-text fallback.
- What happens if an AI response is not JSON at all (e.g., pure literary prose)? The structured parser fails JSON parsing (`PARSE_FAILED`), and the service safely falls back to plain-text translation if length and content criteria are met.
- What happens if an extracted entity has valid `chinese` and `vietnamese` text but `type` is unrecognized? The entity validator normalizes the type to a safe fallback (e.g., `'other'`) and preserves the entity.
- What happens if the cumulative request deadline expires while an HTTP connection is actively receiving chunked data? The transport aborts the active request cleanly, cleans up timers, and returns a clear timeout error.
- What happens if a project description consists entirely of sanitized characters? The system handles the empty result gracefully by omitting the optional instruction block without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The structured response parser MUST distinguish between JSON syntax parse failures (`PARSE_FAILED`) and schema validation failures (`SCHEMA_INVALID`).
- **FR-002**: The raw translation and polish translation services MUST NOT apply plain-text fallback when an AI response parses as valid JSON but fails schema validation, and MUST throw an explicit structural validation error instead.
- **FR-003**: The plain-text fallback in translation services MUST only be permitted when the response text is non-JSON and does not contain serialized JSON keys.
- **FR-004**: The system MUST define a runtime validation schema for discovered entities that validates each item in the entity array, ensuring `chinese`, `vietnamese`, `pinyin`, and `note` are valid strings and `type` is a valid glossary type.
- **FR-005**: All translation pipeline types (`DirectRawTranslationResult`, `DirectPolishTranslationResult`) MUST replace `any[]` with strongly typed entity definitions (`DiscoveredEntity[]` or `Omit<GlossaryItem, 'id'>[]`).
- **FR-006**: The workspace controllers (including `useWorkspaceState.ts` and `chapterTranslationService.ts`) MUST safely handle entity string properties using default fallbacks before calling string methods such as `.trim()`.
- **FR-007**: All user-provided and project-level parameters interpolated into AI prompts (`genre`, `tone`, `description`, `additionalInstructions`, and glossary item fields) in `prompts.ts` MUST pass through `sanitizePromptInput`.
- **FR-008**: The AI client dispatch mechanism MUST enforce a cumulative overall request deadline across key rotation attempts, computing and passing the remaining duration to each successive attempt.
- **FR-009**: Documentation (`docs/model-system.md`) and UI components MUST describe local RPM/TPM/RPD limits as "Local scheduler defaults" / "Default local quota assumptions" rather than fixed Google API limits, clarifying that multiple keys within the same project share Google-enforced quotas.
- **FR-010**: The model catalog (`src/config/models.ts` and documentation) MUST update preset model labels (e.g., `Gemini 2.5 Pro (Preset cao cấp)`) and refresh verification timestamps to current audit dates.
- **FR-011**: Project development dependencies MUST update `vitest` to version `4.1.11` or higher to remediate security advisory GHSA-82fw-gwwq-j7x9.
- **FR-012**: Public documentation (`docs/privacy-policy.md`) MUST replace release placeholder dates with the official publication date.
- **FR-013**: All code quality gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly with zero type errors and zero regressions.

### Key Entities

- **Parsed AI Response State**: A tri-state classification indicating whether an external response is syntactically invalid JSON, structurally non-conforming JSON, or fully valid structured data.
- **Discovered Entity**: A validated vocabulary record containing non-null string properties for source characters, pronunciation, translated meaning, classification, and notes.
- **Cumulative Request Deadline**: A temporal boundary tracking remaining allowable execution time across multiple provider attempts and key rotation iterations.
- **Scheduler Quota Assumption**: A local client-side configuration representing default rate pacing limits to avoid throttling, distinguished from remote provider project-level quotas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 occurrences of serialized JSON syntax or schema-invalid JSON fragments appearing as chapter translation output in the application.
- **SC-002**: 0 unhandled runtime exceptions or crashes caused by undefined properties when processing discovered entities in the workspace.
- **SC-003**: 100% of project configurations, custom instructions, and glossary entries sanitized before interpolation into AI prompts.
- **SC-004**: 100% of multi-key translation requests terminate within the 60-second cumulative deadline when network endpoints stall.
- **SC-005**: 0 moderate or high severity security vulnerabilities reported by dependency scanners for development test runners.
- **SC-006**: 100% pass rate across the full automated test suite and build verification with zero type errors.

## Assumptions

- A 60-second cumulative deadline is sufficient for typical literary chapter translation chunks; individual attempts will divide the remaining budget appropriately.
- Sanitization of project guidelines and additional instructions strips non-printable control characters and zero-width artifacts without degrading literary tone instructions.
- Quota assumptions configured locally operate strictly as client-side scheduling throttles and do not alter external provider quota enforcement.
- Updating Vitest to `>=4.1.11` addresses the path-traversal advisory without introducing breaking changes to Vitest configuration or test execution.

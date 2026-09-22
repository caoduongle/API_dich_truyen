# Feature Specification: AI Pipeline Strict Validation and Structural Integrity

**Feature Branch**: `157-ai-pipeline-strict-validation`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User review of commit `601a9a58` confirming resolution of previous P1s (schema-invalid JSON bypass, entity pipeline `any[]` removal, prompt sanitization) while identifying remaining P1 and P2 items: tightening QA critique response validation (preventing `{}` from passing as valid with 0 issues), item-level QA issue validation and filtering, resolving entity validator strict rejection versus normalization, eliminating cumulative timeout overage edge cases, and addressing residual unvalidated structured AI outputs across the repository.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Strict QA Critique Response Validation & Empty Payload Rejection (Priority: P1)

As a translator and proofreader reviewing translated novel chapters,
I want the QA critique validation to strictly require both the validation flag and the issues collection, rejecting empty or incomplete responses,
So that an uninformative or malformed AI response (such as an empty object `{}`) is never misinterpreted as "no errors found", preventing undetected translation omissions or hallucinations from reaching readers.

**Why this priority**:
Currently, `isQaCritiqueResponse({})` evaluates to `true`. This causes downstream pipelines to silently assume `isValid: true` and `issues: []`. When an AI model produces an empty or broken JSON response, the system reports a false guarantee of flawless translation rather than triggering proper retry or error handling. An undetected omission or hallucination silently approved is far more damaging to manuscript quality than an explicit failure.

**Independent Test**:
- Provide mocked AI responses consisting of empty objects `{}`, objects missing `isValid`, or objects missing `issues`.
- Confirm that validation rejects the payload and triggers proper retry/error handling rather than reporting successful error-free critique.

**Acceptance Scenarios**:

1. **Given** an AI QA critique response returning an empty object `{}`, **When** response validation runs, **Then** it rejects the payload as invalid and does not default to `isValid: true, issues: []`.
2. **Given** an AI QA critique response with valid boolean `isValid` and valid array `issues`, **When** response validation runs, **Then** it accepts the payload and passes it to the QA critique service.
3. **Given** an AI QA critique response where `isValid` is not a boolean (e.g. string, number, null) or `issues` is not an array, **When** response validation runs, **Then** it rejects the payload.

---

### User Story 2 - Item-Level QA Issue Filtering & False Alarm Elimination (Priority: P2)

As a proofreader reviewing flagged translation discrepancies in the workspace,
I want individual QA critique items to be strictly validated according to their category, severity, quoted target text, and description,
So that corrupt or nonsensical issue items returned by the AI are dropped completely instead of being converted into empty, confusing warning cards in the editing workspace.

**Why this priority**:
Currently, invalid issue entries (such as bare numbers, empty objects, or objects missing descriptions) are coerced into default warning cards with empty text and descriptions, cluttering the UI with phantom warnings. Filtering out unparseable items maintains a clean, actionable audit list.

**Independent Test**:
- Feed QA issue arrays containing invalid items (e.g., primitives, missing descriptions, empty dictionaries) alongside valid issue items.
- Verify that only well-formed issues with required fields are preserved, while malformed entries are discarded without crashing.

**Acceptance Scenarios**:

1. **Given** a QA response containing a mix of well-formed issues and malformed entries (e.g., `123`, `{}`, or non-object values), **When** issue processing occurs, **Then** malformed entries are filtered out and only valid issues appear in the results.
2. **Given** an issue with an invalid severity or issue type, **When** processed, **Then** the system safely maps recognized values or rejects completely non-conforming issue structures.

---

### User Story 3 - Discovered Entity Type Enforcement (Priority: P2)

As an editor curating the project glossary during translation,
I want newly discovered character names, terminology, and places to undergo strict property type checking,
So that entries with non-string attributes are rejected or rigorously validated rather than masking corrupt structures with empty strings, preserving the integrity of the project dictionary.

**Why this priority**:
While coercing non-string types to empty strings prevents immediate runtime crashes, it allows structurally corrupt entities (e.g., numbers, null, or objects) to pollute the glossary. Ensuring all entity attributes strictly conform to expected string contracts upholds data quality and aligns with the project specification.

**Independent Test**:
- Submit entities with non-string fields (`pinyin: 123`, `vietnamese: null`, `note: {}`).
- Verify that entity validation enforces the chosen validation strategy without throwing unhandled exceptions.

**Acceptance Scenarios**:

1. **Given** an entity candidate with valid string values for `chinese` and optional string values for `vietnamese`, `pinyin`, and `note`, **When** validated, **Then** the entity is accepted and safely normalized for the workspace.
2. **Given** an entity candidate where `chinese` is missing or empty, or where properties contain invalid non-string types, **When** validated, **Then** the system strictly rejects the entity candidate if any property has an explicit non-string type (`number`, `boolean`, `null`, `object`), while permitting missing or undefined optional attributes (`vietnamese`, `pinyin`, `note`) to default safely to empty strings.

---

### User Story 4 - Hard Cumulative Deadline Ceiling Without Trailing Overshoot (Priority: P2)

As a user translating large novel chapters across multiple configured API keys,
I want the cumulative request deadline to act as an unyielding hard cap without minimum artificial buffers,
So that translation attempts strictly respect the total configured timeout (e.g., 60 seconds) without trailing overruns across key rotations.

**Why this priority**:
Currently, an attempt floor of 1000ms is enforced (`Math.max(1000, ...)`), allowing an attempt to exceed the cumulative deadline by several hundred milliseconds when only a fraction of a second remains. Respecting the exact remaining balance guarantees an uncompromising cumulative timeout ceiling.

**Independent Test**:
- Trigger multi-key translation with a simulated network delay and an impending cumulative deadline (<500ms remaining).
- Verify that the subsequent attempt is bounded exactly by the remaining balance or terminates immediately if the budget is exhausted, with zero overshoot beyond the deadline.

**Acceptance Scenarios**:

1. **Given** a multi-key translation where 200ms remains of the cumulative deadline, **When** initiating the next key attempt, **Then** the attempt is strictly bounded by 200ms without being rounded up to 1000ms.
2. **Given** a cumulative deadline where remaining time reaches zero or less, **When** the next attempt check runs, **Then** the request aborts immediately with a cumulative timeout error.

---

### User Story 5 - Unified Structured Output Validation Across Secondary Services (Priority: P2)

As a system maintainer and developer,
I want secondary AI structured operations (such as glossary analysis, quick term lookup, and deep quality scanning) to use validated structured parsing instead of unvalidated JSON casting,
So that all AI integration points across the entire application share consistent schema boundaries and runtime safety.

**Why this priority**:
While primary translation and polish pipelines enforce strict tri-state parsing and validation, secondary modules (direct glossary analysis, quick term generation, and Hako quality engine) still use raw JSON parsing or unvalidated schema parsing. Standardizing these interfaces eliminates residual technical debt.

**Independent Test**:
- Exercise quick term lookup, glossary extraction, and quality scan services with malformed or incomplete JSON payloads.
- Verify that each service handles structural mismatches gracefully using validated fallbacks or explicit errors.

**Acceptance Scenarios**:

1. **Given** an AI response from quick term lookup, glossary extraction, or quality scanning, **When** parsed, **Then** the payload is checked with a designated runtime schema validator ensuring strict type compliance across all secondary services.
2. **Given** an invalid or schema-mismatched response in secondary engines, **When** validated, **Then** safe fallbacks are applied without throwing uncaught type errors.

---

### Edge Cases

- What happens when a QA critique response contains `isValid: true` but also contains critical severity issues? The validator preserves both, and the audit bridge prioritizes the issues list so that quality discrepancies are never concealed by a conflicting boolean flag.
- What happens when an AI returns an empty `issues: []` array and `isValid: true`? This is the legitimate definition of a clean, pass-all QA critique and is accepted as valid.
- What happens when an AI returns `{}`? The validator rejects the payload because `isValid` is undefined and `issues` is undefined. The service falls back to safe retry or reports a structural failure.
- What happens when an issue item has `type: "omission"` where no Vietnamese text exists to quote? The schema allows `targetText: ""` for omissions, which is accepted as valid as long as `description` is non-empty.
- What happens if the remaining cumulative timeout is less than 50ms before a network dispatch? The transport client terminates immediately before socket dispatch to avoid hanging connection setups, throwing a cumulative TimeoutError.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The QA critique response validator (`isQaCritiqueResponse`) MUST strictly require `isValid` to be a boolean and `issues` to be an array. Payloads missing either field (including `{}`) MUST be rejected as invalid.
- **FR-002**: The QA critique issue processor in `qaCritique.ts` MUST filter out invalid, non-object, or malformed issue items rather than coercing them into empty warning cards.
- **FR-003**: Each preserved QA critique issue MUST validate that `description` (or `message`) is a non-empty string, `targetText` is a string, and `type` and `severity` map to valid enums.
- **FR-004**: The discovered entity validator MUST enforce string type constraints on entity attributes, rejecting entities containing non-string primitives (e.g., numbers, booleans) or complex types (objects, arrays) for `chinese`, `vietnamese`, `pinyin`, or `note`.
- **FR-005**: The cumulative request deadline calculation in `geminiClient.ts` MUST NOT apply an artificial minimum duration floor (such as `Math.max(1000, ...)`), strictly bounding each attempt by `remainingMs`.
- **FR-006**: The AI transport client MUST abort immediately if `remainingMs` is zero or less before initiating any fetch attempt.
- **FR-007**: Structured AI outputs in secondary services (Quick Term lookup in `directGeminiClient.ts`, Quality Scan in `hakoQualityEngine.ts`, and Glossary Analysis in `directGlossaryEngine.ts`) MUST adopt runtime schema validators ensuring type safety.
- **FR-008**: Existing test suites in `src/lib/__tests__/text.test.ts` and translation tests MUST be updated to assert that `{}` is rejected by `isQaCritiqueResponse`, and new unit tests MUST verify strict issue filtering and hard cumulative deadline edge cases.
- **FR-009**: All automated quality verification gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly with zero type errors, zero test failures, and zero build warnings.

### Key Entities

- **QA Critique Record**: A validated inspection result containing an explicit boolean approval status (`isValid`) and a filtered list of conforming issues.
- **QA Issue Item**: A single identified translation problem with non-empty description, text location snippet, categorized error type, and severity rating.
- **Strictly Validated Entity**: A vocabulary term where character representation is a required non-empty string, and all annotations are verified strings.
- **Hard Cumulative Timeout**: An absolute temporal budget for multi-key translation operations where each retry consumes remaining time without artificial minimum floors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 occurrences of empty or schema-invalid QA critique responses (`{}`) interpreted as successful passes.
- **SC-002**: 0 blank or phantom warning cards created in the QA audit interface from malformed AI issue items.
- **SC-003**: 100% of discovered entities accepted into the workspace verify string types across all fields.
- **SC-004**: 100% of multi-key translation requests strictly respect the cumulative deadline ceiling without exceeding configured duration by >50ms.
- **SC-005**: 100% of structured AI outputs across all services validate schemas at runtime.
- **SC-006**: 100% pass rate across the full automated test suite and build verification with zero type errors.

## Assumptions

- Omitted optional properties in entity extraction (e.g., undefined `note` or `pinyin`) represent absence of data and default to empty strings, whereas explicit non-string values (numbers, booleans, objects) represent schema corruption and warrant rejection.
- A request with under 50ms remaining cannot reliably complete an HTTP round trip to Gemini API; aborting immediately is the correct behavior to preserve cumulative deadline guarantees.
- Secondary engines (glossary analysis, quick term, quality scan) retain their functional contracts while gaining runtime schema validation.

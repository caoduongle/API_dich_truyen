# Feature Specification: Strict QA Issue Validation and Secondary Pipeline Hardening

**Feature Branch**: `158-qa-issue-strict-hardening`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User review of commit `2f234ef` confirming resolution of previous P1/P2 items (QA `{}` rejection, entity non-string rejection, cumulative timeout 1s floor removal, JSON tri-state parsing) while identifying remaining P1 and P2 items:
1. 🔴 **P1**: `isQaCritiqueIssue()` still allows missing required fields (`type`, `severity`, `targetText`, `description/message`), coercing incomplete issues to default values rather than strictly rejecting them.
2. 🟠 **P2**: Secondary validators in Hako quality scan only check that `issues` is an array without validating individual items at item level.
3. 🟠 **P2**: Glossary pipeline in `directGlossaryEngine.ts` still uses `any[]` in exported and internal interfaces.
4. 🟠 **P2**: `quickTranslateTermDirect` interpolates `options.genre` into system instruction without `sanitizePromptInput`.
5. 🟠 **P2**: Hako AI quality scan interpolates `projectTitle` and `chapter.title` into prompts without `sanitizePromptInput`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Strict QA Critique Issue Required Fields Validation (Priority: P1)

As a translator and proofreader reviewing automated QA feedback on novel chapters,
I want each identified translation issue to strictly require valid category, valid severity, quoted target text, and descriptive explanation,
So that incomplete, truncated, or malformed issue objects from the AI are dropped completely rather than being artificially coerced into default warning cards with missing context.

**Why this priority**:
Currently, `isQaCritiqueIssue` only checks `targetText`, `type`, and `severity` when they are defined (`!== undefined`). Payloads such as `{"description": "Có lỗi dịch"}` or `{"type": "omission", "description": "Thiếu nội dung"}` pass validation and downstream logic coerces missing fields into defaults (`type: "other"`, `severity: "warning"`, `targetText: ""`). This allows structurally incomplete AI outputs to generate low-context, confusing warning cards in the editing workspace. Under the strict validation model, any issue missing required fields must be filtered out.

**Independent Test**:
- Supply QA critique responses containing incomplete issue items (e.g. missing `type`, missing `severity`, missing `targetText`, or invalid enum values).
- Confirm that `isQaCritiqueIssue` rejects these items (`false`) and `qaCritiqueDirect` drops them from the resulting issues list, while retaining well-formed issues.

**Acceptance Scenarios**:

1. **Given** a QA issue object missing `type`, `severity`, or `targetText`, **When** evaluated by `isQaCritiqueIssue`, **Then** it returns `false`.
2. **Given** a QA issue object where `type` is not one of `['omission', 'addition', 'repetition', 'terminology', 'other']` or `severity` is not one of `['critical', 'warning', 'info']`, **When** evaluated, **Then** it returns `false`.
3. **Given** a QA issue object where `targetText` is not a string, **When** evaluated, **Then** it returns `false`. (An empty string `""` is valid for omissions, but non-string values or missing `targetText` are invalid).
4. **Given** a QA issue object with valid enum `type`, valid enum `severity`, string `targetText`, and non-empty `description` (or `message`), **When** evaluated, **Then** it returns `true`.

---

### User Story 2 - Item-Level Validation for Hako Quality Scan Issues (Priority: P2)

As a quality reviewer performing deep quality audits across novel chapters,
I want the Hako quality scanner to validate individual issue objects within the AI response at runtime,
So that corrupt or malformed scan items (e.g., non-string explanations, invalid categories, non-string snippets) are rejected rather than relying on unsafe runtime type assertions.

**Why this priority**:
Currently, `isHakoQualityScanResponse` only checks `Array.isArray(obj.issues)`. Corrupt items like `{ category: 123, severity: {}, explanation: true }` pass the response-level guard, leaving downstream consumers to use unsafe casts `(item.category as QualityIssueCategory)`. Validating items with a dedicated predicate ensures consistent data integrity across the quality audit interface.

**Independent Test**:
- Pass simulated AI scan responses with mixed valid issues, malformed items, and invalid primitive values to the Hako scanner parser.
- Verify that invalid items are discarded and only conforming quality scan issues are preserved.

**Acceptance Scenarios**:

1. **Given** a Hako quality scan response with an array of issues containing invalid types or missing required explanations, **When** parsed, **Then** malformed items are filtered out at the item level.
2. **Given** a conforming Hako scan issue with valid category, severity, explanation, and string snippets, **When** parsed, **Then** it is preserved and mapped into the audit state.

---

### User Story 3 - Strongly-Typed Glossary Pipeline and Elimination of `any[]` (Priority: P2)

As a software maintainer and developer,
I want the glossary analysis and extraction engine to use concrete TypeScript interfaces instead of `any[]`,
So that the glossary boundary maintains strict compile-time type safety and aligns with the runtime schema validators already in place.

**Why this priority**:
`directGlossaryEngine.ts` currently exports interfaces such as `AnalyzeGlossaryDirectResult` with `suggestions: any[]` and returns `Promise<{ suggestions: any[] }>`. While runtime guards exist, returning `any[]` weakens type safety at the service boundary. Introducing a structured suggestion type ensures end-to-end type integrity.

**Independent Test**:
- Inspect TypeScript compiler output via `npm run lint` (`tsc --noEmit`) to verify that all glossary engine methods expose strongly-typed suggestion arrays.

**Acceptance Scenarios**:

1. **Given** the exported interfaces in `directGlossaryEngine.ts` (`AnalyzeGlossaryDirectResult`, `ExtractGlossaryDirectResult`, `callGlossaryAnalysisDirect`), **When** inspected, **Then** they use concrete types (e.g. `GlossarySuggestion[]` or `DiscoveredEntity[]`) instead of `any[]`.
2. **Given** downstream callers consuming glossary suggestions, **When** compiled, **Then** types flow safely without implicit or explicit `any` casting.

---

### User Story 4 - Comprehensive AI Prompt Sanitization for Metadata & Title Inputs (Priority: P2)

As a security-minded user,
I want all user-provided metadata and titles interpolated into AI prompts (specifically genre in Quick Term, and project/chapter titles in Hako scanner) to be sanitized,
So that potential prompt injection payloads or formatting control characters in user titles cannot manipulate the AI system instructions or response structures.

**Why this priority**:
While primary translation inputs (`term`, `contextText`, `vietnameseContent`, `rawChineseContent`) are sanitized, `options.genre` in `quickTranslateTermDirect` and `chapter.title` / `projectTitle` in Hako quality scan are interpolated directly into prompts. Sanitizing all string interpolations enforces defense-in-depth and eliminates prompt injection vectors.

**Independent Test**:
- Pass genre strings and chapter titles containing control characters or prompt injection attempts (e.g. markdown headers, system instruction overrides).
- Verify that `sanitizePromptInput` is executed on these inputs before template interpolation.

**Acceptance Scenarios**:

1. **Given** an `options.genre` string provided to `quickTranslateTermDirect`, **When** the prompt is constructed, **Then** the genre is sanitized via `sanitizePromptInput` before interpolation.
2. **Given** `projectTitle` and `chapter.title` passed into Hako quality scan, **When** the prompt is constructed, **Then** both titles are sanitized via `sanitizePromptInput` before interpolation.

---

### Edge Cases

- What happens if a QA critique issue has `type: "omission"` where no target text exists in the Vietnamese output?
  The schema requires `targetText` to be a string. For omissions, an empty string `""` is valid and accepted as long as `typeof targetText === 'string'`. Undefined, null, or non-string values are rejected.
- What happens if a QA issue provides `message` instead of `description`?
  Both field names are accepted as valid descriptive text if they are non-empty strings.
- What happens if `options.genre` is undefined in `quickTranslateTermDirect`?
  The genre note is omitted from the prompt as before. If defined, it is sanitized before insertion.
- What happens if `chapter.title` or `projectTitle` is empty or undefined in Hako quality scan?
  The system provides safe fallback strings (e.g. `""` or `"Không có tiêu đề"`) and sanitizes them before interpolation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `isQaCritiqueIssue` MUST strictly require `type` to be a string matching one of the allowed categories: `'omission' | 'addition' | 'repetition' | 'terminology' | 'other'`. Omitted or non-conforming `type` MUST return `false`.
- **FR-002**: `isQaCritiqueIssue` MUST strictly require `severity` to be a string matching one of the allowed severities: `'critical' | 'warning' | 'info'`. Omitted or non-conforming `severity` MUST return `false`.
- **FR-003**: `isQaCritiqueIssue` MUST strictly require `targetText` to be a string (`typeof targetText === 'string'`). Omitted or non-string `targetText` MUST return `false`.
- **FR-004**: `isQaCritiqueIssue` MUST strictly require either `description` or `message` to be a non-empty string (`trim().length > 0`). Omission or whitespace-only string MUST return `false`.
- **FR-005**: Hako quality scan parser MUST validate individual issue items within the `issues` array at runtime (using a dedicated predicate e.g. `isHakoQualityScanIssue`), discarding any item with non-string explanation, missing explanation, invalid category, or non-string snippets.
- **FR-006**: `directGlossaryEngine.ts` MUST replace `any[]` in `AnalyzeGlossaryDirectResult`, `ExtractGlossaryDirectResult`, and internal helper signatures with structured types (e.g. `GlossarySuggestion[]` or `DiscoveredEntity[]`).
- **FR-007**: `quickTranslateTermDirect` in `src/services/directGeminiClient.ts` MUST pass `options.genre` through `sanitizePromptInput` before interpolating into the AI prompt and system instruction.
- **FR-008**: Hako quality scan in `src/services/hakoQualityEngine.ts` MUST pass `projectTitle` and `chapter.title` through `sanitizePromptInput` before interpolating into the AI prompt.
- **FR-009**: All automated quality verification gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly with zero type errors, zero test failures, and zero build warnings.

### Key Entities

- **Strict QA Critique Issue**: A translation audit item with guaranteed presence and validity of `type`, `severity`, `targetText`, and `description`.
- **Validated Hako Scan Issue**: An audit issue detected by the Hako quality engine with verified string explanation, valid category/severity, and clean snippets.
- **Glossary Suggestion**: A strongly-typed vocabulary recommendation containing source term, Vietnamese target, optional pinyin, and notes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of issue objects accepted by `isQaCritiqueIssue` possess valid `type`, valid `severity`, string `targetText`, and non-empty `description`. 0 incomplete issues coerced into default cards.
- **SC-002**: 100% of items parsed from Hako AI quality scans are validated at item level before ingestion into the review UI.
- **SC-003**: 0 occurrences of `any[]` in `directGlossaryEngine.ts` interface declarations and function return types.
- **SC-004**: 100% of user-provided metadata strings (genre, chapter title, project title) interpolated into AI prompts are sanitized against prompt injection.
- **SC-005**: 100% pass rate across the full automated test suite (`npm test`) and build verification (`npm run build`) with zero type errors (`npm run lint`).

## Assumptions

- For omissions, `targetText` can legitimately be an empty string `""` because the missing source content was omitted from the translated text; however, the property must be present as a string type.
- Backward compatibility for `message` alongside `description` is preserved since some model outputs use `message` to convey issue descriptions.
- `sanitizePromptInput` trims whitespace and strips control characters/delimiter markers without altering legitimate literary text content.

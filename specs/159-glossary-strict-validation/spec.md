# Feature Specification: Strict Glossary Runtime Validation and End-to-End Typing Hardening

**Feature Branch**: `159-glossary-strict-validation`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User review of commit `c1b8b2b` confirming resolution of previous P1/P2 items while identifying remaining 3 points:
1. 🟠 **P2**: Glossary runtime validation item-level filtering (`isGlossarySuggestionItem`) — prevent coercion of malformed objects (`{}`, `chinese: 123`, `vietnamese: null`) into blank/phantom cards (`chinese: ""`, `vietnamese: ""`).
2. 🟠 **P2**: Internal `any[]` elimination across glossary engine (`rawSuggestions`, `rawList`), translation service (`detectedQaIssues` in `chapterTranslationService.ts`), and translation types (`glossary?: any[]` in `types.ts`).
3. 🟡 **P3**: Specification and data model alignment — synchronize `GlossarySuggestion` across `data-model.md` and spec artifacts to reflect actual code implementation (`extends Omit<GlossaryItem, 'id'>`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Item-Level Runtime Validation for Glossary Suggestions (Priority: P1)

As a translator or novel project manager,
I want the glossary extraction and analysis pipeline to strictly validate individual suggestion objects at runtime and discard malformed, empty, or type-violating items,
So that corrupt AI outputs (e.g. missing `chinese`, non-string `chinese`, empty `chinese`, non-string `vietnamese`) are dropped completely instead of being coerced into phantom blank entries (`chinese: ""`, `vietnamese: ""`).

**Why this priority**:
Currently, `isGlossarySuggestionsResponse()` only verifies that `data.suggestions` is an array. When the LLM outputs malformed items such as `{}`, `{"chinese": 123}`, or `{"vietnamese": null}`, `directGlossaryEngine.ts` coerces them into `{ chinese: "", vietnamese: "", pinyin: "", type: "other", note: "" }`. Furthermore, `validateAndSnapBackEntities` does not discard `chinese: ""` because `rawText.includes("")` evaluates to `true`. This causes empty/phantom glossary cards to populate the project glossary. Under the strict validation model, any item lacking required valid fields must be filtered out at the item level before downstream processing.

**Independent Test**:
- Pass simulated AI responses containing malformed suggestion items (e.g. `{}`, `{"chinese": 123}`, `{"vietnamese": null}`, `{"chinese": ""}`) to `callGlossaryAnalysisDirect` and `extractGlossaryDirect`.
- Verify that `isGlossarySuggestionItem` rejects these items (`false`) and the engine filters them out, retaining only well-formed suggestions.

**Acceptance Scenarios**:

1. **Given** a raw suggestion item missing `chinese` (or `term`), with empty `chinese: ""`, or with non-string `chinese`, **When** evaluated by `isGlossarySuggestionItem`, **Then** it returns `false`.
2. **Given** a raw suggestion item where `vietnamese` is not a string, **When** evaluated, **Then** it returns `false`.
3. **Given** a raw suggestion item where `type` is defined but is not a valid `GlossaryType` (`'character' | 'location' | 'term' | 'phrase' | 'other'`), **When** evaluated, **Then** it returns `false`.
4. **Given** a raw suggestion item where `pinyin` or `note` is defined but is not a string, **When** evaluated, **Then** it returns `false`.
5. **Given** an AI suggestions payload containing a mix of conforming terms and malformed items (e.g. `{}`, `{"chinese": 123}`, `{"vietnamese": null}`), **When** processed by `analyzeGlossaryDirect` or `extractGlossaryDirect`, **Then** malformed items are discarded and only conforming items are retained.
6. **Given** an item with valid non-empty `chinese`, string `vietnamese`, and optional string `pinyin`/`note`, **When** evaluated by `isGlossarySuggestionItem`, **Then** it returns `true`.

---

### User Story 2 - End-to-End Type Safety & Internal `any[]` Elimination (Priority: P2)

As a software engineer and codebase maintainer,
I want internal variables in the glossary pipeline and downstream translation services to use strongly-typed contracts instead of `any[]`,
So that the entire pipeline is compile-time checked without type holes or unchecked assertions.

**Why this priority**:
While `directGlossaryEngine.ts` replaced `any[]` in its public exported interfaces in commit `c1b8b2b`, internal implementations still cast parsed JSON to `any[]` (`const rawSuggestions = (...) as any[]` and `const rawList = (...) as any[]`). Furthermore, `chapterTranslationService.ts` declares `let detectedQaIssues: any[] = []` and `src/services/translation/types.ts` declares `glossary?: any[]` in `DirectQaCritiqueParams`. Eliminating these remaining occurrences ensures full end-to-end type safety across the AI pipeline.

**Independent Test**:
- Inspect TypeScript compiler output via `npm run lint` (`tsc --noEmit`) and search for `any[]` in the targeted files.
- Verify that all internal variables and parameters use concrete interfaces (`DirectQaCritiqueIssue[]`, `GlossaryItem[]`, `unknown[]`).

**Acceptance Scenarios**:

1. **Given** `directGlossaryEngine.ts`, **When** inspected, **Then** `rawSuggestions` and `rawList` do not use `as any[]`, but handle parsed JSON as `unknown[]` before filtering via `isGlossarySuggestionItem`.
2. **Given** `chapterTranslationService.ts`, **When** inspected, **Then** `detectedQaIssues` is typed as `DirectQaCritiqueIssue[]` instead of `any[]`.
3. **Given** `src/services/translation/types.ts`, **When** inspected, **Then** `DirectQaCritiqueParams.glossary` is typed as `GlossaryItem[]` instead of `any[]`.

---

### User Story 3 - Specification & Data Model Alignment (Priority: P3)

As a developer relying on Spec-Kit as the single source of truth,
I want `data-model.md` and related contracts to accurately describe `GlossarySuggestion` as extending `Omit<GlossaryItem, 'id'>`,
So that architectural documentation perfectly matches the production code.

**Why this priority**:
In `specs/158-qa-issue-strict-hardening/data-model.md`, `GlossarySuggestion` was documented with `term: string` and optional fields, whereas the actual codebase implements `export interface GlossarySuggestion extends Omit<GlossaryItem, 'id'> { term?: string; [key: string]: unknown; }` requiring `chinese`. Aligning the data model documentation prevents drift between design specs and implementation.

**Independent Test**:
- Inspect `data-model.md` and verify that `GlossarySuggestion` schema definition matches the production interface in `src/lib/text.ts`.

**Acceptance Scenarios**:

1. **Given** the feature specifications and data models, **When** inspected, **Then** `GlossarySuggestion` is documented with required `chinese`, `vietnamese`, `pinyin`, `type`, `note`, matching `Omit<GlossaryItem, 'id'>`.

---

### Edge Cases

- What happens if the AI returns a suggestion using the field name `term` instead of `chinese`?
  `isGlossarySuggestionItem` checks `item.chinese` first; if absent, it checks `item.term`. If neither is a non-empty string, the item is rejected. If `item.term` is a non-empty string, it maps to `chinese`.
- What happens if `chinese` contains only whitespace characters?
  `isGlossarySuggestionItem` trims the string and rejects it (`trim().length === 0`).
- What happens if `validateAndSnapBackEntities` receives an entity with an empty `chinese` string?
  `validateAndSnapBackEntities` explicitly checks `if (!item || typeof item.chinese !== 'string' || !item.chinese.trim()) return item;` and avoids applying `rawText.includes("")`.
- What happens if all suggestions in an AI response are malformed?
  The engine filters out all items, yielding an empty array `[]` cleanly without runtime exceptions or phantom cards.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated item-level type predicate `isGlossarySuggestionItem(item: unknown): item is GlossarySuggestion` in `src/lib/text.ts`.
- **FR-002**: `isGlossarySuggestionItem` MUST require `chinese` (or `term`) to be a non-empty string (`trim().length > 0`). Empty strings, non-string types, or undefined values MUST return `false`.
- **FR-003**: `isGlossarySuggestionItem` MUST require `vietnamese` to be a string. Non-string types or undefined values MUST return `false`.
- **FR-004**: If `type` is present on a suggestion item, `isGlossarySuggestionItem` MUST require it to be a valid member of `GlossaryType` (`'character' | 'location' | 'term' | 'phrase' | 'other'`). Invalid string values or non-string types MUST return `false`.
- **FR-005**: If `pinyin` or `note` is present on a suggestion item, `isGlossarySuggestionItem` MUST require it to be a string. Non-string types MUST return `false`.
- **FR-006**: `callGlossaryAnalysisDirect` and `extractGlossaryDirect` in `src/services/directGlossaryEngine.ts` MUST filter raw parsed arrays with `isGlossarySuggestionItem` and drop all malformed items, eliminating fallback coercion into empty cards.
- **FR-007**: `validateAndSnapBackEntities` in `src/lib/sinoNormalize.ts` MUST reject or ignore entities with empty `chinese` (`!item.chinese?.trim()`), preventing phantom entry generation.
- **FR-008**: Internal assertions to `any[]` MUST be removed from `directGlossaryEngine.ts` (`rawSuggestions`, `rawList`), `chapterTranslationService.ts` (`detectedQaIssues`), and `src/services/translation/types.ts` (`glossary`).
- **FR-009**: All automated quality verification gates (`npm run lint`, `npm test`, `npm run build`) MUST pass with zero type errors, zero test failures, and zero build warnings.

### Key Entities

- **Glossary Suggestion Item**: A validated vocabulary entity possessing non-empty `chinese`, valid `vietnamese` string, optional `pinyin`, `type` constrained to `GlossaryType`, and optional `note`.
- **Cleaned Entity**: An entity verified to possess non-empty `chinese` prior to canonicalization or snap-back normalization against the raw source text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of items returned by `analyzeGlossaryDirect` and `extractGlossaryDirect` are strictly validated at item level. 0 corrupt, non-string, or empty `chinese` items coerced into blank glossary cards.
- **SC-002**: 0 occurrences of `any[]` in `directGlossaryEngine.ts`, `chapterTranslationService.ts` QA tracking, and `translation/types.ts`.
- **SC-003**: 100% synchronization between `data-model.md` and `src/lib/text.ts` for `GlossarySuggestion`.
- **SC-004**: 100% pass rate across automated test suites (`npm test`) and build verification (`npm run build`) with 0 type errors (`npm run lint`).

## Assumptions

- Preserves backward compatibility where AI responses may use `term` as an alias for `chinese`.
- No modifications to `src/types.ts` or IndexedDB schema per Constitution Principle IV.
- Existing UI components consume `GlossarySuggestion[]` cleanly without changes.

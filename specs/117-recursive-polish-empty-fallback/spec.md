# Feature Specification: Recursive Divide & Conquer Polish and Empty Response Resilience

**Feature Branch**: `117-recursive-polish-empty-fallback`

**Created**: 2026-09-12

**Status**: Ready for Planning

**Input**: User description: "Restore recursive divide and conquer polish with empty response fallback and multi-round resilience when Gemini returns empty or safety-filtered response"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recursive Polish for Blocked or Empty Content (Priority: P1)

As a translator running automated translation on complex or sensitive chapters, when Google Gemini returns an empty response or triggers content safety filters on a long chapter during literary polishing, the system automatically divides the text recursively into smaller chunks (Divide & Conquer) and polishes each part, falling back to the previous text chunk if any micro-segment cannot be polished, so that the chapter completes successfully without failing.

**Why this priority**: Long chapters with sensitive vocabulary (e.g. mental illness, combat, gore) frequently trigger Gemini's silent empty responses or safety filters. Recursive splitting isolates the problematic segment and allows the rest of the chapter to be polished smoothly.

**Independent Test**: Call `polishTranslationDirect` with text that mocks an empty response on full text but succeeds on split parts; verify that recursive splitting (`depth + 1`) executes and returns combined polished text.

**Acceptance Scenarios**:

1. **Given** a chapter text that triggers "AI trả về phản hồi rỗng." or safety filter on full text, **When** `polishTranslationDirect` executes, **Then** the engine automatically splits text adaptively into smaller parts (`depth + 1`) and retries.
2. **Given** an isolated sub-segment that cannot be polished even after recursive splitting, **When** recursion reaches maximum depth, **Then** the engine falls back to the corresponding raw/previous text for that segment and combines all segments without throwing an unhandled exception.

---

### User Story 2 - Iterative Polish Prior-Round Preservation (Priority: P1)

As a user running multi-cycle polishing (e.g., 3 rounds: Basic -> Rhythm -> Voice/Tone), if Round 1 and Round 2 complete successfully but Round 3 fails due to an empty response or upstream AI glitch, the translation process logs a clear warning, preserves the high-quality polished text from Round 2 (`currentTextToPolish`), and completes the chapter instead of aborting and skipping the entire chapter.

**Why this priority**: Discarding 2 successful polishing rounds and failing the entire chapter because the final optional round returned empty is a critical UX failure and causes extreme user frustration and wasted API quota.

**Independent Test**: Execute chapter translation with `polishCycles = 3` where Round 1 and Round 2 succeed but Round 3 throws "AI trả về phản hồi rỗng"; verify chapter status is marked `completed` and the text from Round 2 is persisted to DB.

**Acceptance Scenarios**:

1. **Given** a chapter where Round 1 and Round 2 completed, **When** Round 3 fails with an empty AI response, **Then** the engine logs a warning indicating Round 3 was skipped due to empty response, keeps the Round 2 result, and saves the chapter as completed.
2. **Given** a chapter where Round 1 fails completely and cannot be polished, **When** fallback occurs, **Then** the system preserves the Phase 1 draft (`firstDraft`) and completes the chapter with a warning rather than failing the queue.

---

### User Story 3 - Transparent API Key Rotation Observability (Priority: P2)

As a user with multiple configured API keys (e.g., 2 Keys), when one API key encounters an empty response or transient error, the client rotation mechanism rotates to the next available key and logs the rotation event so the user understands that multiple keys are active and being utilized.

**Why this priority**: Avoids user confusion where users see "Key #1" in the initial log and assume only 1 key is being recognized by the application.

**Independent Test**: Call `callGeminiDirect` with 2 keys where Key 1 encounters a retryable error and rotates to Key 2; verify both keys are attempted in sequence.

**Acceptance Scenarios**:

1. **Given** 2 configured API keys, **When** an error occurs on Key 1, **Then** `callGeminiDirect` rotates to Key 2 and records the provider attempt for Key 2.

---

## Edge Cases

- **What happens when text cannot be divided further (e.g. single sentence or max depth reached)?**
  The leaf node falls back to the matching raw segment text (`matchingRawPart`) with `isPartial = true` instead of throwing an unhandled error.
- **What happens if all API keys are exhausted (429/quota)?**
  Quota exhaustion (`ALL_KEYS_EXHAUSTED`) is still propagated immediately so the queue pauses safely without burning through false retries.
- **What happens if the queue finishes but has failed chapters?**
  The final queue log checks the actual accumulated list of failed IDs to prevent displaying "BIÊN DỊCH THÀNH CÔNG" when chapters failed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `directTranslationEngine.ts` MUST implement recursive divide-and-conquer `polishWithContentSplitDirect` with adaptive text splitting (`splitTextAdaptively`) and recursion depth tracking (`depth + 1`, max depth 2-3).
- **FR-002**: When encountering `AI trả về phản hồi rỗng.` or `bộ lọc an toàn`, `polishWithContentSplitDirect` MUST recursively split the source and raw texts and attempt polishing each part independently.
- **FR-003**: If a leaf segment fails to polish after recursive splitting, the system MUST fall back to using the matching raw text segment for that part, preserving structural integrity and line breaks.
- **FR-004**: In `chapterTranslationService.ts`, during multi-round polishing (`polishCycles >= 2`), if round $j > 1$ fails with an empty AI response or unrecoverable non-quota error, the service MUST retain the result of round $j - 1$, log a warning, and proceed to save the completed chapter.
- **FR-005**: If round $1$ polishing fails completely, the service MUST fall back to `firstDraft` (the raw translation) and continue to the QA critique / save phase rather than discarding the chapter.
- **FR-006**: `useTranslationProcess.ts` MUST ensure queue completion status accurately checks `allFailedIds` so that summary logs distinguish between full success and partial failure with skipped chapters.

### Key Entities

- **DirectPolishTranslationParams**: Includes sourceText, rawTranslation, genre, tone, glossary, apiKeys, model, roundIndex, totalRounds.
- **DirectPolishTranslationResult**: Returns polishedTranslation, discoveredEntities, successKeyIndex, and isPartial flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Chapters that trigger silent empty AI responses during literary polishing succeed at a rate of >= 98% through recursive chunking or safe fallback.
- **SC-002**: Multi-cycle polishing never discards previous successful rounds when a subsequent round fails.
- **SC-003**: 100% of existing and new automated tests pass (`npm run lint`, `npm test`, `npm run build`).

## Assumptions

- Adaptive text splitting preserves line boundaries and paragraph breaks (`\n\n`).
- Rate-limit errors (429/quota) must still trigger standard key rotation and quota exhaustion logic rather than endless recursion.

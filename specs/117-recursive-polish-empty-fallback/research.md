# Research: Recursive Divide & Conquer Polish and Empty Response Resilience

## Research Tasks & Findings

### 1. Recursive Divide & Conquer in Pure Client-Side Architecture

- **Context**: In previous Express backend architecture (`server/controllers/translation/polishController.ts`), `polishWithContentSplit` recursively divided long text into smaller segments (`splitTextAdaptively`) whenever Gemini returned an empty response or triggered safety filters. During migration to zero-backend, `directGlossaryEngine.ts` preserved this pattern (`analyzeGlossaryWithContentSplitDirect`), but `directTranslationEngine.ts`'s `polishTranslationDirect` was implemented as a single direct call without recursion.
- **Decision**: Introduce `polishWithContentSplitDirect` in `src/services/directTranslationEngine.ts` that wraps `polishTranslationDirectCore`.
  - Max recursion depth: 2 (depth 0 -> depth 1 splits into 2 parts; depth 2 splits into 2 parts; total max 4 segments).
  - Condition: `isSafetyOrEmptyErrorDirect(err)` where `err.message` contains "phản hồi rỗng" or "bộ lọc an toàn" or "SAFETY".
  - Base case / Leaf fallback: If `depth >= 2` or `estimateTokenCount(text) < 200` or `splitTextAdaptively` yields <= 1 part, return the corresponding `matchingRawPart` (from previous round/raw translation) with `isPartial = true` rather than aborting.
  - Recombination: Join results with `\n\n`, preserving paragraph breaks and chapter titles with `ensureChapterTitlePreserved`.
- **Rationale**: Keeps client-side memory footprint and token consumption bounded while isolating sensitive terms to small paragraphs so the rest of the chapter is polished cleanly.
- **Alternatives Considered**:
  - *Retrying entire chapter with plain text*: Geminis often repeat empty responses for the same overall text even without JSON schema if triggered by context words. Splitting isolates the trigger phrase.
  - *Disabling content filters*: Not possible via client API parameters on standard Gemini keys.

### 2. Multi-Round Iterative Polish Resilience in `chapterTranslationService.ts`

- **Context**: The iterative polish pipeline runs 1 to 4 rounds (`getPolishStrategyForRound(j, polishCycles)`). In the user's scenario, Round 1 (Structure & Grammar) and Round 2 (Rhythm & Flow) completed successfully, but Round 3 (Voice & Tone) threw `AI trả về phản hồi rỗng.`, causing the `catch` block to throw and abort the entire chapter.
- **Decision**: Update `executeSingleChapterTranslation` in `src/services/chapterTranslationService.ts`:
  - When Round $j > 1$ encounters an unrecoverable empty response or non-quota error:
    - Log a warning: `${logPrefix} Vòng biên tập thứ ${j} gặp phản hồi rỗng từ AI. Bảo lưu kết quả đã chuốt từ Lượt ${j - 1} để tiếp tục.`
    - Retain `currentTextToPolish` (which holds the complete, high-quality translation from the previous round).
    - Break early out of the polish loop and proceed to Phase 3 (QA Critique) / saving chapter.
  - When Round $1$ encounters an unrecoverable error:
    - Log a warning: `${logPrefix} Vòng biên tập thứ 1 gặp phản hồi rỗng từ AI. Tự động dùng bản dịch thô (Phase 1) để tiếp tục.`
    - Fall back to `firstDraft`.
    - Proceed without failing the queue.
  - Quota errors (`isOverload`, `ALL_KEYS_EXHAUSTED`, 429) MUST still throw so that queue pauses safely without false progress.
- **Rationale**: Users should never lose 2 rounds of successful polishing due to an optional 3rd round glitch.
- **Alternatives Considered**:
  - *Throwing immediately and requiring manual re-run*: Rejected because users run batch translations over dozens of chapters overnight.

### 3. API Key Rotation Transparency and Observability

- **Context**: The user configured 2 API Keys, but the initial log showed `Key xoay vòng: #1`. When Key 1 failed and `callGeminiDirect` rotated to Key 2 internally, no log was emitted to the user console, giving the false impression that only Key 1 was recognized.
- **Decision**:
  - In `callGeminiDirect`, accept an optional `onKeyRotated?: (fromKeyIdx: number, toKeyIdx: number, reason: string) => void` callback, or in caller log rotation events when `successKeyIndex !== startKeyIndex`.
  - In `useTranslationProcess.ts`, track and update `currentApiKeyIndexRef.current` across rounds and emit a clear info log when rotation occurs.
- **Rationale**: Transparency reassures users that multiple keys are active and doing their work.

### 4. Queue Completion Summary Fix in `useTranslationProcess.ts`

- **Context**: Line 488 of `useTranslationProcess.ts` checks `projectRef.current?.translationQueueState?.failedIds || []` immediately after `onUpdateProject(...)`. Because React state updates are asynchronous, `projectRef.current` at that exact tick has not received the latest state, causing it to log "TẤT CẢ CHƯƠNG TRONG HÀNG ĐỢI ĐÃ ĐƯỢC BIÊN DỊCH THÀNH CÔNG!" even when a chapter was skipped.
- **Decision**: Compute `currentFailed` using the local `allFailedIds` array accumulated during the loop execution.

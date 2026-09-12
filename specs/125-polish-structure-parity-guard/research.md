# Research: Polish Truncation Prevention and 1:1 Paragraph Structure Parity

**Feature**: `125-polish-structure-parity-guard`
**Date**: 2026-09-13

## 1. Root Cause Analysis: Why Polished Translation is Shorter than Raw Translation

### Finding 1.1: Asymmetric Pre-Splitting in Translation Engine
- **Current Behavior**:
  - In `src/services/directTranslationEngine.ts`, `rawWithContentSplitDirect` (Stage 1) checks:
    ```typescript
    if (retryDepth === 0 && !isPreSplit && estimateTokenCount(text) > 2000) {
      const chunks = splitTextAdaptively(text, 2);
      ...
    }
    ```
  - In `polishWithContentSplitDirect` (Stage 2), there is **NO pre-split logic**. The full `sourceText` and full `rawTranslation` are bundled together into a single Gemini prompt regardless of chapter length.
- **Consequence**:
  - A chapter of 2,000 Chinese characters + 3,000 Vietnamese characters + System Instruction + Vocabulary/Glossary consumes ~6,000 - 9,000 input tokens.
  - When generating the structured JSON output (`polishedTranslation`), Gemini 2.5 Flash / Pro encounters output token throttling or internal generation fatigue, resulting in truncation (dropping paragraphs at the end of the chapter) or aggressive text summarization/condensation.

### Finding 1.2: Missing Truncation & Length Guard in Stage 2 Post-Processing
- **Current Behavior**:
  - `callPolishDirectCore` validates output only with:
    1. `ensureChapterTitlePreserved(rawTranslation, finalPolishedTranslation)`
    2. `validateTranslationOutput(finalPolishedTranslation)` -> Only checks Chinese character ratio ($\le 10\%$).
  - Neither function compares the length or paragraph count of `finalPolishedTranslation` against `rawTranslation` or `sourceText`.
- **Consequence**:
  - When Gemini drops 30-50% of the chapter (as seen in the user's screenshots of Chapter 92), the truncated text passes validation cleanly and is saved directly into IndexedDB, overwriting or establishing an incomplete draft.

### Finding 1.3: Paragraph Collapsing by LLM
- **Current Behavior**:
  - Web novel raw Chinese formatting often uses single-sentence paragraphs for dramatic timing and dialogue.
  - LLMs trained on formal literature have an inherent bias toward merging short staccato lines into continuous multi-sentence narrative blocks.
- **Consequence**:
  - Paragraph count shrinks significantly (e.g. from 40 paragraphs in raw Chinese to 18 paragraphs in polished Vietnamese). This causes the polished translation to look visually much shorter even when words are not omitted, and breaks side-by-side reading alignment.

---

## 2. Technical Decisions & Tradeoffs

### Decision 2.1: Pre-Emptive Synchronized Splitting in Stage 2
- **Decision**: Introduce pre-splitting in `polishWithContentSplitDirect` when `estimateTokenCount(sourceText) > 1500` or `estimateTokenCount(rawTranslation) > 1800` at `depth === 0`.
- **Mechanism**:
  1. Split `sourceText` adaptively into $K$ parts ($K = 2$ or $3$) at paragraph boundaries using `splitTextAdaptively(sourceText, K)`.
  2. Split `rawTranslation` into $K$ parts using `splitTextAdaptively(rawTranslation, K)`.
  3. Polish each `(sourcePart[i], rawPart[i])` pair in parallel or staggered sequence.
  4. Stitch polished chunks using `\n\n` separator and run title preservation.
- **Rationale**: Keeps each individual Gemini polish call well under 2,000 output tokens, completely eliminating token limit truncation at the root.

### Decision 2.2: Dual-Metric Truncation Guard (`validatePolishIntegrity`)
- **Decision**: Create a dedicated validation function `validatePolishIntegrity(rawText: string, polishedText: string, sourceText?: string): void`:
  1. **Character Length Ratio**:
     - On chapters with $L_{\text{raw}} \ge 300$ characters:
     - If $L_{\text{polished}} < 0.80 \times L_{\text{raw}}$, throw `Error("POLISH_TRUNCATION_DETECTED: Bản chuốt văn bị hụt ký tự bất thường (XX < YY)...")`.
  2. **Paragraph Count Ratio**:
     - If raw has $\ge 5$ paragraphs and polished has $< 0.75 \times \text{raw paragraphs}$, throw `Error("POLISH_TRUNCATION_DETECTED: Bản chuốt văn bị thiếu hụt đoạn văn bất thường...")`.
- **Rationale**: 80% character length and 75% paragraph count provide a safe tolerance window (accounting for natural stylistic conciseness) while catching real truncation anomalies (which typically drop 30-60% of content).

### Decision 2.3: Integration with `isAdaptiveSplitRetryableError`
- **Decision**: Register `POLISH_TRUNCATION_DETECTED` and `PARAGRAPH_STRUCTURE_DIVERGENCE` in `isAdaptiveSplitRetryableError`.
- **Behavior**:
  - When `validatePolishIntegrity` throws inside `callPolishDirectCore`, `polishWithContentSplitDirect` catches it and immediately splits the text into smaller halves/thirds, retrying each sub-segment independently.
  - Sub-segments are small enough that the LLM polishes every single sentence without truncating.

### Decision 2.4: 1:1 Paragraph Parity Enforcement in Prompts & Realignment
- **Decision**:
  1. **Prompt Directives**: Explicitly instruct Gemini in `buildRawTranslationPayload` and `buildPolishTranslationPayload`:
     - "BẮT BUỘC BẢO TOÀN 100% CẤU TRÚC PHÂN ĐOẠN 1-1: Bản gốc có bao nhiêu đoạn văn thì bản dịch PHẢI có bấy nhiêu đoạn văn tương ứng. Tuyệt đối không gộp các câu đối thoại ngắn vào đoạn tự sự."
  2. **Paragraph Normalization**: Normalize multiple newlines (`\r?\n\s*\r?\n` -> `\n\n`) across source, raw, and polished texts.
  3. **Structure Parity Metric**: Calculate `validateParagraphParity(source, target)` with maximum allowed divergence ratio of 20% on chapters with $\ge 5$ paragraphs.

### Decision 2.5: UI Structural Transparency in Workspace
- **Decision**: In `src/components/auto-translator/` and workspace editor header:
  - Display `[Số đoạn: X | Số ký tự: Y]` on draft headers.
  - When switching between "Bản gốc", "Dịch thô", and "Dịch biên tập", translators immediately see structural parity.
  - If paragraph divergence $> 15\%$, render an informational badge `⚠️ Lệch X đoạn so với bản gốc`.

---

## 3. Alternatives Considered

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Sentence-by-sentence polishing** | Perfect 1-1 alignment | Excessive API calls, loses cross-sentence literary context | Rejected |
| **B. Relax prompt instructions only** | No code changes | Non-deterministic; LLM will still truncate long outputs | Rejected |
| **C. Pre-split + Dual-Metric Truncation Guard + Adaptive Split Retry** | Deterministic, preserves literary context, guarantees completeness | Requires coordinated source/raw splitting logic | **Adopted** |

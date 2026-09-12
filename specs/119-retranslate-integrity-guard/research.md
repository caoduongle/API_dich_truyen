# Research: Retranslate Integrity Guard and Safe Draft Preservation

## Phase 0 Research Findings

### Decision 1: Semantics of "Dịch từ đầu" (`from_scratch`)
- **Problem**: In `chapterTranslationService.ts`, when `autoTranslateMode === 'from_scratch'` and `hasExistingTranslation` is true, the engine skips Phase 1 (raw translation) and reuses `existingTranslation` as `firstDraft`. If `existingTranslation` is a truncated 1-paragraph fragment from a prior failed polish run, the engine polishes that single paragraph and overwrites `rawTranslation` with it, destroying the complete raw translation.
- **Decision**: Remove the skip condition entirely for `from_scratch`. When `autoTranslateMode === 'from_scratch'`, the engine MUST unconditionally invoke `translateRawDirect` on `chapter.sourceText`.
- **Rationale**: The explicit meaning of "Dịch từ đầu" (From Scratch) is to re-translate from the original Chinese source. A user choosing this mode is doing so precisely because previous drafts are obsolete, corrupted, or need regeneration.
- **Alternatives Considered**:
  - *Prompting the user per chapter*: Too intrusive in batch auto-translation queues.
  - *Auto-detecting whether to skip*: Unreliable when drafts are partially corrupted.

---

### Decision 2: Draft Integrity Guard (`isDraftTruncated`)
- **Problem**: When drafts are considered for reuse (e.g. in re-polishing), how do we guarantee that the draft isn't a cut-off fragment (like Chapter 138 with 1 paragraph vs hundreds of Chinese characters)?
- **Decision**: Implement an integrity guard `isDraftTruncated(draft: string, sourceText: string): boolean`:
  - If `sourceText.length > 150` and `draft.trim().length < sourceText.trim().length * 0.35`: Truncated (Vietnamese translation character length is typically 1.2x - 1.8x of Chinese characters; anything under 0.35x indicates severe truncation).
  - If `sourceText` has $\ge 3$ paragraphs but `draft` has only 1 paragraph and `draft.length < sourceText.length * 0.5`: Truncated.
  - Returns `true` if truncated, triggering an automatic fallback to fresh raw translation (`translateRawDirect`).
- **Rationale**: Simple, fast, deterministic heuristic that prevents corrupted drafts from ever reaching Phase 2.
- **Alternatives Considered**:
  - *Full AI semantic comparison*: Wastes API tokens and introduces latency just to check if text was cut off.
  - *Fixed character count threshold*: Fails on naturally short chapters.

---

### Decision 3: Source Isolation for Phase 2 Polish Input (`firstDraft`)
- **Problem**: `chapterTranslationService.ts` used `(chapter.polishedTranslation || chapter.rawTranslation || '').trim()`.
- **Decision**: Phase 2 input draft MUST ONLY be sourced from `chapter.rawTranslation`.
- **Rationale**: `polishedTranslation` is the *output* of Phase 2. Blending it into the input of Phase 2 causes feedback corruption loops. `rawTranslation` is the grounding baseline.
- **Alternatives Considered**:
  - *Chaining multiple polish runs*: Covered intentionally by the explicit "Chuyển thành bản thô" button, where the user consciously elevates polished text to become the new baseline.

---

### Decision 4: Granular Draft Controls in `ChapterHistoryPanel`
- **Problem**: Currently only "Reset về bản gốc" exists (which wipes both raw and polished drafts). Users cannot selectively wipe polished text to re-polish from raw, cannot wipe raw text, and cannot promote polished text to raw.
- **Decision**: Add 3 distinct buttons in `ChapterHistoryPanel` with confirmation dialogs:
  1. `Xóa bản biên tập`: Clears `polishedTranslation`, sets status to `in_progress`, switches tab to `raw`.
  2. `Xóa bản dịch thô`: Clears `rawTranslation`, sets status to `not_started` if `polishedTranslation` is also empty, switches tab to `source`.
  3. `Chuyển thành bản thô`: Sets `rawTranslation = polishedTranslation`, clears `polishedTranslation`, sets status to `in_progress`, switches tab to `raw`.
- **Design Alignment**: Use `Button` primitive (`variant="outline"`, `size="sm"`), conforming to `design-system.md` (colors `text-polish`, `border-parchment-2`, `hover:bg-parchment-2`).

---

### Decision 5: Dedicated `repolish` Queue Mode
- **Decision**: Extend `autoTranslateMode` from `'resume' | 'from_scratch'` to `'resume' | 'from_scratch' | 'repolish'`.
- **Behavior**:
  - `'resume'`: Translates untranslated chapters (`status !== 'completed'`).
  - `'from_scratch'`: Re-translates all chapters in range from `sourceText` (GĐ1 + GĐ2).
  - `'repolish'`: Only re-runs GĐ2 polishing on chapters with valid `rawTranslation`. If `rawTranslation` is missing or truncated, falls back to GĐ1 first.

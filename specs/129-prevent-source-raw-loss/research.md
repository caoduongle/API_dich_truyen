# Technical Research: Preventing Source and Raw Translation Data Loss

**Feature**: `129-prevent-source-raw-loss`  
**Date**: 2026-09-13  
**Status**: Completed

## Executive Summary

Investigation of the reported issue—where original Chinese text (`sourceText`) and raw translation drafts (`rawTranslation`) unexpectedly disappeared during translation and quality audit workflows—uncovered a multi-layer flaw across the collaborative editing engine (CRDT/Yjs), workspace lifecycle management, document merging, and database storage layers.

This research documents the root causes, decisions taken, rationale, and alternatives evaluated to ensure absolute data preservation across all chapter stages.

---

## Findings & Decisions

### Decision 1: Defensive Auto-Save Merging in `useChapterCRDT.ts`

- **Problem**: In [`useChapterCRDT.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useChapterCRDT.ts), the debounced auto-save function `debouncedSaveToDb` ran after any text change (such as an edit in polished translation or applying an audit fix in `UnifiedAuditPanel`). It created a `Chapter` object directly from `readChapterFromYDoc(doc, chapId)` and called `saveChapterToDB`. Since `readChapterFromYDoc` extracted `sourceText` from `metadataMap` (which was empty if the session was created without initial data) and `rawTranslation` from `rawText` (which was empty if only polished text was modified), `saveChapterToDB` overwrote the chapter in IndexedDB with `sourceText: ""` and `rawTranslation: ""`.
- **Decision**: 
  In `debouncedSaveToDb`, always load the existing stored chapter from IndexedDB (`await getChapterFromDB(chapId)`) prior to saving. Merge the snapshot onto the existing chapter so that:
  - `sourceText` is preserved from `existing.sourceText` if `snapshot.sourceText` is empty or missing.
  - `rawTranslation` is preserved from `existing.rawTranslation` if `snapshot.rawTranslation` is empty or missing.
  - `title`, `paragraphs`, `translatedLines`, `status`, `qaIssues`, and `zuminovel*` fields from `existing` are preserved unless explicitly overridden with non-empty snapshot data.
- **Rationale**: A collaborative or auto-save snapshot should never act as a destructive replacement for fields that were not active in that specific edit operation.
- **Alternatives Considered**: 
  - *Disable auto-save in CRDT*: Rejected because auto-save is needed to prevent work loss during unexpected browser closes or tab switches.
  - *Only save dirty fields*: IndexedDB stores full objects per key in object stores; partial patching requires reading existing data and merging, which is the chosen approach.

---

### Decision 2: Asynchronous Hydration & Lifecycle Synchronization in `useChapterCRDT.ts`

- **Problem**: `useChapterCRDT` received `initialChapter: loadedChapter`. When selecting chapters via the dropdown (`handleLoadChapterById`), `loadedChapter` was `null`. When opening via `loadedChapter` (from History or Hako), `onClearLoadedChapter?.()` was immediately triggered, resetting `loadedChapter` to `null` on the subsequent render. As a result, `createChapterYDoc` was initialized with an empty `initialData` object, meaning the Y.Doc lacked `sourceText`, `rawTranslation`, and `title`.
- **Decision**:
  1. Add an asynchronous hydration effect inside `useChapterCRDT`: when `chapterId` changes, if the Y.Doc does not yet have `sourceText` or text content, fetch `getChapterFromDB(chapterId)` and populate the document in a transaction.
  2. Extend `crdt.updateMetadata` in `useChapterCRDT` to support `sourceText` alongside `title`, `status`, `paragraphs`, and `translatedLines`.
- **Rationale**: Even if `initialChapter` is null or cleared by the parent component, `useChapterCRDT` autonomously ensures the Y.Doc is seeded with the existing database content before any save operation can occur.
- **Alternatives Considered**:
  - *Keep `loadedChapter` permanent in React state*: Rejected because `loadedChapter` is a navigation transient intended to signal a jump from other tabs; relying on it for session state creates race conditions across tabs.

---

### Decision 3: Propagating Translation Engine Output to CRDT in `useWorkspaceState.ts`

- **Problem**: When a user clicked "Dịch thô" (`handleTranslateRaw`) or "Chuốt văn" (`handlePolishTranslation`), the resulting texts were written to React state via `setRawTranslation(...)` and `setPolishedTranslation(...)`, but were NOT sent to `crdt.updateRawTranslation(...)` or `crdt.updatePolishedTranslation(...)`. Thus, the Y.Doc remained completely empty even though the UI showed translated text. Any subsequent keystroke or audit fix then synced a Y.Doc that was missing the raw translation.
- **Decision**:
  1. In `handleTranslateRaw`, call `handleRawTranslationChange(data.rawTranslation)` (which updates both React state and CRDT via `crdt.updateRawTranslation`).
  2. In `handlePolishTranslation`, call `handlePolishedTranslationChange(polishedResult)` (which updates both React state and CRDT via `crdt.updatePolishedTranslation`).
  3. When loading a chapter in `handleLoadChapterById`, pass the loaded chapter to CRDT or call `crdt.updateMetadata` with `sourceText` and `title`.
- **Rationale**: Ensures the CRDT Y.Doc always reflects the true active state of both translation stages.
- **Alternatives Considered**:
  - *Directly mutate Y.Doc inside the translation handlers*: Rejected because `handleRawTranslationChange` and `handlePolishedTranslationChange` already encapsulate the correct CRDT-aware dispatch with `applyTextDiff`.

---

### Decision 4: Fixing Nullish Coalescing in `crdtDocManager.ts`

- **Problem**: In [`crdtDocManager.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/crdtDocManager.ts#L324-L325), `mergeChapterCrdt` used:
  ```ts
  rawTranslation: snapshot.rawTranslation ?? localChapter.rawTranslation ?? remoteChapter.rawTranslation
  ```
  Because `snapshot.rawTranslation` is always a string (`""` when empty), `"" ?? fallback` evaluates to `""`, failing to fall back to `localChapter.rawTranslation` and erasing the draft.
- **Decision**:
  Replace `??` with non-empty string checks:
  ```ts
  rawTranslation: (snapshot.rawTranslation && snapshot.rawTranslation.trim()) || localChapter.rawTranslation || remoteChapter.rawTranslation || '',
  polishedTranslation: (snapshot.polishedTranslation && snapshot.polishedTranslation.trim()) || localChapter.polishedTranslation || remoteChapter.polishedTranslation || ''
  ```
- **Rationale**: Guarantees that empty string snapshots never take precedence over valid, populated translations from local or remote chapters.
- **Alternatives Considered**:
  - *Custom helper function*: An inline trimmed boolean check is clear, type-safe, and has zero overhead.

---

### Decision 5: Storage Layer Safeguard in `src/services/db.ts`

- **Problem**: `saveChapterToDB(chapter)` performed `store.put(chapter)` without checking whether an existing record's `sourceText` was about to be overwritten with an empty string.
- **Decision**:
  In `saveChapterToDB`, defensively inspect the existing record in `CHAPTERS_STORE`. If the existing record has non-empty `sourceText` and the incoming `chapter.sourceText` is empty or whitespace-only, retain `existing.sourceText`. Log a warning indicating the guard was activated.
  Similarly, do not allow incoming empty `rawTranslation` to overwrite existing `rawTranslation` during auto-save contexts.
- **Rationale**: Acts as the ultimate defense-in-depth safety net. Even if a rogue component or background task attempts to persist an incomplete chapter payload, the database layer refuses to wipe out the author's original Chinese text.
- **Alternatives Considered**:
  - *Throw an error on empty sourceText*: Throwing might crash callers or leave transactions aborted. Merging with existing data safely preserves integrity while allowing the caller's other updates (e.g. polished translation) to succeed.

---

### Decision 6: Self-Healing for Existing Damaged Chapters

- **Problem**: Chapters already affected by the bug (like Chapter 56 in the user's screenshot) have `sourceText: ""` in IndexedDB.
- **Decision**:
  1. In `ChapterHistoryPanel.tsx`, detect chapters with empty `sourceText` or empty `rawTranslation` and display an informative badge/state.
  2. Provide a recovery modal / button allowing the user to paste or re-attach the original Chinese text for that chapter without resetting or overwriting the completed polished translation.
  3. During `hydrateAllChaptersRaw` in Hako review session, if a chapter in DB is missing `sourceText`, check if project metadata or a backup cache has the text, or prompt the user.
- **Rationale**: Fixes both the code flaw (preventing future loss) and addresses past data damage (allowing recovery).

---

## Summary of Impact

| Component / Layer | Action | Risk Level |
|---|---|---|
| `src/hooks/useChapterCRDT.ts` | Merge with existing chapter before saving; hydrate Y.Doc on mount/switch | Low (purely additive safety) |
| `src/hooks/useWorkspaceState.ts` | Route translation results through CRDT-aware setters; sync metadata | Low (standardizes dispatch) |
| `src/services/crdtDocManager.ts` | Fix nullish coalescing `??` to non-empty check | Low |
| `src/services/db.ts` | Add safeguard in `saveChapterToDB` to prevent blanking `sourceText` | Low (fail-safe protection) |
| `src/components/ChapterHistoryPanel.tsx` | Visual indicator & re-supply source text action | Low (UI enhancement) |

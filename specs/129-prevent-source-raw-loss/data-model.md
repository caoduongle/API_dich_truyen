# Data Model: Chapter Multi-Stage Integrity & Preservation

**Feature**: `129-prevent-source-raw-loss`  
**Date**: 2026-09-13  
**Status**: Complete

## 1. Core Entities

### Chapter (IndexedDB `chapters` store)

The primary document entity representing a single story chapter across all translation stages.

| Field | Type | Required | Description | Invariant / Preservation Rule |
|---|---|---|---|---|
| `id` | `string` | Yes | Unique chapter ID (e.g., `chap_123456`) | Immutable primary key |
| `projectId` | `string` | Optional | Foreign key to parent `StoryProject` | Indexed in DB for project queries |
| `title` | `string` | Yes | Chapter title | Must never be overwritten with empty string if previously populated |
| `sourceText` | `string` | Yes | Original Chinese text block | **CRITICAL INVARIANT**: Never overwritten with empty string by auto-save or background sync |
| `processedSourceText` | `string` | Optional | Chinese text after glossary pre-replacement | Preserved if already set |
| `rawTranslation` | `string` | Yes | Phase 1 machine translation draft | Must never be overwritten with empty string unless explicitly cleared by user action |
| `polishedTranslation` | `string` | Yes | Phase 2 polished literary translation | Updated during polishing, manual edits, or audit fixes |
| `paragraphs` | `string[]` | Yes | Paragraphs split from `sourceText` | Maintained in 1:1 parity with source text |
| `translatedLines` | `string[]` | Yes | Corresponding Vietnamese lines | Kept aligned with paragraphs |
| `status` | `ChapterStatus` | Yes | `'not_started' \| 'in_progress' \| 'completed'` | Updated based on presence of raw/polished translations |
| `qaIssues` | `Array<...>` | Optional | QA Critique detected issues | Preserved across translation stages |
| `createdAt` | `string` | Yes | ISO timestamp of chapter creation | Immutable creation timestamp |
| `updatedAt` | `string` | Yes | ISO timestamp of last modification | Updated whenever any stage is modified |
| `zuminovel*` | various | Optional | ZumiNovel integration sync metadata | Preserved across edits |

---

## 2. Invariants & Guard Rules

### Rule 1: Non-Destructive Auto-Save Invariant
When any background auto-save (such as `debouncedSaveToDb` in CRDT) writes to `CHAPTERS_STORE`:
$$\text{sourceText}_{\text{saved}} = \begin{cases} 
\text{snapshot.sourceText} & \text{if } \text{snapshot.sourceText.trim().length} > 0 \\
\text{existing.sourceText} & \text{otherwise}
\end{cases}$$

$$\text{rawTranslation}_{\text{saved}} = \begin{cases} 
\text{snapshot.rawTranslation} & \text{if } \text{snapshot.rawTranslation.trim().length} > 0 \\
\text{existing.rawTranslation} & \text{otherwise}
\end{cases}$$

### Rule 2: Database Layer Defensive Guard
In `saveChapterToDB(chapter)`:
- Check if an existing record exists in `CHAPTERS_STORE`.
- If `existing.sourceText` is non-empty and `chapter.sourceText` is empty or missing, enforce `chapter.sourceText = existing.sourceText`.
- If `existing.rawTranslation` is non-empty and `chapter.rawTranslation` is missing or undefined, enforce `chapter.rawTranslation = existing.rawTranslation`.

### Rule 3: CRDT Y.Doc Complete Hydration
Before accepting local edits, the collaborative document (`Y.Doc`) MUST be hydrated with:
- `rawText` initialized with chapter's `rawTranslation`
- `polishedText` initialized with chapter's `polishedTranslation`
- `metadataMap` initialized with `sourceText`, `title`, `paragraphs`, and `translatedLines`

---

## 3. State Transitions

```
[Import Chapter]
       │ (sourceText set, raw='', polished='')
       ▼
  'not_started'
       │
       │ Translate Raw (Giai đoạn 1)
       ▼
  'in_progress' (sourceText kept, raw set, polished='')
       │
       │ Contextual Polish (Giai đoạn 2)
       ▼
  'completed' (sourceText kept, raw kept, polished set)
       │
       ├─── Apply Audit Fix (Kiểm định) ───► 'completed' (sourceText kept, raw kept, polished updated)
       │
       ├─── User: "Xóa bản biên tập" ──────► 'in_progress' (sourceText kept, raw kept, polished='')
       │
       └─── User: "Reset về bản gốc" ──────► 'not_started' (sourceText kept, raw='', polished='')
```

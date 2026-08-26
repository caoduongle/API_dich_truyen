# Data Model: Quality Review Session & JIT Content Decoupling

**Feature**: `077-decouple-hako-session`
**Date**: 2026-08-27
**Status**: Ready

## 1. Entity Architecture Overview

```
+-------------------------------------------------------------+
|                     StoryProject (DB)                       |
|  - chapters: ChapterMetadata[] (id, title, status, etc.)    |
+-------------------------------------------------------------+
                              |
                     selectProject(project)
                              v
+-------------------------------------------------------------+
|               QualityReviewSession (Persistent)              |
|  - id: string                                               |
|  - projectId: string                                        |
|  - projectTitle: string                                     |
|  - selectedChapterIds: string[] (max 12 IDs)                |
|  - chapters: Record<string, HakoChapterMeta>                |
|  - issues: QualityIssue[]                                   |
|  - status: 'idle' | 'analyzing' | 'completed' | 'error'     |
|  - updatedAt: string                                        |
+-------------------------------------------------------------+
                              |
                     handleStartAnalysis() (JIT Fetch max 12)
                              v
+-------------------------------------------------------------+
|             HakoChapterFull[] (Ephemeral Runtime)           |
|  - chapterId: string                                        |
|  - title: string                                            |
|  - vietnameseContent: string (Loaded JIT from CHAPTERS_DB)  |
|  - rawChineseContent?: string                               |
+-------------------------------------------------------------+
                              |
               Passed into Quality Scan Engine
                              v
           runHeuristicQualityScan / runAiQualityScan
                              |
                              v
              Output QualityIssue[] -> Saved to Session
```

---

## 2. Entity Schemas

### 2.1 `HakoChapterMeta` (Persistent Chapter Descriptor)
Lightweight chapter representation stored in `QualityReviewSession.chapters`. Stripped of full translated text bodies.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `chapterId` | `string` | Yes | Unique identifier of the chapter |
| `title` | `string` | Yes | Display title (e.g. "Chương 1: Khởi đầu") |
| `chapterNumber` | `number` | Yes | Sequential 1-indexed chapter number |
| `translationType` | `'polished' \| 'raw' \| 'none'` | Yes | Translation status indicator |
| `wordCount` | `number` | No | Estimated or cached word count |
| `status` | `'pending' \| 'loaded' \| 'analyzing' \| 'done' \| 'error'` | Yes | Review lifecycle state |
| `errorMessage` | `string` | No | Error details if review failed |
| `rawChineseContent` | `string` | No | Optional custom user-overridden raw text |

### 2.2 `HakoChapterFull` / `ChapterAnalysisPayload` (Ephemeral Runtime Entity)
Constructed Just-In-Time (JIT) in memory only when analysis starts for the selected `selectedChapterIds` (max 12 items). Never written to `HakoQualityCheckerDB`.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `chapterId` | `string` | Yes | Target chapter ID |
| `title` | `string` | Yes | Chapter title |
| `chapterNumber` | `number` | Yes | Chapter index |
| `vietnameseContent` | `string` | Yes | Full Vietnamese translation from DB |
| `rawChineseContent` | `string` | No | Raw Chinese text from DB or custom input |

### 2.3 `QualityReviewSession` (Root Persistent Store Model)
Persisted in IndexedDB `HakoQualityCheckerDB` -> `hako_quality_sessions`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Primary key UUID |
| `projectId` | `string` | Associated project ID |
| `projectTitle` | `string` | Associated project title |
| `selectedChapterIds` | `string[]` | Selected chapter IDs (bounded <= 12) |
| `chapters` | `Record<string, HakoChapterMeta>` | Map of chapter metadata |
| `issues` | `QualityIssue[]` | List of detected quality issues |
| `status` | `'idle' \| 'analyzing' \| 'completed' \| 'error'` | Session processing status |
| `createdAt` | `string` | ISO 8601 creation timestamp |
| `updatedAt` | `string` | ISO 8601 update timestamp |
| `error` | `{ code: string; message: string }` | Optional session-level error |

---

## 3. Lifecycle & State Transitions

### 3.1 Project Selection Lifecycle
1. User chooses Project `P` with $N$ chapters from dropdown.
2. Hook extracts `P.chapters` (`ChapterMetadata[]`).
3. For each metadata item, constructs `HakoChapterMeta` with $O(1)$ property mapping.
4. Updates `session` state in memory instantly; persists debounced lightweight metadata to IndexedDB.

### 3.2 Checkbox Selection Lifecycle
1. User clicks checkbox for chapter ID $C$.
2. Hook verifies `translationType !== 'none'` and selection length limit ($<= 12$).
3. React state `selectedChapterIds` updates immediately (0ms UI lag).
4. Background timer debounces write to `saveSession` by 300ms.

### 3.3 Quality Review Execution Lifecycle (JIT Flow)
1. User clicks **"Bắt đầu kiểm định"**.
2. Hook queries IndexedDB `getChapterFromDB(id)` for the $K$ selected IDs ($1 \le K \le 12$).
3. System compiles in-memory `HakoChapterFull[]`.
4. Executes Heuristic scan ($< 50\text{ms}$) $\to$ adds heuristic issues.
5. Executes AI scan via Gemini API $\to$ adds semantic issues.
6. Emits `updateSessionChaptersAndIssues(metaUpdates, issues)`:
   - Updates issue records and chapter status (`'done'`).
   - Strips full text before saving session to IndexedDB.

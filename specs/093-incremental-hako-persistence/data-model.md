# Data Model: Incremental Quality Review Session Persistence

**Feature**: `093-incremental-hako-persistence`  
**Date**: 2026-09-10  
**Status**: Ready  

## 1. Entity Architecture & Lifecycle Flow

```
+-------------------------------------------------------------+
|               QualityReviewSession (Persistent)              |
|  - id: string                                               |
|  - projectId: string                                        |
|  - projectTitle: string                                     |
|  - selectedChapterIds: string[] (max 12 IDs)                |
|  - chapters: Record<string, ProjectReviewChapter>           |
|  - issues: QualityIssue[]                                   |
|  - status: 'idle' | 'analyzing' | 'completed' |             |
|            'partial' | 'error'                              |
|  - updatedAt: string                                        |
+-------------------------------------------------------------+
                               |
              handleStartAnalysis() execution loop
                               v
   +-------------------------------------------------------+
   | For each chapter i of selectedChapters:              |
   |   1. chapter.status = 'analyzing'                     |
   |   2. heuristicIssues = runHeuristicQualityScan(...)   |
   |   3. allDetectedIssues.push(...heuristicIssues)       |
   |   4. aiIssues = await runAiQualityScan([chapter])     |
   |   5. allDetectedIssues.push(...aiIssues)              |
   |   6. chapter.status = 'done'                          |
   |   7. updateSessionChaptersAndIssues(                  |
   |        chapters, allDetectedIssues,                   |
   |        isLast ? 'completed' : 'analyzing'             |
   |      )                                                |
   +-------------------------------------------------------+
                               |
        On AbortError or Exception (Catch block)
                               v
   +-------------------------------------------------------+
   | updateSessionChaptersAndIssues(                       |
   |   chapters, allDetectedIssues, 'partial'              |
   | )                                                     |
   +-------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 HakoCheckerWorkspace UI                     |
|  - If session.status === 'completed':                       |
|      Render HakoIssueReviewPanel (Clean completed view)     |
|  - If session.status === 'partial':                         |
|      Render Partial Notice Banner (X/Y chapters finished)   |
|      + Render HakoIssueReviewPanel (Preserved issues)       |
+-------------------------------------------------------------+
```

---

## 2. Updated Data Schemas

### 2.1 `QualityReviewSession` (`src/types/hakoChecker.ts`)

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Yes | Unique session identifier |
| `projectId` | `string` | Yes | Associated story project ID |
| `projectTitle` | `string` | Yes | Story project title |
| `selectedChapterIds` | `string[]` | Yes | Selected chapter IDs (bounded $\le 12$) |
| `chapters` | `Record<string, ProjectReviewChapter>` | Yes | Map of chapter review metadata |
| `issues` | `QualityIssue[]` | Yes | List of detected issues (accumulated incrementally) |
| `status` | `'idle' \| 'analyzing' \| 'completed' \| 'partial' \| 'error'` | Yes | **Updated**: includes `'partial'` for interrupted reviews |
| `createdAt` | `string` | Yes | ISO timestamp |
| `updatedAt` | `string` | Yes | ISO timestamp |
| `error` | `{ code: string; message: string }` | No | Optional session error descriptor |

### 2.2 `ProjectReviewChapter` (`src/types/hakoChecker.ts`)

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `chapterId` | `string` | Yes | Unique chapter ID |
| `title` | `string` | Yes | Chapter title |
| `chapterNumber` | `number` | Yes | 1-indexed chapter number |
| `translationType` | `'polished' \| 'raw' \| 'none'` | Yes | Type of available translation |
| `wordCount` | `number` | Yes | Calculated word count |
| `status` | `'pending' \| 'loaded' \| 'analyzing' \| 'done' \| 'error'` | Yes | Review status for this chapter |
| `errorMessage` | `string` | No | Error message if this chapter failed |
| `rawChineseContent` | `string` | No | User-provided or extracted raw text |

---

## 3. State Machine Transitions

```
               [Select Project]
                     |
                     v
                 +-------+
                 | idle  | <---------------------+
                 +-------+                       |
                     |                           |
            [Bắt đầu kiểm định]             [Đặt lại phiên]
                     |                           |
                     v                           |
               +-----------+                     |
        +----> | analyzing | --------------------+
        |      +-----------+                     |
        |        |   |   |                       |
        |        |   |   +-------------------+   |
[Chapter done]   |   |                       |   |
  (i < total)    |   | [Abort / Exception]   |   |
        +--------+   |                       |   |
                     |                       v   |
          [All chaps |                +---------+|
            complete]|                | partial ||
                     v                +---------+|
               +-----------+                 |   |
               | completed | ----------------+---+
               +-----------+
```

1. **`idle` $\to$ `analyzing`**: User triggers analysis. `isAnalyzing` set to true.
2. **`analyzing` $\to$ `analyzing` (incremental save)**: Chapter $i$ completes. Session updated in IndexedDB with issues accumulated so far and `status: 'analyzing'`.
3. **`analyzing` $\to$ `completed`**: Last chapter completes successfully without abort or error.
4. **`analyzing` $\to$ `partial`**: User clicks "Hủy phân tích" or an unhandled exception occurs. All issues accumulated up to that moment are written to IndexedDB with `status: 'partial'`.
5. **`partial` $\to$ `analyzing`**: User clicks "Bắt đầu kiểm định" or "Phân tích lại" to retry or re-run review.
6. **`partial` or `completed` $\to$ `idle`**: User clicks "Đặt lại phiên" to clear session.

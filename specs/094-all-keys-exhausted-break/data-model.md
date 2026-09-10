# Data Model: All API Keys Exhausted Error Flow & Issue Mapping

**Feature**: `094-all-keys-exhausted-break`  
**Date**: 2026-09-10  
**Status**: Ready  

## 1. Error Taxonomy & Control Flow

```
+--------------------------------------------------------------------+
|                  callGeminiDirect(options)                         |
|  Loop attempt: 0 -> rawKeys.length - 1                             |
|  If all keys fail with HTTP 429 / RESOURCE_EXHAUSTED:               |
|    err = new Error("Toàn bộ API Key đã hết hạn mức...")            |
|    err.code = 'ALL_KEYS_EXHAUSTED'                                 |
|    throw err;                                                      |
+--------------------------------------------------------------------+
                                 |
                                 v throws Error (with code='ALL_KEYS_EXHAUSTED')
+--------------------------------------------------------------------+
|               runAiQualityScan(chapters) loop                      |
|  For each chapter of chapters:                                     |
|    try {                                                           |
|      callGeminiDirect(...)                                         |
|    } catch (err) {                                                 |
|      if (err.name === 'AbortError') throw err;                     |
|      if (err.code === 'ALL_KEYS_EXHAUSTED') {                      |
|        push 1 summary warning issue;                               |
|        break; // Stop immediately                                  |
|      }                                                             |
|      push localized chapter warning issue;                         |
|      continue; // Other errors continue                            |
|    }                                                               |
+--------------------------------------------------------------------+
                                 |
                                 v returns
+--------------------------------------------------------------------+
|                   QualityIssue[] (Collected)                       |
|  - Chapter 1..k-1 issues (preserved 100%)                          |
|  - Exactly 1 Quota Exhaustion warning issue                        |
|  - No calls made for chapters k+1..N                               |
+--------------------------------------------------------------------+
```

---

## 2. Entities & Interfaces

### 2.1 Extended `Error` Interface
```typescript
export interface GeminiDirectCallError extends Error {
  code?: 'ALL_KEYS_EXHAUSTED' | string;
}
```

### 2.2 Quota Exhaustion Warning `QualityIssue`
Emitted upon early break:

| Property | Value | Description |
| :--- | :--- | :--- |
| `id` | `issue-<timestamp>-<hash>` | Unique generated UUID |
| `chapterId` | Current chapter ID | Chapter where quota ran out |
| `chapterTitle` | Current chapter title | Chapter title |
| `chapterNumber` | Current chapter number | Chapter number |
| `category` | `'other'` | General quality issue category |
| `severity` | `'warning'` | Warning level |
| `vietnameseSnippet` | `chapter.title` | Context snippet |
| `explanation` | `Toàn bộ API Key đã hết hạn mức (429 RESOURCE_EXHAUSTED). Dừng phân tích AI cho các chương còn lại.` | Human-readable explanation |
| `decision` | `'pending'` | Pending moderator review |
| `detectedBy` | `'ai'` | Identified by AI module |

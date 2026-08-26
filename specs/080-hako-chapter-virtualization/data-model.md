# Data Model: Hako Checker Chapter Virtualization & Performance Resilience

## Overview
This document outlines the in-memory and persistent data structures used in the Hako Quality Checker workflow, specifically focusing on virtualized rendering and lightweight storage persistence.

---

## 1. Entity: `VirtualizedChapterItem` (In-Memory Viewport Slice)

Represents a single chapter element positioned in the virtual scroll container.

```typescript
export interface VirtualizedChapterItem {
  /** Reference to original chapter metadata */
  item: ProjectReviewChapter;
  /** Index of the item in the sorted chapter list (0 to N-1) */
  index: number;
  /** Absolute positioning style for virtual windowing */
  style: {
    position: 'absolute';
    top: number | string;
    transform: string;
    height: string;
    left: number | string;
    right: number | string;
  };
}
```

---

## 2. Entity: `ProjectReviewChapter` (Sanitized Chapter Record)

Lightweight chapter metadata maintained in session state.

```typescript
export interface ProjectReviewChapter {
  /** Unique normalized string ID of the chapter */
  chapterId: string;
  /** Chapter title for display */
  title: string;
  /** Numerical chapter index (1-based) */
  chapterNumber: number;
  /** Translation readiness status */
  translationType: 'polished' | 'raw' | 'none';
  /** Approximate word count of translated text */
  wordCount: number;
  /** Review status */
  status: 'pending' | 'analyzing' | 'done' | 'error';
  /** Optional custom raw Chinese override (never contains heavy Vietnamese text) */
  rawChineseContent?: string;
}
```

---

## 3. Entity: `QualityReviewSession` (Persistent Session)

Stored in IndexedDB database `HakoQualityCheckerDB` (Object store `hako_quality_sessions`).

```typescript
export interface QualityReviewSession {
  /** Unique session ID (UUID / Timestamp) */
  id: string;
  /** Associated project ID */
  projectId: string;
  /** Associated project title */
  projectTitle: string;
  /** Array of normalized string IDs currently selected (Max 12 items) */
  selectedChapterIds: string[];
  /** Map of chapter ID -> Sanitized ProjectReviewChapter */
  chapters: Record<string, ProjectReviewChapter>;
  /** Detected quality issues */
  issues: QualityIssue[];
  /** Session creation timestamp (ISO 8601) */
  createdAt: string;
  /** Session last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Current execution status */
  status: 'idle' | 'analyzing' | 'completed' | 'error';
}
```

---

## Validation & State Constraints

1. **Selection Boundary**: `selectedChapterIds.length` MUST NOT exceed 12.
2. **String ID Normalization**: All IDs in `selectedChapterIds` and keys in `chapters` MUST be string-coerced (`String(id)`).
3. **Payload Sanitization**: `QualityReviewSession.chapters` MUST NOT contain full text strings (`vietnameseContent`) when written to IndexedDB.

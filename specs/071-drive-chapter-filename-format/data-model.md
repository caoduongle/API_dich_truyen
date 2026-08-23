# Data Model: Chapter Filename Format on Google Drive

**Feature**: `071-drive-chapter-filename-format`
**Date**: 2026-08-23

---

## 1. Updated Manifest Item Interface

```typescript
export interface ChapterManifestItem {
  /** Internal immutable chapter ID (e.g. chap_file_import_17244... or chap_123) */
  id: string;
  /** Chapter display title */
  title: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Translation workflow status */
  status: 'not_started' | 'in_progress' | 'completed';
  /** Google Drive File ID */
  fileId?: string;
  /** Human-readable Google Drive File Name (e.g. chapter_001_hoi-1-khoi-dau.json) */
  fileName?: string;
}
```

---

## 2. Filename Format Specification

```text
chapter_{INDEX}_{SLUG}.json
│       │       │
│       │       └── Sanitized ASCII slug (max 30 chars, lowercase, hyphens)
│       └── 3-digit zero-padded 1-based index (001 - 999)
└── Standard prefix
```

---

## 3. Data Mapping Table

| Property | Local (IndexedDB) | Google Drive Remote | Manifest Item |
|---|---|---|---|
| **Identity** | `Chapter.id` (`chap_...`) | Metadata attribute `id` inside JSON payload | `ChapterManifestItem.id` |
| **Filename** | N/A (IndexedDB key) | Google Drive `name` (e.g. `chapter_001_hoi-1.json`) | `ChapterManifestItem.fileName` |
| **File ID** | N/A | Google Drive `file.id` (e.g. `1AbC...`) | `ChapterManifestItem.fileId` |
| **Payload** | `Chapter` object | JSON stringified `Chapter` (or CRDT encrypted) | N/A |

# Research & Technical Decisions: Human-Readable Chapter Filenames on Google Drive

**Feature**: `071-drive-chapter-filename-format`
**Date**: 2026-08-23

---

## 1. Chapter Filename Format Design

### Context & Problem
Previously, chapter files were saved on Google Drive as `chapter_${chap.id}.json`. Because `Chapter.id` in `ProjectFormModal.tsx` and `useWorkspaceState.ts` is generated as `chap_file_import_{timestamp}_{index}` or `chap_{timestamp}_{random}`, the resulting Drive filenames were `chapter_chap_file_import_17244...json`.

In the Google Picker multi-select window, users see a list of identical-looking hash strings, making it impossible to:
1. Verify which chapters are in the folder.
2. Select or unselect specific chapters.
3. Confirm that chapter order is intact.

### Decision
Implement a pure, deterministic filename generator in `driveGranularSync.ts` (and export it):
```typescript
export function sanitizeChapterTitleSlug(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')         // Trim leading/trailing hyphens
    .slice(0, 30);
}

export function formatChapterFileName(index: number, title?: string, chapId?: string): string {
  const padIndex = String(index + 1).padStart(3, '0');
  const slug = sanitizeChapterTitleSlug(title || '');
  if (slug) {
    return `chapter_${padIndex}_${slug}.json`;
  }
  return `chapter_${padIndex}.json`;
}
```

### Examples
- Chapter 1: `title: "Chương 1: Yểm Ngục"` -> `chapter_001_chuong-1-yem-nguc.json`
- Chapter 2: `title: "Chương 2: Vụ án thuế bạc"` -> `chapter_002_chuong-2-vu-an-thue-bac.json`
- Chapter 15: `title: ""` -> `chapter_015.json`

---

## 2. Invariant: Immutability of `Chapter.id`

### Core Principle
According to the project Constitution (Principle IV: Immutable Core Schemas), `Chapter.id` in `src/types.ts` and IndexedDB table schemas must NOT be modified. Internal logic, CRDT sync rooms (`doc-${projectId}-${chapterId}`), paragraph history, and React state rely on `Chapter.id`.

### Implementation
- `Chapter.id` stays exactly as-is (`chap_...`).
- Only the Google Drive file `name` attribute uses `formatChapterFileName`.
- `manifest.json` tracks both `id` (`Chapter.id`) and `fileName` (`formatChapterFileName(...)`).

---

## 3. Backward Compatibility & Resolution Cascade

### Matching Logic
When searching or validating files in `selectedFiles` or Google Drive:
1. Check `chapMeta.fileName` (if recorded in `manifest.json`).
2. Check `chapMeta.fileId` (exact Google Drive File ID).
3. Check `formatChapterFileName(index, chapMeta.title, chapMeta.id)`.
4. Check legacy pattern `chapter_${chapMeta.id}.json`.
5. Check if filename contains `chapMeta.id`.

This guarantees 100% backward compatibility for all existing shared projects on Google Drive.

# Interface Contract: Translator Workspace Upsert Logic

**Feature**: `082-upsert-chapter-save`
**Date**: 2026-08-27

## Scope

This contract governs the interface and behavior of `handleSaveChapter` and related state handlers exposed by `useWorkspaceState` in `src/components/translator-workspace/useWorkspaceState.ts`.

## Export Signature

```typescript
export interface UseWorkspaceStateReturn {
  // ... other properties
  currentChapterId: string | null;
  handleSaveChapter: () => void;
  // ... other properties
}
```

## Behavior Specifications

### 1. `handleSaveChapter`

- **Trigger**: Click "Lưu chương dịch" button in `BilingualEditor` or keyboard shortcut `Ctrl+S` / `Cmd+S`.
- **Preconditions**:
  - `sourceText.trim().length > 0` (otherwise aborts with warning toast `"Không có nội dung để lưu."`).
- **Execution Branches**:

#### Branch A: Existing Chapter Update
- **Condition**: `currentChapterId !== null` AND `activeProject.chapters.some(c => c.id === currentChapterId)`.
- **Effects**:
  1. Locates the existing chapter object `existing` in `activeProject.chapters`.
  2. Constructs the updated chapter object:
     ```typescript
     {
       ...existing,
       title: finalTitle,
       sourceText,
       rawTranslation,
       polishedTranslation,
       paragraphs,
       translatedLines,
       status: polishedTranslation.trim() ? 'completed' : rawTranslation.trim() ? 'in_progress' : 'not_started',
       updatedAt: new Date().toISOString(),
     }
     ```
  3. Updates `activeProject.chapters` using `.map()` without changing array length or order.
  4. Calls `onUpdateProject({ ...activeProject, chapters: updatedChapters })`.
  5. Emits toast notification:
     ```typescript
     showToast({ message: `Đã cập nhật thành công chương: "${finalTitle}"`, type: 'success' });
     ```

#### Branch B: New Chapter Creation
- **Condition**: `currentChapterId === null` OR `!activeProject.chapters.some(c => c.id === currentChapterId)`.
- **Effects**:
  1. Instantiates a new chapter object:
     ```typescript
     const newChapter: Chapter = {
       id: 'chap_' + Date.now(),
       title: finalTitle,
       sourceText,
       rawTranslation,
       polishedTranslation,
       paragraphs,
       translatedLines,
       status: polishedTranslation.trim() ? 'completed' : rawTranslation.trim() ? 'in_progress' : 'not_started',
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString(),
     };
     ```
  2. Prepends `newChapter` to `activeProject.chapters`: `[newChapter, ...activeProject.chapters]`.
  3. Calls `setCurrentChapterId(newChapter.id)` immediately.
  4. Calls `onUpdateProject({ ...activeProject, chapters: updatedChapters })`.
  5. Emits toast notification:
     ```typescript
     showToast({
       message: `Đã lưu trữ thành công chương: "${finalTitle}" vào bộ nhớ lưu trữ lịch sử dịch.`,
       type: 'success'
     });
     ```

### 2. State Reset Contracts

- **Project Switch (`useEffect([activeProject.id])`)**:
  - MUST call `setCurrentChapterId(null)`.
- **Load Sample Example (`handleLoadExample`)**:
  - MUST call `setCurrentChapterId(null)`.
- **Load Chapter from History (`useEffect([loadedChapter])`)**:
  - MUST call `setCurrentChapterId(loadedChapter.id)`.
- **Load Chapter from Dropdown (`handleLoadChapterById`)**:
  - MUST call `setCurrentChapterId(id)`.

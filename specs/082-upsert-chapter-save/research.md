# Research: Upsert Chapter Save in Translator Workspace

**Feature**: `082-upsert-chapter-save`
**Date**: 2026-08-27

## Problem Statement

When users load a previously translated chapter from "Lịch Sử Chương Dịch" (Chapter History) into "Mặt Trận Dịch Thuật" (Single-Chapter Translator Workspace) via "Mở chỉnh sửa lại", `useWorkspaceState` properly initializes `currentChapterId = loadedChapter.id`. However, `handleSaveChapter` previously ignored `currentChapterId`, always generating a new `Chapter` entity with `id: 'chap_' + Date.now()` and prepending it to `activeProject.chapters`.

This caused duplicate entries with identical titles in the Chapter History, left the original chapter unchanged, and caused newly saved duplicate entries to lose data or status if the user only re-ran one translation stage.

## Research Findings & Architectural Decisions

### 1. Upsert Logic Architecture in `handleSaveChapter`

- **Decision**: In `handleSaveChapter`, look up `currentChapterId` in `activeProject.chapters` using `activeProject.chapters.find(c => c.id === currentChapterId)`.
  - **If Found**: Update the matched chapter in-place within `activeProject.chapters` using `.map()`, preserving original `id` and `createdAt`, updating `title`, `sourceText`, `rawTranslation`, `polishedTranslation`, `paragraphs`, `translatedLines`, `status`, and updating `updatedAt: new Date().toISOString()`. Display a toast: `Đã cập nhật thành công chương: "${finalTitle}"`.
  - **If Not Found or `currentChapterId === null`**: Instantiate a new `Chapter` with `id: 'chap_' + Date.now()`, `createdAt: new Date().toISOString()`, and prepend to `activeProject.chapters`. Immediately invoke `setCurrentChapterId(newChapter.id)`. Display a toast: `Đã lưu trữ thành công chương: "${finalTitle}" vào bộ nhớ lưu trữ lịch sử dịch.`.
- **Rationale**: Follows standard document/file editing semantics. Binding `currentChapterId` immediately after new creation prevents rapid consecutive saves (e.g. repeated Ctrl+S) from generating duplicate clones.
- **Alternatives Considered**:
  - *Separate "Lưu mới" and "Cập nhật" buttons in the UI*: Rejected because it adds visual clutter and goes against modern IDE/editor UX standards where Ctrl+S updates the active document.
  - *Relying solely on `currentChapterId !== null` without checking `activeProject.chapters`*: Rejected because if a chapter was deleted elsewhere, updating would silently lose data; verifying existence in `activeProject.chapters` ensures safe fallback to creation.

### 2. Workspace State Lifecycle & `currentChapterId` Management

- **Decision**:
  1. `useEffect([activeProject.id])` (project change): Add `setCurrentChapterId(null)` to ensure clean slate when switching projects.
  2. `handleLoadExample`: Add `setCurrentChapterId(null)` so loading sample demo text does not overwrite previously opened chapters.
  3. `useEffect([loadedChapter])` (load chapter from history): Already sets `setCurrentChapterId(loadedChapter.id)` and resets form states.
  4. `handleLoadChapterById`: Already sets `setCurrentChapterId(id)` when loading a chapter from dropdown.
- **Rationale**: Guarantees strict isolation of editing sessions across project boundaries and demo content.
- **Alternatives Considered**:
  - *Auto-saving on navigation*: Rejected to avoid unexpected background writes without explicit user confirmation.

### 3. Chapter Status and Paragraph Line Splitting Invariants

- **Decision**: Status computation remains standard:
  ```ts
  status: polishedTranslation.trim() ? 'completed' : rawTranslation.trim() ? 'in_progress' : 'not_started'
  ```
  Paragraph and translated line splitting remains:
  ```ts
  const paragraphs = sourceText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  const translatedLines = polishedTranslation
    ? polishedTranslation.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0)
    : rawTranslation.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  ```
- **Rationale**: Keeps exact compatibility with all downstream modules (Hako Checker, Chapter History, Export, Reader).

## Conclusion

The UPSERT strategy requires changes localized to `src/components/translator-workspace/useWorkspaceState.ts`. It does not require changes to `types.ts`, IndexedDB schemas, or backend services, adhering strictly to Constitution Principles II, III, and IV.

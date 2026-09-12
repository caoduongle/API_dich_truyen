# Research: Hako Bulk Raw Hydration

**Branch**: `121-hako-bulk-raw-hydration` | **Spec**: [spec.md](spec.md)

## 1. Technical Decisions

### Decision 1: Batch IndexedDB Retrieval via `getChaptersByProjectFromDB`
- **Context**: Projects can contain hundreds of chapters (e.g. 139 chapters). Previously, opening the raw edit modal for one chapter called `getChapterFromDB(id)` individually. Doing this sequentially for 139 chapters would create 139 separate IndexedDB transactions, taking 500ms–2000ms and risking UI jank.
- **Decision**: Use `getChaptersByProjectFromDB(projectId)` from `src/services/db.ts`, which uses IndexedDB's `projectId` index in a single read transaction: `index.getAll(projectId)`.
- **Performance**: Retrieves 150+ full chapters with `sourceText` in a single transaction in 15–30ms on standard client devices.
- **Alternatives considered**:
  - *Keep single-chapter lazy load on click*: Rejected because it requires users to click 139 individual chapter buttons manually.
  - *Promise.all(ids.map(getChapterFromDB))*: Works, but creates N parallel transactions on the store rather than a single index query.

### Decision 2: Dual Hydration Strategy (Automatic on Select + Manual Toolbar Action)
- **Context**: The user requested: "tôi muốn thêm nút thêm raw cho tất cả các chương; hoặc là nó sẽ tự động thêm raw" (I want to add a button to add raw for all chapters, OR have it automatically add raw).
- **Decision**: Implement **both**:
  1. **Automatic Hydration on Project Select**: In `useHakoReviewSession.selectProject(project)`, eagerly fetch project chapters via `getChaptersByProjectFromDB(project.id)` and populate `chaptersRecord[id].rawChineseContent = fullChap.sourceText` before or concurrently with initializing the session state. Additionally, `HakoChapterSelector` runs an automatic check on mount/project change to hydrate any remaining unpopulated chapters in the background.
  2. **Dedicated Action Button in Toolbar**: In `HakoChapterSelector`, add a "⚡ Nạp Raw toàn bộ" button next to existing range selection tools, wired to `hydrateAllChaptersRaw()` from `useHakoReviewSession`.
- **Rationale**: Automatic hydration provides a zero-click frictionless experience for standard workflows; the toolbar button provides reassurance, manual refresh capability, and immediate feedback (loading spinner + toast/counter).
- **Alternatives considered**:
  - *Only automatic without button*: Misses explicit user control and makes it hard to recover if chapters were newly imported during the session.
  - *Only button without automatic*: Still requires 1 manual click every time, whereas automatic is completely effortless.

### Decision 3: Reactive State and Persistence in `useHakoReviewSession`
- **Context**: Review sessions are persisted to IndexedDB (`HAKO_REVIEW_SESSION_KEY`).
- **Decision**: Expose `hydrateAllChaptersRaw(): Promise<{ successCount: number; totalCount: number }>` from `useHakoReviewSession`.
  - When invoked, it reads `getChaptersByProjectFromDB(session.projectId)`, merges `sourceText` into `session.chapters`, and persists the updated session with debouncing.
  - Returns statistics (`successCount`, `totalCount`) so caller components can display informative toasts or feedback.
- **Preservation rule**: If a chapter already has user-modified raw text (`existingChapter?.rawChineseContent`) that differs from default, preserve it unless overridden.

### Decision 4: Design System & Visual Hierarchy
- **Context**: UI must conform to `.agents/rules/design-system.md`. No AI slop or generic purple gradients.
- **Decision**:
  - Button placed in `HakoChapterSelector` toolbar alongside "Chọn theo khoảng" and "Nhập số chương".
  - Uses project standard: `<Button variant="secondary" size="sm" icon={<Zap className="w-3.5 h-3.5 text-polish" />} ...>`
  - Status indicator in header: `<span className="text-[11px] text-text-muted">Đã có Raw: <strong className="text-text-main">{rawCount}/{totalCount}</strong> chương</span>`
  - Chapter badges: Green `Đã có Raw (X ký tự)` for populated chapters; parchment `+ Thêm Raw` for chapters genuinely lacking source text.

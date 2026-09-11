# Research: Jump from Hako Checker to Translator Workspace

## Research Topics & Architectural Decisions

### 1. Reusing `handleGoToTranslate` in `App.tsx`
- **Context**: `src/App.tsx` already contains `handleGoToTranslate(chapter?: Chapter)` (lines 224-230):
  ```typescript
  const handleGoToTranslate = useCallback(
    (chapter?: Chapter) => {
      setLoadedChapter(chapter || null);
      switchTab('translate');
    },
    [switchTab]
  );
  ```
- **Decision**: Define `handleOpenChapterFromHakoChecker(chapterId: string)` in `AppContent` in `src/App.tsx`:
  ```typescript
  const handleOpenChapterFromHakoChecker = useCallback(async (chapterId: string) => {
    try {
      const chapter = await getChapterFromDB(chapterId);
      if (!chapter) {
        showToast({ message: 'Không tìm thấy dữ liệu chương!', type: 'error' });
        return;
      }
      handleGoToTranslate(chapter);
    } catch (err) {
      console.error('[App] Failed to open chapter from Hako Checker:', err);
      showToast({
        message: 'Lỗi khi tải dữ liệu chương: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error',
      });
    }
  }, [handleGoToTranslate, showToast]);
  ```
- **Rationale**:
  - Reuses the battle-tested tab navigation and state management already functioning for "continue translation" without creating duplicate tab-switching logic.
  - Safely awaits asynchronous IndexedDB fetch.
  - Implements defensive error handling and feedback via `useNotifications().showToast`.
- **Alternatives Considered**:
  - Navigating to `translate` tab without pre-loading chapter: Rejected because the user would have to manually find the chapter in the project sidebar.
  - Creating a separate state flow: Rejected by explicit user rule ("cần TÁI DÙNG đúng cơ chế này, không viết luồng mới song song").

### 2. Toast Notification Availability in `AppContent`
- **Context**: `App()` mounts `<NotificationProvider>` at the root, wrapping `<ProjectProvider>` and `<AppContent />`.
- **Decision**: Import `useNotifications` from `./components/NotificationSystem` and call `const { showToast } = useNotifications();` inside `AppContent`.
- **Rationale**: Follows the existing codebase pattern (`ChapterHistoryPanel.tsx`, `ApiSettings.tsx`) where toast notifications are dispatched using `showToast({ message, type: 'error' })`.
- **Alternatives Considered**: Native browser `window.alert()`: Rejected because user explicitly specified "qua toast/thông báo có sẵn trong app, không alert thô".

### 3. Chapter Issues Listing and Action Trigger in Hako Checker
- **Context**: In `HakoCheckerWorkspace.tsx`, when review is completed or partial, `<HakoIssueReviewPanel>` is rendered with `issues={session.issues}` and `chapters={session.chapters}`.
- **Decision**:
  1. Update `HakoCheckerWorkspaceProps` to accept `onOpenInTranslator?: (chapterId: string) => void`.
  2. Pass `onOpenInTranslator` to `<HakoIssueReviewPanel>`.
  3. In `HakoIssueReviewPanel.tsx`:
     - Group issues by `chapterId` into a list of chapters with detected issues (`chaptersWithIssues`), showing chapter number, title, and count of issues.
     - For each chapter in the list, render an action button `"Mở trong Bàn Dịch để sửa"` that calls `onOpenInTranslator(chap.id)`.
     - Also thread `onOpenInTranslator` to `HakoIssueCard` (or render it directly on issue cards) so proofreaders can jump to the editor directly from an issue card.
- **Rationale**:
  - Provides dual convenience: high-level chapter overview with issue counts, and issue-level quick navigation.
  - Complies with `.agents/rules/design-system.md` using the standard `Button` primitive and design tokens.
- **Alternatives Considered**:
  - Adding the button to `HakoChapterSelector`: Rejected because `HakoChapterSelector` is the pre-analysis selection component, whereas the user requested placing it in the audit results view ("Trong danh sách kết quả kiểm định").

### 4. Database Safety & Immutability
- **Context**: Constitution Principle IV and explicit user constraints dictate that `src/services/db.ts` must NOT be modified.
- **Decision**: `getChapterFromDB` is imported as a strictly read-only caller in `src/App.tsx`. No changes to `src/services/db.ts`.
- **Rationale**: `getChapterFromDB(id: string): Promise<Chapter | null>` already exists in `db.ts` and handles reading from the `chapters` object store.

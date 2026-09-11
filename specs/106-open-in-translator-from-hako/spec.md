# Feature Specification: Direct Jump from Hako Checker to Translator Workspace

**Feature Branch**: `106-open-in-translator-from-hako`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Bối cảnh: src/App.tsx đã có sẵn cơ chế mở 1 chương cụ thể trong TranslatorWorkspace từ nơi khác trong app: hàm xử lý (tìm trong App.tsx, khoảng dòng 205-252 — tên hàm cụ thể hãy đọc lại file để lấy chính xác, đại khái dạng handleGoToTranslate hoặc tương tự) nhận vào 1 đối tượng Chapter đầy đủ, gọi setLoadedChapter(chapter) rồi chuyển tab sang 'translate'. Cơ chế này ĐANG được dùng cho luồng "tiếp tục dịch" (có thể từ ProjectList) — cần TÁI DÙNG đúng cơ chế này, không viết luồng mới song song. Nhiệm vụ: 1. Trong src/components/hako-checker/HakoCheckerWorkspace.tsx, thêm prop mới onOpenInTranslator?: (chapterId: string) => void. 2. Trong danh sách kết quả kiểm định (nơi hiển thị từng chương với điểm/số issue — xác định đúng vị trí bằng cách đọc lại component này), thêm 1 nút "Mở trong Bàn Dịch để sửa" cho mỗi chương có issue, khi bấm sẽ gọi callback này với chapterId tương ứng. 3. Trong src/App.tsx, viết hàm xử lý: - Nhận chapterId từ callback - Lấy đối tượng Chapter đầy đủ từ IndexedDB bằng hàm getChapterFromDB(chapterId) (import từ src/services/db.ts — TUYỆT ĐỐI KHÔNG SỬA db.ts, chỉ đọc) - Gọi hàm xử lý mở bàn dịch đã có ở trên với chapter vừa lấy được - Nếu getChapterFromDB trả về null/không tìm thấy: hiển thị thông báo lỗi rõ ràng (qua toast/thông báo có sẵn trong app, không alert thô), không crash app. 4. Truyền hàm xử lý này vào <HakoCheckerWorkspace onOpenInTranslator={...} /> trong App.tsx. Yêu cầu kỹ thuật & phạm vi: - Chỉ sửa đúng 2 file: src/components/hako-checker/HakoCheckerWorkspace.tsx (và component con của nó nếu danh sách chương nằm ở file con) và src/App.tsx. - KHÔNG tự tiện sửa src/services/db.ts, KHÔNG viết lại logic chuyển tab hay setLoadedChapter từ đầu. - Code phải vượt qua đầy đủ: npm run lint (tsc --noEmit), npm test (toàn bộ test pass, không skip), npm run build (vite build + server build thành công)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Click Jump from Chapter Audit Result to Translator Workspace (Priority: P1)

As a translation moderator or proofreader reviewing quality issues in the Hako Checker workspace, I want a direct action button ("Mở trong Bàn Dịch để sửa") on each audited chapter with detected issues, so that I can immediately navigate to the Translator Workspace with that chapter loaded in the bilingual editor to fix translation errors without manually finding and opening the chapter from the project list.

**Why this priority**: Directly bridges quality auditing with editing workflows, eliminating manual friction, tab toggling, and search overhead when acting on detected issues.

**Independent Test**:
In the Hako Checker workspace with completed or partial review results, locate a chapter with detected issues, click "Mở trong Bàn Dịch để sửa". Verify that the application automatically transitions to the 'translate' tab, sets the loaded chapter state with the complete Chapter record from IndexedDB, and renders the BilingualEditor for that specific chapter.

**Acceptance Scenarios**:
1. **Given** an audit review session containing one or more chapters with detected issues in `HakoCheckerWorkspace`, **When** the user clicks "Mở trong Bàn Dịch để sửa" for a specific chapter, **Then** `onOpenInTranslator(chapterId)` is invoked with that chapter's ID.
2. **Given** `handleOpenChapterFromHakoChecker(chapterId)` is triggered in `App.tsx`, **When** the chapter exists in IndexedDB, **Then** the application retrieves the chapter via `getChapterFromDB(chapterId)`, invokes `handleGoToTranslate(chapter)`, switches the active tab to 'translate', and populates `loadedChapter`.

---

### User Story 2 - Graceful Error Handling When Chapter Record Is Missing (Priority: P2)

As a user interacting with the audit results, if a chapter record cannot be found in the local IndexedDB database (e.g. if the chapter was deleted, corrupted, or not yet persisted), I want the application to present a clear, non-intrusive error notification toast without crashing or entering an undefined state.

**Why this priority**: Guarantees app resilience and predictable feedback when asynchronous storage queries fail or return null.

**Independent Test**:
Trigger `onOpenInTranslator` with a non-existent or invalid `chapterId`. Verify that a toast notification with message `"Không tìm thấy dữ liệu chương!"` (or descriptive error message) is displayed, the app does not crash, and the current workspace tab remains stable.

**Acceptance Scenarios**:
1. **Given** a chapter ID that does not exist in IndexedDB, **When** `onOpenInTranslator(chapterId)` is executed, **Then** `getChapterFromDB` resolves to `null`, a toast notification with error type is triggered via `useNotifications`, and the user remains in the current tab without any unhandled exceptions.
2. **Given** an unexpected exception thrown during chapter retrieval, **When** caught in `handleOpenChapterFromHakoChecker`, **Then** an error toast message is displayed and logged safely.

---

### User Story 3 - Granular Issue-Level Navigation to Translator (Priority: P3)

As a moderator inspecting specific issue cards in the audit results, I want the option to jump to the Translator workspace directly from either the chapter summary breakdown or the issue card itself, so that I have contextual access wherever I am reviewing problems.

**Why this priority**: Enhances proofreading ergonomics by letting users jump to edit while viewing either the chapter overview or a detailed error snippet.

**Independent Test**:
Click "Mở trong Bàn Dịch để sửa" on an individual issue card or chapter summary row in `HakoIssueReviewPanel`. Verify that the callback triggers navigation to the translator workspace for that issue's parent chapter.

**Acceptance Scenarios**:
1. **Given** the issue review panel displaying chapters and issues, **When** the user clicks "Mở trong Bàn Dịch để sửa", **Then** the corresponding `chapterId` is forwarded to `onOpenInTranslator`.

---

### Edge Cases

- **Non-existent or Deleted Chapter**: If a chapter was audited but subsequently deleted from IndexedDB, clicking the button displays an error toast `"Không tìm thấy dữ liệu chương!"` and does NOT change the active workspace tab or erase current editor state.
- **Null or Undefined `onOpenInTranslator` prop**: If `onOpenInTranslator` is not provided (optional prop), the button gracefully does nothing or remains disabled, preventing runtime errors.
- **Multiple rapid clicks**: If the user rapidly clicks "Mở trong Bàn Dịch để sửa", asynchronous requests resolve safely without race conditions or multiple duplicate tab navigations.
- **Chapter with 0 issues**: Chapters that passed audit cleanly without any detected issues do not require or highlight a "sửa" (fix) CTA, maintaining visual focus on chapters needing attention.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `HakoCheckerWorkspace` MUST accept an optional prop `onOpenInTranslator?: (chapterId: string) => void`.
- **FR-002**: In `HakoIssueReviewPanel` (and associated child components within the audit results area), the interface MUST render an action button labeled "Mở trong Bàn Dịch để sửa" for each chapter with detected issues.
- **FR-003**: Clicking "Mở trong Bàn Dịch để sửa" MUST invoke `onOpenInTranslator` with the relevant `chapterId`.
- **FR-004**: In `src/App.tsx`, the application MUST define a handler `handleOpenChapterFromHakoChecker(chapterId: string)` that:
  - Fetches the chapter record using `getChapterFromDB(chapterId)` from `src/services/db.ts`.
  - Reuses the existing `handleGoToTranslate(chapter)` callback to set `loadedChapter` and switch the tab to `'translate'`.
  - Displays a user-friendly error notification via the existing `useNotifications` / `showToast` system if `getChapterFromDB` returns `null` or throws an error.
  - Does NOT crash the application or enter an inconsistent state.
- **FR-005**: In `src/App.tsx`, `<MemoHakoCheckerWorkspace>` MUST receive `onOpenInTranslator={handleOpenChapterFromHakoChecker}`.
- **FR-006**: The implementation MUST strictly preserve the schema of `src/types.ts` and `src/services/db.ts` (strictly read-only access to `getChapterFromDB`).
- **FR-007**: Button styling MUST comply with `.agents/rules/design-system.md` using the pre-existing `Button` primitive from `src/components/ui/Button.tsx`.

### Key Entities

- **Chapter**: Complete document entity stored in IndexedDB (`id`, `projectId`, `title`, `chapterNumber`, `sourceText`, `rawTranslation`, `polishedTranslation`, `status`, etc.).
- **QualityReviewSession**: Moderator review state holding `chapters: Record<string, ProjectReviewChapter>` and `issues: QualityIssue[]`.
- **QualityIssue**: Individual audit item with `id`, `chapterId`, `chapterTitle`, `chapterNumber`, `severity`, `category`, `vietnameseSnippet`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can transition from reviewing an audited chapter's issues in Hako Checker to editing that chapter in the BilingualEditor in 1 single click.
- **SC-002**: 100% of chapters with detected issues in the review results display an accessible "Mở trong Bàn Dịch để sửa" action.
- **SC-003**: 0 crashes or unhandled promise rejections when requesting non-existent or corrupted chapter IDs; feedback is surfaced within 150ms via standard toast.
- **SC-004**: All TypeScript type checks (`npm run lint`), test suites (`npm test`), and production build scripts (`npm run build`) pass cleanly without errors or skips.

## Assumptions

- `getChapterFromDB(chapterId)` is fully functional in `src/services/db.ts` and returns `Promise<Chapter | null>`.
- `handleGoToTranslate(chapter)` in `src/App.tsx` correctly handles setting `loadedChapter` and invoking `switchTab('translate')`.
- `useNotifications` is accessible in `AppContent` via `import { useNotifications } from './components/NotificationSystem'` because `AppContent` is wrapped by `NotificationProvider`.
- Scope is strictly bounded to `src/components/hako-checker/HakoCheckerWorkspace.tsx` (and `HakoIssueReviewPanel.tsx` / `HakoIssueCard.tsx`), and `src/App.tsx`.

# Feature Specification: Incremental Quality Review Session Persistence

**Feature Branch**: `093-incremental-hako-persistence`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: Trong file src/components/hako-checker/HakoCheckerWorkspace.tsx, hàm handleStartAnalysis() gom kết quả Heuristic scan + AI scan vào biến local allDetectedIssues, và CHỈ gọi updateSessionChaptersAndIssues() (ghi vào IndexedDB qua useHakoReviewSession) đúng 1 lần ở CUỐI, khi toàn bộ pipeline chạy xong thành công. Khối catch hiện tại không lưu allDetectedIssues đã thu thập được trước khi lỗi/hủy xảy ra. Hậu quả: người dùng bấm 'Hủy phân tích' giữa chừng, hoặc gặp lỗi mạng ở 1 chương bất kỳ, sẽ mất TOÀN BỘ kết quả đã quét được, phải chạy lại từ đầu. Nhiệm vụ: 1. Sửa để allDetectedIssues được lưu tăng dần trong quá trình chạy, không chỉ 1 lần cuối (sau mỗi chương). 2. Trong khối catch, dù là AbortError hay lỗi khác, PHẢI vẫn gọi updateSessionChaptersAndIssues() với issues đã có. 3. Cân nhắc thêm 1 field trạng thái mới cho session ('partial' bên cạnh 'idle'/'analyzing'/'completed'/'error') để UI hiển thị rõ 'kết quả chưa đầy đủ, đã dừng giữa chừng ở chương X/Y'. 4. Không đổi cách hoạt động của nút 'Hủy phân tích' (vẫn abort ngay)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Incremental Chapter-by-Chapter Issue Persistence (Priority: P1)

As a moderator conducting a quality review across multiple chapters, I want detected issues (both rule-based heuristics and AI critique) and individual chapter completion statuses to be saved continuously into the review session as each chapter completes, so that completed work is never lost if the analysis process stops prematurely.

**Why this priority**: Long-running reviews across up to 12 chapters can take considerable time. If issues are only saved at the very end of the batch, any interruption forces the moderator to re-run the entire batch from scratch, wasting time and AI quota.

**Independent Test**: Select 3 chapters for quality analysis, allow Chapter 1 to complete its inspection, then inspect persistent session storage to verify that Chapter 1's issues and its completion status ('done') are already saved in the session even while subsequent chapters are still being evaluated.

**Acceptance Scenarios**:

1. **Given** a review session with multiple chapters queued for analysis, **When** Chapter 1 finishes both heuristic scan and AI evaluation, **Then** the session immediately persists Chapter 1's detected issues and updates Chapter 1's status to 'done'.
2. **Given** Chapter 1 is completed and Chapter 2 is actively being scanned, **When** the moderator checks the session state, **Then** Chapter 1's issues remain intact in persistent storage and Chapter 2 reflects an active scanning state.

---

### User Story 2 - Resilient Issue Retention on Cancellation or Error (Priority: P1)

As a moderator who cancels an in-progress review or experiences an unexpected network or service error during chapter critique, I want all issues detected across previously scanned chapters to be safely preserved and accessible rather than wiped out, so that I can inspect and act upon whatever findings were already identified.

**Why this priority**: Users frequently cancel long runs or encounter sporadic network timeouts during LLM calls. Preserving partial results turns an interruption into a partial success instead of total failure.

**Independent Test**: Initiate quality analysis on a batch of 3 chapters, click "Hủy phân tích" (or simulate an abort signal) during the processing of Chapter 2, and verify that the session retains all issues found in Chapter 1 (plus any heuristic issues already gathered for Chapter 2), and transitions the session cleanly into a partial review state.

**Acceptance Scenarios**:

1. **Given** analysis is running on Chapter 2 after Chapter 1 has finished, **When** the user clicks "Hủy phân tích", **Then** the process halts immediately, all issues detected up to the abort point are saved, and the review session retains those issues.
2. **Given** analysis is running on Chapter 3, **When** a network disconnection or API error occurs, **Then** an error notification is shown, but the review session preserves all issues identified from Chapter 1 and Chapter 2 without discarding them.

---

### User Story 3 - Partial Review State Indication & Issue Review Panel Access (Priority: P2)

As a moderator returning to or viewing an interrupted review session, I want the workspace to clearly display a "partial" status banner explaining that the analysis stopped midway (e.g. at Chapter X of Y), while still enabling me to view, filter, confirm, and export the issues that were collected.

**Why this priority**: Without an explicit 'partial' status, an interrupted session would either look completely finished (misleading the reviewer into believing all chapters were inspected) or remain hidden/empty.

**Independent Test**: Load or encounter an interrupted session where 2 out of 4 chapters were inspected; verify that the workspace renders the Issue Review Panel displaying the detected issues, along with an informative banner stating that the session was stopped midway at Chapter 2 of 4.

**Acceptance Scenarios**:

1. **Given** a session stops before all selected chapters finish, **When** the session state is finalized, **Then** the session status is set to 'partial' and the workspace presents the Issue Review Panel containing all captured issues.
2. **Given** a session with status 'partial', **When** the moderator views the workspace, **Then** a prominent banner or notification communicates that the review is incomplete (indicating the completed chapter count vs total selected count).
3. **Given** a session with status 'partial', **When** the moderator clicks "Bắt đầu kiểm định" or "Đặt lại phiên", **Then** the user can re-run analysis or reset the session cleanly.

---

### User Story 4 - Unaffected Happy-Path Analysis (Priority: P3)

As a moderator running an uninterrupted analysis from start to finish, I want the full review workflow to conclude with the standard 'completed' status and identical final quality metrics as before, ensuring zero regression to normal operations.

**Why this priority**: Incremental persistence must seamlessly integrate with standard successful runs without altering the final aggregated data structure or user experience.

**Independent Test**: Run a complete analysis on 2 chapters without interruption; verify that the session concludes with status 'completed', all chapter statuses set to 'done', and the complete list of issues ready for review and report generation.

**Acceptance Scenarios**:

1. **Given** a set of chapters analyzed without abort or error, **When** the final chapter completes, **Then** the session status transitions to 'completed' and all detected issues across all chapters are present.

---

### Edge Cases

- **Cancellation before any chapter finishes**: If the user cancels during Chapter 1's heuristic or AI scan before any chapter completes, whatever heuristic issues were identified for Chapter 1 up to that millisecond are retained and saved, and the session status is set to 'partial'.
- **Network timeout on 1 chapter in the middle of a batch**: When an individual chapter's AI critique encounters an unrecoverable network failure, the error is handled gracefully: previous chapter issues are preserved, the chapter is marked with error metadata, and subsequent error handling leaves the session in 'partial' status with preserved findings.
- **Immediate cancellation upon clicking start**: If the user immediately clicks cancel before JIT text loading completes, the session cleanly transitions back to idle or partial without throwing unhandled exceptions.
- **Repeated cancellation clicks**: Multiple rapid clicks on "Hủy phân tích" do not trigger conflicting state mutations or corrupt the IndexedDB session record.
- **Exporting reports from a partial session**: When a session has status 'partial', opening the Report Export modal correctly reflects the subset of chapters actually reviewed without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist review issues and updated chapter review statuses incrementally after each individual chapter finishes its evaluation (including both heuristic analysis and AI critique for that chapter).
- **FR-002**: The review session schema MUST support a `'partial'` status value alongside existing statuses (`'idle'`, `'analyzing'`, `'completed'`, `'error'`) to explicitly represent sessions that stopped or were interrupted before all selected chapters finished.
- **FR-003**: The session persistence handler (`updateSessionChaptersAndIssues`) MUST allow specifying or updating the session status (e.g. `'analyzing'`, `'completed'`, `'partial'`) so that incremental saves and terminal states reflect the true lifecycle stage.
- **FR-004**: When a user aborts an in-progress review via "Hủy phân tích", the system MUST halt scanning immediately via `AbortController` and MUST persist all issues collected up to that moment with session status set to `'partial'`.
- **FR-005**: When an unhandled error or exception occurs during analysis, the system MUST catch the error, record error feedback, and persist all issues collected up to the failure point with session status set to `'partial'`.
- **FR-006**: When a review session has status `'partial'`, the workspace MUST display the Issue Review Panel, allowing the moderator to review, confirm, reject, add notes, and export reports for all issues detected so far.
- **FR-007**: When a review session has status `'partial'`, the workspace MUST display an informative banner indicating that the review was stopped midway and showing how many chapters were analyzed out of the total selected.
- **FR-008**: The cancellation mechanism ("Hủy phân tích") MUST remain responsive and immediate, without introducing artificial delays before aborting.
- **FR-009**: Fully successful review runs that complete all selected chapters without error or cancellation MUST transition to status `'completed'`, preserving identical behavior and results to the previous implementation.
- **FR-010**: All modifications MUST remain strictly confined to `src/components/hako-checker/HakoCheckerWorkspace.tsx`, `src/hooks/useHakoReviewSession.ts`, and `src/types/hakoChecker.ts`.

### Key Entities *(include if feature involves data)*

- **QualityReviewSession**: The persistent session object representing a quality review run for a project. Includes `id`, `projectId`, `projectTitle`, `selectedChapterIds`, `chapters`, `issues`, `createdAt`, `updatedAt`, `status` (`'idle' | 'analyzing' | 'completed' | 'partial' | 'error'`), and optional `error`.
- **ProjectReviewChapter**: Metadata for an individual chapter within the review session catalog. Includes `chapterId`, `title`, `chapterNumber`, `translationType`, `wordCount`, and `status` (`'pending' | 'loaded' | 'analyzing' | 'done' | 'error'`).
- **QualityIssue**: An identified translation or formatting defect, containing `id`, `chapterId`, `chapterTitle`, `chapterNumber`, `category`, `severity`, `vietnameseSnippet`, optional `rawSnippet`, `explanation`, `suggestedFix`, `decision` (`'pending' | 'confirmed' | 'review_needed' | 'dismissed'`), `moderatorNote`, `detectedBy` (`'heuristic' | 'ai'`), and `createdAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of quality issues detected in chapters processed prior to an abort or network failure are retained in the saved session without data loss.
- **SC-002**: User cancellation takes effect in under 200ms and commits all existing findings to storage before the workspace returns to an interactive state.
- **SC-003**: When a review is halted midway, 100% of captured issues are immediately available for moderator review, filtering, and export in the workspace UI.
- **SC-004**: Zero regression on happy-path runs: complete runs produce the exact same final issues, chapter statuses, and `'completed'` session state as before.
- **SC-005**: All code quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors, 0 test failures, and 0 bundle warnings.

## Assumptions

- **Processing Cadence**: Processing each chapter through both Heuristic analysis and AI critique in sequence (Chapter 1 Heuristic → Chapter 1 AI → persist; Chapter 2 Heuristic → Chapter 2 AI → persist) ensures that both fast heuristic findings and deep AI findings for completed chapters are preserved together.
- **Storage Volume**: Because session persistence already strips full chapter text bodies (as introduced in feature 077), saving metadata and issues after each chapter incurs negligible I/O overhead (< 15ms per chapter write).
- **Session Status Invariants**: Existing saved sessions with status `'completed'` or `'idle'` remain completely backward-compatible. Only newly interrupted sessions will carry the `'partial'` status.

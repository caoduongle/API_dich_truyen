# Feature Specification: Batch Issue Decisions & Shared Connection Caching

**Feature Branch**: `095-batch-issue-decisions`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: src/services/hakoSessionStore.ts hiện có hàm openDatabase() được gọi lại từ đầu (indexedDB.open(DB_NAME, DB_VERSION)) ở MỌI lần gọi saveSession/getSession/..., thay vì cache 1 connection dùng chung — trong khi src/services/db.ts (module IndexedDB chính của app, KHÔNG được đụng vào) đã làm đúng việc này với biến module-level `let dbInstance: IDBDatabase | null = null;` trong hàm initDB(). Hậu quả rõ nhất ở src/hooks/useHakoReviewSession.ts, hàm updateIssueDecision(): mỗi lần gọi ghi TOÀN BỘ session (bao gồm mảng issues đầy đủ) xuống DB bằng 1 connection mới. Tính năng 'Duyệt nhanh tất cả' / 'Bỏ qua tất cả' trong src/components/hako-checker/HakoIssueReviewPanel.tsx (hàm handleBatchConfirm/handleBatchDismiss) forEach gọi onDecisionChange (= updateIssueDecision) cho từng issue 'pending' trong danh sách đang lọc — với 30-50 issue, tạo ra 30-50 lần mở connection + ghi toàn bộ session gần như đồng thời. Nhiệm vụ: 1. Trong hakoSessionStore.ts: đổi openDatabase() để cache kết quả (Promise<IDBDatabase>) ở biến module-level, trả lại connection đã mở nếu còn hợp lệ thay vì mở mới mỗi lần. Xử lý tối thiểu case connection bị đóng bất ngờ (onclose) bằng cách reset biến cache về null để lần gọi sau mở lại. 2. Trong useHakoReviewSession.ts: thêm 1 hàm mới `updateMultipleIssueDecisions(issueIds: string[], decision: QualityIssueDecision)` xử lý toàn bộ danh sách issueIds trong 1 lần: map qua current.issues, cập nhật decision cho những issue có id nằm trong issueIds, rồi gọi persistSession() ĐÚNG 1 LẦN với session đã cập nhật đầy đủ (không loop gọi hàm ghi nhiều lần). 3. Trong HakoIssueReviewPanel.tsx: đổi handleBatchConfirm/handleBatchDismiss để gọi updateMultipleIssueDecisions() mới thay vì forEach gọi onDecisionChange từng cái. Cần đổi cả kiểu prop truyền xuống panel này nếu hook cha (HakoCheckerWorkspace.tsx hoặc nơi khởi tạo useHakoReviewSession) chưa expose hàm mới — thêm truyền xuống cho đủ. Ràng buộc: Chỉ được sửa: src/services/hakoSessionStore.ts, src/hooks/useHakoReviewSession.ts, src/components/hako-checker/HakoIssueReviewPanel.tsx, và src/components/hako-checker/HakoCheckerWorkspace.tsx CHỈ nếu cần truyền prop hàm mới xuống — không sửa gì khác trong file đó. Giữ nguyên hàm updateIssueDecision (xử lý 1 issue) cho các chỗ khác vẫn đang dùng nó — KHÔNG xóa, chỉ thêm hàm mới cho batch. Không đổi cấu trúc dữ liệu QualityReviewSession/QualityIssue hiện có. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Viết test mới cho updateMultipleIssueDecisions: xác nhận với 20 issue 'pending', gọi 1 lần với 20 id, kết quả tất cả 20 issue đổi decision đúng, và hàm ghi DB (saveSession) chỉ được gọi ĐÚNG 1 LẦN."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Batch Review Decision with Single Storage Write (Priority: P1)

As a translation quality reviewer inspecting a chapter with dozens of flagged findings, when I click "Xác nhận tất cả" (Confirm All) or "Bác bỏ tất cả" (Dismiss All) on the filtered issues list, I want the system to update all matching pending issues in a single atomic operation and save to storage exactly once, so that the UI does not freeze or trigger 30–50 concurrent disk writes.

**Why this priority**: Reviewing batches of 30–50 findings is standard workflow. Running 30–50 independent full-session write operations severely degrades browser performance, causes disk thrashing, and risks transaction collisions.

**Independent Test**: Mount `useHakoReviewSession` with 20 pending issues, invoke `updateMultipleIssueDecisions` with all 20 issue IDs and decision `'confirmed'`. Assert that all 20 issues are updated to `'confirmed'` and the underlying storage persistence method (`saveSession`) is executed exactly once.

**Acceptance Scenarios**:

1. **Given** a review session with 20 issues in `'pending'` status, **When** `updateMultipleIssueDecisions` is called with the 20 issue IDs and decision `'confirmed'`, **Then** all 20 issues have their decision updated to `'confirmed'` and `saveSession` is called exactly 1 time.
2. **Given** a review session with 20 issues where only 10 IDs are targeted, **When** `updateMultipleIssueDecisions` is executed with the 10 targeted IDs and decision `'dismissed'`, **Then** only those 10 targeted issues are updated to `'dismissed'`, the remaining 10 issues remain untouched, and `saveSession` is called exactly 1 time.
3. **Given** an empty array of issue IDs, **When** `updateMultipleIssueDecisions` is called, **Then** no changes are made and storage write is skipped or executed safely without corruption.

---

### User Story 2 - Shared Database Connection Caching & Lifecycle Resilience (Priority: P1)

As the application storage layer for quality review sessions, I want `hakoSessionStore` to maintain a cached database connection promise at the module level, so that repeated read/write operations reuse the active connection rather than repeatedly executing `indexedDB.open()`.

**Why this priority**: Opening a new IndexedDB connection on every operation adds connection overhead, creates event loop latency, and risks browser database lockouts. Reusing a connection mimics the proven pattern in `src/services/db.ts`.

**Independent Test**: Perform multiple session store operations (`saveSession`, `getSession`); verify that the underlying `indexedDB.open` is called only once while the connection remains open, and that connection teardown events (`onclose`, `onversionchange`) cleanly invalidate the cache.

**Acceptance Scenarios**:

1. **Given** no database connection has been opened yet, **When** `saveSession` or `getSession` is invoked, **Then** `openDatabase()` opens the connection, caches the `Promise<IDBDatabase>`, and returns the database handle.
2. **Given** an active connection is already cached, **When** subsequent store operations are called, **Then** `openDatabase()` returns the cached promise immediately without invoking `indexedDB.open()`.
3. **Given** the database connection closes unexpectedly (`onclose` or `onversionchange`), **When** the event fires, **Then** the cached connection promise is reset to `null` so that future calls re-establish a healthy connection.

---

### User Story 3 - Batch Actions in Review Panel UI (Priority: P2)

As a moderator using the review panel interface, when I apply filters (e.g. by severity, category, or chapter) and click the batch action buttons, I want the panel to dispatch the single batch update action directly to the hook, so that the UI updates instantly without sluggishness.

**Why this priority**: Smooth UI responsiveness during bulk moderation is essential for usability when managing large chapters with many heuristic or AI findings.

**Independent Test**: Trigger "Xác nhận tất cả" in `HakoIssueReviewPanel` with 15 filtered pending issues; verify that `onBatchDecisionChange` is called once with an array of 15 IDs instead of invoking `onDecisionChange` 15 separate times.

**Acceptance Scenarios**:

1. **Given** a list of filtered issues containing 15 `'pending'` issues and 5 already `'confirmed'` issues, **When** the user clicks "Xác nhận tất cả", **Then** the panel gathers the 15 pending issue IDs and dispatches `onBatchDecisionChange(ids, 'confirmed')` exactly once.
2. **Given** `onBatchDecisionChange` is not provided (backward compatibility), **When** a batch action is clicked, **Then** the panel gracefully falls back to invoking `onDecisionChange` per issue.
3. **Given** zero pending issues match the active filter, **When** the batch button is clicked, **Then** no action is dispatched.

---

### Edge Cases

- **Empty or invalid IDs list**: If `issueIds` passed to `updateMultipleIssueDecisions` is empty, the function returns early without redundant writes.
- **IDs not in session**: If `issueIds` contains IDs that do not exist in `current.issues`, valid matching IDs are updated while non-matching IDs are ignored safely.
- **Concurrent single-issue updates**: Single-issue `updateIssueDecision` remains functional and untouched for individual card interactions (e.g., moderator adding notes or changing a single card).
- **Database closed mid-session**: If the browser terminates the IndexedDB connection in the background, `onclose` resets `dbPromise` to `null` and the next call reconnects automatically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In `src/services/hakoSessionStore.ts`, `openDatabase()` MUST cache its connection promise at the module level (`dbPromise`) and reuse it across multiple calls while valid.
- **FR-002**: In `src/services/hakoSessionStore.ts`, the cached connection MUST be invalidated (`dbPromise = null`) on connection `onclose`, `onversionchange`, or open rejection.
- **FR-003**: In `src/hooks/useHakoReviewSession.ts`, the hook MUST expose a new method `updateMultipleIssueDecisions(issueIds: string[], decision: QualityIssueDecision): Promise<void>`.
- **FR-004**: `updateMultipleIssueDecisions` MUST update all matching issues in `session.issues` whose `id` exists in `issueIds` to the specified `decision` in a single state mutation.
- **FR-005**: `updateMultipleIssueDecisions` MUST invoke `persistSession` (and thus `saveSession`) exactly ONCE per batch call, rather than looping or debouncing multiple calls.
- **FR-006**: Existing `updateIssueDecision(issueId, decision, moderatorNote)` MUST be preserved for single-issue operations.
- **FR-007**: In `src/components/hako-checker/HakoIssueReviewPanel.tsx`, `HakoIssueReviewPanelProps` MUST support an optional `onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void` callback.
- **FR-008**: In `src/components/hako-checker/HakoIssueReviewPanel.tsx`, `handleBatchConfirm` and `handleBatchDismiss` MUST gather all pending issue IDs in the currently filtered view and call `onBatchDecisionChange` in a single invocation if provided.
- **FR-009**: In `src/components/hako-checker/HakoCheckerWorkspace.tsx`, `updateMultipleIssueDecisions` MUST be destructured from `useHakoReviewSession()` and passed to `HakoIssueReviewPanel` as `onBatchDecisionChange`.
- **FR-010**: Only `src/services/hakoSessionStore.ts`, `src/hooks/useHakoReviewSession.ts`, `src/components/hako-checker/HakoIssueReviewPanel.tsx`, `src/components/hako-checker/HakoCheckerWorkspace.tsx`, and test files may be modified. No changes to `src/types.ts` or `src/services/db.ts`.

### Key Entities *(include if feature involves data)*

- **QualityIssueDecision**: Status of a detected quality issue (`'pending' | 'confirmed' | 'review_needed' | 'dismissed'`).
- **QualityIssue**: Record of an issue containing `id`, `chapterId`, `category`, `severity`, `decision`, and metadata.
- **QualityReviewSession**: Root session entity storing `id`, `projectId`, `chapters`, and `issues: QualityIssue[]`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A batch confirmation or dismissal of 20 pending issues executes exactly 1 `saveSession` database write call instead of 20 calls (a 95% reduction in disk write operations).
- **SC-002**: 100% of targeted pending issues in the batch operation have their `decision` state updated accurately in both in-memory React state and IndexedDB.
- **SC-003**: Consecutive calls to `saveSession` or `getSession` reuse the same open IndexedDB connection without repeatedly triggering `indexedDB.open()`.
- **SC-004**: Zero regression on existing single-issue decision management (`updateIssueDecision`), and all quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

## Assumptions

- **Scope Boundary**: The existing UI design, styling, and copy in `HakoIssueReviewPanel` remains intact; only the internal dispatch mechanics of `handleBatchConfirm` and `handleBatchDismiss` are changed.
- **Lookup Efficiency**: Using a `Set` for `issueIds` in `updateMultipleIssueDecisions` provides $O(N)$ total complexity over $N$ session issues, which takes $< 1$ms even for 1000 issues.
- **Test Harness**: The test suite can spy on `saveSession` via Vitest `vi.spyOn` or module mock to strictly verify call counts.

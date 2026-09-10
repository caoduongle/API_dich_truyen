# Feature Specification: Batch Action Confirmation & Undo Guard

**Feature Branch**: `097-batch-action-confirmation-undo`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: src/components/hako-checker/HakoIssueReviewPanel.tsx, 2 nút 'Duyệt nhanh tất cả' và 'Bỏ qua tất cả' (hàm handleBatchConfirm/handleBatchDismiss) thực thi NGAY khi bấm, không có bước xác nhận, không có cách hoàn tác nếu bấm nhầm — với thao tác ảnh hưởng hàng chục issue cùng lúc, 1 cú click nhầm là mất công rà lại thủ công. (Prompt này nên làm SAU Prompt A3, vì sẽ dùng lại updateMultipleIssueDecisions() mới tạo ở đó.) Nhiệm vụ: 1. Trước khi thực thi handleBatchConfirm/handleBatchDismiss, nếu số lượng issue bị ảnh hưởng > 5, hiện 1 hộp thoại xác nhận đơn giản (dùng lại pattern modal đã có trong repo — xem cách HakoReportExportModal.tsx hoặc modal khác trong src/components/ dựng overlay, KHÔNG tạo hệ thống Modal mới từ đầu, KHÔNG cần tạo src/components/ui/Modal.tsx dùng chung dù design-system.md có nhắc tới việc đó là nợ kỹ thuật — ngoài phạm vi prompt này). Nội dung: 'Bạn sắp duyệt/bỏ qua N lỗi. Tiếp tục?' kèm 2 nút Hủy/Xác nhận. 2. Sau khi thực thi thành công, hiện 1 thông báo dạng toast/banner tạm thời (vài giây, dùng lại pattern thông báo đã có trong app nếu tìm thấy, ví dụ NotificationSystem.tsx — kiểm tra trước khi viết mới) có nút 'Hoàn tác'. Hoàn tác = phục hồi lại decision cũ (pending) cho đúng tập issueIds vừa đổi, gọi lại updateMultipleIssueDecisions() với decision cũ. Toast tự ẩn sau khoảng 6-8 giây, sau đó không hoàn tác được nữa (không cần lưu lịch sử phức tạp nhiều bước, chỉ cần hoàn tác được thao tác GẦN NHẤT). Ràng buộc: Chỉ được sửa: src/components/hako-checker/HakoIssueReviewPanel.tsx. Nếu bắt buộc phải thêm 1 hàm helper dùng chung cho toast, có thể thêm vào file hook/service liên quan trực tiếp đến panel này, nhưng KHÔNG viết lại NotificationSystem.tsx nếu nó đã tồn tại — chỉ import và dùng. Ngưỡng '> 5 issue mới hỏi xác nhận' là số gợi ý — có thể điều chỉnh nếu tìm thấy hằng số ngưỡng tương tự đã dùng ở nơi khác trong module Hako Checker cho nhất quán, nhưng phải ghi rõ lý do nếu đổi số. Không thêm dependency mới. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Test mới: bấm 'Duyệt nhanh tất cả' với 10 issue pending → xuất hiện hộp xác nhận; bấm Hủy → không có gì đổi; bấm Xác nhận → cả 10 issue thành confirmed, toast hoàn tác xuất hiện; bấm Hoàn tác → cả 10 issue quay lại pending."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirmation Guard for Large-Scale Batch Actions (Priority: P1)

As a moderator conducting quality checks across multiple chapters with dozens of detected issues, I want the system to require an explicit confirmation before executing "Duyệt nhanh tất cả" (Confirm All) or "Bỏ qua tất cả" (Dismiss All) whenever more than 5 issues are affected, so that an accidental misclick does not inadvertently alter tens of issues at once.

**Why this priority**: Bulk actions modify large amounts of review data instantaneously. Without a confirmation checkpoint, an accidental single tap on "Bỏ qua tất cả" or "Duyệt nhanh tất cả" would overwrite hours of quality analysis across dozens of issues, requiring tedious manual re-triage.

**Independent Test**: Mount `HakoIssueReviewPanel` with 10 pending issues. Click "Duyệt nhanh tất cả". Verify a confirmation dialog appears showing "Bạn sắp duyệt 10 lỗi. Tiếp tục?". Click "Hủy", verify no issues are changed. Click "Duyệt nhanh tất cả" again, click "Xác nhận", verify all 10 issues are updated to `confirmed`.

**Acceptance Scenarios**:

1. **Given** more than 5 pending issues (e.g., 10 issues) match the current filter, **When** the moderator clicks "Duyệt nhanh tất cả", **Then** a confirmation modal opens displaying "Bạn sắp duyệt 10 lỗi. Tiếp tục?" with "Hủy" and "Xác nhận" buttons, and no issue decisions are mutated yet.
2. **Given** more than 5 pending issues match the current filter, **When** the moderator clicks "Bỏ qua tất cả", **Then** a confirmation modal opens displaying "Bạn sắp bỏ qua 10 lỗi. Tiếp tục?" with "Hủy" and "Xác nhận" buttons.
3. **Given** the confirmation modal is open, **When** the moderator clicks "Hủy", presses the `Escape` key, or clicks outside the modal dialog, **Then** the modal closes immediately and all issues retain their previous `pending` state.
4. **Given** the confirmation modal is open, **When** the moderator clicks "Xác nhận", **Then** the modal closes and the batch decision update is dispatched for all targeted issues.
5. **Given** 5 or fewer pending issues (e.g., 1, 3, or 5 issues) match the current filter, **When** the moderator clicks "Duyệt nhanh tất cả" or "Bỏ qua tất cả", **Then** the action executes immediately without showing the confirmation modal.

---

### User Story 2 - Temporary Undo Window for Bulk Decision Mutations (Priority: P1)

As a moderator who has just confirmed or dismissed a batch of issues, I want to see a temporary notification toast with an "Hoàn tác" (Undo) button for 6–8 seconds, so that if I realize I made a mistake or applied the action to the wrong filtered set, I can immediately restore all affected issues back to their original `pending` status with one click.

**Why this priority**: Even with confirmation prompts, users occasionally make mistakes. Providing an immediate, low-friction undo safety net guarantees peace of mind and prevents unrecoverable workflow disruption.

**Independent Test**: Perform a batch confirmation on 10 pending issues. Observe that a notification toast appears with message "Đã duyệt 10 lỗi." and an "Hoàn tác" button. Click "Hoàn tác", verify all 10 issues revert back to `pending`.

**Acceptance Scenarios**:

1. **Given** a batch action (confirm or dismiss) has just executed on $N$ issues, **When** the mutation completes, **Then** a toast notification appears containing the action summary (e.g., "Đã duyệt 10 lỗi." or "Đã bỏ qua 10 lỗi.") and an actionable "Hoàn tác" button.
2. **Given** the undo toast is visible, **When** the moderator clicks "Hoàn tác", **Then** the system restores all $N$ previously mutated issues back to `pending` decision via `onBatchDecisionChange` (or `onDecisionChange`), and the toast closes immediately.
3. **Given** the undo toast is displayed, **When** 6 to 8 seconds elapse without user interaction, **Then** the toast automatically dismisses and the temporary undo action expires.
4. **Given** an undo toast is active, **When** the moderator performs another batch action, **Then** the undo capability updates to track the most recent batch action.

---

### Edge Cases

- **Exactly 5 pending issues**: `pendingIds.length === 5`. Because the threshold is strictly `> 5`, the action executes immediately without opening the confirmation modal, but still displays the undo toast.
- **Exactly 6 pending issues**: `pendingIds.length === 6`. Meets the threshold `> 5`, so the confirmation modal is triggered.
- **Zero pending issues**: When all issues in the current view have already been decided (no `pending` issues), the batch buttons are either hidden or clicking them produces no-op; no modal or toast is triggered.
- **User switches page or filter while undo toast is active**: The toast remains active and clicking "Hoàn tác" correctly targets the exact list of issue IDs that were changed, regardless of the active view or page.
- **Rapid double-clicks on batch buttons**: State guards prevent opening duplicate confirmation modals or triggering concurrent redundant batch dispatches.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `HakoIssueReviewPanel.tsx` MUST define a confirmation threshold constant `BATCH_CONFIRM_THRESHOLD = 5`.
- **FR-002**: When the moderator triggers "Duyệt nhanh tất cả" or "Bỏ qua tất cả", if the number of affected pending issues exceeds `BATCH_CONFIRM_THRESHOLD` (`pendingIds.length > 5`), the component MUST intercept the action and display a confirmation modal dialog instead of immediately dispatching the mutation.
- **FR-003**: The confirmation modal MUST display:
  - Header/Title: "Xác nhận thao tác hàng loạt"
  - Body message: `"Bạn sắp " + (action === 'confirmed' ? "duyệt" : "bỏ qua") + " " + count + " lỗi. Tiếp tục?"`
  - Action buttons: "Hủy" (`Button variant="secondary"`) and "Xác nhận" (`Button variant="primary"`).
- **FR-004**: If the user clicks "Hủy", closes the modal, or clicks the backdrop/presses Escape, the modal MUST close and NO changes may be made to any issues.
- **FR-005**: If the number of affected pending issues is $\le 5$, the batch action MUST execute immediately without opening the confirmation modal.
- **FR-006**: The confirmation modal MUST reuse the existing modal component pattern (`src/components/ui/Modal.tsx`) without inventing custom modal architectures.
- **FR-007**: Following any successful batch execution (whether confirmed via modal or executed directly when $\le 5$), the component MUST show a temporary toast notification using the app's existing notification system (`useNotifications` from `src/components/NotificationSystem.tsx`).
- **FR-008**: The toast notification MUST:
  - Display a clear message: `"Đã duyệt " + count + " lỗi."` or `"Đã bỏ qua " + count + " lỗi."`
  - Set toast type to `'success'`
  - Configure duration between 6000ms and 8000ms (defaulting to 7000ms)
  - Provide an undo handler `onUndo` with label `"Hoàn tác"`.
- **FR-009**: When the user clicks "Hoàn tác" on the toast:
  - The component MUST revert all issues in the affected batch back to `'pending'`.
  - The revert MUST be dispatched via `onBatchDecisionChange(issueIds, 'pending')` (or `onDecisionChange` fallback for backward compatibility).
- **FR-010**: All changes MUST be strictly isolated to `src/components/hako-checker/HakoIssueReviewPanel.tsx`. No alterations to `NotificationSystem.tsx`, `HakoIssueCard.tsx`, or core storage layers.
- **FR-011**: All styling MUST strictly adhere to `.agents/rules/design-system.md` (`rounded-[2px]`/`rounded-md`, design tokens `bg-parchment`, `border-parchment-2`, `text-text-main`, `text-polish`).
- **FR-012**: No new external dependencies may be added.

### Key Entities

- **BatchActionConfirmState**:
  - `decision`: `'confirmed' | 'dismissed'` — the target decision type.
  - `issueIds`: `string[]` — array of pending issue IDs targeted for mutation.
  - `count`: `number` — number of affected issues.
- **BatchUndoState**:
  - `issueIds`: `string[]` — array of issue IDs mutated in the most recent batch.
  - `previousDecision`: `'pending'` — original decision state to restore upon undo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of batch operations affecting $> 5$ issues are gated behind explicit confirmation dialogs, preventing accidental mass-mutations.
- **SC-002**: 100% of batch operations provide an immediate 6–8 second undo window via toast notification that completely reverts all affected issues back to `pending`.
- **SC-003**: 0% accidental unrecoverable data loss reported from moderator batch clicks.
- **SC-004**: Zero regression on quality gates: `npm run lint` (0 errors), `npm test` (100% pass), `npm run build` (successful compilation).

## Assumptions

- **NotificationProvider Availability**: In application runtime, `App.tsx` wraps the entire component tree with `<NotificationProvider>`, ensuring `useNotifications()` is available to `HakoIssueReviewPanel`.
- **Threshold Consistency**: `BATCH_CONFIRM_THRESHOLD = 5` matches user intent and standard bulk-action conventions; operations affecting 1–5 issues are minor enough for instant execution with undo fallback, while operations affecting $\ge 6$ issues warrant an explicit confirmation prompt.
- **Undo History**: Only the single most recent batch action needs to be undoable within the toast's active lifetime; multi-step undo history is intentionally out of scope.

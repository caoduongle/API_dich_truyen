# Feature Specification: Keyboard Navigation and Quick Execution for Audit Issues

**Feature Branch**: `105-audit-keyboard-navigation`  
**Created**: 2026-09-11  
**Status**: Draft  
**Input**: User description: "Bối cảnh: src/hooks/useHotkeys.ts đã tồn tại và đang được dùng trong BilingualEditor.tsx cho Ctrl+S (lưu) và Ctrl+Enter (submit) — pattern gọi `useHotkeys('ctrl+s', callback)` đã chứng minh hoạt động, chỉ cần lặp lại đúng pattern này với tổ hợp phím mới. Nhiệm vụ: 1. Trong UnifiedAuditPanel.tsx (hoặc BilingualEditor.tsx nếu panel không phải nơi phù hợp để đăng ký hotkey toàn cục — tự xác định dựa trên cách useHotkeys hiện hoạt động, ví dụ nó có bị giới hạn phạm vi theo component đang mount hay không): thêm state `focusedIssueIndex` (số nguyên, index trong danh sách issue đang hiển thị ở trang/tab lọc hiện tại). 2. Đăng ký `useHotkeys('alt+j', () => tăng focusedIssueIndex, cuộn/scroll issue đó vào view nếu cần)` và `useHotkeys('alt+k', ...)` giảm index tương tự (giới hạn trong khoảng [0, length-1], không tràn mảng). 3. Đăng ký `useHotkeys('enter', ...)`: CHỈ kích hoạt khi đang có 1 issue được focusedIssueIndex trỏ tới VÀ không đang gõ trong ô input/textarea nào khác (kiểm tra document.activeElement để tránh xung đột với Enter trong textarea nội dung chương) — khi kích hoạt, thực hiện hành động chính của issue đó: nếu autoFixable thì gọi handleApplyAuditFix, nếu không thì chỉ gọi scrollAndSelectInTextarea (từ Prompt B4) để đưa người dùng tới đúng vị trí, không tự áp dụng gì cả. 4. Issue đang được focusedIssueIndex trỏ tới cần có dấu hiệu hiển thị rõ trên UI (viền nổi bật hoặc nền khác biệt nhẹ theo token màu đã có, KHÔNG dùng box-shadow màu sắc lòe loẹt ngoài hệ thống). Ràng buộc: Chỉ sửa: UnifiedAuditPanel.tsx và/hoặc BilingualEditor.tsx (chỉ phần liên quan tới hotkey mới, không đụng logic khác). KHÔNG đổi hành vi Ctrl+S/Ctrl+Enter đã có. Không thêm dependency mới — dùng đúng useHotkeys sẵn có. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Viết/cập nhật test cho useHotkeys.test.ts nếu cần, hoặc test riêng cho logic điều hướng index (tăng/giảm có giới hạn, không tràn mảng). Mô tả rõ: Alt+J/Alt+K hoạt động khi nào (panel phải đang mở/focus hay hoạt động toàn cục?) — ghi rõ giới hạn này để tránh hiểu nhầm."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sequential Keyboard Navigation via Alt+J / Alt+K (Priority: P1) 🎯 MVP

As a translator reviewing chapter translation quality,  
I want to press `Alt+J` to navigate down and `Alt+K` to navigate up through the list of audit issues without taking my hands off the keyboard,  
So that I can quickly inspect identified translation issues sequentially and keep my focus on editing.

**Why this priority**:  
Fast issue triage is essential during intense translation editing. Allowing keyboard navigation eliminates constant mouse switching between the text editor and audit cards.

**Independent Test**:  
Mount the workspace with multiple audit issues. Press `Alt+J` repeatedly and observe the focus moving sequentially from issue 0 to the end of the list without overflowing. Press `Alt+K` and verify the focus moves backwards, clamping at index 0. Verify the selected card scrolls into view within the audit scroll container.

**Acceptance Scenarios**:

1. **Given** a list of issues displayed under the current tab in `UnifiedAuditPanel`, **When** the user presses `Alt+J`, **Then** `focusedIssueIndex` advances by 1 (clamped at `length - 1`), the corresponding card displays distinct active styling (e.g. `border-polish/60 bg-parchment-2/40`), and the card scrolls smoothly into visible view if outside the container viewport.
2. **Given** `focusedIssueIndex` is greater than 0, **When** the user presses `Alt+K`, **Then** `focusedIssueIndex` decreases by 1 (clamped at 0), updating the visual highlight and scrolling the card into view.
3. **Given** `focusedIssueIndex` is 0, **When** the user presses `Alt+K`, **Then** `focusedIssueIndex` remains 0 (no underflow/negative indexing).
4. **Given** `focusedIssueIndex` is at the last item (`length - 1`), **When** the user presses `Alt+J`, **Then** `focusedIssueIndex` remains at `length - 1` (no array overflow).
5. **Given** the list has 0 issues, **When** `Alt+J` or `Alt+K` is pressed, **Then** `focusedIssueIndex` remains `-1` (or `null`) and no errors occur.

---

### User Story 2 - Context-Aware Primary Action Execution via Enter (Priority: P2)

As a translator with an audit issue selected via keyboard,  
I want to press `Enter` to immediately execute the issue's primary resolution action,  
So that I can either auto-fix deterministic errors in one stroke or jump straight to the exact sentence in the translation textarea for manual editing.

**Why this priority**:  
Pairing Alt+J/K navigation with an Enter action hotkey enables a complete keyboard-driven audit triage workflow (navigate → fix/inspect → next).

**Independent Test**:  
Select an auto-fixable issue with `Alt+J` and press `Enter` while not focused in any input/textarea. Verify `handleApplyAuditFix` is invoked. Select a non-fixable issue and press `Enter`. Verify `scrollAndSelectInTextarea` highlights the excerpt in the editor textarea. Type in the translation textarea and press `Enter`. Verify a newline is inserted without triggering audit actions.

**Acceptance Scenarios**:

1. **Given** an audit issue is selected via `focusedIssueIndex`, the issue has `autoFixable: true` with a valid suggestion, and the cursor is NOT inside an `input`, `textarea`, or content-editable field, **When** the user presses `Enter`, **Then** the primary auto-fix action (`onApplyFix`) is invoked, resolving the issue without manual mouse clicks.
2. **Given** an audit issue is selected via `focusedIssueIndex`, the issue is NOT `autoFixable` (or has no suggestion), and the user is NOT inside an input/textarea, **When** the user presses `Enter`, **Then** `scrollAndSelectInTextarea` (or selection callback) is called, focusing and highlighting the offending `targetText` inside the active translation textarea.
3. **Given** the user is currently editing/typing inside the translation textarea (or any other input/textarea), **When** the user presses `Enter`, **Then** the `Enter` hotkey action is completely suppressed, allowing standard newline insertion without interference.
4. **Given** no issue is selected (`focusedIssueIndex` is `-1` or `null`), **When** the user presses `Enter` outside of form fields, **Then** no action is taken.

---

### User Story 3 - Co-existence with Existing Hotkeys & Filter State Synchronization (Priority: P3)

As a power user relying on workspace keyboard shortcuts,  
I want the new audit hotkeys (`Alt+J`, `Alt+K`, `Enter`) to co-exist cleanly with existing shortcuts (`Ctrl+S`, `Ctrl+Enter`) and adapt when changing filter tabs,  
So that my overall workspace shortcuts remain predictable and conflict-free.

**Why this priority**:  
Prevents shortcut collisions and ensures state consistency when switching between "Tất cả", "Quy chuẩn Hako", "Góp ý AI", and "Chưa xử lý" tabs.

**Independent Test**:  
Press `Ctrl+S` and verify the chapter save operation triggers normally. Switch filter tabs in `UnifiedAuditPanel` and verify `focusedIssueIndex` resets or clamps safely to the new filtered list bounds.

**Acceptance Scenarios**:

1. **Given** any focus state in the workspace, **When** the user presses `Ctrl+S` or `Ctrl+Enter`, **Then** existing chapter saving or translation triggering occurs without interference from audit navigation shortcuts.
2. **Given** `focusedIssueIndex` is at position 3 in a tab with 5 items, **When** the user switches to a tab containing only 2 items, **Then** `focusedIssueIndex` resets to 0 (or clamps to 1) so it never references an out-of-bounds index.

---

### Edge Cases

- **No issues in active tab**: `filteredIssues.length === 0` → hotkeys do nothing, `focusedIssueIndex` stays `-1`.
- **List changes dynamically (e.g. issue resolved and filtered out of 'pending' tab)**: If the list shrinks, `focusedIssueIndex` clamps to `Math.min(prevIndex, newLength - 1)`.
- **User clicks an issue card with mouse**: Syncs `focusedIssueIndex` to the clicked card's index.
- **Form element focus check**: The system checks both `enableOnFormTags: false` and `document.activeElement` (`INPUT`, `TEXTAREA`, `SELECT`, `[contenteditable]`) before triggering Enter action.
- **Lifecycle & mount scope**: The hotkeys are active whenever `UnifiedAuditPanel` is mounted within the DOM. If the panel is unmounted, event listeners are cleanly detached via `useHotkeys` cleanup.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a `focusedIssueIndex` state (`number | null`, default `0` when list has items, `-1` when empty) in `UnifiedAuditPanel.tsx` representing the zero-based index of the currently keyboard-focused issue in `filteredIssues`.
- **FR-002**: System MUST register `useHotkeys('alt+j', ...)` to increment `focusedIssueIndex` bounded by `[0, filteredIssues.length - 1]`.
- **FR-003**: System MUST register `useHotkeys('alt+k', ...)` to decrement `focusedIssueIndex` bounded by `[0, filteredIssues.length - 1]`.
- **FR-004**: System MUST scroll the focused issue card into view when `focusedIssueIndex` changes using DOM `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`.
- **FR-005**: System MUST visually distinguish the focused card using design system color tokens (e.g., `border-polish/60 bg-parchment-2/40 ring-1 ring-polish/40`), strictly avoiding arbitrary box-shadows or out-of-system colors.
- **FR-006**: System MUST register `useHotkeys('enter', ...)` with `enableOnFormTags: false` (and verifying `document.activeElement` is not an `INPUT`, `TEXTAREA`, `SELECT`, or `contenteditable` element).
- **FR-007**: When `enter` is triggered on a focused issue with `autoFixable === true` and a valid suggestion (not already resolved), the system MUST invoke the primary fix handler (`handleQuickFix` / `onApplyFix`).
- **FR-008**: When `enter` is triggered on a focused issue that is NOT `autoFixable` (or has no suggestion), the system MUST invoke `handleAuditIssueSelection` to scroll and select the `targetText` in the editor textarea.
- **FR-009**: Clicking an issue card with the mouse MUST synchronize `focusedIssueIndex` to that card's index.
- **FR-010**: Changing the active filter tab (`activeTab`) MUST reset or clamp `focusedIssueIndex` to remain strictly within valid bounds of the newly filtered list.
- **FR-011**: All modifications MUST remain strictly confined to `UnifiedAuditPanel.tsx` and/or `BilingualEditor.tsx` (and respective test files), with ZERO changes to `Ctrl+S` and `Ctrl+Enter` behaviors.

### Scope & Lifecycle Clarification

- **Where hotkeys are registered**: Registered in `UnifiedAuditPanel.tsx` via `useHotkeys`.
- **Active Scope**:
  - `Alt+J` and `Alt+K` are active globally in the window whenever `UnifiedAuditPanel` is mounted (i.e. whenever the translator workspace editor is open).
  - `Enter` is guarded: It only takes effect when `UnifiedAuditPanel` is mounted, an issue card is currently focused (`focusedIssueIndex >= 0`), AND the user's cursor is NOT inside any `input`, `textarea`, or editable form field.
  - When the user is typing inside the translation textarea, pressing `Enter` always inserts a regular newline as expected.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Translators can navigate through any number of audit issues at a rate of 3+ issues per second using purely `Alt+J` and `Alt+K`.
- **SC-002**: 100% of `Enter` presses while typing in `textarea` or `input` insert newlines normally without triggering audit actions or losing focus.
- **SC-003**: 0% index overflow/underflow errors when navigating past list boundaries (index is strictly bounded in `[0, length - 1]`).
- **SC-004**: Visual focus state updates in under 16ms (1 frame) with smooth scroll alignment in the issue list container.
- **SC-005**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 diagnostics.

---

## Assumptions

- `useHotkeys` from `src/hooks/useHotkeys.ts` attaches event listeners to `window` and respects `enableOnFormTags: false`.
- The audit card container is a scrollable element with `overflow-y-auto` capable of hosting DOM refs for `scrollIntoView`.
- Translators working in the workspace benefit from standard Vim/Gmail-like keyboard navigation (`j`/`k` conventions with `Alt` modifier to avoid typing collisions).

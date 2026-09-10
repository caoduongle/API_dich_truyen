# Feature Specification: Textarea Issue Selection & Smooth Auto-Scroll

**Feature Branch**: `103-textarea-issue-selection`  
**Created**: 2026-09-10  
**Status**: Draft  
**Input**: User description: "Bối cảnh: src/components/translator-workspace/BilingualEditor.tsx render sourceText/rawTranslation/polishedTranslation bằng <textarea> THUẦN (dòng ~206/413/486) — HTML textarea KHÔNG hỗ trợ tô màu một phần nội dung bên trong nó (không như contentEditable hay code editor). Cách khả thi không cần đổi cả editor: dùng textarea.setSelectionRange(start, end) để BÔI CHỌN đoạn khớp (trình duyệt tự hiện màu selection mặc định của nó) kèm cuộn tới vị trí đó. Nhiệm vụ: 1. Tạo file mới src/utils/textareaHighlight.ts với hàm: `scrollAndSelectInTextarea(textareaEl: HTMLTextAreaElement, targetText: string): boolean` — logic: dùng textareaEl.value.indexOf(targetText) để tìm vị trí bắt đầu; nếu không tìm thấy (targetText rỗng hoặc không khớp do model paraphrase), trả về false và KHÔNG làm gì thêm (không throw lỗi ra UI). Nếu tìm thấy: gọi textareaEl.focus(), textareaEl.setSelectionRange(start, start + targetText.length). Để cuộn tới đúng vị trí: ước tính số dòng trước vị trí start bằng cách đếm ký tự xuống dòng trong value.slice(0, start), nhân với chiều cao dòng ước tính (đọc line-height thực tế của textarea qua getComputedStyle, đừng hard-code số), rồi set textareaEl.scrollTop tương ứng (trừ đi khoảng đệm để đoạn được chọn không dính sát mép trên). 2. Trong UnifiedAuditPanel.tsx (đã tạo ở Prompt B3): khi click vào 1 issue có targetText khác rỗng, gọi scrollAndSelectInTextarea với ref của đúng textarea đang hiển thị nội dung tương ứng (rawTranslation hay polishedTranslation — xác định dựa theo giai đoạn/tab đang active trong BilingualEditor, đọc code BilingualEditor.tsx để biết cách nó theo dõi tab/giai đoạn đang xem hiện tại). Panel cần nhận ref của textarea đó qua props từ BilingualEditor (dùng useRef/forwardRef, hoặc callback ref — chọn cách ít thay đổi cấu trúc component nhất). 3. Nếu scrollAndSelectInTextarea trả về false (không tìm thấy đoạn khớp), hiện 1 thông báo nhỏ, không chặn luồng (ví dụ toast nhẹ 'Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa'). Ràng buộc: Chỉ tạo mới: src/utils/textareaHighlight.ts. Chỉ sửa: src/components/translator-workspace/UnifiedAuditPanel.tsx, src/components/translator-workspace/BilingualEditor.tsx (chỉ phần thêm ref/truyền ref xuống, KHÔNG đổi logic khác của editor). Không thêm dependency mới (không cài thư viện đo text/canvas measurement nào, dùng getComputedStyle + phép tính xấp xỉ là đủ, không cần chính xác tuyệt đối tới từng pixel). Việc 'highlight' ở đây LÀ bôi chọn (selection), KHÔNG phải tô nền màu cố định — đừng cố gắng chuyển textarea sang contentEditable hay div overlay để tô màu thật, ngoài phạm vi prompt này. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Viết unit test cho scrollAndSelectInTextarea với jsdom: tạo textarea giả, set value chứa 1 đoạn text, gọi hàm với đúng đoạn đó → assert selectionStart/selectionEnd đúng vị trí; gọi với đoạn KHÔNG tồn tại → assert trả về false, selectionStart không đổi. Mô tả/ảnh chụp: click 1 issue có targetText trong panel → textarea tương ứng cuộn và bôi chọn đúng đoạn."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Click-to-Locate Quality Issues in Active Editor (Priority: P1)

As a translator or proofreader reviewing quality issues in the `UnifiedAuditPanel`,  
I want clicking on any issue card with a non-empty target text excerpt to instantly focus, highlight (native text selection), and scroll the corresponding editor textarea directly to that snippet,  
So that I can immediately inspect the surrounding paragraph context without manually hunting through thousands of words in the chapter.

**Why this priority**:  
Manually searching long chapters for an error or critique snippet breaks editor flow and induces eye fatigue. Native selection and estimated scroll provide immediate navigation with zero invasive modifications to plain textareas.

**Independent Test**:  
Mount the editor with a populated translation, click an issue card in `UnifiedAuditPanel` containing a valid target excerpt, and verify that the active editor textarea receives focus, its selection range matches the excerpt boundaries, and the viewport scrolls near the targeted line.

**Acceptance Scenarios**:

1. **Given** an issue with valid `targetText` is rendered in `UnifiedAuditPanel` and the Polished tab is active, **When** the user clicks the issue card, **Then** the polished editor textarea gains focus, its selection range highlights the target text excerpt, and the textarea scrolls to bring the selected line into comfortable view.
2. **Given** the Raw Translation tab is active in the editor, **When** the user clicks an audit issue card, **Then** the raw translation editor textarea is targeted and highlights the excerpt if present in the raw text.
3. **Given** an issue has no `targetText` (e.g. general omission or file-level warning), **When** the user clicks the issue card, **Then** no text selection or scrolling occurs, and no disruptive error is surfaced.

---

### User Story 2 - Graceful Fallback & Non-blocking Feedback for Drifted Text (Priority: P2)

As an editor who may have edited or paraphrased a translation after quality checks were run,  
I want a discreet, non-blocking notification when a clicked excerpt cannot be matched in the current textarea content,  
So that I know why selection did not occur without being interrupted by modal dialogs or breaking errors.

**Why this priority**:  
AI suggestions or previous heuristic scan results can become stale if the user modifies text prior to clicking an issue card. Graceful notification maintains translator confidence and transparency.

**Independent Test**:  
Trigger selection with a snippet that does not exist in the active textarea, verify that `scrollAndSelectInTextarea` returns `false`, selection remains unchanged, and a mild warning toast notification appears ("Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa").

**Acceptance Scenarios**:

1. **Given** an issue excerpt was modified or deleted by the user, **When** clicking the issue card, **Then** the system quietly fails selection, does not scroll erratically, and displays a gentle informational toast notification informing the user that the snippet may have been edited.
2. **Given** `targetText` is empty or whitespace-only, **When** processed, **Then** the locator returns `false` without throwing an error.

---

### Edge Cases

- **Target text appears multiple times in the chapter**: The locator selects the first occurrence found (`indexOf`).
- **Target text located at the very first or last line**: Scroll offset calculation clamps cleanly at `scrollTop = 0` or max scroll range without negative or out-of-bounds numbers.
- **Computed line-height returns "normal" or non-pixel value**: The utility falls back to a sensible proportional default (e.g. `1.5 * fontSize` or 20px) rather than producing `NaN`.
- **Textarea is not mounted or currently hidden**: Selection utility safely checks for element nullity and exits cleanly with `false`.
- **Rapid successive card clicks**: Each click smoothly cancels or updates the selection range to the newest item without race conditions or memory leaks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated utility function `scrollAndSelectInTextarea(textareaEl: HTMLTextAreaElement, targetText: string): boolean` in `src/utils/textareaHighlight.ts`.
- **FR-002**: `scrollAndSelectInTextarea` MUST check if `targetText` is non-empty and located within `textareaEl.value`; if not found or empty, it MUST return `false` without modifying DOM selection or throwing errors.
- **FR-003**: When `targetText` is found, `scrollAndSelectInTextarea` MUST:
  1. Call `textareaEl.focus()`.
  2. Set selection range to `[start, start + targetText.length]` via `textareaEl.setSelectionRange(...)`.
  3. Compute vertical scroll position using actual `line-height` from `getComputedStyle(textareaEl)` multiplied by the line index of the match (counted by newline characters before `start`), applying a top margin buffer to keep the selection comfortably below the top edge.
  4. Set `textareaEl.scrollTop` and return `true`.
- **FR-004**: System MUST wire active editor textarea references from `BilingualEditor.tsx` to `UnifiedAuditPanel.tsx` based on the currently viewed stage (`activeStage: 'raw' | 'polished'`).
- **FR-005**: In `UnifiedAuditPanel.tsx`, clicking an issue card containing `targetText` MUST invoke `scrollAndSelectInTextarea` on the active editor textarea.
- **FR-006**: When `scrollAndSelectInTextarea` returns `false` on an issue with `targetText`, the system MUST display a non-blocking toast notification: *"Không tìm thấy đoạn văn này trong bản dịch hiện tại, có thể nội dung đã được sửa"*.
- **FR-007**: System MUST NOT alter editor semantics (remains pure `<textarea>`, without introducing `contentEditable`, canvas measurement packages, or rich-text overlays).

### Key Entities

- **TextareaHighlightUtility**: Standalone DOM helper calculating string offsets, line-height geometry, and executing scroll & selection.
- **ActiveTextareaRef**: React reference pointing to the currently visible editor textarea (`raw` vs `polished`).
- **TargetTextExcerpt**: Substring identifier provided by `UnifiedAuditIssue` representing the offending passage in the translation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of issue cards with matching target excerpts scroll to and highlight the exact text range within 50ms of user click.
- **SC-002**: 100% of non-matching or edited excerpts display non-blocking feedback without console errors, crashes, or unintended scrolling.
- **SC-003**: Zero external dependencies added to `package.json` for text geometry or selection.
- **SC-004**: Unit tests covering both matched selection and unmatched fallback scenarios pass with 100% reliability in test suite.
- **SC-005**: All quality gates pass cleanly (`npm run lint`, `npm test`, `npm run build`).

## Assumptions

- Textarea uses standard monospace or sans-serif styling with consistent line-height configured in Tailwind classes.
- Selection styling uses the browser/OS default text selection highlight.
- Quality issues reported by Hako and QA Critique relate to translated text (raw or polished), matching the active editing stage in `BilingualEditor`.

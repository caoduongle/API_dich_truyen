# Feature Specification: Workspace Audit Scanners & QA Critique Decoupling

**Feature Branch**: `101-workspace-audit-scanners`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: src/components/translator-workspace/useWorkspaceState.ts, hàm handlePolishTranslation() (khoảng dòng 682-705), sau khi Polish xong, NẾU enableAiQaCritique đang bật thì TỰ ĐỘNG gọi qaCritiqueDirect() ngay lập tức. Quyết định UX đã chốt: BỎ hành vi tự động này, thay bằng 1 nút bấm thủ công trong panel kiểm định (panel sẽ được xây ở Prompt B3). Nhiệm vụ: 1. Xóa đoạn code tự động gọi qaCritiqueDirect() bên trong handlePolishTranslation (đoạn gắn với điều kiện enableAiQaCritique). Toggle enableAiQaCritique có thể giữ lại nếu nó còn dùng cho mục đích khác (kiểm tra trước khi xóa hẳn state này — nếu chỉ dùng riêng cho auto-trigger thì có thể bỏ luôn, nếu dùng chỗ khác thì giữ state nhưng bỏ nhánh gọi tự động). 2. Thêm 1 hàm mới, tách biệt, ví dụ handleRunAiQaCritique(): gọi qaCritiqueDirect() với sourceText và polishedTranslation hiện tại (y hệt tham số cũ đã dùng trong nhánh tự động vừa xóa), set state loading riêng (ví dụ isCheckingQa đã có sẵn), set kết quả vào qaIssues đã có sẵn. Hàm này được export ra khỏi hook để component panel gọi khi người dùng bấm nút. 3. Thêm 1 hàm mới handleRunHakoScan(): gọi runHeuristicQualityScan (import từ src/services/hakoQualityEngine.ts) với {chapterId, title, chapterNumber, vietnameseContent: polishedTranslation} của chương đang mở. Hàm này CHẠY TỨC THÌ, không cần API key, có thể tự chạy mỗi khi polishedTranslation đổi (debounce nhẹ ví dụ 500ms) HOẶC chỉ chạy khi người dùng bấm nút — chọn phương án tự động chạy khi nội dung đổi (debounce) vì đây là kiểm tra rule-based không tốn chi phí, khác với AI QA. Lưu kết quả vào 1 state mới, ví dụ hakoIssues. 4. Export cả 2 state mới (hakoIssues) và 2 hàm mới (handleRunAiQaCritique, handleRunHakoScan) ra khỏi object trả về của useWorkspaceState. Ràng buộc: CHỈ sửa src/components/translator-workspace/useWorkspaceState.ts. KHÔNG đổi UI ở prompt này (không đụng QaCritiquePanel.tsx/BilingualEditor.tsx). Đọc kỹ toàn bộ handlePolishTranslation hiện tại trước khi sửa. Không đổi cơ chế CRDT. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Viết unit test cho handleRunAiQaCritique và handleRunHakoScan."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Decouple Auto QA Critique from Polish Translation (Priority: P1)

As a translator using the workspace,
I want the Polish Translation action to complete immediately without triggering an automatic AI QA critique call,
So that I do not incur unwanted API quota costs or experience unexpected background latency when I just want to inspect the polished text.

**Why this priority**:
Automatic critique execution after every polish call wastes API requests and key quota, while surprising users who have not explicitly requested a quality audit.

**Independent Test**:
Can be verified by executing `handlePolishTranslation()` and confirming that `qaCritiqueDirect()` is NOT called automatically, regardless of `enableAiQaCritique`.

**Acceptance Scenarios**:
1. **Given** `enableAiQaCritique` is `true`, **When** `handlePolishTranslation()` finishes generating polished text, **Then** `qaCritiqueDirect()` is NOT invoked, and `isCheckingQa` remains `false`.
2. **Given** Polish translation completes, **When** reviewing notifications, **Then** toast notifications specific to AI QA Critique are not displayed as part of the polish step.

---

### User Story 2 - Explicit Manual AI QA Critique Action (Priority: P1)

As a translation reviewer or editor,
I want an explicit action `handleRunAiQaCritique()` that I can trigger on demand,
So that the AI quality critique evaluates the current source and polished translation only when I intentionally click the audit button.

**Why this priority**:
Empowers users to control AI API token consumption and audit timing.

**Independent Test**:
Can be verified by invoking `handleRunAiQaCritique()` directly:
- `isCheckingQa` toggles to `true` during the call and reverts to `false` in `finally`.
- `qaCritiqueDirect()` is called with `{ sourceText, translatedText: polishedTranslation, apiKeys, model: selectedModel }`.
- Returned issues populate the `qaIssues` state (`DirectQaCritiqueIssue[]`).

**Acceptance Scenarios**:
1. **Given** the workspace contains `sourceText` and `polishedTranslation`, **When** `handleRunAiQaCritique()` is called, **Then** `isCheckingQa` is set to `true`, `qaIssues` is cleared, and `qaCritiqueDirect` is executed.
2. **Given** `qaCritiqueDirect` returns issues, **When** execution resolves, **Then** `qaIssues` updates with the returned defect array and a summary toast is displayed.
3. **Given** `qaCritiqueDirect` throws an error, **When** caught, **Then** error is logged, `isCheckingQa` returns to `false`, and no unhandled promise rejection crashes the workspace.

---

### User Story 3 - Debounced Real-Time Heuristic Quality Scan (Priority: P1)

As a translator editing a chapter,
I want heuristic quality checks (raw Chinese leaks, repetition, placeholder markers) to run automatically in the background when polished text changes,
So that I get instant, zero-cost feedback on formatting and copy-paste errors without pressing any buttons or calling external APIs.

**Why this priority**:
Heuristic scans in `hakoQualityEngine.ts` are local synchronous CPU-bound operations costing 0 API tokens and running in <5ms. Running them with a gentle debounce (e.g. 500ms) provides real-time linting as the user types or translates.

**Independent Test**:
Can be tested by updating `polishedTranslation`:
- `runHeuristicQualityScan()` executes after debounce timeout.
- Detected issues are saved in `hakoIssues` (`QualityIssue[]`).
- `handleRunHakoScan()` can also be invoked manually on demand.

**Acceptance Scenarios**:
1. **Given** `polishedTranslation` contains un-translated Chinese characters or repeated paragraphs, **When** `handleRunHakoScan()` is invoked or after debounce delay, **Then** `hakoIssues` contains the corresponding `QualityIssue` items.
2. **Given** `polishedTranslation` is empty, **When** heuristic scan runs, **Then** `hakoIssues` is an empty array `[]`.

---

### Edge Cases

- **Triggering QA critique when polished text is empty**: `handleRunAiQaCritique` displays an advisory warning toast ("Chưa có bản dịch hoàn thiện để kiểm định") and returns early without invoking the API.
- **Switching chapters while a scan is pending**: The debounce timer is cleared on unmount or when `currentChapterId` changes.
- **Rapid text changes**: Consecutive edits reset the 500ms debounce timer so `runHeuristicQualityScan` only fires once after editing pauses.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove the automatic invocation of `qaCritiqueDirect()` from `handlePolishTranslation()` in `src/components/translator-workspace/useWorkspaceState.ts`.
- **FR-002**: System MUST preserve all non-QA logic in `handlePolishTranslation()` (including term extraction, project glossary updates, error handling, and polish completion toast).
- **FR-003**: System MUST implement and export `handleRunAiQaCritique()` in `useWorkspaceState.ts`, invoking `qaCritiqueDirect` with `{ sourceText, translatedText: polishedTranslation, apiKeys, model: selectedModel, startKeyIndex }` and updating `isCheckingQa` and `qaIssues`.
- **FR-004**: System MUST implement and export `hakoIssues` state (`QualityIssue[]`) and `handleRunHakoScan()` in `useWorkspaceState.ts`, which calls `runHeuristicQualityScan({ chapterId, title, chapterNumber, vietnameseContent: polishedTranslation })`.
- **FR-005**: System MUST automatically trigger `handleRunHakoScan()` with a debounce delay (e.g. 500ms) whenever `polishedTranslation` changes.
- **FR-006**: System MUST NOT modify any UI components (`QaCritiquePanel.tsx`, `BilingualEditor.tsx`, `TranslatorWorkspace.tsx`) in this feature; changes MUST be strictly confined to `useWorkspaceState.ts` and its test suite.
- **FR-007**: CRDT synchronization (`crdt.updatePolishedTranslation`, `handlePolishedTranslationChange`) MUST remain intact and unaffected.

### Key Entities

- **hakoIssues**: `QualityIssue[]` storing defects identified by heuristic rules on the current polished translation.
- **qaIssues**: `DirectQaCritiqueIssue[]` storing defects returned by Gemini QA Critique.
- **handleRunAiQaCritique**: Async callback function to initiate on-demand AI review.
- **handleRunHakoScan**: Callback function to execute instant rule-based scan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 automatic calls to `qaCritiqueDirect()` occur when executing `handlePolishTranslation()`.
- **SC-002**: 100% of calls to `handleRunAiQaCritique()` correctly manage `isCheckingQa` (true while active, false upon completion/error).
- **SC-003**: `runHeuristicQualityScan()` automatically triggers within 500ms after `polishedTranslation` modifications.
- **SC-004**: 100% pass rate in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts` with dedicated tests for `handleRunAiQaCritique`, `handleRunHakoScan`, and decoupled polish translation.
- **SC-005**: Multi-gate verification (`npm run lint`, `npm test`, `npm run build`) passes cleanly with 0 errors.

## Assumptions

- `runHeuristicQualityScan` is imported from `src/services/hakoQualityEngine.ts`.
- `QualityIssue` is imported from `src/types/hakoChecker.ts`.
- `DirectQaCritiqueIssue` is imported from `src/services/directTranslationEngine.ts`.
- The UI hook consumers (`TranslatorWorkspace.tsx`) will be wired in Prompt B3 without breaking backward compatibility now since new exports are additive.

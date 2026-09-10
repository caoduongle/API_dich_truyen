# Feature Specification: Unified Audit Panel for Translator Workspace

**Feature Branch**: `102-unified-audit-panel`  
**Created**: 2026-09-10  
**Status**: Draft  
**Input**: User description: "Bối cảnh: src/components/translator-workspace/QaCritiquePanel.tsx hiện là 1 component đơn giản (chỉ hiển thị cảnh báo mismatch + danh sách phẳng qaIssues, không có tương tác, không filter, không nút xác nhận/bỏ qua). Sau Prompt B0-B2, đã có: type UnifiedAuditIssue + adapter (B1), state hakoIssues/qaIssues và 2 hàm trigger thủ công handleRunHakoScan/handleRunAiQaCritique (B2). Giờ cần gộp UI thành 1 panel duy nhất. Nhiệm vụ: 1. Tạo component mới src/components/translator-workspace/UnifiedAuditPanel.tsx thay thế QaCritiquePanel.tsx. Props nhận vào: hakoIssues, qaIssues (dùng mapHakoIssueToUnified/mapQaIssueToUnified từ auditBridgeService để gộp thành 1 mảng UnifiedAuditIssue[] ngay trong component, hoặc nhận sẵn mảng đã gộp — tự quyết định chỗ gộp hợp lý hơn giữa component này và useWorkspaceState, miễn nhất quán), isCheckingQa, onRunAiQaCritique (gọi handleRunAiQaCritique), và các callback cho hành động trên từng issue (sẽ thêm đầy đủ ở Prompt B5, ở đây tạm thời chỉ cần onIssueClick(issue) cho việc click chọn issue). 2. UI gồm: (a) nút "Chạy AI Thẩm định" (dùng component Button variant="primary" có sẵn, hiện trạng thái loading khi isCheckingQa=true) — đây LÀ nút thay thế hoàn toàn cho auto-trigger cũ; (b) tab lọc "Tất cả / Quy chuẩn Hako (X) / Góp ý AI (Y) / Chưa xử lý" tương tự pattern tab đã dùng ở HakoIssueReviewPanel.tsx (tham khảo cách file đó làm tabs, giữ nhất quán); (c) danh sách issue dạng card gọn (không cần đầy đủ như HakoIssueCard.tsx của module batch, panel này nằm trong sidebar hẹp của Bàn Dịch nên cần compact hơn) — mỗi card hiện severity bằng Badge (tone neutral/warning/danger theo bảng token đã có, error→danger, warning→warning, info→neutral), title, message, và nếu có targetText thì hiện đoạn trích rút gọn. 3. Dùng đúng 3 trạng thái bắt buộc theo design-system.md cho danh sách: Loading (dùng Skeleton có sẵn khi isCheckingQa), Empty (dùng EmptyState có sẵn khi không có issue nào, kèm hành động rõ ràng ví dụ nút "Chạy AI Thẩm định" ngay trong EmptyState), Error (nếu qaCritiqueDirect lỗi, hiện thông báo cụ thể + nút thử lại, không chỉ "Đã có lỗi xảy ra"). 4. Cập nhật src/components/translator-workspace/BilingualEditor.tsx: đổi import từ QaCritiquePanel sang UnifiedAuditPanel, cập nhật props truyền xuống cho khớp. 5. Cập nhật src/components/TranslatorWorkspace.tsx nếu nó cũng truyền prop liên quan xuống BilingualEditor cho panel này (kiểm tra trước khi sửa, chỉ đổi đúng phần liên quan tới qaIssues/UnifiedAuditPanel). 6. XÓA file QaCritiquePanel.tsx sau khi đã chuyển hết chức năng, không để file thừa không dùng trong repo. Ràng buộc: Đây là component UI — BẮT BUỘC đọc .agents/rules/design-system.md trước khi viết: dùng Button/Badge/EmptyState/Skeleton có sẵn, không tự vẽ mới; bo góc rounded-[2px]/rounded-md; không gradient nhiều màu; không emoji; z-index nếu cần chỉ dùng đúng thang đã định nghĩa. CHỈ sửa/tạo: UnifiedAuditPanel.tsx (mới), xóa QaCritiquePanel.tsx, BilingualEditor.tsx, TranslatorWorkspace.tsx. KHÔNG đụng useWorkspaceState.ts thêm nữa trừ khi phát hiện thiếu 1 giá trị trả về cần thiết đã bỏ sót ở Prompt B2. Chưa cần làm chức năng click-để-highlight hay 1-click-fix ở prompt này — onIssueClick ở bước này chỉ cần console.log hoặc để trống thân hàm. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Không còn file nào import QaCritiquePanel trong toàn repo. Ảnh chụp màn hình cả 3 trạng thái Loading/Empty/Error của panel mới."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified Quality Audit Overview & On-Demand AI Critique (Priority: P1)

As a translator or editor working in the Translator Workspace,  
I want a consolidated quality audit panel (`UnifiedAuditPanel`) that brings together both rule-based Hako heuristic defects and AI QA Critique suggestions in one unified interface,  
So that I have a single, coherent place to monitor translation fidelity, formatting flaws, and semantic critique without navigating between fragmented components.

**Why this priority**:  
Previously, heuristic checks and AI critique operated in disparate states with `QaCritiquePanel` being a static, non-interactive warning banner. Unifying them provides immediate insight into chapter quality with manual control over AI token expenditure.

**Independent Test**:  
Can be verified by mounting `UnifiedAuditPanel` within `BilingualEditor` and verifying that both `hakoIssues` and `qaIssues` are mapped into a single unified issue list and rendered with the primary "Chạy AI Thẩm định" action.

**Acceptance Scenarios**:
1. **Given** the translator is editing a chapter with polished text, **When** opening the workspace display panel, **Then** `UnifiedAuditPanel` renders with a header containing a seal character ("評" or "審"), issue counter summary, and the "Chạy AI Thẩm định" button.
2. **Given** the translator clicks "Chạy AI Thẩm định", **When** `isCheckingQa` becomes `true`, **Then** the button shows a loading state (`disabled`, loading spinner), and the issue list transitions into the loading skeleton state.
3. **Given** paragraph count mismatch between raw source and translated text, **When** viewing the panel, **Then** an amber warning alert is displayed detailing source and translation paragraph counts.

---

### User Story 2 - Multi-Category Filter Tabs (Priority: P1)

As an editor reviewing audit issues in a busy workspace,  
I want filter tabs ("Tất cả", "Quy chuẩn Hako", "Góp ý AI", "Chưa xử lý") with live counter badges,  
So that I can quickly narrow down the list to rule violations, AI linguistic suggestions, or unresolved items without visual clutter.

**Why this priority**:  
A typical chapter may produce dozens of heuristic notices and AI suggestions. Filter tabs allow focused, incremental resolution of specific types of flaws.

**Independent Test**:  
Can be verified by toggling each filter tab and confirming that only matching issues are displayed, with tab count badges accurately reflecting the quantity of issues in each subset.

**Acceptance Scenarios**:
1. **Given** both Hako heuristic issues and AI critique issues exist, **When** clicking the "Quy chuẩn Hako (X)" tab, **Then** only issues with `source === 'hako_rule'` are rendered in the list.
2. **Given** AI critique issues exist, **When** clicking "Góp ý AI (Y)", **Then** only issues with `source === 'ai_critique'` are shown.
3. **Given** issues with status `'pending'` exist, **When** clicking "Chưa xử lý (Z)", **Then** only unresolved items are displayed.
4. **Given** the "Tất cả" tab is active, **When** viewing the list, **Then** all issues from all sources are displayed.

---

### User Story 3 - Compact Workspace Issue Cards (Priority: P1)

As a translator operating within the compact sidebar of the workspace,  
I want issue cards styled specifically for dense layout constraints,  
So that each issue clearly conveys severity (`danger`, `warning`, `neutral`), source, title, explanation message, and optional target text excerpt without dominating screen real estate.

**Why this priority**:  
Unlike the full-screen batch review panel (`HakoIssueReviewPanel`), the workspace audit panel lives in the inline workspace editor sidebar and must be compact, legible, and non-intrusive.

**Independent Test**:  
Can be verified by inspecting card elements:
- Severity is displayed with design system `Badge` (`error` → `tone="danger"`, `warning` → `tone="warning"`, `info` → `tone="neutral"`).
- Card displays issue title, message, and quoted `targetText` (if present).
- Clicking a card triggers `onIssueClick(issue)`.

**Acceptance Scenarios**:
1. **Given** an issue with severity `'error'`, **When** rendered in the card, **Then** it displays a `Badge` with `tone="danger"` and text "Lỗi".
2. **Given** an issue with severity `'warning'`, **When** rendered, **Then** it displays a `Badge` with `tone="warning"` and text "Cảnh báo".
3. **Given** an issue with severity `'info'`, **When** rendered, **Then** it displays a `Badge` with `tone="neutral"` and text "Thông tin".
4. **Given** an issue contains `targetText`, **When** rendered, **Then** the target snippet is displayed in a subtle excerpt box.
5. **Given** the user clicks an issue card, **When** clicked, **Then** `onIssueClick(issue)` callback is fired.

---

### User Story 4 - 3 Mandatory UX States & Graceful Error Recovery (Priority: P1)

As a user interacting with the quality panel,  
I want consistent Loading, Empty, and Error states adhering to the "Mực & Chu Sa" design system,  
So that I always know the system status and have a clear, actionable path forward in every condition.

**Why this priority**:  
Mandatory per `.agents/rules/design-system.md` and Constitution Principle I. A panel with blank loading screens or generic error messages violates UX standards.

**Independent Test**:  
Can be tested across all 3 conditions:
- Loading: Renders `Skeleton` components during `isCheckingQa=true`.
- Empty: Renders `EmptyState` when 0 issues are found, with a "Chạy AI Thẩm định" CTA button.
- Error: Renders an error banner with specific error details and a "Thử lại" button when an audit failure occurs.

**Acceptance Scenarios**:
1. **Given** `isCheckingQa` is `true`, **When** rendering the issue list, **Then** 3 compact `Skeleton` card items are displayed with animated pulsing.
2. **Given** 0 issues are found after scan, **When** viewing the panel, **Then** `EmptyState` is displayed with message "Bản dịch hiện không có vấn đề chất lượng nào" and a CTA button "Chạy AI Thẩm định".
3. **Given** `qaCritiqueDirect` fails with an error (e.g. quota exhausted or network failure), **When** `qaError` is provided, **Then** a danger-toned error box is rendered with the error message and a "Thử lại" button that invokes `onRunAiQaCritique`.

---

### Edge Cases

- **Zero issues from both sources**: Displays `EmptyState` with positive feedback and a CTA button to trigger AI review.
- **AI QA Critique returns 0 issues while Hako has 2 issues**: Total count is 2; "Góp ý AI" tab shows (0); "Quy chuẩn Hako" tab shows (2).
- **Extremely long targetText snippet**: Snippet is capped with CSS line-clamp (max 2 lines) or ellipsis to prevent vertical blowout in the sidebar.
- **Empty polished translation**: The "Chạy AI Thẩm định" button remains disabled or triggers warning toast via existing handler.
- **Component unmount / tab switch during AI check**: Safely clears loading state without memory leaks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create `src/components/translator-workspace/UnifiedAuditPanel.tsx` replacing `QaCritiquePanel.tsx`.
- **FR-002**: `UnifiedAuditPanel` MUST accept `hakoIssues` (`QualityIssue[]`), `qaIssues` (`DirectQaCritiqueIssue[]`), `isCheckingQa` (`boolean`), `onRunAiQaCritique` (`() => void`), `onIssueClick` (`(issue: UnifiedAuditIssue) => void`), `isMismatch` (`boolean`), `sourceParaCount` (`number`), `translationParaCount` (`number`), and optional `qaError` (`string | null`).
- **FR-003**: `UnifiedAuditPanel` MUST convert `hakoIssues` and `qaIssues` into a unified list of `UnifiedAuditIssue[]` using `mapHakoIssueToUnified` and `mapQaIssueToUnified` from `src/services/auditBridgeService.ts`.
- **FR-004**: `UnifiedAuditPanel` MUST render an interactive tab bar supporting 4 filter modes: "Tất cả", "Quy chuẩn Hako", "Góp ý AI", "Chưa xử lý" with dynamic counts.
- **FR-005**: `UnifiedAuditPanel` MUST render compact cards for filtered issues, displaying severity Badge (`danger`, `warning`, `neutral`), title, explanation message, source badge/tag, and optional targetText snippet.
- **FR-006**: `UnifiedAuditPanel` MUST implement the 3 mandatory UX states:
  - **Loading**: Render `Skeleton` cards when `isCheckingQa` is `true`.
  - **Empty**: Render `EmptyState` when the active tab contains 0 issues, with a clear CTA button.
  - **Error**: Render error alert with specific message and "Thử lại" button if `qaError` is present.
- **FR-007**: System MUST update `src/components/translator-workspace/BilingualEditor.tsx` to import and render `UnifiedAuditPanel` instead of `QaCritiquePanel`.
- **FR-008**: System MUST update `src/components/TranslatorWorkspace.tsx` to pass `hakoIssues`, `qaIssues`, `isCheckingQa`, and `onRunAiQaCritique` (bound to `handleRunAiQaCritique`) into `BilingualEditor`.
- **FR-009**: System MUST permanently delete `src/components/translator-workspace/QaCritiquePanel.tsx` and ensure zero lingering imports exist across the repository.
- **FR-010**: All UI styling MUST strictly comply with `.agents/rules/design-system.md` (Ink & Cinnabar tokens: `bg-ink`, `bg-parchment`, `border-parchment-2`, `text-text-main`, `text-text-muted`, `text-polish`; `rounded-[2px]` / `rounded-md`; no platform emojis; no multi-color gradients; no new npm dependencies).

### Key Entities

- **UnifiedAuditPanel**: Top-level UI component in the workspace sidebar consolidating all audit and critique results.
- **UnifiedAuditIssue**: Normalized data model representing both heuristic and AI-detected flaws.
- **FilterTabs**: `'all' | 'hako_rule' | 'ai_critique' | 'pending'`.
- **AuditActions**: "Chạy AI Thẩm định", "Thử lại", and issue card selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of references to `QaCritiquePanel` are replaced; `QaCritiquePanel.tsx` is deleted and `grep -rn "QaCritiquePanel" src/` returns 0 results.
- **SC-002**: All 4 filter tabs correctly filter issues and display accurate numerical counters matching the active chapter data.
- **SC-003**: The "Chạy AI Thẩm định" button correctly triggers `handleRunAiQaCritique()` and reflects `isCheckingQa` loading state.
- **SC-004**: All 3 mandatory UX states (Loading via `Skeleton`, Empty via `EmptyState`, Error with retry) render correctly and cleanly under their respective conditions.
- **SC-005**: All quality gates pass with zero regressions:
  - `npm run lint` (`tsc --noEmit`) passes with 0 errors.
  - `npm test` (`vitest run`) passes 100% of tests.
  - `npm run build` passes cleanly.

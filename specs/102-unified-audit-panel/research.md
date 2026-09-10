# Research: Unified Audit Panel for Translator Workspace

**Feature Branch**: `102-unified-audit-panel`  
**Date**: 2026-09-10  
**Status**: Completed

## Executive Summary

Feature 102 consolidates rule-based heuristic issues (`hakoIssues`) and AI linguistic critique issues (`qaIssues`) into a single, cohesive, interactive workspace panel: `UnifiedAuditPanel.tsx`. It replaces the legacy, non-interactive `QaCritiquePanel.tsx`, introduces an explicit on-demand "Chạy AI Thẩm định" action button (replacing the previous auto-trigger), provides 4 filter tabs, delivers compact sidebar cards with standard severity tokens, and enforces the 3 mandatory UX states (Loading, Empty, Error) in accordance with `.agents/rules/design-system.md`.

---

## Key Technical Decisions

### Decision 1: Placement of Unified Mapping (`auditBridgeService`)

- **Context**: The user prompt allows mapping `hakoIssues` and `qaIssues` into `UnifiedAuditIssue[]` either inside `UnifiedAuditPanel` or in `useWorkspaceState`.
- **Decision**: Perform mapping **inside `UnifiedAuditPanel.tsx`** via `useMemo`.
- **Rationale**:
  1. The user rule explicitly instructs: *"KHÔNG đụng useWorkspaceState.ts thêm nữa trừ khi phát hiện thiếu 1 giá trị trả về cần thiết đã bỏ sót ở Prompt B2"*.
  2. `useWorkspaceState` already cleanly exposes `hakoIssues: QualityIssue[]` and `qaIssues: DirectQaCritiqueIssue[]`.
  3. `mapHakoIssueToUnified` and `mapQaIssueToUnified` from `src/services/auditBridgeService.ts` are pure, synchronous, sub-millisecond transformations. Wrapping them in `useMemo([hakoIssues, qaIssues])` avoids unnecessary hook re-renders and keeps the data bridge strictly bound to presentation concern.
- **Alternatives Considered**:
  - *Mapping in `useWorkspaceState`*: Rejected because it would require modifying `useWorkspaceState.ts` and updating existing hook tests unnecessarily, violating constraint boundaries.

---

### Decision 2: Tab Filtering Architecture & Dynamic Counts

- **Context**: The panel requires tabs for "Tất cả", "Quy chuẩn Hako (X)", "Góp ý AI (Y)", and "Chưa xử lý (Z)".
- **Decision**:
  - Model active tab as `'all' | 'hako_rule' | 'ai_critique' | 'pending'`.
  - Calculate dynamic count badges for each tab in an O(N) `useMemo` pass over `unifiedIssues`:
    - Total: `unifiedIssues.length`
    - Hako Rule: `unifiedIssues.filter(i => i.source === 'hako_rule').length`
    - AI Critique: `unifiedIssues.filter(i => i.source === 'ai_critique').length`
    - Pending: `unifiedIssues.filter(i => i.status === 'pending').length`
  - Style tab buttons using compact pill button styling matching `HakoIssueReviewPanel.tsx` and `BilingualEditor.tsx`:
    - Active: `bg-parchment-2 text-text-main shadow-xs font-bold border border-parchment-2`
    - Inactive: `text-text-muted hover:text-text-main hover:bg-parchment/40`
- **Rationale**: Provides instant visual feedback on where issues originate and how many remain unaddressed.

---

### Decision 3: Compact Issue Card Layout for Sidebar Space

- **Context**: `UnifiedAuditPanel` sits within the right pane/sidebar of `BilingualEditor` above or alongside the translation text. It must be compact and not push the editing fields out of view.
- **Decision**:
  - Container: `rounded-md border border-parchment-2 bg-ink/60 p-3 space-y-2.5 shadow-xs`.
  - Card Item: `rounded-[2px] border border-parchment-2 bg-parchment/60 p-2.5 space-y-1.5 hover:border-polish/40 transition-colors cursor-pointer`.
  - Severity Badge: Use design system primitive `<Badge tone={badgeTone}>`:
    - `error` → `tone="danger"`
    - `warning` → `tone="warning"`
    - `info` → `tone="neutral"`
  - Target Text Excerpt: When `targetText` is present, render a compact box with `font-mono text-[11px] text-text-muted bg-ink/80 border border-parchment-2 px-2 py-1 rounded-[2px] line-clamp-2`.
  - Action Click: `onClick={() => onIssueClick?.(issue)}` (stubbed for Prompt B4/B5).
- **Rationale**: Adheres to the "Mực & Chu Sa" design system (sharp `rounded-[2px]`, dark ink contrast, cinnabar accent, no emoji).

---

### Decision 4: Implementing the 3 Mandatory UX States

- **Context**: `.agents/rules/design-system.md` requires: *"Loading (dùng Skeleton có sẵn) · Empty (dùng EmptyState có sẵn, luôn kèm 1 hành động rõ ràng) · Error (thông báo cụ thể + nút thử lại, không chỉ 'Đã có lỗi xảy ra'). Thiếu 1 trong 3 trạng thái = chưa xong việc."*
- **Decision**:
  1. **Loading State**: When `isCheckingQa === true`:
     - Render 2-3 `Skeleton` elements (`src/components/common/Skeleton.tsx`) mimicking compact issue cards.
     - Also show a mini indicator in the header ("Đang thẩm định...") with `Loader2` spinning icon.
  2. **Empty State**: When `filteredIssues.length === 0`:
     - Render `<EmptyState>` (`src/components/ui/EmptyState.tsx`) with title "Không có vấn đề cần xử lý", description "Bản dịch hiện tại đã thỏa mãn các quy tắc chất lượng.", and an action button to "Chạy AI Thẩm định" if AI critique hasn't been run yet.
  3. **Error State**: When `qaError` is provided:
     - Render an error container (`border-polish/40 bg-polish/10 text-polish`) detailing the error message.
     - Include a `<Button variant="secondary" size="sm" onClick={onRunAiQaCritique}>Thử lại</Button>`.
  4. **Paragraph Mismatch Alert**:
     - Preserved when `isMismatch === true` (amber warning box displaying `sourceParaCount` vs `translationParaCount`).
- **Rationale**: Fully compliant with design system mandatory requirements and error recovery workflows.

---

### Decision 5: File Cleanup & Migration Path

- **Context**: Requirement 6 states: *"XÓA file QaCritiquePanel.tsx sau khi đã chuyển hết chức năng, không để file thừa không dùng trong repo."*
- **Decision**:
  1. Create `src/components/translator-workspace/UnifiedAuditPanel.tsx`.
  2. Update `src/components/translator-workspace/BilingualEditor.tsx` to import and render `UnifiedAuditPanel`.
  3. Update `src/components/TranslatorWorkspace.tsx` to pass `hakoIssues` and `onRunAiQaCritique`.
  4. Delete `src/components/translator-workspace/QaCritiquePanel.tsx`.
  5. Grep codebase for `QaCritiquePanel` to guarantee 0 references remain.
- **Rationale**: Prevents dead code or dual-panel maintenance overhead.

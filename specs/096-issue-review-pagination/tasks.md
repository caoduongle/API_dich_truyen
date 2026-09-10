# Tasks: Issue Review Panel Pagination

**Feature**: `096-issue-review-pagination`  
**Input**: Design documents from `specs/096-issue-review-pagination/`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/096-issue-review-pagination/spec.md) | **Plan**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/096-issue-review-pagination/plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify active feature directory configuration

- [x] T001 Verify active feature configuration in .specify/feature.json

---

## Phase 2: User Story 1 (P1) - Paginated Card List for High-Volume Issue Moderation 🎯 MVP

**Goal**: Display at most 20 `<HakoIssueCard>` instances per page with a bottom pagination navigation bar using the existing `Button` component, ensuring smooth scrolling without fixed-height virtual list assumptions.

**Independent Test**: Mount `HakoIssueReviewPanel` with 45 issues. Verify that Page 1 renders exactly 20 issues with "Trang 1/3", clicking "Trang sau" renders issues 21–40 ("Trang 2/3"), and clicking "Trang sau" renders issues 41–45 ("Trang 3/3") with "Trang sau" disabled.

### Implementation for User Story 1

- [x] T002 [US1] Add currentPage state and PAGE_SIZE = 20 constant in src/components/hako-checker/HakoIssueReviewPanel.tsx
- [x] T003 [US1] Slice displayedIssues from filteredIssues and render at most 20 cards per page in src/components/hako-checker/HakoIssueReviewPanel.tsx
- [x] T004 [US1] Render bottom pagination controls bar (Trang trước, Trang X/Y, Trang sau) using existing Button component when filteredIssues.length > 20 in src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Review panel displays at most 20 issues per page with functional navigation buttons.

---

## Phase 3: User Story 2 (P1) - Dynamic Filter and Mutation Page Clamping

**Goal**: Automatically reset or clamp `currentPage` to page 1 or `totalPages` whenever filter criteria change or the total issues count shrinks, avoiding empty pages.

**Independent Test**: Navigate to Page 3 of 3 (45 issues), apply a filter matching only 8 issues; verify `currentPage` resets to 1, all 8 issues are displayed, and pagination controls hide.

### Implementation for User Story 2

- [x] T005 [US2] Implement filter-change reset to page 1 and clamp currentPage when currentPage > totalPages in src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Filter changes immediately reset or clamp `currentPage` to a valid page.

---

## Phase 4: User Story 3 (P2) - Full-Scope Batch Action Preservation Verification

**Goal**: Ensure "Duyệt nhanh tất cả" and "Bỏ qua tất cả" continue to apply to ALL `filteredIssues`, regardless of which page the user is viewing.

**Independent Test**: On a 45-issue list across 3 pages, navigate to Page 2, click "Duyệt nhanh tất cả"; verify all 45 pending issues are processed in one batch.

### Implementation for User Story 3

- [x] T006 [US3] Verify handleBatchConfirm and handleBatchDismiss operate on complete filteredIssues array across all pages in src/components/hako-checker/HakoIssueReviewPanel.tsx

**Checkpoint**: Batch actions retain global filter scope across all pages.

---

## Phase 5: Polish & Quality Verification

**Purpose**: Verify all quality gates and constitutional constraints pass cleanly

- [x] T007 Run TypeScript type check via npm run lint to ensure zero type errors
- [x] T008 Run full unit test suite via npm test to ensure 100% test pass rate
- [x] T009 Run production build via npm run build to verify bundle compilation

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (US1)**: Prerequisite for all subsequent phases.
- **Phase 3 (US2)**: Depends on US1 state variables.
- **Phase 4 (US3)**: Verifies batch actions work concurrently with pagination.
- **Phase 5 (Polish)**: Runs after all implementation tasks.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (`T001`).
2. Complete Phase 2: Pagination state, slicing, and footer controls (`T002`, `T003`, `T004`).
3. Validate pagination with 45 simulated issues.

### Incremental Delivery
1. Complete Phase 3: Filter reset & clamping (`T005`).
2. Complete Phase 4: Batch action preservation check (`T006`).
3. Complete Phase 5: Quality gates (`T007`, `T008`, `T009`).

# Feature Specification: Issue Review Panel Pagination

**Feature Branch**: `096-issue-review-pagination`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Bối cảnh: src/components/hako-checker/HakoIssueReviewPanel.tsx hiện render filteredIssues.map() trực tiếp toàn bộ, mỗi phần tử là 1 <HakoIssueCard> (component 16KB, có textarea ghi chú, nhiều nút, có thể mở rộng nội dung). Với 1 lượt kiểm định 12 chương có thể ra 50-100+ issue, danh sách dài dễ giật khi cuộn trên máy yếu. QUAN TRỌNG — đọc kỹ trước khi chọn giải pháp: src/hooks/useVirtualList.ts (đang dùng cho HakoChapterSelector.tsx) CHỈ hỗ trợ item có CHIỀU CAO CỐ ĐỊNH (nhận 1 số itemHeight duy nhất, tính vị trí bằng translateY(index * itemHeight)). HakoIssueCard có chiều cao THAY ĐỔI tùy nội dung (có/không có rawSnippet, đang mở textarea ghi chú hay không, độ dài text khác nhau). Áp dụng thẳng useVirtualList vào danh sách issue SẼ GÂY CHỒNG LẤN/SAI VỊ TRÍ CARD vì giả định sai về chiều cao. KHÔNG được tái sử dụng useVirtualList cho việc này. Nhiệm vụ: thay vì virtualization, dùng PHÂN TRANG (đơn giản, an toàn với chiều cao biến đổi): 1. Thêm state currentPage trong HakoIssueReviewPanel.tsx, hiển thị tối đa 20 issue/trang (đúng theo filteredIssues sau khi lọc theo tab hiện tại). 2. Thêm thanh điều hướng trang ở cuối danh sách (nút 'Trang trước'/'Trang sau' + hiển thị 'Trang X/Y', dùng component Button có sẵn trong src/components/ui/Button.tsx, không tự vẽ nút mới). 3. Khi đổi tab lọc (Tất cả/Hako/AI QA/Chưa xử lý) hoặc khi danh sách issue thay đổi (ví dụ sau khi duyệt/bỏ qua làm số lượng giảm), reset currentPage về 1 nếu trang hiện tại vượt quá số trang mới. 4. Chỉ áp dụng phân trang khi filteredIssues.length > 20 — nếu ít hơn, hiển thị hết như hiện tại, không cần thanh điều hướng. Ràng buộc: Chỉ được sửa: src/components/hako-checker/HakoIssueReviewPanel.tsx. Không đổi HakoIssueCard.tsx, không đổi cách hoạt động 'Duyệt nhanh tất cả'/'Bỏ qua tất cả' (áp dụng cho TOÀN BỘ filteredIssues đang lọc, không chỉ trang hiện tại — giữ đúng hành vi cũ). Tuân thủ .agents/rules/design-system.md: bo góc rounded-[2px]/rounded-md, không dùng rounded-full trừ khi là hình tròn thật, không thêm màu mới ngoài token đã có. Tiêu chí hoàn thành: npm run lint, npm test, npm run build đều sạch/pass. Test thủ công: danh sách 45 issue giả lập hiển thị đúng 3 trang (20/20/5), chuyển trang mượt, không mất trạng thái decision đã chọn ở trang khác khi quay lại."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smooth Pagination for High-Volume Issue Moderation (Priority: P1)

As a moderator reviewing a multi-chapter quality check that generated 50–100+ findings, I want the review panel to display at most 20 issues per page with pagination controls at the bottom, so that scrolling remains butter-smooth even on low-spec hardware without browser lagging caused by rendering dozens of heavy, variable-height cards simultaneously.

**Why this priority**: Rendering 50–100+ heavy `HakoIssueCard` components (each containing expandable text, note textareas, and multiple interactive buttons) in a single unpaginated DOM tree degrades frame rate and creates significant scroll jank.

**Independent Test**: Mount `HakoIssueReviewPanel` with 45 issues. Verify that Page 1 displays exactly issues 1–20, the pagination bar displays "Trang 1/3" with "Trang trước" disabled, clicking "Trang sau" displays issues 21–40 ("Trang 2/3"), and clicking "Trang sau" again displays issues 41–45 ("Trang 3/3") with "Trang sau" disabled.

**Acceptance Scenarios**:

1. **Given** 45 filtered issues, **When** the moderator views the review panel, **Then** only the first 20 issue cards are rendered in the DOM, and a pagination bar at the bottom displays "Trang 1/3" with "Trang trước" disabled and "Trang sau" enabled.
2. **Given** the moderator is on Page 1 of 3, **When** they click "Trang sau", **Then** the panel renders issues 21 through 40 and the indicator displays "Trang 2/3" with both navigation buttons enabled.
3. **Given** the moderator is on Page 2 of 3, **When** they click "Trang sau", **Then** the panel renders issues 41 through 45 and the indicator displays "Trang 3/3" with "Trang sau" disabled.
4. **Given** the moderator is on Page 3, **When** they click "Trang trước", **Then** the panel smoothly returns to Page 2.

---

### User Story 2 - Dynamic Filter and Mutation Page Clamping (Priority: P1)

As a moderator adjusting filters (severity, category, status, or chapter) or reviewing issues, I want `currentPage` to automatically reset or clamp whenever the filtered count changes so that I never get stranded on an empty page (e.g. Page 4 of a 1-page result).

**Why this priority**: When a user filters from 60 issues down to 5 issues while on Page 3, without automatic page clamping the list would display an empty page with Page 3/1, confusing the user and requiring manual back-navigation.

**Independent Test**: On a list of 45 issues, navigate to Page 3. Select a filter that matches only 8 issues (1 page). Verify that the panel immediately displays Page 1 with the 8 matching issues and hides the pagination bar.

**Acceptance Scenarios**:

1. **Given** the user is on Page 3 of 3 (45 issues), **When** they apply a filter that reduces matching issues to 15, **Then** `currentPage` resets to 1, all 15 issues are displayed, and the pagination controls are hidden.
2. **Given** the user is on Page 3 of 3 (45 issues), **When** they apply a filter matching 30 issues (2 pages), **Then** `currentPage` clamps to 2 (or resets to 1), displaying valid results without an empty view.
3. **Given** `filteredIssues.length <= 20`, **When** the panel renders, **Then** all matching issues are displayed directly and the pagination bar is not rendered.

---

### User Story 3 - Full-Scope Batch Action Preservation (Priority: P2)

As a moderator using "Duyệt nhanh tất cả" (Confirm All) or "Bỏ qua tất cả" (Dismiss All), I want batch actions to continue applying to ALL currently filtered issues across all pages, rather than only the issues visible on the active page, so that bulk moderation remains fast and complete.

**Why this priority**: Users expect "Duyệt nhanh tất cả" under an active filter (e.g. "Cảnh báo" or "Chương 2") to confirm all matching issues in that filter, regardless of which page of pagination they happen to be viewing.

**Independent Test**: Load 45 pending issues across 3 pages. On Page 2, click "Duyệt nhanh tất cả". Verify that all 45 pending issues are confirmed in one batch call, not just the 20 on Page 2.

**Acceptance Scenarios**:

1. **Given** 45 pending issues across 3 pages, **When** the user clicks "Duyệt nhanh tất cả" while on Page 2, **Then** all 45 pending issues from `filteredIssues` are dispatched for batch confirmation.
2. **Given** all 45 pending issues are confirmed, **When** the filter is set to "Chờ duyệt", **Then** the list becomes empty, displaying the EmptyState cleanly.

---

### Edge Cases

- **Exactly 20 issues**: `filteredIssues.length === 20`, totalPages is 1. Since `length <= 20`, no pagination bar is rendered; all 20 issues are displayed on a single page.
- **21 issues**: `filteredIssues.length === 21`, totalPages is 2. Page 1 displays 20 issues, Page 2 displays 1 issue. Pagination bar is shown.
- **Zero matching issues**: `filteredIssues.length === 0`. The existing `EmptyState` component is rendered; no pagination bar is shown.
- **Card expansion & textarea interaction**: Because regular DOM layout with standard pagination is used (rather than fixed-height virtual translateY calculations), cards can expand to any variable height without collision, clipping, or overlapping.
- **Decision preservation**: When a user confirms an issue on Page 1, navigates to Page 2, and returns to Page 1, the card on Page 1 accurately displays its updated decision state because the underlying session state is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In `src/components/hako-checker/HakoIssueReviewPanel.tsx`, the component MUST maintain a `currentPage` state variable defaulting to `1`.
- **FR-002**: The component MUST define a page size constant of `20` (`PAGE_SIZE = 20`).
- **FR-003**: The component MUST slice `filteredIssues` to derive `displayedIssues`: from `(currentPage - 1) * PAGE_SIZE` to `currentPage * PAGE_SIZE`.
- **FR-004**: When `filteredIssues.length > PAGE_SIZE`, the component MUST render a pagination control bar at the bottom of the issues list.
- **FR-005**: The pagination bar MUST include:
  - "Trang trước" button using the existing `Button` component (`variant="secondary"`, `size="sm"`), disabled when `currentPage === 1`.
  - Page indicator text displaying `"Trang " + currentPage + "/" + totalPages`.
  - "Trang sau" button using the existing `Button` component (`variant="secondary"`, `size="sm"`), disabled when `currentPage === totalPages`.
- **FR-006**: When `filteredIssues.length <= PAGE_SIZE`, the component MUST NOT render the pagination control bar.
- **FR-007**: Whenever `filteredIssues` changes or filter selections change, if `currentPage > totalPages`, `currentPage` MUST be clamped/reset to `Math.max(1, totalPages)` or `1`.
- **FR-008**: `handleBatchConfirm` and `handleBatchDismiss` MUST continue to extract pending IDs from the entire `filteredIssues` list, NOT just `displayedIssues`.
- **FR-009**: The implementation MUST NOT use `useVirtualList` or any fixed-height virtual scrolling hook, guaranteeing full support for variable-height cards.
- **FR-010**: Only `src/components/hako-checker/HakoIssueReviewPanel.tsx` may be modified. No changes to `HakoIssueCard.tsx`.
- **FR-011**: All styling MUST adhere to `.agents/rules/design-system.md` (using existing design tokens `bg-parchment`, `text-text-main`, `text-text-muted`, `border-parchment-2`, `rounded-[2px]`/`rounded-md`, and no raw hex colors or `rounded-full`).

### Key Entities *(include if feature involves data)*

- **PaginationState**:
  - `currentPage`: 1-based index of the currently active page (integer $\ge 1$).
  - `PAGE_SIZE`: Fixed constant of 20 items per page.
  - `totalPages`: Calculated as `Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE))`.
  - `displayedIssues`: Sliced sub-array of `QualityIssue[]` rendered on the active page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any review batch with $> 20$ issues (e.g. 45 or 100+ issues), at most 20 `<HakoIssueCard>` DOM nodes are mounted at any given time, reducing DOM node count by up to 80% on 100-issue sessions.
- **SC-002**: Page navigation transitions occur instantaneously with zero scroll jank and zero layout distortion on variable-height cards.
- **SC-003**: 100% of batch actions continue to affect all matching filtered issues, retaining full consistency.
- **SC-004**: Quality verification passes with zero type errors (`npm run lint`), 100% test pass rate (`npm test`), and a successful production build (`npm run build`).

## Assumptions

- **Page Transition Scroll**: Resetting the page or navigating pages remains in-place within the view container, or smoothly scrolls to the top of the issues list container.
- **Button Component**: The existing `Button` component in `src/components/ui/Button.tsx` supports `disabled`, `variant="secondary"`, and `size="sm"`.

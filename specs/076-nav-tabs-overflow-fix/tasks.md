# Tasks: Sửa Lỗi Tràn & Hiển Thị Thanh Điều Hướng Tab Chính

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify navigation tab structure and setup baseline types.

- [X] T001 Verify all 6 tab identifiers (`tab-translate`, `tab-auto-translate`, `tab-glossary`, `tab-history`, `tab-projects`, `tab-hako-checker`) and shortcut bindings in `src/App.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hook for tracking horizontal scroll overflow and auto-scrolling active tab element.

- [X] T002 Implement custom hook `useScrollOverflow` in `src/hooks/useScrollOverflow.ts` with `canScrollLeft`, `canScrollRight`, `checkOverflow`, and `scrollToElement` methods with passive scroll/resize listeners
- [X] T003 [P] Add unit test suite in `src/hooks/__tests__/useScrollOverflow.test.ts` to test overflow detection logic and element scrolling

**Checkpoint**: Foundation ready — hook is tested and ready to integrate into navigation header.

---

## Phase 3: User Story 1 — Tự động cuộn tab kích hoạt vào vùng hiển thị (Priority: P1) 🎯 MVP

**Goal**: When switching tabs via mouse click or hotkeys (`Alt+1` to `Alt+6`), the activated tab element automatically scrolls into view if it was partially or fully hidden.

**Independent Test**: Resize browser window to laptop width (~1280px); press `Alt+6`; Tab 6 ("Kiểm Định Hako") smoothly scrolls into full view with active highlight.

### Implementation for User Story 1

- [X] T004 [US1] Attach `useScrollOverflow` ref to the tab container in `src/App.tsx` and trigger auto-scroll to `document.getElementById('tab-' + activeTab)` on `activeTab` changes
- [X] T005 [US1] Verify that hotkeys `Alt+1` through `Alt+6` and direct mouse clicks on all 6 tabs correctly invoke auto-scrolling

**Checkpoint**: US1 fully functional — Tab 6 is never hidden or unreachable when triggered.

---

## Phase 4: User Story 2 — Hiển thị chỉ báo thị giác khi dải tab bị tràn biên (Priority: P1)

**Goal**: Render subtle, elegant gradient fade overlays at the left and right edges of the scrolling tab strip when offscreen tabs exist.

**Independent Test**: On a narrower viewport, verify right edge shows `from-parchment to-transparent` fade overlay; scrolling right hides right overlay and shows left overlay.

### Implementation for User Story 2

- [X] T006 [US2] Add left and right fade overlay elements in `src/App.tsx` with `bg-gradient-to-r from-parchment to-transparent` (left) and `bg-gradient-to-l from-parchment to-transparent` (right), `pointer-events-none`, and `z-10`, conditionally rendered based on `canScrollLeft` and `canScrollRight`
- [X] T007 [US2] Verify that fade overlays do not block mouse clicks (`pointer-events-none`) and disappear on wide screens where no overflow exists

**Checkpoint**: US2 fully functional — users have intuitive visual affordance for scrollable tabs.

---

## Phase 5: User Story 3 — Tách biệt và bảo toàn khối thông tin bộ truyện hiện tại (Priority: P2)

**Goal**: Ensure `activeProject.title` is isolated on the right side with bounded width, ellipsis truncation, and tooltip, without competing with the tab scrolling container.

**Independent Test**: Load a project with a long title; verify title remains stationary on the right with ellipsis, while tab buttons scroll cleanly inside their allocated flex region.

### Implementation for User Story 3

- [X] T008 [US3] Restructure the nav bar container in `src/App.tsx` into a flex layout separating the scrollable tab region (`flex-1 min-w-0 relative`) and the static project title indicator (`shrink-0` with `max-w` and `truncate` with `title` tooltip)

**Checkpoint**: US3 fully functional — project title and tab navigation coexist harmoniously.

---

## Phase 6: Polish & Quality Gates

**Purpose**: Verification, test suite pass, and zero-regression quality gate checks.

- [X] T009 Run `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build` (`vite build + esbuild`) to verify all quality gates pass cleanly with 0 errors
- [X] T010 Execute end-to-end verification of Scenarios 1–4 from `specs/076-nav-tabs-overflow-fix/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1. T002 and T003 can run in parallel.
- **US1 (Phase 3)**: Depends on Phase 2. Integrates hook into `src/App.tsx`.
- **US2 (Phase 4)**: Depends on US1 (enhances visual feedback).
- **US3 (Phase 5)**: Depends on US1/US2 (polishes layout structure).
- **Polish (Phase 6)**: Runs after all user stories are complete.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 & 2 (Hook & Unit Test)
2. Complete Phase 3 (Auto-scroll wiring in `src/App.tsx`)
3. **STOP and VALIDATE**: Verify `Alt+6` auto-scrolls to Tab 6.
4. Complete Phase 4 (Fade overlays) & Phase 5 (Project title isolation).
5. Run Quality Gates (Phase 6).

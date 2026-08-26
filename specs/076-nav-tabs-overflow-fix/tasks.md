# Tasks: Kế Hoạch Giải Quyết Toàn Diện — Thanh Điều Hướng Tab Chính

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & CSS Utilities (Shared Infrastructure)

**Purpose**: Configure CSS utilities and navigation baseline classes.

- [X] T001 [P] Verify and update CSS utility classes in `src/index.css` for hidden scrollbar (`.scrollbar-none`) and smooth scroll behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hook enhancements for horizontal overflow detection, offset step scrolling, and active element auto-focus.

- [X] T002 Update `src/hooks/useScrollOverflow.ts` to provide `scrollByOffset`, `scrollLeftAction`, `scrollRightAction`, `scrollToElement`, and `calculateScrollOverflow` with passive scroll/resize listeners
- [X] T003 [P] Update unit test suite in `src/hooks/__tests__/useScrollOverflow.test.ts` covering offset scrolling calculations, boundaries, and element focus

**Checkpoint**: Foundation ready — hook is tested and ready to power Chevrons, Auto-scroll, and Gradient masks.

---

## Phase 3: User Story 1 — Container cuộn mượt mà, Nút Chevron & Auto-Scroll (Priority: P1) 🎯 MVP

**Goal**: Nav tabs container smoothly scrolls horizontally with visible `<` and `>` Chevron buttons at edges, gradient masks, and active tab auto-scrolling on click / `Alt+1..6`.

**Independent Test**: Resize browser to 1280px; click right Chevron button `>` to scroll 200px; press `Alt+6` to auto-scroll Tab 6 into full view.

### Implementation for User Story 1

- [X] T004 [US1] Add left and right Chevron buttons (`ChevronLeft`, `ChevronRight` from `lucide-react`) at `z-20` in `src/App.tsx`, wired to `scrollLeftAction` and `scrollRightAction`, conditionally rendered based on `canScrollLeft` and `canScrollRight`
- [X] T005 [US1] Add `shrink-0` (`flex-shrink: 0`) to all 6 tab buttons in `src/App.tsx` and ensure smooth auto-scroll on `activeTab` changes
- [X] T006 [US1] Position subtle Gradient Masks (`bg-gradient-to-r/l from-parchment to-transparent`) at `z-10` with `pointer-events-none` in `src/App.tsx`

**Checkpoint**: US1 fully functional — Chevrons, auto-scroll, and gradient masks work cohesively.

---

## Phase 4: User Story 2 — Tối ưu hóa mật độ hiển thị (Responsive Density) (Priority: P1)

**Goal**: Compact tab button padding, responsive `Kbd` shortcut badges (hidden < 1440px), hover tooltips, and isolated project title block.

**Independent Test**: View tabs at 1280px (< 1440px): `Kbd` badges are hidden, tab padding is compact (`px-2.5 sm:px-3 py-1.5 sm:py-2`), hover displays `title` tooltip with shortcut.

### Implementation for User Story 2

- [X] T007 [US2] Update padding of tab buttons in `src/App.tsx` to `px-2.5 sm:px-3 py-1.5 sm:py-2` and add hover `title` tooltip attributes containing label and hotkey for each tab
- [X] T008 [US2] Update `Kbd` shortcut badges in `src/App.tsx` to `hidden 2xl:inline-block text-[9px]` to hide gracefully on screens below 1440px
- [X] T009 [US2] Isolate `activeProject.title` in `src/App.tsx` in a static right-aligned flex block with `max-w-[160px] md:max-w-[220px] lg:max-w-[300px]`, `truncate`, and tooltip

**Checkpoint**: US2 fully functional — tab strip fits more items naturally and never cramps labels.

---

## Phase 5: User Story 3 — Menu xổ xuống "Thêm ▾" (More Dropdown Menu) dự phòng (Priority: P2)

**Goal**: Provide a fallback dropdown menu popover ("Thêm ▾" / `MoreHorizontal`) allowing instant 1-click navigation to any of the 6 tabs.

**Independent Test**: Click "Thêm ▾" button; popover menu opens with all 6 tabs and badges; click "Kiểm Tra Hako" to jump directly to Tab 6.

### Implementation for User Story 3

- [X] T010 [US3] Implement accessible More Dropdown menu popover in `src/App.tsx` with click-outside listener, `Escape` key close handler, and full listing of 6 tabs with icons, labels, badges, and hotkeys

**Checkpoint**: US3 fully functional — all tabs accessible in 1 click regardless of scroll position.

---

## Phase 6: Polish & Quality Gates

**Purpose**: Verification, test suite pass, and zero-regression quality gate checks.

- [X] T011 Run `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build` (`vite build + esbuild`) to verify all quality gates pass cleanly with 0 errors
- [X] T012 Execute end-to-end verification of Scenarios 1–5 from `specs/076-nav-tabs-overflow-fix/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1. T002 and T003 can run in parallel.
- **US1 (Phase 3)**: Depends on Phase 2. Implements Chevrons, auto-scroll, and masks.
- **US2 (Phase 4)**: Depends on US1. Enhances responsive density.
- **US3 (Phase 5)**: Depends on US1/US2. Adds fallback More dropdown menu.
- **Polish (Phase 6)**: Runs after all user stories are complete.

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1 & 2 (Hook with offset actions & unit tests).
2. Complete Phase 3 (Chevrons + auto-scroll + masks).
3. Complete Phase 4 (Responsive density & tooltips).
4. **STOP and VALIDATE**: Test navigation on laptop viewport.
5. Complete Phase 5 (More Dropdown Menu).
6. Run Quality Gates (Phase 6).

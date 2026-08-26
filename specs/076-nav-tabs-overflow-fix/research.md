# Research & Architectural Decisions: Kế Hoạch Toàn Diện — Thanh Điều Hướng Tab Chính

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Architectural Decisions

### Decision 1: Enhanced Scroll Control Hook with Offset Navigation (`useScrollOverflow`)

- **Context**: Users need multiple ways to navigate tabs: direct click, hotkeys (`Alt+1..6`), mouse-wheel / trackpad swipe, and dedicated step-by-step scrolling buttons (`<` and `>`).
- **Decision**:
  - Extend `useScrollOverflow` to include `scrollByOffset(offset: number)` and convenience helpers `scrollLeftAction` / `scrollRightAction` with a default step of `200px`.
  - Listen to `scroll`, `resize`, and `ResizeObserver` events passively to compute `canScrollLeft` and `canScrollRight`.
  - Maintain `scrollToElement(id, 'smooth')` for automatic focus on `activeTab` changes.
- **Rationale**: Single source of truth for all horizontal scrolling calculations and animations.

---

### Decision 2: Chevron Navigation Buttons & Gradient Masks

- **Context**: On screens with hidden overflow, users need clear visual feedback and explicit click targets to scroll the tab list without needing trackpad gestures.
- **Decision**:
  - Position circular Chevron buttons (`ChevronLeft`, `ChevronRight` from `lucide-react`) at `absolute left-0 / right-0 top-1/2 -translate-y-1/2 z-20`.
  - Buttons styled with `bg-ink/90 border border-parchment-2 shadow-xs text-text-muted hover:text-text-main`.
  - Render gradient masks `bg-gradient-to-r/l from-parchment to-transparent` beneath the Chevron buttons (`z-10`, `pointer-events-none`).
- **Rationale**:
  - Provides intuitive affordance matching the "Mực & Chu Sa" aesthetic.
  - `pointer-events-none` on masks ensures clicks on tab buttons under the gradient still work effortlessly.

---

### Decision 3: Responsive Density Optimization

- **Context**: Standard laptop screens (1366x768, 1440x900) have limited horizontal space. Displaying full shortcut badges (`Kbd Alt+X`) and overly generous padding forces unnecessary overflow.
- **Decision**:
  - Responsive padding: `px-2.5 sm:px-3 py-1.5 sm:py-2` (balanced click area and compact width).
  - Shortcut badge visibility: Hide `Kbd` on screens `< 1440px` (`hidden 2xl:inline-block`), and encode shortcut into the `title` attribute of the tab button (e.g. `title="Kiểm Tra Chất Lượng (Alt+6)"`).
  - Item integrity: Add `shrink-0` (`flex-shrink: 0`) to all tab buttons to completely prevent label cramping.
- **Rationale**: Fits more tabs directly on screen without sacrificing shortcut discoverability.

---

### Decision 4: "More Tabs" Popover Dropdown Menu (Fallback Navigation)

- **Context**: On very narrow viewports (e.g. tablet portrait, split-screen < 768px), or for users preferring list navigation, a dropdown menu allows jumping to any tab in 1 click.
- **Decision**:
  - Add a lightweight popover menu button ("Thêm ▾" or `MoreHorizontal`) on the right of the tab bar.
  - Dropdown lists all 6 tabs with their icon, Vietnamese title, count badge, and shortcut.
  - Clicking any tab executes `switchTab(tab)` and closes the menu.
  - Accessible click-outside listener and `Escape` key handler.
- **Rationale**: Guarantees 100% reachability of all features even on extreme screen constraints.

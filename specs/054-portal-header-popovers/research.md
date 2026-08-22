# Research & Technical Decisions: Portal-Based Header Popovers

**Feature Directory**: `specs/054-portal-header-popovers`
**Date**: 2026-08-22

---

## 1. Stacking Context Root Cause Analysis

### Sibling Stacking Contexts in App.tsx:
- **Header**: `App.tsx` line ~195: `<header className="sticky top-0 z-30 ...">`
- **Navigation Tabs**: `App.tsx` line ~259: `<nav className="sticky top-14 z-30 ...">`

Because both elements share the same stacking context level (`z-30`) in the same parent container (`#root`), the browser's CSS Stacking Context algorithm determines paint order by DOM tree sequence. Since the tab bar is declared *after* the header in the DOM, the entire tab bar and its children are painted over the entire header and its children.

Setting a child element inside the header to `z-40`, `z-50`, or `z-[999]` cannot escape the parent header's `z-30` stacking context.

---

## 2. Portal-Based Fixed Positioning Architecture

### Mechanism:
1. Render the popover container into `document.body` via `ReactDOM.createPortal(menuJsx, document.body)`.
2. Apply `position: fixed; top: ${coords.top}px; right: ${coords.right}px;` to place the dropdown precisely underneath the trigger button.
3. Compute `coords` using `triggerRef.current.getBoundingClientRect()`:
   $$\text{top} = \text{rect.bottom} + 4$$
   $$\text{right} = \text{window.innerWidth} - \text{rect.right}$$
4. Re-calculate coords dynamically on `window.addEventListener('resize')` and `window.addEventListener('scroll', ..., true)` capturing phase to follow scrollable viewport adjustments.
5. Set `z-40` on the portaled popup. Because the popup is now a direct child of `document.body`, `z-40` correctly places it above all `z-30` sticky elements without any CSS hacks.

---

## 3. Dual-Ref Safe Outside-Click Detection

When portaled to `document.body`, the popup DOM is no longer a descendant of `dropdownRef.current`. Therefore, a simple `triggerRef.current.contains(event.target)` check would incorrectly treat clicks inside the popup as "outside" clicks.

### Solution:
Maintain two refs:
1. `triggerRef`: Attached to the trigger button.
2. `menuRef`: Attached to the portaled dropdown menu container.

Click is only dismissed if:
$$\text{isOutside} = !\text{triggerRef.current.contains(target)} \land !\text{menuRef.current.contains(target)}$$

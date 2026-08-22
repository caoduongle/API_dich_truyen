# Implementation Plan: Portal-Based Header Popovers (ThemeSwitcher & LanguageSelector)

**Feature Directory**: `specs/054-portal-header-popovers`
**Date**: 2026-08-22

---

## 1. Technical Context

- **Problem**: In `src/App.tsx`, the top header (`sticky top-0 z-30`) and navigation tab bar (`sticky top-14 z-30`) are sibling stacking contexts. Because the tab bar is rendered later in the DOM, it clips and paints over any popover rendered inside the header (`ThemeSwitcher` and `LanguageSelector`).
- **Solution**: Use `ReactDOM.createPortal` to render the popover menu into `document.body`, positioned with `position: fixed` using dynamic coordinates computed from `getBoundingClientRect()`.
- **Reusable Hook**: Extract coordinate calculation, dynamic scroll/resize listeners, and dual-ref outside-click detection into `src/hooks/useDropdownPosition.ts`.
- **Design System Adherence**: Keep `z-40` for popover content, `rounded-[2px]`, without modifying `z-30` header/tab bar or design tokens.

---

## 2. Proposed Changes & Itemized File List

### Hooks & Utilities
1. **[NEW]** [`src/hooks/useDropdownPosition.ts`](../../src/hooks/useDropdownPosition.ts):
   - Reusable hook for computing fixed portal coordinates, tracking scroll/resize events, and handling outside-click / Escape dismissal across dual refs.
2. **[NEW]** [`src/hooks/__tests__/useDropdownPosition.test.ts`](../../src/hooks/__tests__/useDropdownPosition.test.ts):
   - Unit tests for coordinate math and listener lifecycle.

### UI Components
3. **[MODIFY]** [`src/components/common/ThemeSwitcher.tsx`](../../src/components/common/ThemeSwitcher.tsx):
   - Adopt `useDropdownPosition`, render menu into `document.body` via `createPortal`.
4. **[MODIFY]** [`src/components/common/LanguageSelector.tsx`](../../src/components/common/LanguageSelector.tsx):
   - Adopt `useDropdownPosition`, render menu into `document.body` via `createPortal`.

---

## 3. Verification Plan

### Automated Tests
- `npx vitest run src/hooks/__tests__/useDropdownPosition.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build` (`vite build` + esbuild)

### Visual / Manual Verification
- Open app, click `ThemeSwitcher` button -> dropdown menu appears floating completely over the tab bar without clipping.
- Click `LanguageSelector` button -> dropdown menu appears floating completely over the tab bar without clipping.
- Click inside the menu (e.g. choose "Sepia" or "English") -> theme/locale changes and menu closes cleanly.
- Press Escape or click outside -> menu closes.

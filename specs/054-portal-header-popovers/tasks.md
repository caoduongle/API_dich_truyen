# Tasks: Portal-Based Header Popovers (ThemeSwitcher & LanguageSelector)

**Feature Directory**: `specs/054-portal-header-popovers`
**Branch**: `054-portal-header-popovers`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Foundational Hook

**Purpose**: Create reusable dropdown positioning and safe outside-click detection hook for portal-based popovers.

- [x] T001 [P] Write unit tests for `useDropdownPosition` coordinate calculations and event listener lifecycle in `src/hooks/__tests__/useDropdownPosition.test.ts`
- [x] T002 Implement `src/hooks/useDropdownPosition.ts` supporting fixed coordinates, dynamic scroll/resize tracking, Escape key handling, and dual-ref outside-click dismissal

**Checkpoint**: Hook correctly calculates `{ top, right }` and handles dismissal events.

---

## Phase 2: UI Implementation (User Story 1 & 2) 🎯 MVP

**Goal**: Port `ThemeSwitcher` and `LanguageSelector` to `ReactDOM.createPortal` using `useDropdownPosition`, completely eliminating stacking context clipping above the navigation tabs.

- [x] T003 [US1] Update `src/components/common/ThemeSwitcher.tsx` to render popup menu into `document.body` via `ReactDOM.createPortal` with fixed coordinates
- [x] T004 [US2] Update `src/components/common/LanguageSelector.tsx` to render popup menu into `document.body` via `ReactDOM.createPortal` with fixed coordinates

**Checkpoint**: Both `ThemeSwitcher` and `LanguageSelector` popups float completely above the navigation tab bar.

---

## Phase 3: Polish & Verification Gates

**Purpose**: Quality assurance and verification gates.

- [x] T005 Run full typecheck with `npm run lint` (`tsc --noEmit`)
- [x] T006 Run full test suite with `npm test` (`vitest run`)
- [x] T007 Verify production build with `npm run build` (`vite build` + esbuild server)

---

## Dependencies & Execution Order

```text
Phase 1 (Hook Foundation) ──► Phase 2 (ThemeSwitcher & LanguageSelector MVP) ──► Phase 3 (Quality Gates)
```

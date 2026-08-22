# Tasks: Reading & Editor Theme System (Dark, Light, Sepia, Custom)

**Feature Directory**: `specs/053-reading-theme-system`
**Branch**: `053-reading-theme-system`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & CSS Variable Infrastructure

**Purpose**: Establish TypeScript types, theme-aware CSS custom properties, and FOUC prevention script.

- [x] T001 [P] Create TypeScript interfaces for Theme system (`ThemeMode`, `CustomThemePalette`, `ContrastAuditResult`, `ThemeContextType`) in `src/types/theme.ts`
- [x] T002 [P] Update `src/index.css` to define and scope the 6 semantic CSS custom properties for `[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="sepia"]`, and `[data-theme="custom"]`
- [x] T003 [P] Add synchronous theme initialization script in `index.html` to eliminate initial flash of unstyled content (FOUC)

---

## Phase 2: Foundational (WCAG Contrast Auditor & ThemeContext)

**Purpose**: Core contrast calculation engine and React theme state provider with localStorage persistence.

**⚠️ CRITICAL**: Must complete before implementing theme UI components.

- [x] T004 [P] Write unit tests for WCAG 2.1 relative luminance and contrast ratio calculations in `src/utils/__tests__/contrastAuditor.test.ts`
- [x] T005 Implement WCAG 2.1 contrast calculation helper functions (`getLuminance`, `getContrastRatio`, `auditPalette`) in `src/utils/contrastAuditor.ts`
- [x] T006 [P] Write unit tests for `ThemeContext` (mode switching, persistence to `localStorage`, OS auto-detection) in `src/context/__tests__/ThemeContext.test.tsx`
- [x] T007 Implement `ThemeContext.tsx` and `ThemeProvider` in `src/context/ThemeContext.tsx`

**Checkpoint**: ThemeContext can switch themes, persist to localStorage, and compute contrast ratios.

---

## Phase 3: User Story 1, 2, 3 - Preset Switching & Header ThemeSwitcher (Priority: P1) 🎯 MVP

**Goal**: Allow users to toggle between Dark, Light, and Sepia themes via a header button and have all views (including BilingualEditor) adapt instantly with high contrast.

**Independent Test**: Toggle between Dark, Light, and Sepia in header dropdown, verify that BilingualEditor and entire UI adapt smoothly with legible contrast and consistent cinnabar red accent.

### Implementation for User Story 1, 2, 3

- [x] T008 [US1/US2/US3] Create `src/components/common/ThemeSwitcher.tsx` with Lucide icons (`Moon`, `Sun`, `BookOpen`, `Palette`) and z-40 popover menu following design system
- [x] T009 [US1/US2/US3] Integrate `<ThemeProvider>` and mount `<ThemeSwitcher />` in the sticky top header of `src/App.tsx` next to `LanguageSelector`

**Checkpoint**: User Story 1, 2, and 3 fully functional — Dark, Light, and Sepia presets switch cleanly with full persistence.

---

## Phase 4: User Story 4 - Custom Theme Studio with Live Contrast Auditing (Priority: P2)

**Goal**: Allow users to customize all 6 color tokens using native color pickers, view a real-time preview, and receive non-blocking WCAG warning badges if contrast is low.

**Independent Test**: Open Custom Theme Modal, adjust color inputs, verify that contrast warnings trigger below 4.5:1, save custom palette, and verify that the custom colors apply app-wide.

### Implementation for User Story 4

- [x] T010 [US4] Create `src/components/common/CustomThemeModal.tsx` featuring 6 native color inputs, live editor preview, and non-blocking WCAG warning badges (`Badge tone="warning"`)
- [x] T011 [US4] Connect "Tùy chỉnh..." option in `ThemeSwitcher.tsx` to open `CustomThemeModal` and apply custom palette to `:root` style

**Checkpoint**: User Story 4 fully functional — custom color studio with contrast auditing works seamlessly.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, documentation, and verification gates.

- [x] T012 Update `README.md` documenting the 4 reading theme options (Dark, Light, Sepia, Custom)
- [x] T013 Run full typecheck with `npm run lint` (`tsc --noEmit`)
- [x] T014 Run full test suite with `npm test` (`vitest run`)
- [x] T015 Verify production build with `npm run build` (`vite build` + esbuild server)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Infrastructure (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS UI components.
- **User Story 1, 2, 3 (Phase 3)**: Depends on Foundational completion.
- **User Story 4 (Phase 4)**: Depends on Phase 3 completion.
- **Polish (Phase 5)**: Runs after all user stories are complete.

### User Story Completion Order

```text
Setup & Infrastructure (Phase 1) ──► Foundational (Phase 2) ──► US1, 2, 3 (Presets & Header Switcher MVP) ──► US4 (Custom Studio) ──► Polish
```

---

## Parallel Opportunities

- **Phase 1**: T001 (`src/types/theme.ts`), T002 (`src/index.css`), and T003 (`index.html`) can run in parallel.
- **Phase 2**: T004 (contrast tests) can run in parallel with T005, and T006 (context tests) can run in parallel with T007.

---

## Implementation Strategy

### MVP First (User Story 1, 2, 3 Only)
1. Complete Phase 1 (CSS Variables & Types) and Phase 2 (Contrast Auditor & ThemeContext).
2. Complete Phase 3 (ThemeSwitcher & App.tsx header integration).
3. Validate User Story 1, 2, 3 (Dark, Light, Sepia presets) independently.

### Incremental Delivery
1. Foundation: CSS custom properties, WCAG contrast auditor, ThemeContext.
2. User Story 1, 2, 3: Header theme switcher, instant preset switching, localStorage persistence.
3. User Story 4: Custom theme studio modal with live contrast warnings and native color inputs.
4. Polish: Typecheck, test suites, production build, and documentation updates.

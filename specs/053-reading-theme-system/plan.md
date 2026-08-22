# Implementation Plan: Reading & Editor Theme System (Dark, Light, Sepia, Custom)

**Feature Directory**: `specs/053-reading-theme-system`
**Date**: 2026-08-22

---

## 1. Technical Context

- **Goal**: Implement a comprehensive reading and editor theme system with 4 choices — **Dark (Tối)** (default "Mực & Chu Sa"), **Light (Sáng)** (warm ivory paper `#F7F2E9`), **Sepia** (vintage manuscript `#F4ECD8`), and **Custom (Tùy chỉnh)** — to alleviate eye strain during long translation sessions in `BilingualEditor.tsx` and across the whole app.
- **Architecture**:
  - **CSS Custom Properties Scoped by `data-theme`**: Defines semantic CSS variables in `src/index.css` for `[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="sepia"]`, and `[data-theme="custom"]`. All existing Tailwind classes (`bg-ink`, `bg-parchment`, `text-text-main`, `text-text-muted`, `border-parchment-2`, `bg-polish`) inherit automatically without modifying individual component files.
  - **Consistent Cinnabar Red Accent**: The accent color `--color-polish` remains `#B8402C` across all 3 built-in presets (Dark, Light, Sepia), maintaining brand identity and passing WCAG contrast.
  - **Zero-Dependency WCAG 2.1 Contrast Calculation**: Relative luminance and contrast ratio calculated using pure TypeScript math in `src/utils/contrastAuditor.ts`.
  - **ThemeContext & Persistence**: Managed via `src/context/ThemeContext.tsx` (mirroring `src/i18n/I18nContext.tsx`) and persisted to `localStorage`. 0 bytes written to IndexedDB.
  - **Header Switcher & Popover**: `src/components/common/ThemeSwitcher.tsx` positioned in sticky header (`z-30`) with popover at `z-40` and `rounded-[2px]`.
  - **FOUC Elimination**: Inline script in `index.html` sets `data-theme` synchronously before initial paint.

---

## 2. Constitution & Quality Gates Check

- [x] **Principle I (Quality Gates)**: `npm run lint`, `npm test`, and `npm run build` must pass cleanly.
- [x] **Principle II (Dependency Minimization)**: 0 new NPM packages added. Native `<input type="color">` and native TS contrast math.
- [x] **Principle III (Domain Separation)**: Scoped strictly to client theme styling and React context. 0 changes to IndexedDB, translation engines, or backend server.
- [x] **Principle IV (Core Schemas)**: 0 changes to `types.ts` project data or IndexedDB schema.
- [x] **Principle V (Review-Driven Development)**: Itemized file plan presented for review.

---

## 3. Proposed Changes & Itemized File List

### Styling & Foundation
1. **[MODIFY]** [`src/index.css`](../../src/index.css):
   - Scope `--color-ink`, `--color-parchment`, `--color-parchment-2`, `--color-text-main`, `--color-text-muted`, `--color-draft`, `--color-polish` under `[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="sepia"]`, `[data-theme="custom"]`.
   - Update scrollbar styling to use dynamic CSS variables.
2. **[MODIFY]** [`index.html`](../../index.html):
   - Add inline script in `<head>` for synchronous theme resolution before render (FOUC elimination).

### Utils & Types
3. **[NEW]** [`src/types/theme.ts`](../../src/types/theme.ts):
   - Define `ThemeMode`, `CustomThemePalette`, `ContrastAuditResult`, `ThemeContextType`.
4. **[NEW]** [`src/utils/contrastAuditor.ts`](../../src/utils/contrastAuditor.ts):
   - Zero-dependency WCAG 2.1 relative luminance and contrast ratio computation.
5. **[NEW]** [`src/utils/__tests__/contrastAuditor.test.ts`](../../src/utils/__tests__/contrastAuditor.test.ts):
   - Unit tests for contrast ratio calculations and built-in preset audits.

### Context & State
6. **[NEW]** [`src/context/ThemeContext.tsx`](../../src/context/ThemeContext.tsx):
   - React context managing `theme`, `customPalette`, `localStorage` persistence, OS auto-detection, and DOM `data-theme` synchronization.
7. **[NEW]** [`src/context/__tests__/ThemeContext.test.tsx`](../../src/context/__tests__/ThemeContext.test.tsx):
   - Unit tests for theme switching, custom palette application, and persistence.

### UI Components
8. **[NEW]** [`src/components/common/ThemeSwitcher.tsx`](../../src/components/common/ThemeSwitcher.tsx):
   - Header dropdown button with Lucide icons (`Moon`, `Sun`, `BookOpen`, `Palette`) at z-40 ladder.
9. **[NEW]** [`src/components/common/CustomThemeModal.tsx`](../../src/components/common/CustomThemeModal.tsx):
   - Modal with 6 native color pickers, real-time live preview, and non-blocking WCAG warning badges (`Badge tone="warning"`).
10. **[MODIFY]** [`src/App.tsx`](../../src/App.tsx):
    - Wrap application in `<ThemeProvider>`.
    - Place `<ThemeSwitcher />` in sticky header next to `<LanguageSelector />`.

### Documentation
11. **[MODIFY]** [`README.md`](../../README.md):
    - Document the 4-choice reading theme system (Dark, Light, Sepia, Custom).

---

## 4. Verification Plan

### Automated Tests
- `npx vitest run src/utils/__tests__/contrastAuditor.test.ts`
- `npx vitest run src/context/__tests__/ThemeContext.test.tsx`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build` (`vite build` + esbuild)

### Visual Verification
- Toggle between Dark, Light, Sepia, and Custom in `BilingualEditor.tsx` and verify warm manuscript aesthetic.
- Verify that cinnabar red accents and badges maintain high legibility.
- Verify FOUC-free page refreshes.

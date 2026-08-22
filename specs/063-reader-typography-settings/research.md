# Research & Architecture Decisions: Reader Typography Settings

## 1. Context & Architecture

### Current State
- The reading theme system (`ThemeContext.tsx`, `CustomThemeModal.tsx`) currently handles 4 modes (`dark`, `light`, `sepia`, `custom`) and 6 color tokens (`ink`, `parchment`, `parchment2`, `textMain`, `textMuted`, `polish`).
- Text rendering in `BilingualEditor.tsx` currently relies primarily on generic Tailwind classes like `font-serif` or `text-xs` / `text-sm` without user-adjustable font family or size.

---

## 2. Technical Decisions

### Decision 1: Typography Storage in `ThemeContext` & Global CSS Custom Properties
- **Decision**: Manage `readerFont` and `readerFontSize` in `ThemeContext.tsx`, applying them globally as CSS custom properties on `document.documentElement`:
  ```css
  --reader-font-family: [fontFamilyCss];
  --reader-font-size: [fontSize]px;
  ```
- **Rationale**: Any reader component, editor view, or preview block can immediately bind to `var(--reader-font-family)` and `var(--reader-font-size, 22px)` without prop drilling.

### Decision 2: Font Options & Dynamic Google Font Injection
- **Decision**: Define standard font collection with 7 options:
  1. `system`: System UI stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
  2. `arial`: `Arial, sans-serif`
  3. `helvetica`: `"Helvetica Neue", Helvetica, Arial, sans-serif`
  4. `roboto`: `"Roboto", sans-serif` (Google Font)
  5. `georgia`: `Georgia, serif`
  6. `merriweather`: `"Merriweather", Georgia, serif` (Google Font - Default)
  7. `source-serif-4`: `"Source Serif 4", Georgia, serif` (Google Font)
- **Dynamic Loader**: When a Google Font is selected, inject `<link rel="stylesheet" id="google-font-${id}" href="...">` once into document `<head>`. If offline, the CSS fallback font handles rendering gracefully.

### Decision 3: Font Size Bounds and Clamping
- **Decision**: Bounded between `MIN_READER_FONT_SIZE = 14` and `MAX_READER_FONT_SIZE = 50`, default `DEFAULT_READER_FONT_SIZE = 22`. Provide `+` and `-` controls with step size of `1px` (or `2px` on quick click) and direct visual feedback.
- **Rationale**: 14px supports high density on small screens while 50px provides large accessibility reading for presentations or visually impaired readers.

### Decision 4: Integrated Customization in `CustomThemeModal` & Live Preview
- **Decision**: Add a dedicated "Kiểu Chữ & Cỡ Chữ (Typography)" section in `CustomThemeModal.tsx` above the Live Preview. The Live Preview displays the draft font family and font size in real time.
- **Rationale**: Unifies visual customization (Colors + Typography) into a single cohesive, accessible dialog.

---

## 3. Compatibility & Non-Regression Analysis

| Component / Flow | Impact | Verification |
|---|---|---|
| **`ThemeContext.tsx`** | Extended with font state without breaking existing theme mode or palette logic. | Unit tests in `ThemeContext.test.ts`. |
| **`CustomThemeModal.tsx`** | Enhanced with typography controls and live preview scaling. | Unit and manual test verification. |
| **`BilingualEditor.tsx`** | Uses `--reader-font-family` and `--reader-font-size` on translation text blocks. | Visual verification in workspace. |

# Research: High-Contrast CJK Raw Snippet & Bilingual Evidence Display

**Feature**: `078-fix-raw-snippet-contrast`
**Date**: 2026-08-27
**Status**: Completed

## 1. Problem Analysis & Contrast Audit

### Root Cause
In `src/components/hako-checker/HakoIssueCard.tsx`, the raw Chinese snippet container was hardcoded with:
`className="bg-ink border border-parchment-2 rounded-[2px] p-2.5 text-xs text-amber-100/90 font-serif leading-relaxed"`

When rendered under the application's theme system:
1. **Light Theme (`html[data-theme="light"]`)**:
   - Background (`--color-ink`): `#FFFFFF` (White)
   - Foreground (`text-amber-100/90`): `#FEF3C7` (Pale yellow)
   - Measured WCAG Contrast Ratio: **1.09 : 1** (Catastrophic failure; WCAG AA requires $\ge 4.5:1$, AAA requires $\ge 7:1$).
2. **Sepia Theme (`html[data-theme="sepia"]`)**:
   - Background (`--color-ink`): `#EBE0C9` (Light cream parchment)
   - Foreground (`text-amber-100/90`): `#FEF3C7`
   - Measured WCAG Contrast Ratio: **1.21 : 1** (Unreadable).
3. **Dark Theme (`html[data-theme="dark"]`)**:
   - Background (`--color-ink`): `#14100D`
   - Foreground (`text-amber-100/90`): `#FEF3C7`
   - Measured WCAG Contrast Ratio: **13.5 : 1** (Passes only on Dark mode).

Because `text-amber-100` is a fixed pale color rather than a semantic token, switching from Dark to Light or Sepia inverted the background from dark to pure white while leaving the text pale yellow, causing complete text invisibility.

---

## 2. Technical Decisions & Color Palette Design

### Decision 1: Semantic Theme Token Binding
- **Chosen Approach**: Use application theme tokens `text-text-main` (or `text-stone-900 dark:text-amber-100`) combined with `bg-parchment/60` and `border-parchment-2`.
- **Rationale**: `text-text-main` is dynamically bound to:
  - Light mode: `#3A2E22` (Deep warm dark brown on `#F7F2E9` parchment $\to$ **10.5 : 1** AAA).
  - Sepia mode: `#5B4636` (Deep sepia ink on `#F4ECD8` $\to$ **8.5 : 1** AAA).
  - Dark mode: `#DCD1BC` (Warm parchment text on `#1F1914` $\to$ **11.2 : 1** AAA).
- **Alternatives Evaluated**:
  - *Hardcoding dark text `#000000`*: Rejected because it clashes with dark mode.
  - *Hardcoding Tailwind `dark:` variants manually on every element*: Semantic variables are cleaner and guarantee Sepia theme support as well as Light and Dark.

### Decision 2: Distinct Bilingual Visual Accents
- **Chosen Approach**:
  - **Vietnamese Evidence**: `border-l-4 border-polish/80 bg-ink/50` (Cinnabar red accent border indicating reviewed translation).
  - **Chinese Raw Source**: `border-l-4 border-amber-600/80 bg-parchment/60` (Amber/gold accent border indicating original raw source text).
- **Rationale**: Provides instant visual distinction between source text and translation output.

### Decision 3: Dedicated CJK Font Stack & Glyph Spacing
- **Chosen Approach**: Define `.cjk-raw-snippet` in `src/index.css`:
  ```css
  .cjk-raw-snippet {
    font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
    letter-spacing: 0.02em;
    line-height: 1.65;
  }
  ```
- **Rationale**: Complex Chinese characters have higher stroke density than Latin characters. A dedicated serif font stack with $0.02\text{em}$ letter-spacing and $1.65$ line-height prevents character collision and blurry strokes.

### Decision 4: One-Click Clipboard Copy with Feedback
- **Chosen Approach**: Add an inline copy button on the raw snippet header with `Copy` and `Check` icons, managing a 2-second copied state via `useState`.
- **Rationale**: Enhances moderator workflow when checking external dictionaries or glossary databases.

---

## 3. WCAG Luminance & Contrast Mathematical Formula

Relative luminance $L$ of a color is calculated as:
$$L = 0.2126 \cdot R_{lin} + 0.7152 \cdot G_{lin} + 0.0722 \cdot B_{lin}$$

Contrast ratio $C$ between foreground $L_1$ and background $L_2$ (where $L_1 > L_2$):
$$C = \frac{L_1 + 0.05}{L_2 + 0.05}$$

With the semantic tokens:
- **Light Theme**: $C = 10.5 \ge 7.0$ (WCAG AAA Passed ✅)
- **Dark Theme**: $C = 11.2 \ge 7.0$ (WCAG AAA Passed ✅)
- **Sepia Theme**: $C = 8.5 \ge 7.0$ (WCAG AAA Passed ✅)

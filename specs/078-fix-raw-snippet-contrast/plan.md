# Implementation Plan: High-Contrast CJK Raw Snippet & Bilingual Evidence Display

**Branch**: `078-fix-raw-snippet-contrast` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/078-fix-raw-snippet-contrast/spec.md`

## Summary

Fix the severe contrast and readability issue where raw Chinese snippets on issue cards were rendered with pale yellow text (`text-amber-100/90`) on white backgrounds in Light/Sepia themes. 
1. **Semantic Color Binding**: Bind raw snippet text and backgrounds to theme tokens (`text-text-main`, `bg-parchment/60`, `border-parchment-2`) to guarantee $\ge 7:1$ WCAG AAA contrast across Light, Sepia, and Dark themes.
2. **Visual Hierarchy Differentiation**: Style Vietnamese evidence with a Cinnabar/red accent border and Chinese raw source with an Amber/gold accent border.
3. **CJK Font Stack**: Define `.cjk-raw-snippet` in `src/index.css` with dedicated font fallback (`Noto Serif SC`, `Source Han Serif`, `PingFang SC`, `Microsoft YaHei`) and optimal line-height/letter-spacing.
4. **One-Click Quick Copy**: Add an inline copy button on the raw snippet container with 2-second visual feedback.
5. **Contrast Auditor Test Suite**: Implement a mathematical WCAG contrast auditor utility and unit tests.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19
**Primary Dependencies**: Tailwind CSS v4, Lucide React icons (`Copy`, `Check`, `FileCode`)
**Storage**: N/A (Pure UI presentation enhancement)
**Testing**: Vitest (`npx vitest run`) + TypeScript compiler (`tsc --noEmit`)
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)
**Performance Goals**:
- WCAG Contrast Ratio $\ge 7.0:1$ (WCAG AAA) across Light, Dark, Sepia
- Copy interaction latency $< 50\text{ms}$
- 0ms theme transition lag
**Constraints**: Adhere strictly to the "Mực & Chu Sa" design system in `.agents/rules/design-system.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check Item | Status | Notes |
| :--- | :--- | :---: | :--- |
| **I. Quality Gates** | `tsc --noEmit`, `vitest run`, `vite build` | **PASS** | Strict verification required. |
| **II. Dependency Minimization** | No new NPM packages added | **PASS** | Uses existing Lucide icons and Tailwind tokens. |
| **III. Concern Separation** | UI only, no backend/translation modifications | **PASS** | Restricted strictly to `HakoIssueCard.tsx`, `index.css`, and contrast test utility. |
| **IV. Immutable Schemas** | No changes to `src/types.ts` or database | **PASS** | Component-level presentation update only. |
| **V. Atomic Commits & Docs** | Synced specifications and modular changes | **PASS** | Complete contracts, research, and quickstart documentation. |

## Project Structure

### Documentation (this feature)

```text
specs/078-fix-raw-snippet-contrast/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Contrast audit & architectural decisions
├── data-model.md        # Entity definitions & token mappings
├── quickstart.md        # Verification scenarios & validation guide
├── contracts/
│   └── cjk-snippet-ui.contract.md # CSS & component contracts
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code Impact

```text
src/
├── index.css                                         # Add .cjk-raw-snippet font stack & typography rules
├── components/
│   └── hako-checker/
│       └── HakoIssueCard.tsx                         # Update bilingual snippet containers & add copy button
└── utils/
    ├── contrastAuditor.ts                            # Mathematical WCAG luminance and contrast ratio helper
    └── __tests__/
        └── contrastAuditor.test.ts                   # Unit tests verifying contrast ratios >= 7:1 across themes
```

## Planned Changes by File

### 1. `src/index.css`
- Add `.cjk-raw-snippet` class with CJK serif font stack (`Noto Serif SC`, `Source Han Serif`, `PingFang SC`, `Microsoft YaHei`, `serif`), letter-spacing $0.02\text{em}$, and line-height $1.65$.

### 2. `src/components/hako-checker/HakoIssueCard.tsx`
- Replace hardcoded `text-amber-100/90` with semantic `text-text-main font-medium cjk-raw-snippet`.
- Apply distinct visual hierarchy:
  - Vietnamese evidence: `border-l-4 border-polish/80 bg-ink/60 border border-parchment-2`
  - Chinese raw snippet: `border-l-4 border-amber-600/80 bg-parchment/60 border border-parchment-2`
- Add one-click copy button in raw snippet header with `Copy` / `Check` icons and feedback state.

### 3. `src/utils/contrastAuditor.ts` & `src/utils/__tests__/contrastAuditor.test.ts`
- Implement `calculateLuminance` and `calculateContrastRatio` functions following the official W3C WCAG 2.1 formula.
- Add unit tests verifying that all theme combinations (Light, Sepia, Dark) for Vietnamese and Chinese snippet text exceed $7.0:1$.

## Verification Plan

### Automated Tests
```bash
npm run lint
npx vitest run src/utils/__tests__/contrastAuditor.test.ts
npm test
npm run build
```

### Manual Verification
1. Switch between Light, Sepia, and Dark themes.
2. Verify that Chinese characters are sharp, legible, and dark on light backgrounds.
3. Test the "Sao chép" button on the raw snippet header and verify clipboard content.

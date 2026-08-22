# Implementation Plan: Typography Settings (Font & Font Size) for Reader & Workspace

**Branch**: `063-reader-typography-settings` | **Date**: 2026-08-23 | **Spec**: [`specs/063-reader-typography-settings/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/063-reader-typography-settings/spec.md)

**Input**: Feature specification from `/specs/063-reader-typography-settings/spec.md`

## Summary

Add reader typography customization (7 font families + font size adjustment from 14px to 50px) to the application. Update `src/types/theme.ts` with font options and constants, extend `ThemeContext.tsx` to manage and persist typography state to `localStorage`, dynamically load Google Fonts, update `--reader-font-family` and `--reader-font-size` on `document.documentElement`, add typography controls and real-time live preview scaling to `CustomThemeModal.tsx`, and apply the variables to `BilingualEditor.tsx`.

---

## Technical Context

**Language/Version**: TypeScript 5.8.2 / React 19.0.1  
**Primary Dependencies**: React 19, Lucide React, Tailwind CSS v4, `clsx`, `tailwind-merge`  
**Storage**: `localStorage` (`ai_dich_truyen_reader_font`, `ai_dich_truyen_reader_font_size`)  
**Testing**: Vitest 4.1.9 (`npm test`), TypeScript `tsc --noEmit` (`npm run lint`), `npm run build`  
**Target Platform**: Web (Desktop & Mobile responsive)  
**Project Type**: React Frontend Application  
**Performance Goals**: Instant font scaling (< 16ms), asynchronous Google Font stylesheet injection with swap display  
**Constraints**:
- Strictly follow `.agents/rules/design-system.md`.
- Ensure font size is strictly clamped in `[14, 50]`.
- Maintain full backward compatibility for existing themes and palettes.  
**Scale/Scope**: 4 files modified (`src/types/theme.ts`, `src/context/ThemeContext.tsx`, `src/components/common/CustomThemeModal.tsx`, `src/components/translator-workspace/BilingualEditor.tsx`) + test files.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: `tsc --noEmit`, `vitest run`, and `vite build` will pass cleanly.
- [x] **II. Dependency Minimization & Existing Library Reuse**: Reuses existing UI components and icons (`Type`, `Minus`, `Plus`, `RotateCcw`, `Badge`, `Button`).
- [x] **III. Strict Concern Separation & Domain Boundary Preservation**: Purely UI and client theme context. No backend or Gemini translation logic modified.
- [x] **IV. Immutable Core Schemas & Storage Stability**: Core schemas and types unchanged; theme types cleanly extended.
- [x] **V. Atomic Commits & Documentation Synchronization**: Single, well-defined feature diff.

---

## Project Structure

### Documentation (this feature)

```text
specs/063-reader-typography-settings/
├── plan.md              # Implementation plan (this document)
├── research.md          # Phase 0: Technical choices & font stack
├── data-model.md        # Phase 1: Typography data model & lifecycle
├── quickstart.md        # Phase 1: Verification scenarios
├── contracts/           # Phase 1: Interface contracts
│   └── typography-theme.contract.md
├── checklists/
│   └── requirements.md  # Quality checklist
└── spec.md              # Feature specification
```

### Source Code Layout

```text
src/
├── types/
│   └── theme.ts                                 # [MODIFY] Add ReaderFontId, ReaderFontOption, constants
├── context/
│   ├── ThemeContext.tsx                         # [MODIFY] Manage readerFont & readerFontSize, load fonts, set CSS vars
│   └── __tests__/
│       └── ThemeContext.test.ts                 # [MODIFY] Unit tests for typography state & persistence
└── components/
    ├── common/
    │   └── CustomThemeModal.tsx                 # [MODIFY] Add Typography section, +/- controls, live preview scaling
    └── translator-workspace/
        └── BilingualEditor.tsx                  # [MODIFY] Bind reader paragraphs to --reader-font-family & --reader-font-size
```

---

## Proposed Changes

### 1. `src/types/theme.ts`
- Export `ReaderFontId`, `ReaderFontOption`, `READER_FONT_OPTIONS`, `MIN_READER_FONT_SIZE`, `MAX_READER_FONT_SIZE`, `DEFAULT_READER_FONT_SIZE`, `DEFAULT_READER_FONT`.
- Extend `ThemeContextType` with `readerFont`, `readerFontSize`, `setReaderFont`, `setReaderFontSize`, `resetReaderTypography`.

### 2. `src/context/ThemeContext.tsx`
- Add font loader utility `loadGoogleFont(fontId)`.
- Initialize `readerFont` and `readerFontSize` from `localStorage` with fallback to `DEFAULT_READER_FONT` and `DEFAULT_READER_FONT_SIZE`.
- Apply `--reader-font-family` and `--reader-font-size` to `document.documentElement` inside `applyThemeToDOM`.
- Provide `setReaderFont`, `setReaderFontSize` (clamped `14..50`), and `resetReaderTypography`.

### 3. `src/components/common/CustomThemeModal.tsx`
- Add state for `draftFont` and `draftFontSize`.
- Add Typography controls: Font picker (grid / select) + font size stepper (`-`, display, `+`).
- Bind Live Preview text to `draftFont` and `draftFontSize`.
- Update Save and Reset handlers.

### 4. `src/components/translator-workspace/BilingualEditor.tsx`
- Apply `var(--reader-font-family, "Merriweather", Georgia, serif)` and `var(--reader-font-size, 22px)` to translation paragraph blocks and editable reader elements.

---

## Verification Plan

### Automated Tests
```bash
npm run lint    # tsc --noEmit: Must pass with 0 errors
npm test        # vitest run: All tests must pass
npm run build   # vite build + esbuild: Must build successfully
```

### Targeted Tests
```bash
npx vitest run src/context/__tests__/ThemeContext.test.ts
```

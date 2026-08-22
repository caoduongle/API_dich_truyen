# Tasks: Typography Settings (Font & Font Size) for Reader & Workspace

## Feature Overview
- **Branch**: `063-reader-typography-settings`
- **Spec**: [`specs/063-reader-typography-settings/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/063-reader-typography-settings/spec.md)
- **Plan**: [`specs/063-reader-typography-settings/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/063-reader-typography-settings/plan.md)

---

## Phase 1: Setup & Pre-Verification

**Purpose**: Verify baseline quality gates and test suite before making edits.

- [x] T001 Verify baseline test suite passes via `npm test`

---

## Phase 2: Foundational (Type Definitions & Font Loader Helper)

**Purpose**: Establish type definitions, font stack options, and Google Font loader utility.

- [x] T002 [P] Define `ReaderFontId`, `ReaderFontOption`, `READER_FONT_OPTIONS`, and sizing constants in `src/types/theme.ts`
- [x] T003 [P] Implement dynamic Google Font loader utility in `src/utils/fontLoader.ts`

---

## Phase 3: User Story 1 - Font Family Customization & Dynamic Google Fonts (Priority: P1) 🎯 MVP

**Goal**: Enable font selection from 7 options with dynamic Google Font stylesheet loading and `--reader-font-family` CSS custom property.

**Independent Test**: Select "Source Serif 4" in `CustomThemeModal`, verify stylesheet is loaded and `--reader-font-family` applies to DOM.

### Implementation
- [x] T004 [US1] Extend `ThemeContext` with `readerFont` state, `localStorage` persistence, and `--reader-font-family` CSS property in `src/context/ThemeContext.tsx`
- [x] T005 [US1] Add Font Family selector section and preview binding in `src/components/common/CustomThemeModal.tsx`

**Checkpoint**: Users can choose from 7 fonts with dynamic stylesheet loading and persistent storage.

---

## Phase 4: User Story 2 - Incremental Font Size Adjustment & Clamping (Priority: P1)

**Goal**: Provide 14px–50px font size adjustment with +/- controls and bounded clamping.

**Independent Test**: Click `+` and `-` in `CustomThemeModal`, verify font size scales between 14px and 50px and clamps at boundaries.

### Implementation & Testing
- [x] T006 [US2] Extend `ThemeContext` with `readerFontSize` state, 14–50px clamping, and `--reader-font-size` CSS variable in `src/context/ThemeContext.tsx`
- [x] T007 [US2] Add Font Size increment/decrement stepper controls in `src/components/common/CustomThemeModal.tsx`
- [x] T008 [P] [US2] Add unit tests for typography state, font loading, and bounds clamping in `src/context/__tests__/ThemeContext.test.ts`

**Checkpoint**: Font size can be smoothly adjusted between 14px and 50px with strict boundary checks.

---

## Phase 5: User Story 3 - Full Synchronization Across Reading Frames (Priority: P2)

**Goal**: Bind reader translation paragraphs and editor surfaces to typography CSS variables.

**Independent Test**: Open translation editor in `BilingualEditor.tsx`, verify translation text renders using `--reader-font-family` and `--reader-font-size`.

### Implementation
- [x] T009 [US3] Bind reader translation paragraphs and text editing surfaces to `--reader-font-family` and `--reader-font-size` in `src/components/translator-workspace/BilingualEditor.tsx`

---

## Phase 6: Polish & Quality Gates

**Purpose**: Strict Constitution quality assurance and end-to-end verification.

- [x] T010 [P] Verify type safety with zero type errors via `npm run lint` (`tsc --noEmit`)
- [x] T011 [P] Execute entire unit test suite via `npm test` (`vitest run`)
- [x] T012 Execute production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T013 Verify quickstart manual scenarios from `specs/063-reader-typography-settings/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002 [P], T003 [P])
   │
   ▼
Phase 3: User Story 1 (T004, T005) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T006, T007, T008 [P])
   │
   ▼
Phase 5: User Story 3 (T009)
   │
   ▼
Phase 6: Polish & Quality Gates (T010 [P], T011 [P], T012, T013)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Complete T001 (baseline check).
2. Complete T002 + T003 (types & font loader).
3. Complete T004 + T005 (`ThemeContext` font state & modal font selector).
4. Verify font switching works in browser.

### Full Delivery
5. Complete Phase 4 (font size stepper & unit tests).
6. Complete Phase 5 (`BilingualEditor` reader binding).
7. Complete Phase 6 (all Constitution quality gates).

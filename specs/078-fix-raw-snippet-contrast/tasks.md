# Tasks: High-Contrast CJK Raw Snippet & Bilingual Evidence Display

**Branch**: `078-fix-raw-snippet-contrast` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create typography CSS classes and contrast auditor testing infrastructure.

- [X] T001 Define `.cjk-raw-snippet` font stack, letter-spacing, and line-height in `src/index.css`
- [X] T002 [P] Implement WCAG relative luminance and contrast ratio auditor in `src/utils/contrastAuditor.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify contrast calculation mathematics and theme token values before component wiring.

- [X] T003 [P] Add unit test suite verifying WCAG AAA contrast ratio ($\ge 7:1$) across Light, Dark, and Sepia themes in `src/utils/__tests__/contrastAuditor.test.ts`

**Checkpoint**: Foundation ready — Contrast auditor passes mathematical validation for all 3 themes.

---

## Phase 3: User Story 1 - High-Contrast CJK Raw Snippet Legibility (Priority: P1) 🎯 MVP

**Goal**: Eliminate unreadable pale text by binding raw snippet container and text to high-contrast semantic theme tokens.

**Independent Test**: Render an issue card containing Chinese raw snippet in Light theme; verify raw text is crisp, dark `#3A2E22` on parchment `#F7F2E9` with zero washed-out yellow text.

### Tests for User Story 1
- [X] T004 [P] [US1] Unit test verifying raw snippet contrast ratio $\ge 7:1$ under Light and Sepia theme token combinations in `src/utils/__tests__/contrastAuditor.test.ts`

### Implementation for User Story 1
- [X] T005 [US1] Refactor raw Chinese snippet container and text classes to use semantic tokens (`bg-parchment/60`, `border-parchment-2`, `text-text-main font-medium`) in `src/components/hako-checker/HakoIssueCard.tsx`

**Checkpoint**: User Story 1 complete — Raw Chinese text is 100% legible across Light, Sepia, and Dark themes.

---

## Phase 4: User Story 2 - Distinct Bilingual Visual Hierarchy (Priority: P2)

**Goal**: Visually differentiate Vietnamese translation evidence (Cinnabar/Red accent border) from Chinese raw source (Amber/Gold accent border).

**Independent Test**: View an issue card with both snippets; verify Vietnamese block has `border-l-4 border-polish/80` and Chinese block has `border-l-4 border-amber-600/80`.

### Implementation for User Story 2
- [X] T006 [US2] Update Vietnamese evidence container to feature `border-l-4 border-polish/80 bg-ink/60 border border-parchment-2` in `src/components/hako-checker/HakoIssueCard.tsx`
- [X] T007 [US2] Update Chinese raw source container to feature `border-l-4 border-amber-600/80 bg-parchment/60 border border-parchment-2` in `src/components/hako-checker/HakoIssueCard.tsx`

**Checkpoint**: User Story 2 complete — Distinct visual hierarchy established between translation and source text.

---

## Phase 5: User Story 3 - CJK Font Stack & Glyph Sharpness (Priority: P3)

**Goal**: Ensure complex Hanzi characters render without clipping, blurring, or broken strokes on all operating systems.

**Independent Test**: Render multi-stroke Chinese characters (e.g. 龙, 涎, 瀚, 饕, 餮) in the raw snippet; verify `.cjk-raw-snippet` font class is active with balanced letter spacing.

### Implementation for User Story 3
- [X] T008 [US3] Attach `.cjk-raw-snippet` class to the raw text element in `src/components/hako-checker/HakoIssueCard.tsx`

**Checkpoint**: User Story 3 complete — CJK typography rendered with dedicated font fallback and stroke clarity.

---

## Phase 6: User Story 4 - Quick One-Click Copy for Raw Snippets (Priority: P4)

**Goal**: Provide a one-click copy button on the raw snippet header with immediate 2-second feedback indicator.

**Independent Test**: Click "Sao chép" on the raw snippet header; verify text is copied to clipboard and button displays "Đã chép" with `Check` icon for 2 seconds.

### Implementation for User Story 4
- [X] T009 [US4] Add `isCopied` state, copy handler with `navigator.clipboard.writeText`, and `Copy`/`Check` icon toggle in `src/components/hako-checker/HakoIssueCard.tsx`

**Checkpoint**: User Story 4 complete — One-click raw text copy operational with feedback.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Run full quality gates and verify theme switching.

- [X] T010 Run TypeScript static type checking via `npm run lint` (`tsc --noEmit`)
- [X] T011 Run all test suites via `npm test` (`vitest run`)
- [X] T012 Run production bundle compilation via `npm run build`
- [X] T013 [P] Validate theme switching and visual rendering against `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks story validation.
- **Phase 3 (User Story 1 - MVP)**: Depends on Phase 1 & 2.
- **Phase 4 (User Story 2)**: Can run with or after Phase 3.
- **Phase 5 (User Story 3)**: Depends on Phase 1.
- **Phase 6 (User Story 4)**: Can run in parallel with UI tasks.
- **Phase 7 (Polish)**: Depends on all User Stories completion.

### Parallel Opportunities
- T001 and T002 can run in parallel.
- T003 and T004 can run in parallel.
- T010, T011, T012, T013 run in the final verification phase.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Define `.cjk-raw-snippet` in `src/index.css` and create contrast auditor.
2. Update `src/components/hako-checker/HakoIssueCard.tsx` with semantic high-contrast tokens.
3. Validate contrast ratio $\ge 7:1$ across Light, Dark, and Sepia themes.

### Incremental Delivery
1. Add visual hierarchy accent borders (User Story 2).
2. Attach CJK font class (User Story 3).
3. Add one-click copy button (User Story 4).
4. Run full quality gates (`lint`, `test`, `build`).

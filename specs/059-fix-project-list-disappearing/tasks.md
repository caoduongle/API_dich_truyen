# Tasks: Fix Disappearing Project Card Grid on Tab Navigation

## Feature Overview
- **Branch**: `059-fix-project-list-disappearing`
- **Spec**: [`specs/059-fix-project-list-disappearing/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/059-fix-project-list-disappearing/spec.md)
- **Plan**: [`specs/059-fix-project-list-disappearing/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/059-fix-project-list-disappearing/plan.md)

---

## Phase 1: Setup & Baseline Verification

**Purpose**: Verify baseline quality gates before applying modifications.

- [x] T001 Verify baseline unit test suite passes via `npm test`

---

## Phase 2: Foundational

**Purpose**: Inspect existing test harnesses and baseline behavior for ProjectList component.

- [x] T002 Inspect existing unit test suite in `src/components/__tests__/ProjectList.test.tsx`

---

## Phase 3: User Story 1 - Fix Disappearing Project Card Grid (Priority: P1) 🎯 MVP

**Goal**: Remove the motion entrance wrapper causing cards to freeze at `opacity: 0` in `display: none` containers, ensuring 100% reliable visibility on every tab visit.

**Independent Test**: Switch from Quản Lý Truyện (Alt+5) to Bàn Biên Soạn (Alt+1) and back to Quản Lý Truyện (Alt+5); verify all project cards remain immediately and fully visible with `opacity: 1`.

### Implementation & Testing
- [x] T003 [US1] Remove `CARD_ENTRANCE` variants and `<motion.div>` entrance wrapper around project cards in `src/components/ProjectList.tsx`
- [x] T004 [P] [US1] Add unit tests verifying project card grid rendering and visibility under prop updates in `src/components/__tests__/ProjectList.test.tsx`

**Checkpoint**: At this point, project cards never disappear or freeze transparently when navigating between tabs.

---

## Phase 4: User Story 2 - Preserved Card Functionality & Polish (Priority: P2)

**Goal**: Ensure all card interactions (select project, export json, export text, export epub, share Google Drive, delete) continue operating seamlessly.

**Independent Test**: Click card to select project and switch to workspace; test edit modal, export download, and share modal in Quản Lý Truyện.

### Implementation
- [x] T005 [US2] Verify and validate all interactive handlers and modals in `src/components/ProjectList.tsx`

**Checkpoint**: All project management functions work without any regressions.

---

## Phase 5: Quality Gates & Browser Verification

**Purpose**: Strict Constitution quality assurance and live browser validation.

- [x] T006 [P] Run TypeScript typecheck verification via `npm run lint` (`tsc --noEmit`)
- [x] T007 [P] Run entire unit test suite via `npm test` (`vitest run`)
- [x] T008 Run production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T009 Execute browser verification and capture before/after screenshots via Chrome DevTools MCP

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002)
   │
   ▼
Phase 3: User Story 1 (T003, T004 [P]) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T005)
   │
   ▼
Phase 5: Quality Gates (T006 [P], T007 [P], T008, T009)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Verify baseline tests (`T001`).
2. Implement card grid visibility fix in `ProjectList.tsx` (`T003`).
3. Add unit test coverage in `ProjectList.test.tsx` (`T004`).
4. Validate in browser that tab switching no longer blanks the card grid.

### Full Delivery
5. Complete Phase 4 (`T005` functional interactions validation).
6. Complete Phase 5 (`T006`, `T007`, `T008`, `T009` quality gates and screenshot captures).

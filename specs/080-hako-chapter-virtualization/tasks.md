# Tasks: Hako Checker Chapter Virtualization & Performance Resilience

**Branch**: `080-hako-chapter-virtualization` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify virtualization hooks and test infrastructure

- [X] T001 Inspect and verify virtualization capability in `src/hooks/useVirtualList.ts` for dynamic/fixed item height and overscan support
- [X] T002 Verify test environment and mock IndexedDB harnesses in `src/hooks/__tests__/useHakoReviewSession.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data sanitization and type alignment

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Ensure `sanitizeSession` in `src/services/hakoSessionStore.ts` strictly strips all text payloads and normalizes string IDs before any storage write
- [X] T004 Update and verify type definitions in `src/types/hakoChecker.ts` for virtualized chapter items and string-coerced IDs

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Smooth Scrolling & Instant Toggling for Long Chapter Lists (Priority: P1) 🎯 MVP

**Goal**: Enable high-performance list virtualization for projects with >20 chapters in `HakoChapterSelector`, cutting JS blocking time to <16ms and DOM node count to <50 elements.

**Independent Test**: Load a 139-chapter project, scroll to chapters #120-139, and verify instantaneous checkbox toggle (<16ms) with zero frame drops or white-screen unmounts.

### Tests for User Story 1 🧪
- [X] T005 [P] [US1] Add unit tests for virtual list chapter selection and $O(1)$ set lookup performance in `src/hooks/__tests__/useHakoReviewSession.test.ts`

### Implementation for User Story 1
- [X] T006 [US1] Integrate `useVirtualList` hook and $O(1)$ memoized `Set` lookup into `src/components/hako-checker/HakoChapterSelector.tsx`
- [X] T007 [US1] Implement virtual scroll container, item absolute positioning, and dynamic raw drawer support in `src/components/hako-checker/HakoChapterSelector.tsx`
- [X] T008 [US1] Verify visual states, checkbox toggle feedback, selection counter, and 12-chapter boundary enforcement in `src/components/hako-checker/HakoChapterSelector.tsx`

**Checkpoint**: User Story 1 is functional and testable independently (MVP ready)

---

## Phase 4: User Story 2 - Lightweight & Granular Storage Persistence (Priority: P2)

**Goal**: Prevent heavy `structuredClone` cycles on checkbox toggles, ensuring storage persistence never stalls React UI rendering.

**Independent Test**: Rapidly click multiple checkboxes and verify in IndexedDB that only debounced sanitized metadata is persisted without blocking the main thread.

### Tests for User Story 2 🧪
- [X] T009 [P] [US2] Add unit tests verifying debounced persistence does not clone large strings or block React state in `src/hooks/__tests__/useHakoReviewSession.test.ts`

### Implementation for User Story 2
- [X] T010 [US2] Refactor `toggleChapterSelection`, `selectChapterRange`, and `clearChapterSelection` in `src/hooks/useHakoReviewSession.ts` to guarantee zero main-thread blocking and clean debouncing
- [X] T011 [US2] Optimize `saveSession` in `src/services/hakoSessionStore.ts` to minimize IndexedDB serialization time

**Checkpoint**: User Stories 1 & 2 work seamlessly together

---

## Phase 5: User Story 3 - React 19 StrictMode & Concurrency Stability (Priority: P3)

**Goal**: Guarantee idempotency, timer cleanup, and error resilience under React 19 double-mount and concurrent transitions.

**Independent Test**: Mount workspace under React 19 StrictMode, switch tabs and projects rapidly, and verify zero transaction locks, zero infinite re-renders, and localized ErrorBoundary fallback.

### Tests for User Story 3 🧪
- [X] T012 [P] [US3] Add unit test for React 19 double-mount / concurrent session restoration in `src/hooks/__tests__/useHakoReviewSession.test.ts`

### Implementation for User Story 3
- [X] T013 [US3] Harden `useEffect` lifecycle, timer cleanup, and `sessionRef` synchronization in `src/hooks/useHakoReviewSession.ts`
- [X] T014 [US3] Verify `ErrorBoundary` fault containment and fallback recovery in `src/components/hako-checker/HakoCheckerWorkspace.tsx` and `src/components/ErrorBoundary.tsx`

**Checkpoint**: All user stories functional, robust, and shielded

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification against Constitution quality gates and end-to-end browser testing

- [X] T015 [P] Run full test suite (`npm test`), verifying all 666+ unit/integration tests pass cleanly
- [X] T016 Run TypeScript type-checking (`npm run lint`), ensuring 0 errors
- [X] T017 Run production build (`npm run build`), ensuring clean Vite + esbuild output
- [X] T018 Execute quickstart validation on Chrome DevTools with 139+ chapters project (`Lãnh Chúa`)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories.
- **User Stories (Phases 3-5)**: Depend on Phase 2. Can be implemented incrementally (P1 → P2 → P3).
- **Polish (Phase 6)**: Depends on all user stories being completed.

### Parallel Opportunities
- `T005`, `T009`, `T012` (Unit tests) can run in parallel across test files.
- `T015` and `T016` can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (Phase 1) + Foundational (Phase 2).
2. Implement User Story 1 (Phase 3).
3. Validate smooth virtualized scrolling on 139+ chapters.
4. Deliver MVP.

### Incremental Delivery
1. Foundation ready (Phase 1 + 2)
2. Add US1 (Virtualization & $O(1)$ Lookups) → Test
3. Add US2 (Optimized Storage Persistence) → Test
4. Add US3 (React 19 & Error Boundary Resilience) → Test
5. Polish & Verification (Phase 6)

# Tasks: Fix Tab Navigation Infinite Loop

## Feature Overview
- **Branch**: `056-fix-tab-navigation-loop`
- **Spec**: [`specs/056-fix-tab-navigation-loop/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/056-fix-tab-navigation-loop/spec.md)
- **Plan**: [`specs/056-fix-tab-navigation-loop/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/056-fix-tab-navigation-loop/plan.md)

---

## Phase 1: Setup & Pre-Verification

**Purpose**: Verify baseline quality gates and dev environment before making edits.

- [x] T001 Verify baseline unit tests pass with zero failures via `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core ref architecture in `useChapterCRDT.ts` to prepare hook for callback decoupling.

- [x] T002 Add mutable callback refs `onRemoteChangeRef` and `debouncedSaveToDbRef` in `src/hooks/useChapterCRDT.ts`

---

## Phase 3: User Story 1 & 2 - Bidirectional Tab Navigation & Render Loop Elimination (Priority: P1) 🎯 MVP

**Goal**: Restore full bidirectional tab navigation and eliminate the cascading infinite re-render loop (`Maximum update depth exceeded`) in `useChapterCRDT`.

**Independent Test**: Navigate to any tab (e.g. Tab 3 → Tab 2 → Tab 1) using mouse clicks and hotkeys (`Alt+1`..`Alt+5`), confirming panel switches immediately and console reports 0 update depth errors.

### Implementation
- [x] T003 [US1] Refactor `src/hooks/useChapterCRDT.ts` to invoke `onRemoteChangeRef.current` and remove `onRemoteChange` / `debouncedSaveToDb` from the `useEffect` dependency array
- [x] T004 [P] [US1] Wrap `onRemoteChange` callback in `useCallback` within `src/components/TranslatorWorkspace.tsx`
- [x] T005 [US2] Verify in browser that switching leftward (Tab 5 → Tab 4 → Tab 3 → Tab 2 → Tab 1) updates `activeTab` state and renders the target panel without infinite loop errors

**Checkpoint**: At this point, tab navigation works bidirectionally and the console is completely free of `Maximum update depth exceeded` errors.

---

## Phase 4: User Story 3 - CRDT Real-Time Collaboration Non-Regression (Priority: P2)

**Goal**: Ensure CRDT document updates and remote collaborator synchronization continue functioning correctly through the stabilized ref mechanism.

**Independent Test**: Ensure `onRemoteChange` is called when `doc.on('update')` receives non-local transactions, and existing CRDT tests pass.

### Implementation & Testing
- [x] T006 [US3] Verify Y.Doc remote update listener cleanly invokes `onRemoteChangeRef.current` in `src/hooks/useChapterCRDT.ts`
- [x] T007 [US3] Add unit test assertions in `src/services/__tests__/crdtDocManager.test.ts` verifying `createChapterYDoc` and update handlers remain robust

**Checkpoint**: CRDT real-time collaboration remains 100% functional with zero regressions.

---

## Phase 5: Polish & Quality Gates

**Purpose**: Strict Constitution quality assurance and end-to-end verification.

- [x] T008 [P] Verify type safety with zero type errors via `npm run lint` (`tsc --noEmit`)
- [x] T009 [P] Execute entire unit test suite via `npm test` (`vitest run`)
- [x] T010 Execute production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T011 Execute full manual browser verification scenario from `specs/056-fix-tab-navigation-loop/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002)
   │
   ▼
Phase 3: User Story 1 & 2 (T003, T004 [P], T005) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 3 (T006, T007)
   │
   ▼
Phase 5: Polish & Quality Gates (T008 [P], T009 [P], T010, T011)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Complete T001 (baseline check).
2. Complete T002 + T003 in `src/hooks/useChapterCRDT.ts`.
3. Complete T004 in `src/components/TranslatorWorkspace.tsx`.
4. Validate T005 directly in Chrome DevTools to confirm bidirectional tab switching is restored.

### Full Delivery
5. Complete Phase 4 (CRDT non-regression verification).
6. Complete Phase 5 (all Constitution gates: lint, test, build, browser quickstart).

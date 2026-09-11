# Tasks: Auto-Fix and Targeted AI Sentence Rewriting

**Feature Branch**: `104-audit-auto-fix-rewrite`
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/104-audit-auto-fix-rewrite/spec.md)
**Generated**: 2026-09-10

---

## Phase 1: Foundational — Service Layer

**Purpose**: Add `rewriteSentenceDirect` to the translation engine and `handleApplyAuditFix` to the workspace state hook. These are blocking prerequisites for the UI.

- [x] T001 [P] [US1] Add `DirectRewriteSentenceParams` and `DirectRewriteSentenceResult` interfaces to `src/services/directTranslationEngine.ts`
- [x] T002 [US2] Implement `rewriteSentenceDirect` function in `src/services/directTranslationEngine.ts` using `callGeminiDirect` pattern
- [x] T003 [US1] Implement `handleApplyAuditFix(issue: UnifiedAuditIssue): boolean` in `src/components/translator-workspace/useWorkspaceState.ts`, using CRDT-aware setters only
- [x] T004 [US1] Export `handleApplyAuditFix` from `useWorkspaceState.ts` return object

---

## Phase 2: User Story 1 — One-Click Heuristic Auto-Fix (Priority: P1) 🎯 MVP

**Goal**: Issue cards with `autoFixable: true` show a "Sửa ngay" button that invokes centralized fix handler

**Independent Test**: Click "Sửa ngay" on autoFixable issue, verify text updates and issue resolves

- [x] T005 [US1] Add new props to `UnifiedAuditPanelProps` in `src/components/translator-workspace/UnifiedAuditPanel.tsx`: `onApplyFix`, `apiKeys`, `selectedModel`, `onRewriteSentence`
- [x] T006 [US1] Add local state for `resolvedIssueIds`, `rewritingIssueId`, `pendingPreviews` in `UnifiedAuditPanel`
- [x] T007 [US1] Integrate resolved status into `unifiedIssues` mapping (override status for resolved IDs)
- [x] T008 [US1] Add "Sửa ngay" button on issue cards where `autoFixable && suggestion` in `UnifiedAuditPanel.tsx`
- [x] T009 [US1] Wire "Sửa ngay" button click to call `onApplyFix`, handle success/failure, update `resolvedIssueIds`

**Checkpoint**: Heuristic auto-fix works end-to-end for rule-based issues

---

## Phase 3: User Story 2 — Targeted AI Sentence Rewriting (Priority: P2)

**Goal**: AI critique issues show "Nhờ AI viết lại câu này" with preview workflow

**Independent Test**: Click rewrite button, see loading → preview → confirm/cancel

- [x] T010 [US2] Add "Nhờ AI viết lại câu này" button on `ai_critique` issue cards with `targetText` in `UnifiedAuditPanel.tsx`
- [x] T011 [US2] Wire button to call `rewriteSentenceDirect` (or `onRewriteSentence` prop) with loading state on card
- [x] T012 [US2] Render inline preview box showing AI suggestion with "Áp dụng" / "Hủy" controls
- [x] T013 [US2] Wire "Áp dụng" to call `onApplyFix` with overridden suggestion, mark resolved; wire "Hủy" to dismiss preview

**Checkpoint**: AI rewrite with preview-confirm workflow works end-to-end

---

## Phase 4: User Story 3 — CRDT Integrity & Scope Confinement (Priority: P3)

**Goal**: Ensure 100% CRDT compliance and strict boundary constraint (chỉ sửa 3 file chỉ định)

- [x] T014 [US3] Ensure `handleApplyAuditFix` routes all mutations exclusively through `handlePolishedTranslationChange` / `handleRawTranslationChange`
- [x] T015 [US3] Restrict modifications strictly to `useWorkspaceState.ts`, `directTranslationEngine.ts`, and `UnifiedAuditPanel.tsx`

---

## Phase 5: Tests

**Purpose**: Unit tests for handleApplyAuditFix, rewriteSentenceDirect, and updated UnifiedAuditPanel

- [x] T016 [P] [US1] Add tests for `handleApplyAuditFix` in `src/components/translator-workspace/__tests__/useWorkspaceState.test.ts`: success case, text drift case, CRDT setter verification
- [x] T017 [P] [US2] Add tests for `rewriteSentenceDirect` in `src/services/__tests__/directTranslationEngine.test.ts`: mock callGeminiDirect, assert prompt structure
- [x] T018 [P] [US1] Add tests for "Sửa ngay" button rendering and resolved badge in `src/components/translator-workspace/__tests__/UnifiedAuditPanel.test.tsx`

---

## Phase 6: Polish & Quality Gates

- [x] T019 Run `npm run lint` — must pass with 0 errors
- [x] T020 Run `npm test` — all tests must pass
- [x] T021 Run `npm run build` — must build successfully

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (T001-T004): No dependencies — service + hook layer first
- **Phase 2** (T005-T009): Depends on T003, T004 — needs `handleApplyAuditFix`
- **Phase 3** (T010-T013): Depends on T002, T005-T006 — needs `rewriteSentenceDirect` and panel state
- **Phase 4** (T014-T015): Depends on T003-T004, T005 — prop plumbing
- **Phase 5** (T016-T018): Can start after Phase 1-3 implementations
- **Phase 6** (T019-T021): Final validation after all code changes

### Parallel Opportunities

- T001 can run in parallel (interface only, different from T003)
- T016, T017, T018 can all run in parallel (different test files)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001-T004: Service + hook layer
2. T005-T009: "Sửa ngay" button UI
3. T014-T015: Prop plumbing
4. **VALIDATE**: Auto-fix works, lint/test/build pass

### Incremental Delivery

1. Phase 1 → Foundation ready
2. Phase 2 → MVP: one-click auto-fix
3. Phase 3 → AI rewrite with preview
4. Phase 4 → Full prop wiring
5. Phase 5 → Tests
6. Phase 6 → Quality gates

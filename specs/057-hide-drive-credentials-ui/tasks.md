# Tasks: Hide Default Google Drive Credentials in UI

## Feature Overview
- **Branch**: `057-hide-drive-credentials-ui`
- **Spec**: [`specs/057-hide-drive-credentials-ui/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/057-hide-drive-credentials-ui/spec.md)
- **Plan**: [`specs/057-hide-drive-credentials-ui/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/057-hide-drive-credentials-ui/plan.md)

---

## Phase 1: Setup & Pre-Verification

**Purpose**: Verify baseline quality gates and test suite before making edits.

- [x] T001 Verify baseline unit test suite passes via `npm test`

---

## Phase 2: Foundational (State & Helper Logic)

**Purpose**: Add state hooks and origin detection logic for Google Cloud credentials.

- [x] T002 Add credential origin detection and advanced drawer state in `src/components/google-sync/GoogleSyncModal.tsx`

---

## Phase 3: User Story 1 - Clean Pre-Configured Status (Priority: P1) 🎯 MVP

**Goal**: Hide all raw credential strings and remove prominent "Thay đổi" buttons from the default modal view, showing only clean status badges.

**Independent Test**: Open Google Sync modal when environment variables exist; verify raw strings are completely hidden and "Đã cấu hình sẵn" badge is displayed.

### Implementation
- [x] T003 [US1] Redesign default credential view in `src/components/google-sync/GoogleSyncModal.tsx` to hide raw strings and display status badges
- [x] T004 [US1] Replace prominent "Thay đổi" header buttons with subtle collapsible "Tùy chỉnh nâng cao" trigger in `src/components/google-sync/GoogleSyncModal.tsx`

**Checkpoint**: Standard users opening the modal see a clean, uncluttered dialog with reassuring status badges and zero exposed credential strings.

---

## Phase 4: User Story 2 - Masked Input & Advanced Settings Drawer (Priority: P2)

**Goal**: Provide a collapsible drawer for custom credential overrides with `type="password"`, `Eye`/`EyeOff` toggles, and one-click restore default action.

**Independent Test**: Expand "Tùy chỉnh nâng cao", verify inputs are masked by default, toggle `Eye` icon to reveal text, save custom key, and verify "Khôi phục mặc định" clears custom key.

### Implementation & Testing
- [x] T005 [US2] Implement collapsible advanced drawer with password-masked input fields and Eye/EyeOff toggles in `src/components/google-sync/GoogleSyncModal.tsx`
- [x] T006 [US2] Add one-click "Khôi phục mặc định" action to clear custom localStorage credentials in `src/components/google-sync/GoogleSyncModal.tsx`
- [x] T007 [P] [US2] Add unit test suite verifying credential masking and status badge resolution in `src/components/google-sync/__tests__/GoogleSyncModal.test.ts`

**Checkpoint**: Advanced users can safely enter and manage custom Google Cloud credentials with shoulder-surfing protection.

---

## Phase 5: User Story 3 - Non-Regression & Integration (Priority: P3)

**Goal**: Ensure OAuth PKCE login and Google Picker flow continue executing transparently using effective credentials.

**Independent Test**: Trigger Google login and Google Picker from modal and verify authentication and folder import proceed without errors.

### Implementation & Verification
- [x] T008 [US3] Verify Google OAuth PKCE login and Google Picker trigger seamlessly using effective credentials in `src/components/google-sync/GoogleSyncModal.tsx`

---

## Phase 6: Polish & Quality Gates

**Purpose**: Strict Constitution quality assurance and end-to-end verification.

- [x] T009 [P] Verify type safety with zero type errors via `npm run lint` (`tsc --noEmit`)
- [x] T010 [P] Execute entire unit test suite via `npm test` (`vitest run`)
- [x] T011 Execute production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T012 Execute browser manual validation scenario from `specs/057-hide-drive-credentials-ui/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002)
   │
   ▼
Phase 3: User Story 1 (T003, T004) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T005, T006, T007 [P])
   │
   ▼
Phase 5: User Story 3 (T008)
   │
   ▼
Phase 6: Polish & Quality Gates (T009 [P], T010 [P], T011, T012)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Complete T001 (baseline check).
2. Complete T002 + T003 + T004 in `GoogleSyncModal.tsx`.
3. Verify in browser that the modal opens with clean status badges and zero raw strings exposed.

### Full Delivery
4. Complete Phase 4 (advanced drawer with masked password inputs & unit tests).
5. Complete Phase 5 (verify OAuth PKCE and Picker flow).
6. Complete Phase 6 (all Constitution quality gates).

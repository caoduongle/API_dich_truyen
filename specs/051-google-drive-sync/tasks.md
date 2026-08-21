# Tasks: Client-Side Google Authentication & Google Drive Sync

**Feature Directory**: `specs/051-google-drive-sync`
**Branch**: `051-google-drive-sync`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & Types

**Purpose**: Establish core TypeScript types and models for Google authentication and Drive synchronization.

- [x] T001 [P] Create TypeScript interfaces for Google Auth (`GoogleUserProfile`, `GoogleAuthState`, `PKCEChallenge`) in `src/types/googleAuth.ts`
- [x] T002 [P] Create TypeScript interfaces for Google Drive Sync (`DriveSyncManifest`, `DriveProjectSummary`, `SyncProgress`, `SyncConflictInfo`) in `src/types/googleDriveSync.ts`

---

## Phase 2: Foundational (PKCE Helper & Auth Service)

**Purpose**: Core cryptographic PKCE generation and Google OAuth 2.0 client-side authentication engine.

**⚠️ CRITICAL**: Must complete before building UI components and Drive sync services.

- [x] T003 [P] Write unit tests for Web Crypto PKCE generator in `src/services/__tests__/pkceHelper.test.ts`
- [x] T004 Implement Web Crypto PKCE verifier, SHA-256 challenge, and random state generator in `src/services/pkceHelper.ts`
- [x] T005 Implement `googleAuthService.ts` for direct client-side OAuth 2.0 PKCE flow, token exchange, user info fetching, and session management in `src/services/googleAuthService.ts`

**Checkpoint**: Browser can generate PKCE challenges, initiate Google login, and exchange authorization codes directly for tokens.

---

## Phase 3: User Story 1 - Client-Side Google Authentication with OAuth 2.0 PKCE (Priority: P1) 🎯 MVP

**Goal**: Allow users to log in with Google directly from the UI, view their profile in the navbar, and manage auth state without any server proxying.

**Independent Test**: Click "Đăng nhập Google" in navbar, verify Google OAuth popup/redirect, confirm profile avatar/name display in header, and confirm 0 server token calls.

### Implementation for User Story 1

- [x] T006 [P] [US1] Create `src/components/google-sync/GoogleUserButton.tsx` rendering Google avatar, name, and sync status badge in top navigation
- [x] T007 [US1] Integrate `GoogleUserButton` and OAuth redirect callback parameter handling in `src/App.tsx`

**Checkpoint**: User Story 1 fully functional — user can log in with Google and see profile in header.

---

## Phase 4: User Story 2 - Optional Bi-Directional Google Drive Cloud Sync (Priority: P1)

**Goal**: Enable optional bi-directional synchronization of IndexedDB projects, chapters, and glossaries with a dedicated folder in user's Google Drive.

**Independent Test**: Perform Push (Backup) to Drive, inspect `drive.google.com` to verify `AI_Dich_Truyen_Data` folder and JSON files, perform Pull (Restore) on a clean session to verify restoration into IndexedDB.

### Tests for User Story 2

- [x] T008 [P] [US2] Write unit tests for Drive manifest serialization and bi-directional timestamp merge in `src/services/__tests__/googleDriveSyncService.test.ts`

### Implementation for User Story 2

- [x] T009 [US2] Implement `googleDriveSyncService.ts` with `drive.file` folder management (`AI_Dich_Truyen_Data`), multipart JSON upload, JSON download, and IndexedDB sync reconciliation in `src/services/googleDriveSyncService.ts`
- [x] T010 [US2] Create `src/components/google-sync/GoogleSyncModal.tsx` for managing Google login, Client ID input, manual Push/Pull, and progress indicators

**Checkpoint**: User Story 2 fully functional — bidirectional backup and restore with Google Drive works smoothly.

---

## Phase 5: User Story 3 - Offline-First Resilience, Sync Conflict Resolution & Logout (Priority: P2)

**Goal**: Provide clear sync status, handle conflicting edits gracefully, and ensure complete in-memory credential cleanup on sign-out.

**Independent Test**: Test token expiration recovery, trigger conflicting edit scenarios in modal, and verify that Sign-out wipes in-memory credentials without deleting local IndexedDB books.

### Implementation for User Story 3

- [x] T011 [US3] Add conflict resolution dialog and token refresh/expiry handling in `src/components/google-sync/GoogleSyncModal.tsx` and `src/services/googleDriveSyncService.ts`
- [x] T012 [US3] Implement clean logout in `googleAuthService.ts` and `GoogleSyncModal.tsx` ensuring in-memory token wiping while preserving local IndexedDB data

**Checkpoint**: User Story 3 fully functional — error recovery, conflict handling, and logout are robust.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, documentation, and verification gates.

- [x] T013 Update `.env.example` with `VITE_GOOGLE_CLIENT_ID` documentation
- [x] T014 Update `README.md` and `docs/privacy-policy.md` describing client-side Google Drive sync with minimal `drive.file` scope
- [x] T015 Run full typecheck with `npm run lint` (`tsc --noEmit`)
- [x] T016 Run full test suite with `npm test` (`vitest run`)
- [x] T017 Verify production build with `npm run build` (`vite build` + esbuild server)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Types (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion (runs after US1).
- **User Story 3 (Phase 5)**: Depends on US2 completion.
- **Polish (Phase 6)**: Runs after all user stories are complete.

### User Story Completion Order

```text
Setup & Types (Phase 1) ──► Foundational (Phase 2) ──► US1 (Google Login MVP) ──► US2 (Drive Sync) ──► US3 (Conflict & Resilience) ──► Polish
```

---

## Parallel Opportunities

- **Phase 1**: T001 (`src/types/googleAuth.ts`) and T002 (`src/types/googleDriveSync.ts`) can run in parallel.
- **Phase 2**: T003 (unit test in `pkceHelper.test.ts`) can be written in parallel with T004.
- **Phase 4**: T008 (unit test in `googleDriveSyncService.test.ts`) can be written before implementation T009.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1 (Types) and Phase 2 (PKCE + GoogleAuthService).
2. Complete Phase 3 (GoogleUserButton + App.tsx integration).
3. Validate User Story 1 (Google Login & Profile display) independently.

### Incremental Delivery
1. Foundation: PKCE generator & Google auth service.
2. User Story 1: Google Sign-in button, avatar in navbar, profile inspection.
3. User Story 2: Google Drive API integration, Push (Backup) & Pull (Restore) modal.
4. User Story 3: Conflict resolution, token expiry refresh, and logout.
5. Polish: Typecheck, vitest test suites, production build, and documentation updates.

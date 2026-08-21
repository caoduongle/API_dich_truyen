# Tasks: Project Sharing & Multi-User Collaboration via Google Drive

**Feature Directory**: `specs/052-drive-collaboration`
**Branch**: `052-drive-collaboration`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & Primitives

**Purpose**: Establish reusable UI modal primitive and extended TypeScript types for collaboration.

- [x] T001 [P] Create reusable accessible modal primitive `src/components/ui/Modal.tsx` following design system
- [x] T002 [P] Update `src/types.ts` and `src/types/googleDriveSync.ts` with collaboration metadata (`driveFolderId`, `driveStorageFormat`, `isShared`, `collaborators`, `CollaboratorPermission`, `SharedProjectManifest`, `ChapterConflictInfo`)

---

## Phase 2: Foundational (Services & Core Logic)

**Purpose**: Core client-side services for Drive Permissions, Google Picker dynamic loader, and granular chapter storage migration.

**⚠️ CRITICAL**: Must complete before implementing collaboration UI components.

- [x] T003 [P] Write unit tests for Permissions API payload formatting in `src/services/__tests__/googleDrivePermissionsService.test.ts`
- [x] T004 Implement Google Drive Permissions API client (`shareFolderWithUser`, `listFolderCollaborators`, `revokeFolderPermission`) in `src/services/googleDrivePermissionsService.ts`
- [x] T005 Implement dynamic Google Picker script loader and folder picker builder in `src/services/googlePickerService.ts`
- [x] T006 [P] Write unit tests for granular chapter sync and conflict reconciliation in `src/services/__tests__/granularSyncReconciliation.test.ts`
- [x] T007 Implement `migrateProjectToGranularSubfolder`, `syncGranularProject`, and `importProjectFromSharedFolder` in `src/services/googleDriveSyncService.ts`

**Checkpoint**: Services can migrate project storage, grant Drive permissions, open Google Picker, and sync individual chapters.

---

## Phase 3: User Story 1 & 2 - Project Subfolder Migration & Share Modal (Priority: P1) 🎯 MVP

**Goal**: Allow project owners to migrate a project to a dedicated sub-folder on first share, grant writer permissions to collaborators by email, and manage active collaborators.

**Independent Test**: Click "Chia sẻ" on a project card in `ProjectList.tsx`, verify automatic creation of `AI_Dich_Truyen_Data/{projectId}/` subfolder with separate `chapter_*.json` files, input collaborator email and verify writer permission grant via Drive API.

### Implementation for User Story 1 & 2

- [x] T008 [US1/US2] Create `src/components/google-sync/ShareProjectModal.tsx` for inviting collaborators, managing permissions, and triggering auto-migration
- [x] T009 [US1/US2] Add "Chia sẻ" action button to project cards in `src/components/ProjectList.tsx` and connect with `ShareProjectModal`

**Checkpoint**: Project owner can migrate and share a project with collaborators.

---

## Phase 4: User Story 3 - Open Shared Project via Google Picker (Priority: P1)

**Goal**: Allow collaborators to pick and import shared project folders into their IndexedDB workspace using Google Picker.

**Independent Test**: Log in as Collaborator B, click "Mở dự án được chia sẻ" in `GoogleSyncModal.tsx`, pick the shared folder in Google Picker, verify that project metadata and all chapters are imported into IndexedDB.

### Implementation for User Story 3

- [x] T010 [US3] Update `src/components/google-sync/GoogleSyncModal.tsx` to include "Mở dự án được chia sẻ" trigger (calling Google Picker) and Developer API Key configuration
- [x] T011 [US3] Connect Google Picker folder selection callback with `importProjectFromSharedFolder` and auto-bind `driveFolderId` in `src/App.tsx` and `GoogleSyncModal.tsx`

**Checkpoint**: Collaborator can open shared projects via Google Picker and sync them locally.

---

## Phase 5: User Story 4 - Chapter-Level Granular Sync & Conflict Resolution (Priority: P2)

**Goal**: Provide granular chapter sync where different collaborators can edit different chapters simultaneously, and resolve conflicting edits on the same chapter gracefully.

**Independent Test**: Simulate diverged edits on the same chapter, trigger sync, verify Chapter Conflict Modal appearance, test "Save as Copy" to verify local chapter forking and remote chapter pull.

### Implementation for User Story 4

- [x] T012 [US4] Create `src/components/google-sync/ChapterConflictModal.tsx` displaying diverged chapter details and resolution options (Keep Local, Use Remote, Save as Copy)
- [x] T013 [US4] Integrate `ChapterConflictModal` into sync workflow when granular conflicts are detected during `syncGranularProject`

**Checkpoint**: Chapter-level concurrent editing and conflict resolution are fully functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality assurance, documentation, and verification gates.

- [x] T014 Update `.env.example` with `VITE_GOOGLE_PICKER_API_KEY` documentation
- [x] T015 Update `README.md` and `docs/privacy-policy.md` describing project sharing and multi-user collaboration via Google Drive
- [x] T016 Run full typecheck with `npm run lint` (`tsc --noEmit`)
- [x] T017 Run full test suite with `npm test` (`vitest run`)
- [x] T018 Verify production build with `npm run build` (`vite build` + esbuild server)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Primitives (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user story phases.
- **User Story 1 & 2 (Phase 3)**: Depends on Foundational completion.
- **User Story 3 (Phase 4)**: Depends on Phase 3 completion.
- **User Story 4 (Phase 5)**: Depends on Phase 4 completion.
- **Polish (Phase 6)**: Runs after all user stories are complete.

### User Story Completion Order

```text
Setup & Primitives (Phase 1) ──► Foundational (Phase 2) ──► US1 & US2 (Share & Migrate MVP) ──► US3 (Picker Import) ──► US4 (Chapter Sync & Conflict) ──► Polish
```

---

## Parallel Opportunities

- **Phase 1**: T001 (`src/components/ui/Modal.tsx`) and T002 (`src/types/` updates) can run in parallel.
- **Phase 2**: T003 (unit test) can run in parallel with T004, and T006 (unit test) can run in parallel with T007.

---

## Implementation Strategy

### MVP First (User Story 1 & 2 Only)
1. Complete Phase 1 (Modal & Types) and Phase 2 (Permissions Service, Picker Service, Granular Migration).
2. Complete Phase 3 (ShareProjectModal & ProjectList button).
3. Validate User Story 1 & 2 (Project subfolder migration & sharing) independently.

### Incremental Delivery
1. Foundation: Permissions API client, Picker loader, Granular migration engine.
2. User Story 1 & 2: Share modal, subfolder isolation, permission management.
3. User Story 3: Google Picker integration, import shared project.
4. User Story 4: Granular chapter sync and chapter conflict resolution modal.
5. Polish: Typecheck, test suite, build, and documentation updates.

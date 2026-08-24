# Feature Specification: Fix Single-File Bundle Sharing Wiring & Permission Scoping

**Feature Branch**: `074-fix-bundle-share-wiring`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Sửa lỗi nối dây (wiring) trong 072-drive-bundle-crdt-sync: luồng 'bắt đầu chia sẻ dự án' chưa thực sự dùng kiến trúc bundle 1-file, khiến bug 404/ trùng file gốc vẫn còn nguyên cho mọi lượt chia sẻ mới từ giờ trở đi."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New Project Sharing with Single-File Bundle Architecture (Priority: P1) 🎯 MVP

As a project owner sharing a novel for the first time, I want clicking "Khởi tạo và Sẵn sàng chia sẻ" to package and upload my novel as a single bundle file directly into the shared application root directory and grant access specifically to that single bundle file, so that invited collaborators can immediately find and import the project without 404 missing chapter errors or file duplication.

**Why this priority**: Without this wiring, all newly shared projects continue to produce the legacy fragmented multi-file folder structure, rendering them impossible to import using the new single-file bundle Picker and leaving the core 404/duplicate file issues unresolved.

**Independent Test**:
1. Take an unshared project (storage format unset or monolithic).
2. Open the Share modal and click "Khởi tạo gói 1-file & Sẵn sàng chia sẻ".
3. Verify the project is packaged into a single bundle file (`driveStorageFormat === 'bundle'`) with a valid `driveFileId`.
4. Invite a collaborator email and verify permissions are attached strictly to the single bundle file ID.
5. Have the collaborator open the file picker and select the bundle file; verify successful 1-step import without errors.

**Acceptance Scenarios**:

1. **Given** an unshared or monolithic project, **When** the owner opens the Share modal and initiates sharing, **Then** the system executes single-file bundle migration, stores `driveFileId` on the project record, sets `driveStorageFormat` to `bundle`, and displays collaborator management controls.
2. **Given** a newly migrated bundle project, **When** the owner invites a collaborator by email with reader/writer role, **Then** the permission is assigned directly to the bundle's `driveFileId` (not the parent folder), preserving privacy for other projects stored in the root folder.
3. **Given** a collaborator receiving access to a bundle project, **When** they use the bundle file picker to import the project, **Then** the project and all chapters are imported into local storage in a single operation.

---

### User Story 2 - Backward-Compatible Management & Explicit Upgrade for Granular Projects (Priority: P2)

As a project owner with an existing project previously shared under the legacy multi-file granular structure, I want my existing shared project to continue functioning with folder-level permissions, while having an explicit, opt-in button to upgrade the project to the single-file bundle format at a time of my choosing.

**Why this priority**: Existing collaborations already have collaborators assigned at the folder level. Silently auto-migrating granular projects during background push generates a new file ID and invalidates existing collaborator access without warning. An explicit owner action ensures collaborators can be informed and re-invited cleanly.

**Independent Test**:
1. Open a project that already has `driveStorageFormat === 'granular'` and a valid `driveFolderId`.
2. Open the Share modal and confirm existing collaborators are listed correctly via `driveFolderId`.
3. Confirm an "Nâng cấp lên gói 1-file" action button is visible with explanatory guidance.
4. Click the upgrade button, confirm the action, and verify the project transitions to `driveStorageFormat === 'bundle'` with a new `driveFileId`.

**Acceptance Scenarios**:

1. **Given** a project with legacy granular storage format, **When** the owner opens the Share modal, **Then** the modal lists existing collaborators by querying permissions on `driveFolderId` and shows an optional "Nâng cấp lên gói 1-file" action.
2. **Given** a legacy granular project, **When** background sync runs, **Then** the system synchronizes using the granular sync flow without performing silent background file conversions.
3. **Given** the owner explicitly clicks "Nâng cấp lên gói 1-file", **When** migration completes, **Then** the project updates to `bundle` format, saves `driveFileId`, and transitions the UI to bundle-scoped collaborator management.

---

### User Story 3 - Resource-Agnostic Permission Management & Clear Privacy Communication (Priority: P3)

As a project owner or collaborator, I want permission management functions to work seamlessly on both individual Drive files (bundles) and Drive folders (legacy granular projects), with UI banners accurately explaining how access boundaries work, so that I can trust my other private projects remain inaccessible to invitees.

**Why this priority**: The Google Drive Permissions API supports both file and folder resources on identical endpoints (`/files/{resourceId}/permissions`). Generalizing the permission service prevents code duplication and prevents accidental folder-level leakage for bundle files.

**Independent Test**:
1. Invoke the permission service methods (`share`, `list`, `revoke`) passing a file ID (bundle); verify correct HTTP calls and permissions response.
2. Invoke the same methods passing a folder ID (granular); verify backward compatibility.
3. Inspect the Share modal informational banner; verify text accurately describes single-file isolation in the shared app folder.

**Acceptance Scenarios**:

1. **Given** a valid Google Drive resource identifier (file ID or folder ID), **When** sharing, listing, or revoking permissions, **Then** the permission service executes successfully against the target resource without breaking existing callers.
2. **Given** an owner viewing the Share modal, **When** reading the security/privacy notice, **Then** the notice clearly communicates that bundle projects grant access exclusively to the individual project bundle file within the application directory.

---

### Edge Cases

- **Token Expiration during Migration or Permission Grant**: If the Google OAuth access token expires during bundle creation or permission changes, the UI displays a clear re-authentication notice without corrupting project state.
- **Upgrading Granular Project with Active Collaborators**: When upgrading from granular to bundle, the owner is warned that previous collaborators will need access to the new bundle file and will need to import the project once via the bundle picker.
- **Offline / Network Interruption during Share Initialization**: If network fails during bundle upload or permission update, local project state rolls back gracefully and allows re-trying without leaving orphaned partial state.
- **Revoking Last Collaborator**: Revoking the only collaborator on a bundle file transitions the collaborator list cleanly to an empty state message without UI errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project sharing initialization flow MUST invoke `migrateOwnerProjectToBundle()` instead of `migrateProjectToGranularSubfolder()` when preparing an unshared/monolithic project for collaboration.
- **FR-002**: The project sharing modal (`ShareProjectModal`) MUST distinguish between three distinct storage states:
  - **State A (Unshared/Monolithic)**: Prompts owner to initialize 1-file bundle storage (`migrateOwnerProjectToBundle`).
  - **State B (Legacy Granular)**: Manages collaborators via `driveFolderId` and presents an explicit, owner-initiated "Nâng cấp lên gói 1-file" upgrade button.
  - **State C (Bundle 1-File)**: Manages collaborators via `driveFileId`.
- **FR-003**: The Google Drive Permissions Service MUST generalize its methods (`shareFolderWithUser` -> resource-level, `listFolderCollaborators` -> resource-level, `revokeFolderPermission` -> resource-level) to accept any Google Drive `resourceId` (file or folder), maintaining backward compatibility with all existing callers.
- **FR-004**: Adding a collaborator to a bundle project MUST assign permissions directly to the project's `driveFileId` and MUST NOT assign permissions to the parent application folder (`ensureAppFolder`).
- **FR-005**: Automatic background push sync MUST NOT silently mutate legacy granular projects to bundle format; migration MUST only occur via explicit owner interaction in the sharing interface.
- **FR-006**: Specification 072 task documentation (`specs/072-drive-bundle-crdt-sync/tasks.md` Task T018) MUST be updated to reflect the rectified requirement (explicit owner-triggered upgrade rather than silent background sync upgrade).
- **FR-007**: The security information banner in `ShareProjectModal` MUST accurately describe that bundle projects are stored as individual files in the shared application folder, with permissions strictly bounded to that specific file.

### Key Entities

- **StoryProject**: Local database entity containing `id`, `title`, `driveFileId` (optional Drive file ID for bundle format), `driveFolderId` (optional Drive folder ID for legacy granular format), and `driveStorageFormat` (`'monolithic' | 'granular' | 'bundle'`).
- **CollaboratorPermission**: Represents an invited user's access rights (`permissionId`, `emailAddress`, `displayName`, `role`: `'owner' | 'writer' | 'reader'`, `photoLink`).
- **ProjectBundle**: Single JSON document payload encompassing the complete project metadata, chapter contents, and CRDT sync snapshots.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly shared projects initialize in single-file bundle format without creating granular subfolders or multi-file chapter hierarchies.
- **SC-002**: 0% accidental parent-folder permission leaks when inviting collaborators to bundle projects (permissions granted strictly to the target file resource).
- **SC-003**: 100% of existing legacy granular projects remain operational with their original folder-based collaborator settings until explicitly upgraded by the owner.
- **SC-004**: Collaborator addition, listing, and revocation operations complete within 3 seconds under normal network conditions for both file and folder targets.
- **SC-005**: 100% pass rate across the test suite (`vitest run`), 0 TypeScript compile errors (`tsc --noEmit`), and successful production build (`vite build`).

## Assumptions

- Google Drive Permissions REST API (`/drive/v3/files/{fileId}/permissions`) supports identical CRUD operations whether `{fileId}` references a file or a folder resource.
- The project owner has valid Google OAuth authorization with `drive.file` scope.
- Existing collaborators on legacy granular projects will continue to sync via the granular protocol until the owner explicitly converts the project to a bundle and re-shares the file.
- The application root folder (`AI_Dich_Truyen_Data`) is private to the owner and never shared in its entirety.

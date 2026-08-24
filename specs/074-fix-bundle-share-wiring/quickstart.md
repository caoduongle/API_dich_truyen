# Quickstart & Verification Guide: Single-File Bundle Sharing

**Feature Branch**: `074-fix-bundle-share-wiring`
**Date**: 2026-08-24
**Status**: Completed

## Prerequisites
- Node.js environment configured.
- Existing dependencies installed (`npm install`).

## Automated Verification

Run the project verification commands:

```bash
# 1. Type Check
npm run lint

# 2. Test Suite Execution
npm test

# 3. Production Build
npm run build
```

---

## Validation Scenarios

### Scenario 1: Unshared Project Initialization (State A -> State C)
1. In the application, select a newly created project without Drive sync.
2. Click the "Chia sẻ" action to open `ShareProjectModal`.
3. Verify the modal displays "Chuẩn bị dự án để chia sẻ" and the action button "Khởi tạo gói 1-file & Sẵn sàng chia sẻ".
4. Click the initialization button.
5. Verify the project is uploaded as a single bundle file (`driveFileId` assigned, `driveStorageFormat === 'bundle'`).
6. Verify the UI transitions to show the collaborator invitation form and collaborator list.

### Scenario 2: Collaborator Sharing on Bundle File
1. With the bundle project open in `ShareProjectModal`, enter a collaborator's email and select "Quyền chỉnh sửa (Dịch)".
2. Click "Cấp quyền".
3. Verify that the permission is created on `project.driveFileId` (not the root app folder).
4. Verify the collaborator appears in the active collaborators list with their profile image or initial.

### Scenario 3: Legacy Granular Project Handling & Manual Upgrade (State B -> State C)
1. Open a project configured with `driveStorageFormat === 'granular'` and `driveFolderId`.
2. Open `ShareProjectModal`.
3. Verify that existing collaborators are listed via `driveFolderId`.
4. Verify the optional upgrade button "Nâng cấp lên gói 1-file" is present.
5. Click "Nâng cấp lên gói 1-file", confirm the prompt.
6. Verify that `migrateOwnerProjectToBundle` executes, assigns `driveFileId`, and updates `driveStorageFormat` to `bundle`.

### Scenario 4: Google Drive Permissions Service Generalization
1. Execute unit test `src/services/__tests__/googleDrivePermissionsService.test.ts`.
2. Verify all tests pass for sharing, listing, and revoking permissions against file and folder resources.

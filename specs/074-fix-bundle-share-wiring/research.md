# Research: Fix Single-File Bundle Sharing Wiring & Permission Scoping

**Feature Branch**: `074-fix-bundle-share-wiring`
**Date**: 2026-08-24
**Status**: Completed

## Executive Summary

The single-file bundle architecture created in Spec 072 provides atomic 1-file project storage and conflict-free CRDT synchronization. However, the sharing initiation UI (`ShareProjectModal.tsx`) remained wired to the legacy `migrateProjectToGranularSubfolder()` method, leaving newly shared projects in the deprecated granular structure. In addition, the permissions service assumed folder targets (`folderId`), which if used with bundle files without careful scoping could risk either failing or inadvertently sharing folder resources.

This research establishes the design decisions for:
1. Routing all new sharing actions to `migrateOwnerProjectToBundle()`.
2. Managing permissions strictly on `driveFileId` for bundle projects and `driveFolderId` for legacy granular projects.
3. Providing an explicit (non-automatic) upgrade path for legacy granular projects.
4. Generalizing the Google Drive permissions service to handle any Drive `resourceId`.

---

## Technical Decisions & Rationale

### Decision 1: Default to `migrateOwnerProjectToBundle()` for New Projects

- **Decision**: In `ShareProjectModal.tsx`, when an unshared or monolithic project begins the sharing flow, invoke `googleDriveSyncService.migrateOwnerProjectToBundle()` instead of `migrateProjectToGranularSubfolder()`.
- **Rationale**:
  - The single-file bundle format (`project_bundle_{projectId}.json`) is the standardized sharing model from Spec 072 onwards.
  - Granular multi-file format creates 404 missing chapter bugs and duplicate file pollution.
  - The collaborator Picker UI (`openBundlePicker`) only accepts 1-file JSON bundles; projects created in granular format cannot be imported by collaborators.
- **Alternatives Considered**:
  - *Keep granular subfolder creation as an option*: Rejected because granular subfolders are deprecated and introduce severe file fragmentation and sync race conditions.

---

### Decision 2: Tri-State UI & Explicit Migration for Legacy Projects

- **Decision**: `ShareProjectModal.tsx` supports three distinct states:
  1. **Unshared/Monolithic** (`!driveFolderId && !driveFileId` or `driveStorageFormat === 'monolithic'` or undefined): Action button runs `migrateOwnerProjectToBundle()`.
  2. **Legacy Granular** (`driveStorageFormat === 'granular' && !!driveFolderId`): Collaborators managed via `driveFolderId`; provides an explicit "Nâng cấp lên gói 1-file" button with confirmation modal.
  3. **Bundle** (`driveStorageFormat === 'bundle' && !!driveFileId`): Collaborators managed via `driveFileId`.
- **Rationale**:
  - Silently upgrading legacy granular projects during background sync (as originally drafted in T018) would create a new `driveFileId`. Previous collaborators who were granted folder permissions on `driveFolderId` would not automatically have permissions on the newly created bundle file in the root folder, and their pickers would lose access without warning.
  - Requiring the owner to explicitly trigger migration ensures they are aware that previous collaborators must be re-invited or given access to the new bundle file.
- **Alternatives Considered**:
  - *Automatic silent background upgrade*: Rejected due to privacy and collaborator permission invalidation risks.

---

### Decision 3: Generalization of Google Drive Permissions Service

- **Decision**: In `googleDrivePermissionsService.ts`, rename parameters from `folderId: string` to `resourceId: string` and provide aliases or keep existing method names with generalized parameter signatures (`shareResourceWithUser`, `listCollaborators`, `revokePermission` alongside backward-compatible signatures).
- **Rationale**:
  - The Google Drive v3 REST API endpoint `https://www.googleapis.com/drive/v3/files/{fileId}/permissions` treats folders and files identically (folders are simply files with MIME type `application/vnd.google-apps.folder`).
  - No endpoint changes are required. Generalizing parameter names documents intent clearly and guarantees that permissions can be set on file IDs (`project.driveFileId`) or folder IDs (`project.driveFolderId`).
- **Privacy Security Guarantee**:
  - When `resourceId` is `project.driveFileId`, Drive assigns permissions *exclusively* to `project_bundle_{id}.json`.
  - The parent app folder (`AI_Dich_Truyen_Data`) and all other project files therein remain 100% private to the owner.

---

### Decision 4: Rectification of Spec 072 Task T018

- **Decision**: Update `specs/072-drive-bundle-crdt-sync/tasks.md` Task T018 from claiming "automatic on next push" to "explicit owner-triggered upgrade in ShareProjectModal".
- **Rationale**: Keeps task tracking documents in sync with production architecture and prevents future confusion regarding background sync behavior.

---

## Constitution Compliance Check

| Principle | Assessment | Status |
|-----------|------------|--------|
| **I. Strict Quality Gates** | Plan includes full `tsc --noEmit`, `vitest run`, and `vite build` verification with dedicated unit tests. | PASS |
| **II. Dependency Minimization** | Uses existing React 19, Lucide icons, and Google Drive REST client; no new packages added. | PASS |
| **III. Concern Separation** | Changes isolated to `src/services/googleDrivePermissionsService.ts`, `ShareProjectModal.tsx`, and test files. Does not touch translation pipeline. | PASS |
| **IV. Storage Stability** | Preserves `StoryProject` interface and IndexedDB schema without breaking migrations. | PASS |
| **V. Atomic Commits & Docs** | Clear, scoped changes with updated spec/plan/tasks documentation. | PASS |

# Interface Contract: Share Project Modal & Permissions Service

**Feature Branch**: `074-fix-bundle-share-wiring`
**Date**: 2026-08-24
**Status**: Completed

## 1. Component Contract: `ShareProjectModal.tsx`

### 1.1 Props

```typescript
interface ShareProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: StoryProject | null;
  onProjectUpdated?: (project: StoryProject) => void;
}
```

### 1.2 State Detection Logic

```typescript
// State C: Project is in modern single-file bundle format
const isBundle = project?.driveStorageFormat === 'bundle' && !!project?.driveFileId;

// State B: Project is in legacy granular multi-file format
const isGranular = project?.driveStorageFormat === 'granular' && !!project?.driveFolderId;

// Active resource ID used for permissions API calls
const targetResourceId = isBundle ? project?.driveFileId : (isGranular ? project?.driveFolderId : null);

// Can manage collaborators
const canManageCollaborators = !!targetResourceId;
```

### 1.3 Action Contracts

1. **Initial Migration (State A -> State C)**:
   ```typescript
   const handleMigrate = async () => {
     // Invokes googleDriveSyncService.migrateOwnerProjectToBundle
     const fileId = await googleDriveSyncService.migrateOwnerProjectToBundle(
       token,
       project.id,
       setMigrationProgress
     );
     // Re-fetches project from DB, calls onProjectUpdated, loads collaborators
   };
   ```

2. **Explicit Upgrade (State B -> State C)**:
   ```typescript
   const handleUpgradeToBundle = async () => {
     // Prompts confirmation warning regarding collaborator re-invites
     // Invokes googleDriveSyncService.migrateOwnerProjectToBundle
     // Updates project state and loads bundle-scoped collaborators
   };
   ```

3. **Collaborator Operations (State B or State C)**:
   ```typescript
   // List:
   await googleDrivePermissionsService.listFolderCollaborators(token, targetResourceId);

   // Add:
   await googleDrivePermissionsService.shareFolderWithUser(token, targetResourceId, email, role);

   // Revoke:
   await googleDrivePermissionsService.revokeFolderPermission(token, targetResourceId, permissionId);
   ```

---

## 2. API Contract: Google Drive v3 Permissions Endpoints

All permissions requests target `https://www.googleapis.com/drive/v3/files/{resourceId}/permissions`.

### 2.1 Create Permission
- **Method**: `POST`
- **Path**: `/drive/v3/files/{resourceId}/permissions?fields=id,role,type,emailAddress,displayName,photoLink&sendNotificationEmail=false`
- **Request Body**:
  ```json
  {
    "role": "writer" | "reader",
    "type": "user",
    "emailAddress": "collaborator@example.com"
  }
  ```
- **Response**: `200 OK` with `CollaboratorPermission` fields.

### 2.2 List Permissions
- **Method**: `GET`
- **Path**: `/drive/v3/files/{resourceId}/permissions?fields=permissions(id,role,type,emailAddress,displayName,photoLink)`
- **Response**: `200 OK` with list of permissions.

### 2.3 Delete Permission
- **Method**: `DELETE`
- **Path**: `/drive/v3/files/{resourceId}/permissions/{permissionId}`
- **Response**: `204 No Content`.

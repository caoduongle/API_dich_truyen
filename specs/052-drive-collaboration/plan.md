# Implementation Plan: Project Sharing & Multi-User Collaboration via Google Drive

**Feature Directory**: `specs/052-drive-collaboration`
**Date**: 2026-08-22

---

## 1. Technical Context

- **Goal**: Expand on the personal Google Drive sync engine (`specs/051-google-drive-sync`) to support multi-user project sharing and collaborative chapter translation (for 2–5 translators) directly through Google Drive.
- **Architecture**:
  - **Auth Reuse**: Reuses `src/services/pkceHelper.ts` and `src/services/googleAuthService.ts` 100% without rewriting or modifying the authentication handshake.
  - **Sub-folder Isolation & Granular Migration**: On first share, project is migrated to a dedicated sub-folder `AI_Dich_Truyen_Data/{projectId}/` with individual `chapter_{chapterId}.json` files. Unshared projects stay in monolithic single-file format (`project_{id}.json` + `chapters_{id}.json`) to guarantee 0 regressions.
  - **Google Drive Permissions API**: Calls `POST /files/{folderId}/permissions` (role: `writer`, type: `user`) to grant access directly under the `drive.file` minimal scope.
  - **Google Picker API (Zero NPM Package)**: Dynamically injects `https://apis.google.com/js/api.js` at runtime when collaborator opens a shared folder.
  - **Chapter-Level Conflict Resolution**: Compares `updatedAt` timestamps per chapter. Triggers Chapter Conflict Modal (Keep Local / Use Remote / Save as Copy) only on actual diverged edits.
  - **Zero Server Storage / Zero Real-Time WebSocket**: Remains strictly client-side and manual Push/Pull.
  - **Core Translation Isolation**: `directGeminiClient.ts` and `directTranslationEngine.ts` remain untouched.

---

## 2. Constitution & Quality Gates Check

- [x] **Principle I (Quality Gates)**: `npm run lint`, `npm test`, and `npm run build` must pass cleanly.
- [x] **Principle II (Dependency Minimization)**: 0 new NPM packages added. Google Picker loaded via standard browser dynamic script tag.
- [x] **Principle III (Domain Separation)**: Scoped strictly to client collaboration modules (`src/services/`, `src/components/google-sync/`).
- [x] **Principle IV (Core Schemas)**: `src/types.ts` schemas extended backwards-compatibly (`driveFolderId`, `driveStorageFormat`, `isShared`, `collaborators`).
- [x] **Principle V (Review-Driven Development)**: Itemized file plan and Google Cloud setup steps presented for review.

---

## 3. Manual Steps Required on Google Cloud Console (For User)

In addition to the OAuth Client ID already created in Feature 051, please perform the following steps in the Google Cloud Console:

1. **Enable Google Picker API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services > Library**.
   - Search for **Google Picker API** and click **Enable**.
2. **Create a Dedicated Browser API Key for Google Picker**:
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > API key**.
   - Click **Edit API key**:
     - Name: `AI Dịch Truyện - Picker API Key`.
     - **Application Restrictions**: Select **HTTP referrers (web sites)** and add:
       - `http://localhost:5173/*`
       - `http://localhost:3000/*`
       - `https://<your-production-url>/*`
     - **API Restrictions**: Select **Restrict key** and tick:
       - **Google Picker API**
       - **Google Drive API**
     - Click **Save**.
   - Copy the API Key and configure `VITE_GOOGLE_PICKER_API_KEY="<api-key>"` in `.env` (or input it directly in the app's Google Sync configuration modal).
3. **Add Collaborators to Test Users (If in Testing Mode)**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Under **Test users**, add the Google email addresses of your collaborators.
   - *(Note: Since `drive.file` is a Non-Sensitive scope, you can also click **Publish App** to switch to "In production" status without Google verification, allowing any Google user to collaborate).*

---

## 4. Proposed Changes & Itemized File List

### UI Primitives & Foundation
1. **[NEW]** [`src/components/ui/Modal.tsx`](../../src/components/ui/Modal.tsx):
   - Reusable accessible modal dialog following `.agents/rules/design-system.md` (z-50 ladder, ESC key, backdrop click, parchment/ink styling).

### Type Definitions
2. **[MODIFY]** [`src/types.ts`](../../src/types.ts):
   - Add optional collaboration metadata to `StoryProject`: `driveFolderId?: string`, `driveStorageFormat?: 'monolithic' | 'granular'`, `isShared?: boolean`, `isOwner?: boolean`, `collaborators?: CollaboratorPermission[]`.
3. **[MODIFY]** [`src/types/googleDriveSync.ts`](../../src/types/googleDriveSync.ts):
   - Add `CollaboratorPermission`, `SharedProjectManifest`, `ChapterManifestItem`, and `ChapterConflictInfo`.

### Services
4. **[NEW]** [`src/services/googleDrivePermissionsService.ts`](../../src/services/googleDrivePermissionsService.ts):
   - Google Drive Permissions API v3: `shareFolderWithUser`, `listFolderCollaborators`, `revokeFolderPermission`.
5. **[NEW]** [`src/services/googlePickerService.ts`](../../src/services/googlePickerService.ts):
   - Dynamic script loader for `apis.google.com/js/api.js`, Picker builder for selecting shared project folders.
6. **[MODIFY]** [`src/services/googleDriveSyncService.ts`](../../src/services/googleDriveSyncService.ts):
   - Implement `migrateProjectToGranularSubfolder`, `syncGranularProject`, `importProjectFromSharedFolder`, and chapter-level reconciliation.

### UI Components
7. **[NEW]** [`src/components/google-sync/ShareProjectModal.tsx`](../../src/components/google-sync/ShareProjectModal.tsx):
   - Modal for managing project sharing: auto-migration trigger, collaborator email input, active collaborators list with revoke action.
8. **[NEW]** [`src/components/google-sync/ChapterConflictModal.tsx`](../../src/components/google-sync/ChapterConflictModal.tsx):
   - Modal for resolving chapter conflicts: displays local vs. remote timestamps, side-by-side snippet preview, and resolution options (Keep Local, Use Remote, Save as Copy).
9. **[MODIFY]** [`src/components/google-sync/GoogleSyncModal.tsx`](../../src/components/google-sync/GoogleSyncModal.tsx):
   - Add "Mở dự án được chia sẻ (Google Picker)" button, Picker API key configuration input, and "Chia sẻ" action triggers.
10. **[MODIFY]** [`src/components/ProjectList.tsx`](../../src/components/ProjectList.tsx):
    - Add "Chia sẻ" (Share) button on each project card.

### Tests & Documentation
11. **[NEW]** [`src/services/__tests__/googleDrivePermissionsService.test.ts`](../../src/services/__tests__/googleDrivePermissionsService.test.ts):
    - Unit tests for Permissions API payload formatting and error handling.
12. **[NEW]** [`src/services/__tests__/granularSyncReconciliation.test.ts`](../../src/services/__tests__/granularSyncReconciliation.test.ts):
    - Unit tests for chapter-level timestamp comparison and conflict detection.
13. **[MODIFY]** [`.env.example`](../../.env.example):
    - Add `VITE_GOOGLE_PICKER_API_KEY` documentation.
14. **[MODIFY]** [`README.md`](../../README.md) & [`docs/privacy-policy.md`](../../docs/privacy-policy.md):
    - Document multi-user project sharing and collaboration via Google Drive.

---

## 5. Verification Plan

### Automated Tests
- `npx vitest run src/services/__tests__/googleDrivePermissionsService.test.ts`
- `npx vitest run src/services/__tests__/granularSyncReconciliation.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build` (`vite build` + esbuild)

### Manual Verification
- Share a project from User A to User B -> verify subfolder creation and chapter splitting.
- Open project from User B via Google Picker -> verify clean IndexedDB import.
- Perform concurrent non-conflicting edits -> verify clean merge.
- Perform conflicting edits on the same chapter -> verify Chapter Conflict Modal resolution.

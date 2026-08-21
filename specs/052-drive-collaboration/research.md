# Research & Architectural Decisions: Project Sharing & Drive Collaboration

**Feature Directory**: `specs/052-drive-collaboration`
**Date**: 2026-08-22

---

## 1. Google Drive Permissions API under `drive.file` Scope

### Verification & Validation:
- **Scope**: `https://www.googleapis.com/auth/drive.file` grants the application full read, write, and permission-management access to files and folders that the application itself created.
- **Behavior of Permissions API**:
  - Endpoint: `POST https://www.googleapis.com/drive/v3/files/{folderId}/permissions`
  - Body:
    ```json
    {
      "role": "writer",
      "type": "user",
      "emailAddress": "collaborator@gmail.com"
    }
    ```
  - Query parameter: `sendNotificationEmail=false` (or `true` if Google sends an email notification).
  - Because User A's client created the subfolder `AI_Dich_Truyen_Data/{projectId}/`, User A has permission to manage ACLs (permissions) on that folder.
- **Listing Active Permissions**:
  - Endpoint: `GET https://www.googleapis.com/drive/v3/files/{folderId}/permissions?fields=permissions(id, role, type, emailAddress, displayName, photoLink)`
  - Allows User A to view and manage active collaborators.
- **Revoking Permissions**:
  - Endpoint: `DELETE https://www.googleapis.com/drive/v3/files/{folderId}/permissions/{permissionId}`

---

## 2. Google Picker API Client-Side Integration (Zero NPM Packages)

### Why Google Picker is Required:
- Under the `drive.file` scope, User B's application token cannot query `files.list` to discover folders created by User A (since User B did not create them in their own session).
- Google's official security architecture requires User B to interactively pick the folder via the **Google Picker** dialog. Once selected in the Picker, Google explicitly grants `drive.file` authorization for that folder to User B's OAuth token.

### Dynamic Script Loading Architecture:
- We dynamically inject `https://apis.google.com/js/api.js` into the DOM at runtime only when the user requests to open a shared project.
- Initialization Flow:
  ```typescript
  // 1. Load gapi client
  await loadGoogleApiScript();
  // 2. Load picker library
  await new Promise((resolve) => window.gapi.load('picker', resolve));
  // 3. Build and show Picker
  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.FOLDERS)
    .setOAuthToken(accessToken)
    .setDeveloperKey(pickerApiKey)
    .setCallback((data) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs[0];
        const folderId = doc.id;
        // Import project from folderId
      }
    })
    .build();
  picker.setVisible(true);
  ```
- **Zero Package Overhead**: Fully complies with the project's Dependency Minimization Constitution rule.

---

## 3. Storage Hierarchy & Granular Chapter Migration Protocol

### Unshared Projects (Personal Mode - Feature 051):
```text
AI_Dich_Truyen_Data/
├── manifest.json
├── project_{projectId}.json
└── chapters_{projectId}.json
```
*Retained 100% as-is for personal/unshared projects to guarantee backward compatibility.*

### Shared Projects (Collaborative Mode - Feature 052):
```text
AI_Dich_Truyen_Data/
└── 📁 {projectId}/                       (Subfolder shared with Collaborator B)
    ├── project.json                      (Project metadata, genre, tone, glossary)
    ├── manifest.json                     (Chapter index with individual updatedAt timestamps)
    ├── chapter_{chapterId_1}.json        (Individual Chapter 1)
    ├── chapter_{chapterId_2}.json        (Individual Chapter 2)
    └── ...
```

### Migration Trigger:
1. When User A clicks **"Chia sẻ"** for project `proj_123` for the first time:
2. Create subfolder `AI_Dich_Truyen_Data/proj_123/`.
3. Upload `project.json` containing metadata and glossary.
4. Split all chapters in IndexedDB into individual `chapter_{id}.json` files and upload them.
5. Upload `manifest.json` indexing chapter timestamps.
6. Grant `writer` permission to User B on `AI_Dich_Truyen_Data/proj_123/`.
7. Update local project record: `driveFolderId = folderId`, `driveStorageFormat = 'granular'`, `isShared = true`.

---

## 4. Chapter-Level Granular Sync & Conflict Resolution

### Timestamp Comparison Matrix:
| Local Chapter `updatedAt` vs Remote `updatedAt` | Action |
|---|---|
| Local > Remote | Push `chapter_{id}.json` to shared folder |
| Remote > Local | Pull and save `chapter_{id}.json` into IndexedDB |
| Local == Remote | In sync, skip network call |
| Both modified independently since last sync checkpoint | Prompt user via **Chapter Conflict Resolution Modal** |

### Chapter Conflict Modal Options:
1. **Giữ bản dịch máy này (Keep Local)**: Overwrite remote file with local chapter.
2. **Dùng bản trên Drive (Use Remote)**: Overwrite local IndexedDB chapter with remote file.
3. **Lưu thành bản sao (Save as Copy)**: Duplicate local chapter into a new chapter (e.g. `Chương 1 (Bản sao cá nhân)`) and pull remote chapter.

---

## 5. Manual Google Cloud Console Setup Guide (New for Feature 052)

In addition to the OAuth 2.0 Client ID created in Feature 051, the user must perform these additional steps:

1. **Enable Google Picker API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services > Library**.
   - Search for **Google Picker API** and click **Enable**.
2. **Create a Dedicated Browser API Key for Google Picker**:
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > API key**.
   - Click **Edit API key**:
     - Name: `AI Dịch Truyện - Picker API Key`.
     - **Set Application Restrictions**: Choose **HTTP referrers (web sites)** and add:
       - `http://localhost:5173/*`
       - `http://localhost:3000/*`
       - `https://<your-production-url>/*`
     - **Set API Restrictions**: Choose **Restrict key** and select:
       - **Google Picker API**
       - **Google Drive API**
     - Click **Save**.
   - Copy the API Key and set `VITE_GOOGLE_PICKER_API_KEY="<api-key>"` in `.env` (or input in the app's Google Sync configuration modal).
3. **OAuth Consent Screen & Collaborator Access**:
   - If the app is in **Testing** mode: Add the Google email addresses of all collaborators to the **Test users** list in **APIs & Services > OAuth consent screen**.
   - Alternatively: Because `drive.file` is a **Non-Sensitive** scope, the app owner can click **Publish App** to switch to **In production** status without requiring Google verification, enabling any Google user to log in and collaborate.

# Data Model & State Transitions: Google Drive Folder Self-Healing

**Feature**: Self-Healing and Graceful Recovery for Missing Google Drive Folders and Files  
**Branch**: `073-drive-folder-self-healing`  
**Date**: 2026-08-23  

---

## 1. Entity Definitions & Database Schema Stability

> [!NOTE]
> Per Principle IV of the Constitution, this feature requires **zero mutations** to existing core types in `src/types.ts` or IndexedDB object stores. It operates entirely using existing data fields (`project.driveFolderId`, `project.driveFileId`, `project.driveStorageFormat`).

### Core Entities Involved

```text
┌─────────────────────────────────────────────────────────────┐
│ StoryProject (IndexedDB: 'projects')                        │
├─────────────────────────────────────────────────────────────┤
│ id: string                                                  │
│ title: string                                               │
│ driveFolderId?: string      ◄── Replaced on self-healing    │
│ driveFileId?: string        ◄── Replaced on bundle recovery │
│ driveStorageFormat?: 'monolithic' | 'granular' | 'bundle'   │
│ isOwner?: boolean                                           │
│ isShared?: boolean                                          │
│ updatedAt: string           ◄── Refreshed on migration      │
│ chapters: ChapterMetadata[]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Remote Resource Vitality & Existence State Machine

When querying Google Drive for a resource identity (`fileId` or `folderId`), the client transitions through the following evaluation states:

```mermaid
stateDiagram-v2
    [*] --> ProbeEndpoint: fileExists(accessToken, fileId)
    ProbeEndpoint --> HTTPCheck: GET files/{fileId}?fields=id,trashed
    HTTPCheck --> NegativeCheck: HTTP 404 / 403 / 400 / Network Error
    HTTPCheck --> TrashedCheck: HTTP 200 OK
    TrashedCheck --> PositiveCheck: data.trashed === false
    TrashedCheck --> NegativeCheck: data.trashed === true
    PositiveCheck --> [*]: returns true (Alive & Accessible)
    NegativeCheck --> [*]: returns false (Dead / Deleted / Inaccessible)
```

---

## 3. Granular Project Sync Self-Healing Flow

During `syncGranularProject`, the state transitions seamlessly from normal sync to self-healing migration upon detecting a missing remote container:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Sync UI / User
    participant GS as DriveGranularSync
    participant RC as DriveRestClient
    participant DB as IndexedDB
    participant GD as Google Drive API

    UI->>GS: syncGranularProject(client, token, projectId, driveFolderId)
    GS->>RC: fileExists(token, driveFolderId)
    RC->>GD: GET files/{driveFolderId}?fields=id,trashed
    GD-->>RC: 404 Not Found (or trashed: true)
    RC-->>GS: returns false (Folder Deleted)

    Note over GS: Trigger Self-Healing Recovery

    GS->>UI: onProgress("Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới...")
    GS->>GS: migrateProjectToGranularSubfolder(client, token, projectId, onProgress)
    GS->>RC: ensureProjectSubfolder(token, projectId)
    RC->>GD: POST files (Create new subfolder)
    GD-->>RC: newFolderId
    GS->>RC: uploadJsonFile (project.json, chapters, manifest.json)
    GS->>DB: saveProjectToDB({ ...project, driveFolderId: newFolderId })
    DB-->>GS: OK
    GS-->>UI: returns GranularProjectSyncSummary (success: true, uploaded: N)
```

---

## 4. Shared Folder Import Pre-Flight Validation

```mermaid
sequenceDiagram
    autonumber
    participant User as Collaborator
    participant GS as DriveGranularSync
    participant RC as DriveRestClient
    participant GD as Google Drive API

    User->>GS: importProjectFromSharedFolder(client, token, sharedFolderId)
    GS->>RC: fileExists(token, sharedFolderId)
    RC->>GD: GET files/{sharedFolderId}?fields=id,trashed
    alt Folder Does Not Exist (404 / Trashed)
        GD-->>RC: 404 / trashed: true
        RC-->>GS: returns false
        GS-->>User: throw Error("Thư mục chia sẻ này không còn tồn tại trên Google Drive...")
    else Folder Exists
        GD-->>RC: 200 OK (trashed: false)
        RC-->>GS: returns true
        GS->>GD: Search for project.json
        alt project.json Missing
            GD-->>GS: files: []
            GS-->>User: throw Error("Không tìm thấy tệp project.json trong thư mục...")
        else project.json Found
            GD-->>GS: files: [project.json]
            GS->>User: Complete Import into IndexedDB
        end
    end
```

---

## 5. In-Memory Cache Life-Cycle (`DriveRestClient.ensureAppFolder`)

| State | Action | Next State |
|---|---|---|
| `cachedFolderId === null` | Search query for `AI_Dich_Truyen_Data` | Set `cachedFolderId = foundId` or `createdId` |
| `cachedFolderId !== null` | Call `fileExists(token, cachedFolderId)` | If `true`: return `cachedFolderId`<br/>If `false`: reset `cachedFolderId = null` and execute search/create flow |

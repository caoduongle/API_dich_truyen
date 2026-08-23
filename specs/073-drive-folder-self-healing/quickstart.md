# Quickstart & Verification Guide: Google Drive Folder Self-Healing

**Feature**: Self-Healing and Graceful Recovery for Missing Google Drive Folders and Files  
**Branch**: `073-drive-folder-self-healing`  
**Date**: 2026-08-23  

---

## 1. Prerequisites & Environment Setup

- Node.js 18+ and npm installed
- Working directory: repository root (`e:\tailieuhoctap\laptrinhnangcao\th\merged`)
- Quality check tools: TypeScript compiler (`tsc`), Vitest test runner (`vitest`), Vite bundler (`vite`)

---

## 2. Automated Test Execution

Run the automated test suite specifically covering Google Drive client and sync services:

```bash
# Run unit & contract tests for driveRestClient and driveGranularSync
npm test -- src/services/google-drive/__tests__/
```

Run full project verification gates:

```bash
# 1. Type check
npm run lint

# 2. Complete test suite
npm test

# 3. Production build
npm run build
```

---

## 3. End-to-End Validation Scenarios

### Scenario 1: Self-Healing on Manually Deleted Subfolder (Granular Sync)

1. **Setup**:
   - Create a local story project "Vũ Động Càn Khôn" with 3 chapters in IndexedDB.
   - Run initial granular sync / migration to create the remote subfolder on Google Drive (e.g. `folder_123`).
   - Confirm `project.driveFolderId === 'folder_123'` in IndexedDB.
2. **Action**:
   - Manually delete or move the subfolder `folder_123` to Trash on Google Drive.
   - In the application UI, open Google Sync modal and click **"Đồng bộ"** on "Vũ Động Càn Khôn".
3. **Expected Outcome**:
   - The UI shows progress message: `"Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới..."`.
   - The system calls `ensureProjectSubfolder`, creating a new folder (e.g. `folder_456`) on Google Drive.
   - All 3 chapters, `project.json`, and `manifest.json` are uploaded to `folder_456`.
   - `project.driveFolderId` in IndexedDB is updated to `'folder_456'`.
   - Sync modal displays success: `"Đồng bộ chương hoàn tất! (Tải lên: 3, Tải về: 0)"`.
   - Zero 404 errors or unhandled exceptions.

---

### Scenario 2: Diagnostic Error on Importing Non-Existent Shared Folder

1. **Setup**:
   - Obtain or generate an invalid/deleted folder ID (e.g. `invalid_deleted_folder_999`).
2. **Action**:
   - Call `importProjectFromSharedFolder(client, token, 'invalid_deleted_folder_999')`.
3. **Expected Outcome**:
   - The operation fails immediately without attempting to search for `project.json`.
   - The error message thrown contains:
     `"Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới."`

---

### Scenario 3: App Root Folder Invalidation & Cache Reset

1. **Setup**:
   - Instantiate `client = new DriveRestClient()`.
   - Call `await client.ensureAppFolder(token)` (caches `cachedFolderId = 'root_folder_001'`).
2. **Action**:
   - Delete `root_folder_001` on Google Drive.
   - Call `await client.ensureAppFolder(token)` again on the same `client` instance.
3. **Expected Outcome**:
   - `ensureAppFolder` probes `root_folder_001` with `fileExists`, receives `false`.
   - `cachedFolderId` is reset to `null`.
   - A new `AI_Dich_Truyen_Data` folder is found or created on Drive.
   - The new valid folder ID is returned and cached.

---

### Scenario 4: Multi-Project Batch Sync Resiliency

1. **Setup**:
   - Have Project A (healthy remote folder) and Project B (deleted remote folder).
2. **Action**:
   - Trigger **"Sao lưu toàn bộ lên Drive"** (`pushAllToDrive`).
3. **Expected Outcome**:
   - Project A syncs normally.
   - Project B self-heals transparently (recreates folder and uploads chapters).
   - Batch summary completes with `syncedProjects: 2` and `success: true`.

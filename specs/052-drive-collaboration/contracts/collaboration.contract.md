# Interface Contracts: Project Sharing & Drive Collaboration

**Feature Directory**: `specs/052-drive-collaboration`
**Date**: 2026-08-22

---

## 1. Google Drive Permissions Service Interface (`src/services/googleDrivePermissionsService.ts`)

```typescript
export interface IGoogleDrivePermissionsService {
  /**
   * Cấp quyền truy cập (writer/reader) cho cộng tác viên trên thư mục dự án
   */
  shareFolderWithUser(
    accessToken: string,
    folderId: string,
    emailAddress: string,
    role?: 'writer' | 'reader'
  ): Promise<CollaboratorPermission>;

  /**
   * Lấy danh sách cộng tác viên hiện tại của thư mục
   */
  listFolderCollaborators(
    accessToken: string,
    folderId: string
  ): Promise<CollaboratorPermission[]>;

  /**
   * Thu hồi quyền truy cập của cộng tác viên
   */
  revokeFolderPermission(
    accessToken: string,
    folderId: string,
    permissionId: string
  ): Promise<boolean>;
}
```

---

## 2. Google Picker Service Interface (`src/services/googlePickerService.ts`)

```typescript
export interface IGooglePickerService {
  /**
   * Tải động script Google API (apis.google.com/js/api.js) và khởi tạo thư viện picker
   */
  ensurePickerLoaded(): Promise<void>;

  /**
   * Mở cửa sổ Google Picker cho phép người dùng chọn thư mục dự án đã được chia sẻ
   */
  openFolderPicker(options: {
    accessToken: string;
    pickerApiKey: string;
    onFolderSelected: (folderId: string, folderName: string) => void;
    onCancel?: () => void;
  }): Promise<void>;
}
```

---

## 3. Granular Project Sync Interface (`src/services/googleDriveSyncService.ts`)

```typescript
export interface IGranularProjectSyncService {
  /**
   * Di chuyển dự án từ định dạng gộp monolithic sang subfolder riêng và tách nhỏ từng chương
   */
  migrateProjectToGranularSubfolder(
    accessToken: string,
    projectId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<string>;

  /**
   * Đồng bộ từng chương cho dự án đã chia sẻ
   */
  syncGranularProject(
    accessToken: string,
    projectId: string,
    driveFolderId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    success: boolean;
    uploadedChapters: number;
    downloadedChapters: number;
    conflicts: ChapterConflictInfo[];
    error?: string;
  }>;

  /**
   * Nhập toàn bộ dự án và các chương từ thư mục được chia sẻ vào IndexedDB
   */
  importProjectFromSharedFolder(
    accessToken: string,
    sharedFolderId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<StoryProject>;
}
```

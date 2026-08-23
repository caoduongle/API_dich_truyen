# Service Interface Contracts: Google Drive Self-Healing and Error Recovery

**Feature**: Self-Healing and Graceful Recovery for Missing Google Drive Folders and Files  
**Branch**: `073-drive-folder-self-healing`  
**Date**: 2026-08-23  

---

## 1. `DriveRestClient` Existence Verification Contract

```typescript
export class DriveRestClient {
  /**
   * Kiểm tra một tệp hoặc thư mục có tồn tại và truy cập được trên Google Drive không.
   *
   * @param accessToken Token truy cập OAuth2 hợp lệ
   * @param fileId ID của file hoặc folder cần kiểm tra trên Google Drive
   * @returns `true` nếu file tồn tại và không nằm trong thùng rác (trashed: false);
   *          `false` nếu trả về 404, 403, 400, trashed: true, hoặc có lỗi mạng. KHÔNG throw.
   */
  public async fileExists(accessToken: string, fileId: string): Promise<boolean>;

  /**
   * Đảm bảo thư mục gốc AI_Dich_Truyen_Data tồn tại trên Google Drive.
   * Nếu có ID đã lưu trong cache, xác minh trước khi sử dụng. Nếu không còn tồn tại,
   * xoá cache và tự động tạo mới.
   *
   * @param accessToken Token truy cập OAuth2 hợp lệ
   * @returns Folder ID của thư mục ứng dụng hợp lệ
   */
  public async ensureAppFolder(accessToken: string): Promise<string>;
}
```

### Contract Test Requirements for `DriveRestClient.fileExists`

- **Scenario 1.1**: Returns `true` when API responds with `200 OK` and `{ id: '...', trashed: false }`.
- **Scenario 1.2**: Returns `false` when API responds with `200 OK` and `{ id: '...', trashed: true }`.
- **Scenario 1.3**: Returns `false` when API responds with `404 Not Found`.
- **Scenario 1.4**: Returns `false` when API responds with `403 Forbidden` (unauthorized or outside scope).
- **Scenario 1.5**: Returns `false` when network throws `FetchError` or offline rejection.
- **Scenario 1.6**: Returns `false` immediately when `fileId` is empty or whitespace without sending HTTP request.

---

## 2. `DriveGranularSync.syncGranularProject` Self-Healing Contract

```typescript
export class DriveGranularSync {
  /**
   * Đồng bộ dự án chia sẻ từng chương độc lập với cơ chế tự phục hồi khi folder bị xoá.
   *
   * @param client Instance của DriveRestClient
   * @param accessToken OAuth2 token
   * @param projectId ID của dự án local
   * @param driveFolderId ID thư mục dự án remote trên Drive
   * @param onProgress Callback báo cáo tiến độ đồng bộ
   * @param selectedFiles Danh sách file đã được cấp quyền qua Picker (nếu có)
   *
   * Behavioral Contract:
   * 1. Gọi `client.fileExists(accessToken, driveFolderId)`.
   * 2. Nếu `false`:
   *    - Phát thông báo tiến độ: "Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới..."
   *    - Gọi `migrateProjectToGranularSubfolder(client, accessToken, projectId, onProgress)`
   *    - Trả về GranularProjectSyncSummary với `success: true`, `uploadedChapters: N`, `downloadedChapters: 0`
   * 3. Nếu `true`: Tiếp tục luồng đồng bộ chương thông thường (so sánh manifest, push/pull).
   */
  public async syncGranularProject(
    client: DriveRestClient,
    accessToken: string,
    projectId: string,
    driveFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<GranularProjectSyncSummary & { conflicts: ChapterConflictInfo[] }>;
}
```

---

## 3. `DriveGranularSync.importProjectFromSharedFolder` Pre-Flight Validation Contract

```typescript
export class DriveGranularSync {
  /**
   * Nhập dự án từ thư mục chia sẻ trên Google Drive.
   *
   * Behavioral Contract:
   * 1. Gọi `client.fileExists(accessToken, sharedFolderId)`.
   * 2. Nếu `false`:
   *    - Throw Error với nội dung chính xác:
   *      "Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới."
   * 3. Nếu `true`:
   *    - Tiến hành tìm kiếm `project.json`.
   *    - Nếu `project.json` không tồn tại, throw Error: "Không thể tìm thấy tệp project.json trong thư mục..."
   */
  public async importProjectFromSharedFolder(
    client: DriveRestClient,
    accessToken: string,
    sharedFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<StoryProject>;
}
```

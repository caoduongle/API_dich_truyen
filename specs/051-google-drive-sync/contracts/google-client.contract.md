# Interface Contracts: Client-Side Google Auth & Drive Sync Engine

**Feature Directory**: `specs/051-google-drive-sync`
**Date**: 2026-08-22

---

## 1. Google OAuth 2.0 PKCE Client Interface (`src/services/googleAuthService.ts`)

```typescript
export interface IGoogleAuthService {
  /**
   * Khởi tạo luồng OAuth 2.0 PKCE và mở cửa sổ đăng nhập Google
   */
  login(): Promise<GoogleAuthState>;

  /**
   * Xử lý callback sau khi Google redirect về với authorization code
   */
  handleAuthCallback(code: string, state: string): Promise<GoogleAuthState>;

  /**
   * Lấy access token hiện tại, tự động kiểm tra hạn sử dụng
   */
  getValidAccessToken(): Promise<string | null>;

  /**
   * Lấy thông tin user profile từ Google userinfo endpoint
   */
  fetchUserProfile(accessToken: string): Promise<GoogleUserProfile>;

  /**
   * Đăng xuất và xóa token trong bộ nhớ trình duyệt
   */
  logout(): void;

  /**
   * Đăng ký listener lắng nghe thay đổi trạng thái đăng nhập
   */
  onAuthStateChanged(callback: (state: GoogleAuthState) => void): () => void;
}
```

---

## 2. Google Drive Sync Service Interface (`src/services/googleDriveSyncService.ts`)

```typescript
export interface IGoogleDriveSyncService {
  /**
   * Tìm hoặc tạo thư mục 'AI_Dich_Truyen_Data' trên Drive của người dùng
   */
  ensureAppFolder(accessToken: string): Promise<string>;

  /**
   * Lấy danh sách manifest các dự án hiện có trên Drive
   */
  fetchRemoteManifest(accessToken: string): Promise<DriveSyncManifest | null>;

  /**
   * Đẩy (Upload/Backup) toàn bộ dự án từ IndexedDB lên Google Drive
   */
  pushAllToDrive(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; syncedProjects: number; error?: string }>;

  /**
   * Tải về (Download/Restore) toàn bộ dự án từ Google Drive vào IndexedDB
   */
  pullAllFromDrive(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; restoredProjects: number; error?: string }>;

  /**
   * Đồng bộ 2 chiều thông minh theo timestamp updatedAt
   */
  syncBiDirectional(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    success: boolean;
    uploadedCount: number;
    downloadedCount: number;
    conflicts: SyncConflictInfo[];
  }>;
}
```

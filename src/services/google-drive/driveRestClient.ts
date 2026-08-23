import { DriveSyncManifest } from '../../types/googleDriveSync';

export const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
export const APP_FOLDER_NAME = 'AI_Dich_Truyen_Data';
export const MANIFEST_FILE_NAME = 'manifest.json';

export class DriveRestClient {
  private cachedFolderId: string | null = null;

  /**
   * Kiểm tra 1 folder/file ID có còn tồn tại và truy cập được không.
   * Trả về false nếu 404 / bị xoá / không có quyền — KHÔNG throw.
   */
  public async fileExists(accessToken: string, fileId: string): Promise<boolean> {
    if (!fileId || !fileId.trim()) return false;
    try {
      const res = await fetch(
        `${DRIVE_FILES_ENDPOINT}/${fileId}?fields=id,trashed`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return false;
      const data = await res.json();
      return !data.trashed;
    } catch {
      return false;
    }
  }

  /**
   * Đảm bảo thư mục lưu trữ của ứng dụng tồn tại trên Google Drive
   */
  public async ensureAppFolder(accessToken: string): Promise<string> {
    if (this.cachedFolderId) {
      const exists = await this.fileExists(accessToken, this.cachedFolderId);
      if (exists) {
        return this.cachedFolderId;
      }
      this.cachedFolderId = null;
    }

    const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${APP_FOLDER_NAME}' and trashed = false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      throw new Error(`Không thể tìm kiếm thư mục Drive (HTTP ${searchRes.status})`);
    }

    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      this.cachedFolderId = data.files[0].id;
      return data.files[0].id;
    }

    // Nếu chưa có, tạo thư mục mới
    const createRes = await fetch(DRIVE_FILES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Không thể tạo thư mục '${APP_FOLDER_NAME}' trên Drive (HTTP ${createRes.status})`);
    }

    const created = await createRes.json();
    this.cachedFolderId = created.id;
    return created.id;
  }

  /**
   * Tạo hoặc tìm subfolder cho dự án chia sẻ
   */
  public async ensureProjectSubfolder(accessToken: string, projectId: string): Promise<string> {
    const rootFolderId = await this.ensureAppFolder(accessToken);
    const query = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${projectId}' and trashed = false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    const createRes = await fetch(DRIVE_FILES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Không thể tạo subfolder dự án '${projectId}' trên Drive (HTTP ${createRes.status})`);
    }

    const created = await createRes.json();
    return created.id;
  }

  /**
   * Tải tệp JSON lên Google Drive (tự động cập nhật nếu đã tồn tại)
   */
  public async uploadJsonFile(
    accessToken: string,
    folderId: string,
    fileName: string,
    jsonString: string
  ): Promise<string> {
    const query = `'${folderId}' in parents and name = '${fileName}' and trashed = false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingFileId: string | null = null;
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        existingFileId = data.files[0].id;
      }
    }

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      ...(existingFileId ? {} : { parents: [folderId] }),
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      jsonString +
      closeDelimiter;

    const uploadUrl = existingFileId
      ? `${DRIVE_UPLOAD_ENDPOINT}/${existingFileId}?uploadType=multipart`
      : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`;

    const uploadRes = await fetch(uploadUrl, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!uploadRes.ok) {
      throw new Error(`Lỗi tải lên tệp '${fileName}' (HTTP ${uploadRes.status})`);
    }

    const resData = await uploadRes.json();
    return resData.id;
  }

  /**
   * Tải nội dung tệp JSON từ Google Drive theo File ID
   */
  public async downloadJsonFile<T = any>(accessToken: string, fileId: string): Promise<T> {
    const downloadUrl = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Không thể tải dữ liệu tệp ID ${fileId} (HTTP ${res.status})`);
    }

    return await res.json();
  }

  /**
   * Lấy Manifest chung từ root folder Google Drive (cho các dự án cá nhân monolithic)
   */
  public async fetchRemoteManifest(accessToken: string): Promise<DriveSyncManifest | null> {
    const folderId = await this.ensureAppFolder(accessToken);
    const query = `'${folderId}' in parents and name = '${MANIFEST_FILE_NAME}' and trashed = false`;
    const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) return null;
    const data = await searchRes.json();
    if (!data.files || data.files.length === 0) return null;

    const manifestFileId = data.files[0].id;
    return await this.downloadJsonFile<DriveSyncManifest>(accessToken, manifestFileId);
  }
}

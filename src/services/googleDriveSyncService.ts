import { StoryProject, Chapter } from '../types';
import {
  DriveSyncManifest,
  DriveProjectSummary,
  SyncProgress,
  SyncConflictInfo,
} from '../types/googleDriveSync';
import {
  getProjectsFromDB,
  saveProjectToDB,
  getChaptersByProjectFromDB,
  saveChapterToDB,
} from './db';

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const APP_FOLDER_NAME = 'AI_Dich_Truyen_Data';
const MANIFEST_FILE_NAME = 'manifest.json';

/**
 * So sánh thời điểm cập nhật giữa bản ghi local và remote.
 */
export function reconcileProjectTimestamps(
  localUpdatedAt?: string,
  remoteUpdatedAt?: string
): 'push' | 'pull' | 'in_sync' {
  if (!localUpdatedAt && !remoteUpdatedAt) return 'in_sync';
  if (!remoteUpdatedAt) return 'push';
  if (!localUpdatedAt) return 'pull';

  const localTime = new Date(localUpdatedAt).getTime();
  const remoteTime = new Date(remoteUpdatedAt).getTime();

  if (Math.abs(localTime - remoteTime) < 1000) {
    return 'in_sync';
  }
  return localTime > remoteTime ? 'push' : 'pull';
}

/**
 * Chuẩn bị payload JSON cho dự án và danh sách chương truyện.
 */
export function serializeProjectForDrive(
  project: StoryProject,
  chapters: Chapter[]
): { projectJson: string; chaptersJson: string } {
  return {
    projectJson: JSON.stringify(project, null, 2),
    chaptersJson: JSON.stringify(chapters, null, 2),
  };
}

class GoogleDriveSyncService {
  private cachedFolderId: string | null = null;

  /**
   * Đảm bảo thư mục lưu trữ của ứng dụng tồn tại trên Google Drive
   */
  public async ensureAppFolder(accessToken: string): Promise<string> {
    if (this.cachedFolderId) return this.cachedFolderId;

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
   * Tải tệp JSON lên Google Drive (tự động cập nhật nếu đã tồn tại)
   */
  public async uploadJsonFile(
    accessToken: string,
    folderId: string,
    fileName: string,
    jsonString: string
  ): Promise<string> {
    // 1. Kiểm tra xem tệp đã tồn tại chưa
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

    // 2. Tạo multipart body
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
   * Lấy Manifest từ Google Drive
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

  /**
   * Đẩy (Sao lưu toàn bộ) dữ liệu từ IndexedDB lên Google Drive
   */
  public async pushAllToDrive(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; syncedProjects: number; error?: string }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang kết nối thư mục Google Drive...',
        progressPercent: 5,
      });

      const folderId = await this.ensureAppFolder(accessToken);
      const localProjects = await getProjectsFromDB();

      if (localProjects.length === 0) {
        onProgress?.({
          status: 'success',
          message: 'Không có dự án nào trong máy để tải lên.',
          progressPercent: 100,
        });
        return { success: true, syncedProjects: 0 };
      }

      const summaries: DriveProjectSummary[] = [];

      for (let i = 0; i < localProjects.length; i++) {
        const project = localProjects[i];
        const percent = Math.round(10 + ((i + 1) / localProjects.length) * 80);

        onProgress?.({
          status: 'syncing',
          message: `Đang tải lên: ${project.title} (${i + 1}/${localProjects.length})...`,
          currentProjectTitle: project.title,
          progressPercent: percent,
        });

        const chapters = await getChaptersByProjectFromDB(project.id);
        const { projectJson, chaptersJson } = serializeProjectForDrive(project, chapters);

        const projectFileId = await this.uploadJsonFile(
          accessToken,
          folderId,
          `project_${project.id}.json`,
          projectJson
        );

        const chaptersFileId = await this.uploadJsonFile(
          accessToken,
          folderId,
          `chapters_${project.id}.json`,
          chaptersJson
        );

        summaries.push({
          id: project.id,
          title: project.title,
          updatedAt: project.updatedAt || new Date().toISOString(),
          chapterCount: chapters.length,
          glossaryCount: project.glossary?.length || 0,
          projectFileId,
          chaptersFileId,
        });
      }

      // Cập nhật Manifest
      const manifest: DriveSyncManifest = {
        version: '1.0.0',
        lastSyncTimestamp: new Date().toISOString(),
        projects: summaries,
      };

      await this.uploadJsonFile(
        accessToken,
        folderId,
        MANIFEST_FILE_NAME,
        JSON.stringify(manifest, null, 2)
      );

      onProgress?.({
        status: 'success',
        message: `Đã sao lưu thành công ${localProjects.length} dự án lên Google Drive!`,
        progressPercent: 100,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
      });

      return { success: true, syncedProjects: localProjects.length };
    } catch (err: any) {
      console.error('Lỗi sao lưu lên Drive:', err);
      const errorMsg = err.message || 'Lỗi không xác định khi tải lên Google Drive.';
      onProgress?.({
        status: 'error',
        message: `Thất bại: ${errorMsg}`,
        progressPercent: 100,
        error: errorMsg,
      });
      return { success: false, syncedProjects: 0, error: errorMsg };
    }
  }

  /**
   * Kéo (Khôi phục toàn bộ) dữ liệu từ Google Drive vào IndexedDB
   */
  public async pullAllFromDrive(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; restoredProjects: number; error?: string }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang kiểm tra danh mục sao lưu trên Google Drive...',
        progressPercent: 10,
      });

      const manifest = await this.fetchRemoteManifest(accessToken);
      if (!manifest || !manifest.projects || manifest.projects.length === 0) {
        onProgress?.({
          status: 'success',
          message: 'Không tìm thấy dữ liệu sao lưu nào trên Google Drive.',
          progressPercent: 100,
        });
        return { success: true, restoredProjects: 0 };
      }

      const total = manifest.projects.length;

      for (let i = 0; i < total; i++) {
        const summary = manifest.projects[i];
        const percent = Math.round(15 + ((i + 1) / total) * 80);

        onProgress?.({
          status: 'syncing',
          message: `Đang khôi phục: ${summary.title} (${i + 1}/${total})...`,
          currentProjectTitle: summary.title,
          progressPercent: percent,
        });

        if (summary.projectFileId) {
          const projectData = await this.downloadJsonFile<StoryProject>(
            accessToken,
            summary.projectFileId
          );
          await saveProjectToDB(projectData);
        }

        if (summary.chaptersFileId) {
          const chaptersData = await this.downloadJsonFile<Chapter[]>(
            accessToken,
            summary.chaptersFileId
          );
          for (const chap of chaptersData) {
            await saveChapterToDB(chap);
          }
        }
      }

      onProgress?.({
        status: 'success',
        message: `Đã khôi phục thành công ${total} bộ truyện vào trình duyệt!`,
        progressPercent: 100,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
      });

      return { success: true, restoredProjects: total };
    } catch (err: any) {
      console.error('Lỗi khôi phục từ Drive:', err);
      const errorMsg = err.message || 'Lỗi không xác định khi tải từ Google Drive.';
      onProgress?.({
        status: 'error',
        message: `Thất bại: ${errorMsg}`,
        progressPercent: 100,
        error: errorMsg,
      });
      return { success: false, restoredProjects: 0, error: errorMsg };
    }
  }

  /**
   * Đồng bộ 2 chiều thông minh theo timestamp
   */
  public async syncBiDirectional(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    success: boolean;
    uploadedCount: number;
    downloadedCount: number;
    conflicts: SyncConflictInfo[];
  }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang phân tích dữ liệu đồng bộ 2 chiều...',
        progressPercent: 10,
      });

      const folderId = await this.ensureAppFolder(accessToken);
      const localProjects = await getProjectsFromDB();
      const localMap = new Map(localProjects.map((p) => [p.id, p]));

      const manifest = await this.fetchRemoteManifest(accessToken);
      const remoteProjects = manifest?.projects || [];
      const remoteMap = new Map(remoteProjects.map((p) => [p.id, p]));

      let uploadedCount = 0;
      let downloadedCount = 0;
      const conflicts: SyncConflictInfo[] = [];

      const allProjectIds = Array.from(
        new Set([...Array.from(localMap.keys()), ...Array.from(remoteMap.keys())])
      );

      for (let i = 0; i < allProjectIds.length; i++) {
        const id = allProjectIds[i];
        const local = localMap.get(id);
        const remote = remoteMap.get(id);
        const percent = Math.round(15 + ((i + 1) / allProjectIds.length) * 75);

        const projectTitle = local?.title || remote?.title || id;
        onProgress?.({
          status: 'syncing',
          message: `Đang đồng bộ: ${projectTitle}...`,
          currentProjectTitle: projectTitle,
          progressPercent: percent,
        });

        const action = reconcileProjectTimestamps(local?.updatedAt, remote?.updatedAt);

        if (action === 'push' && local) {
          const chapters = await getChaptersByProjectFromDB(local.id);
          const { projectJson, chaptersJson } = serializeProjectForDrive(local, chapters);

          const projectFileId = await this.uploadJsonFile(
            accessToken,
            folderId,
            `project_${local.id}.json`,
            projectJson
          );
          const chaptersFileId = await this.uploadJsonFile(
            accessToken,
            folderId,
            `chapters_${local.id}.json`,
            chaptersJson
          );

          remoteMap.set(local.id, {
            id: local.id,
            title: local.title,
            updatedAt: local.updatedAt || new Date().toISOString(),
            chapterCount: chapters.length,
            glossaryCount: local.glossary?.length || 0,
            projectFileId,
            chaptersFileId,
          });

          uploadedCount++;
        } else if (action === 'pull' && remote) {
          if (remote.projectFileId) {
            const projectData = await this.downloadJsonFile<StoryProject>(
              accessToken,
              remote.projectFileId
            );
            await saveProjectToDB(projectData);
          }
          if (remote.chaptersFileId) {
            const chaptersData = await this.downloadJsonFile<Chapter[]>(
              accessToken,
              remote.chaptersFileId
            );
            for (const chap of chaptersData) {
              await saveChapterToDB(chap);
            }
          }
          downloadedCount++;
        }
      }

      // Cập nhật lại Manifest mới nhất
      const updatedManifest: DriveSyncManifest = {
        version: '1.0.0',
        lastSyncTimestamp: new Date().toISOString(),
        projects: Array.from(remoteMap.values()),
      };

      await this.uploadJsonFile(
        accessToken,
        folderId,
        MANIFEST_FILE_NAME,
        JSON.stringify(updatedManifest, null, 2)
      );

      onProgress?.({
        status: 'success',
        message: `Đồng bộ hoàn tất! (Đã tải lên: ${uploadedCount}, Tải về: ${downloadedCount})`,
        progressPercent: 100,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
      });

      return {
        success: true,
        uploadedCount,
        downloadedCount,
        conflicts,
      };
    } catch (err: any) {
      console.error('Lỗi đồng bộ 2 chiều:', err);
      const errorMsg = err.message || 'Lỗi đồng bộ dữ liệu.';
      onProgress?.({
        status: 'error',
        message: `Thất bại: ${errorMsg}`,
        progressPercent: 100,
        error: errorMsg,
      });
      return {
        success: false,
        uploadedCount: 0,
        downloadedCount: 0,
        conflicts: [],
      };
    }
  }
}

export const googleDriveSyncService = new GoogleDriveSyncService();

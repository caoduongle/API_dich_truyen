import { StoryProject, Chapter } from '../types';
import {
  DriveSyncManifest,
  DriveProjectSummary,
  SyncProgress,
  SyncConflictInfo,
  SharedProjectManifest,
  ChapterManifestItem,
  ChapterConflictInfo,
} from '../types/googleDriveSync';
import {
  getProjectsFromDB,
  getProjectFromDB,
  saveProjectToDB,
  getChaptersByProjectFromDB,
  saveChapterToDB,
} from './db';

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const APP_FOLDER_NAME = 'AI_Dich_Truyen_Data';
const MANIFEST_FILE_NAME = 'manifest.json';

/**
 * So sánh thời điểm cập nhật giữa bản ghi local và remote ở cấp dự án.
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
 * So sánh thời điểm cập nhật giữa bản ghi local và remote ở cấp từng chương.
 */
export function reconcileChapterTimestamps(
  localUpdatedAt?: string,
  remoteUpdatedAt?: string
): 'push' | 'pull' | 'in_sync' {
  return reconcileProjectTimestamps(localUpdatedAt, remoteUpdatedAt);
}

/**
 * Chuẩn bị payload JSON cho dự án và danh sách chương truyện (Định dạng gộp monolithic).
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

/**
 * Xây dựng manifest cho dự án cộng tác tách chương granular.
 */
export function buildSharedProjectManifest(
  projectId: string,
  title: string,
  chapters: Chapter[]
): SharedProjectManifest {
  return {
    version: '1.0.0',
    projectId,
    title,
    updatedAt: new Date().toISOString(),
    chapters: chapters.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
      status: c.status || 'not_started',
    })),
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

  /**
   * Di chuyển dự án từ monolithic sang subfolder riêng và chia nhỏ từng file chương
   */
  public async migrateProjectToGranularSubfolder(
    accessToken: string,
    projectId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<string> {
    onProgress?.({
      status: 'syncing',
      message: 'Đang khởi tạo thư mục chia sẻ riêng trên Google Drive...',
      progressPercent: 10,
    });

    const project = await getProjectFromDB(projectId);
    if (!project) {
      throw new Error(`Không tìm thấy dự án ID: ${projectId}`);
    }

    const subfolderId = await this.ensureProjectSubfolder(accessToken, projectId);
    const chapters = await getChaptersByProjectFromDB(projectId);

    onProgress?.({
      status: 'syncing',
      message: 'Đang tải lên thông tin dự án (project.json)...',
      progressPercent: 25,
    });

    // 1. Tải lên project.json
    await this.uploadJsonFile(
      accessToken,
      subfolderId,
      'project.json',
      JSON.stringify(project, null, 2)
    );

    // 2. Tách và tải lên từng chapter_{id}.json
    const chapterManifestItems: ChapterManifestItem[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const chap = chapters[i];
      const percent = Math.round(30 + ((i + 1) / chapters.length) * 60);

      onProgress?.({
        status: 'syncing',
        message: `Đang chia nhỏ chương ${i + 1}/${chapters.length}: ${chap.title}...`,
        progressPercent: percent,
      });

      const fileId = await this.uploadJsonFile(
        accessToken,
        subfolderId,
        `chapter_${chap.id}.json`,
        JSON.stringify(chap, null, 2)
      );

      chapterManifestItems.push({
        id: chap.id,
        title: chap.title,
        updatedAt: chap.updatedAt || chap.createdAt || new Date().toISOString(),
        status: chap.status || 'not_started',
        fileId,
      });
    }

    // 3. Tải lên manifest.json trong subfolder
    const sharedManifest: SharedProjectManifest = {
      version: '1.0.0',
      projectId,
      title: project.title,
      updatedAt: project.updatedAt || new Date().toISOString(),
      chapters: chapterManifestItems,
    };

    await this.uploadJsonFile(
      accessToken,
      subfolderId,
      MANIFEST_FILE_NAME,
      JSON.stringify(sharedManifest, null, 2)
    );

    // 4. Cập nhật trạng thái dự án trong IndexedDB
    const updatedProject: StoryProject = {
      ...project,
      driveFolderId: subfolderId,
      driveStorageFormat: 'granular',
      isShared: true,
      isOwner: true,
    };
    await saveProjectToDB(updatedProject);

    onProgress?.({
      status: 'success',
      message: 'Đã chuyển đổi cấu trúc lưu trữ và sẵn sàng chia sẻ!',
      progressPercent: 100,
    });

    return subfolderId;
  }

  /**
   * Đồng bộ từng chương độc lập cho dự án cộng tác đã chia sẻ
   */
  public async syncGranularProject(
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
  }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang kiểm tra dữ liệu chương từ thư mục chia sẻ...',
        progressPercent: 10,
      });

      const localProject = await getProjectFromDB(projectId);
      const localChapters = await getChaptersByProjectFromDB(projectId);
      const localChaptersMap = new Map(localChapters.map((c) => [c.id, c]));

      // Tải remote manifest trong subfolder
      const query = `'${driveFolderId}' in parents and name = '${MANIFEST_FILE_NAME}' and trashed = false`;
      const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;
      const manifestRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let remoteManifest: SharedProjectManifest | null = null;
      if (manifestRes.ok) {
        const data = await manifestRes.json();
        if (data.files && data.files.length > 0) {
          remoteManifest = await this.downloadJsonFile<SharedProjectManifest>(
            accessToken,
            data.files[0].id
          );
        }
      }

      const remoteChapters = remoteManifest?.chapters || [];
      const remoteChaptersMap = new Map(remoteChapters.map((c) => [c.id, c]));

      let uploadedChapters = 0;
      let downloadedChapters = 0;
      const conflicts: ChapterConflictInfo[] = [];

      const allChapterIds = Array.from(
        new Set([...Array.from(localChaptersMap.keys()), ...Array.from(remoteChaptersMap.keys())])
      );

      for (let i = 0; i < allChapterIds.length; i++) {
        const chapId = allChapterIds[i];
        const local = localChaptersMap.get(chapId);
        const remoteMeta = remoteChaptersMap.get(chapId);
        const percent = Math.round(15 + ((i + 1) / allChapterIds.length) * 75);

        onProgress?.({
          status: 'syncing',
          message: `Đang đồng bộ chương: ${local?.title || remoteMeta?.title || chapId}...`,
          progressPercent: percent,
        });

        const action = reconcileChapterTimestamps(local?.updatedAt, remoteMeta?.updatedAt);

        if (action === 'push' && local) {
          const fileId = await this.uploadJsonFile(
            accessToken,
            driveFolderId,
            `chapter_${local.id}.json`,
            JSON.stringify(local, null, 2)
          );

          remoteChaptersMap.set(local.id, {
            id: local.id,
            title: local.title,
            updatedAt: local.updatedAt || new Date().toISOString(),
            status: local.status || 'not_started',
            fileId,
          });
          uploadedChapters++;
        } else if (action === 'pull' && remoteMeta) {
          // Tìm file ID của chapter
          let fileId = remoteMeta.fileId;
          if (!fileId) {
            const chapSearchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(
              `'${driveFolderId}' in parents and name = 'chapter_${chapId}.json' and trashed = false`
            )}&fields=files(id, name)&spaces=drive`;
            const chapSearchRes = await fetch(chapSearchUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (chapSearchRes.ok) {
              const chapSearchData = await chapSearchRes.json();
              if (chapSearchData.files && chapSearchData.files.length > 0) {
                fileId = chapSearchData.files[0].id;
              }
            }
          }

          if (fileId) {
            const remoteChapterData = await this.downloadJsonFile<Chapter>(accessToken, fileId);
            await saveChapterToDB(remoteChapterData);
            downloadedChapters++;
          }
        }
      }

      // Cập nhật lại manifest trong subfolder
      const updatedManifest: SharedProjectManifest = {
        version: '1.0.0',
        projectId,
        title: localProject?.title || remoteManifest?.title || 'Dự án chia sẻ',
        updatedAt: new Date().toISOString(),
        chapters: Array.from(remoteChaptersMap.values()),
      };

      await this.uploadJsonFile(
        accessToken,
        driveFolderId,
        MANIFEST_FILE_NAME,
        JSON.stringify(updatedManifest, null, 2)
      );

      onProgress?.({
        status: 'success',
        message: `Đồng bộ chương hoàn tất! (Tải lên: ${uploadedChapters}, Tải về: ${downloadedChapters})`,
        progressPercent: 100,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
      });

      return {
        success: true,
        uploadedChapters,
        downloadedChapters,
        conflicts,
      };
    } catch (err: any) {
      console.error('Lỗi đồng bộ chương:', err);
      const errorMsg = err.message || 'Lỗi đồng bộ chương truyện.';
      onProgress?.({
        status: 'error',
        message: `Thất bại: ${errorMsg}`,
        progressPercent: 100,
        error: errorMsg,
      });
      return {
        success: false,
        uploadedChapters: 0,
        downloadedChapters: 0,
        conflicts: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Nhập toàn bộ dự án và các chương từ thư mục được chia sẻ vào IndexedDB
   */
  public async importProjectFromSharedFolder(
    accessToken: string,
    sharedFolderId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<StoryProject> {
    onProgress?.({
      status: 'syncing',
      message: 'Đang tải thông tin dự án từ thư mục chia sẻ...',
      progressPercent: 15,
    });

    // 1. Tải project.json
    const projQuery = `'${sharedFolderId}' in parents and name = 'project.json' and trashed = false`;
    const projSearchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(projQuery)}&fields=files(id, name)&spaces=drive`;
    const projRes = await fetch(projSearchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!projRes.ok) {
      throw new Error(`Không thể tìm thấy tệp project.json trong thư mục (HTTP ${projRes.status})`);
    }

    const projData = await projRes.json();
    if (!projData.files || projData.files.length === 0) {
      throw new Error('Thư mục được chọn không chứa tệp project.json hợp lệ của AI Dịch Truyện.');
    }

    const project = await this.downloadJsonFile<StoryProject>(accessToken, projData.files[0].id);

    // 2. Tải manifest.json
    const manifestQuery = `'${sharedFolderId}' in parents and name = '${MANIFEST_FILE_NAME}' and trashed = false`;
    const manifestSearchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(manifestQuery)}&fields=files(id, name)&spaces=drive`;
    const manifestRes = await fetch(manifestSearchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let manifest: SharedProjectManifest | null = null;
    if (manifestRes.ok) {
      const manifestData = await manifestRes.json();
      if (manifestData.files && manifestData.files.length > 0) {
        manifest = await this.downloadJsonFile<SharedProjectManifest>(
          accessToken,
          manifestData.files[0].id
        );
      }
    }

    const chapters = manifest?.chapters || [];
    onProgress?.({
      status: 'syncing',
      message: `Đang tải ${chapters.length} chương truyện...`,
      progressPercent: 30,
    });

    for (let i = 0; i < chapters.length; i++) {
      const chapMeta = chapters[i];
      const percent = Math.round(30 + ((i + 1) / (chapters.length || 1)) * 60);

      onProgress?.({
        status: 'syncing',
        message: `Đang tải: ${chapMeta.title} (${i + 1}/${chapters.length})...`,
        progressPercent: percent,
      });

      if (chapMeta.fileId) {
        try {
          const chap = await this.downloadJsonFile<Chapter>(accessToken, chapMeta.fileId);
          await saveChapterToDB(chap);
        } catch (chapErr) {
          console.warn(`Không thể tải chương ${chapMeta.id}:`, chapErr);
        }
      }
    }

    const importedProject: StoryProject = {
      ...project,
      driveFolderId: sharedFolderId,
      driveStorageFormat: 'granular',
      isShared: true,
      isOwner: false,
    };
    await saveProjectToDB(importedProject);

    onProgress?.({
      status: 'success',
      message: `Đã mở thành công dự án "${project.title}"!`,
      progressPercent: 100,
    });

    return importedProject;
  }

  /**
   * Đẩy (Sao lưu toàn bộ) dữ liệu từ IndexedDB lên Google Drive (Dự án cá nhân monolithic)
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

        // Nếu dự án đã được chuyển sang định dạng granular chia sẻ riêng, đồng bộ theo subfolder
        if (project.driveStorageFormat === 'granular' && project.driveFolderId) {
          await this.syncGranularProject(accessToken, project.id, project.driveFolderId);
          summaries.push({
            id: project.id,
            title: project.title,
            updatedAt: project.updatedAt || new Date().toISOString(),
            chapterCount: project.chapters?.length || 0,
            glossaryCount: project.glossary?.length || 0,
            driveFolderId: project.driveFolderId,
            storageFormat: 'granular',
            isShared: true,
          });
          continue;
        }

        // Định dạng gộp monolithic cá nhân
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
          storageFormat: 'monolithic',
          isShared: false,
        });
      }

      // Cập nhật Manifest chung
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

        if (summary.storageFormat === 'granular' && summary.driveFolderId) {
          await this.importProjectFromSharedFolder(accessToken, summary.driveFolderId);
          continue;
        }

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

        // Nếu dự án đã chuyển sang granular (chia sẻ riêng)
        if (local?.driveStorageFormat === 'granular' && local.driveFolderId) {
          await this.syncGranularProject(accessToken, local.id, local.driveFolderId);
          uploadedCount++;
          continue;
        }

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
            storageFormat: 'monolithic',
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

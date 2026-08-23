import { StoryProject, Chapter } from '../../types';
import {
  DriveSyncManifest,
  DriveProjectSummary,
  SyncProgress,
  SyncConflictInfo,
} from '../../types/googleDriveSync';
import {
  getProjectsFromDB,
  saveProjectToDB,
  getChaptersByProjectFromDB,
  saveChapterToDB,
} from '../db';
import { DriveRestClient, MANIFEST_FILE_NAME } from './driveRestClient';

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

export class DriveProjectSync {
  /**
   * Đẩy (Sao lưu toàn bộ) dữ liệu từ IndexedDB lên Google Drive (Dự án cá nhân monolithic)
   */
  public async pushAllToDrive(
    client: DriveRestClient,
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void,
    onSyncGranularProject?: (accessToken: string, projectId: string, driveFolderId: string) => Promise<any>
  ): Promise<{ success: boolean; syncedProjects: number; error?: string }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang kết nối thư mục Google Drive...',
        progressPercent: 5,
      });

      const folderId = await client.ensureAppFolder(accessToken);
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
        if (project.driveStorageFormat === 'granular' && project.driveFolderId && onSyncGranularProject) {
          await onSyncGranularProject(accessToken, project.id, project.driveFolderId);
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

        const projectFileId = await client.uploadJsonFile(
          accessToken,
          folderId,
          `project_${project.id}.json`,
          projectJson
        );

        const chaptersFileId = await client.uploadJsonFile(
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

      await client.uploadJsonFile(
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
    client: DriveRestClient,
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void,
    onImportFromSharedFolder?: (accessToken: string, sharedFolderId: string) => Promise<any>
  ): Promise<{ success: boolean; restoredProjects: number; error?: string }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang kiểm tra danh mục sao lưu trên Google Drive...',
        progressPercent: 10,
      });

      const manifest = await client.fetchRemoteManifest(accessToken);
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

        if (summary.storageFormat === 'granular' && summary.driveFolderId && onImportFromSharedFolder) {
          await onImportFromSharedFolder(accessToken, summary.driveFolderId);
          continue;
        }

        if (summary.projectFileId) {
          const projectData = await client.downloadJsonFile<StoryProject>(
            accessToken,
            summary.projectFileId
          );
          await saveProjectToDB(projectData);
        }

        if (summary.chaptersFileId) {
          const chaptersData = await client.downloadJsonFile<Chapter[]>(
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
    client: DriveRestClient,
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void,
    onSyncGranularProject?: (accessToken: string, projectId: string, driveFolderId: string) => Promise<any>
  ): Promise<{
    success: boolean;
    uploadedCount: number;
    downloadedCount: number;
    failedPullCount: number;
    conflicts: SyncConflictInfo[];
  }> {

    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang phân tích dữ liệu đồng bộ 2 chiều...',
        progressPercent: 10,
      });

      const folderId = await client.ensureAppFolder(accessToken);
      const localProjects = await getProjectsFromDB();
      const localMap = new Map(localProjects.map((p) => [p.id, p]));

      const manifest = await client.fetchRemoteManifest(accessToken);
      const remoteProjects = manifest?.projects || [];
      const remoteMap = new Map(remoteProjects.map((p) => [p.id, p]));

      let uploadedCount = 0;
      let downloadedCount = 0;
      let failedPullCount = 0;
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
        if (local?.driveStorageFormat === 'granular' && local.driveFolderId && onSyncGranularProject) {
          const granRes = await onSyncGranularProject(accessToken, local.id, local.driveFolderId);
          if (granRes) {
            uploadedCount += granRes.uploadedChapters || 0;
            downloadedCount += granRes.downloadedChapters || 0;
            failedPullCount += granRes.failedPullCount || 0;
          }
          continue;
        }

        const action = reconcileProjectTimestamps(local?.updatedAt, remote?.updatedAt);

        if (action === 'push' && local) {
          const chapters = await getChaptersByProjectFromDB(local.id);
          const { projectJson, chaptersJson } = serializeProjectForDrive(local, chapters);

          const projectFileId = await client.uploadJsonFile(
            accessToken,
            folderId,
            `project_${local.id}.json`,
            projectJson
          );
          const chaptersFileId = await client.uploadJsonFile(
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
            const projectData = await client.downloadJsonFile<StoryProject>(
              accessToken,
              remote.projectFileId
            );
            await saveProjectToDB(projectData);
          }
          if (remote.chaptersFileId) {
            const chaptersData = await client.downloadJsonFile<Chapter[]>(
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

      await client.uploadJsonFile(
        accessToken,
        folderId,
        MANIFEST_FILE_NAME,
        JSON.stringify(updatedManifest, null, 2)
      );

      const statusMsg =
        failedPullCount > 0
          ? `Đồng bộ hoàn tất! (Tải lên: ${uploadedCount}, Tải về: ${downloadedCount} — còn ${failedPullCount} chương mới cần bấm "Đồng bộ file mới")`
          : `Đồng bộ hoàn tất! (Đã tải lên: ${uploadedCount}, Tải về: ${downloadedCount})`;

      onProgress?.({
        status: 'success',
        message: statusMsg,
        progressPercent: 100,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
      });

      return {
        success: true,
        uploadedCount,
        downloadedCount,
        failedPullCount,
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
        failedPullCount: 0,
        conflicts: [],
      };
    }
  }
}

import { StoryProject, Chapter, ChapterMetadata } from '../../types';
import {
  ProjectBundle,
  BundleProjectData,
  BundleChapterData,
  SyncProgress,
} from '../../types/googleDriveSync';
import {
  getProjectFromDB,
  saveProjectToDB,
  getChaptersByProjectFromDB,
  saveChapterToDB,
  saveChaptersToDB,
  getCrdtState,
  saveCrdtState,
  saveCrdtStates,
} from '../db';
import {
  createChapterYDoc,
  exportDocUpdate,
  extractCrdtSnapshot,
  mergeChapterCrdt,
  uint8ArrayToBase64,
} from '../crdtDocManager';
import { DriveRestClient } from './driveRestClient';

export class DriveBundleSync {
  /**
   * Đóng gói toàn bộ thông tin dự án và danh sách chương thành một đối tượng ProjectBundle
   */
  public async buildProjectBundle(projectId: string): Promise<ProjectBundle> {
    const project = await getProjectFromDB(projectId);
    if (!project) {
      throw new Error(`Không tìm thấy dự án với ID: ${projectId}`);
    }

    const localChapters = await getChaptersByProjectFromDB(projectId);
    const bundleChapters: BundleChapterData[] = [];
    const crdtRecordsToSave = [];

    for (const chap of localChapters) {
      let crdtSnapshot = '';
      const storedCrdt = await getCrdtState(chap.id);

      if (storedCrdt && storedCrdt.state && storedCrdt.state.length > 0) {
        crdtSnapshot = uint8ArrayToBase64(storedCrdt.state);
      } else {
        const session = createChapterYDoc(projectId, chap.id, chap);
        const stateBytes = exportDocUpdate(session.doc);
        crdtSnapshot = uint8ArrayToBase64(stateBytes);
        crdtRecordsToSave.push({
          chapterId: chap.id,
          projectId,
          state: stateBytes,
          updatedAt: chap.updatedAt || new Date().toISOString(),
        });
      }

      bundleChapters.push({
        ...chap,
        crdtSnapshot,
      });
    }

    if (crdtRecordsToSave.length > 0) {
      await saveCrdtStates(crdtRecordsToSave);
    }

    const projectData: BundleProjectData = {
      id: project.id,
      title: project.title,
      author: project.author,
      genre: project.genre,
      tone: project.tone,
      description: project.description,
      glossary: project.glossary || [],
      pendingGlossary: project.pendingGlossary || [],
      chapters: project.chapters || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      collaborators: project.collaborators,
      translationQueueState: project.translationQueueState,
      glossaryScanQueueState: project.glossaryScanQueueState,
      ignoredDuplicatePairs: project.ignoredDuplicatePairs,
    };

    return {
      bundleVersion: 1,
      exportedAt: new Date().toISOString(),
      project: projectData,
      chapters: bundleChapters,
    };
  }

  /**
   * Đẩy gói dữ liệu dự án lên Google Drive thành 1 file duy nhất (project_bundle_{projectId}.json)
   */
  public async pushBundle(
    client: DriveRestClient,
    accessToken: string,
    projectId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ fileId: string; uploadedAt: string }> {
    onProgress?.({
      status: 'syncing',
      message: 'Đang đóng gói dữ liệu dự án...',
      progressPercent: 20,
    });

    const bundle = await this.buildProjectBundle(projectId);
    const bundleJson = JSON.stringify(bundle, null, 2);

    onProgress?.({
      status: 'syncing',
      message: 'Đang tải gói dữ liệu lên Google Drive...',
      progressPercent: 50,
    });

    const rootFolderId = await client.ensureAppFolder(accessToken);
    const fileName = `project_bundle_${projectId}.json`;
    const fileId = await client.uploadJsonFile(accessToken, rootFolderId, fileName, bundleJson);

    // Cập nhật thông tin lưu trữ trong IndexedDB
    const project = await getProjectFromDB(projectId);
    if (project) {
      const now = new Date().toISOString();
      const updatedProject: StoryProject = {
        ...project,
        driveFileId: fileId,
        driveStorageFormat: 'bundle',
        updatedAt: now,
      };
      await saveProjectToDB(updatedProject);
    }

    onProgress?.({
      status: 'success',
      message: 'Đã sao lưu gói dự án lên Google Drive thành công!',
      progressPercent: 100,
    });

    return {
      fileId,
      uploadedAt: bundle.exportedAt,
    };
  }

  /**
   * Kéo và hợp nhất dữ liệu từ file gói dự án trên Google Drive về máy tính bằng CRDT
   */
  public async pullBundle(
    client: DriveRestClient,
    accessToken: string,
    projectId: string,
    driveFileId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    success: boolean;
    mergedChaptersCount: number;
    newChaptersCount: number;
    error?: string;
  }> {
    try {
      onProgress?.({
        status: 'syncing',
        message: 'Đang tải gói dữ liệu từ Google Drive...',
        progressPercent: 20,
      });

      const bundle = await client.downloadJsonFile<ProjectBundle>(accessToken, driveFileId);
      if (!bundle || !bundle.project || !Array.isArray(bundle.chapters)) {
        throw new Error('Dữ liệu gói dự án trên Google Drive không đúng định dạng.');
      }

      onProgress?.({
        status: 'syncing',
        message: 'Đang hợp nhất nội dung các chương bằng CRDT...',
        progressPercent: 50,
      });

      const localProject = await getProjectFromDB(projectId);
      const localChapters = await getChaptersByProjectFromDB(projectId);
      const localChaptersMap = new Map<string, Chapter>(localChapters.map((c) => [c.id, c]));

      let mergedCount = 0;
      let newCount = 0;
      const chaptersToSave: Chapter[] = [];
      const crdtStatesToSave = [];

      for (const remoteChap of bundle.chapters) {
        const localChap = localChaptersMap.get(remoteChap.id);
        const storedCrdt = await getCrdtState(remoteChap.id);

        const { mergedChapter, crdtState } = mergeChapterCrdt({
          projectId,
          chapterId: remoteChap.id,
          localChapter: localChap || null,
          localCrdtState: storedCrdt?.state || null,
          remoteChapter: remoteChap,
          remoteCrdtSnapshot: remoteChap.crdtSnapshot || null,
        });

        if (localChap) {
          mergedCount++;
        } else {
          newCount++;
        }

        chaptersToSave.push(mergedChapter);
        crdtStatesToSave.push({
          chapterId: remoteChap.id,
          projectId,
          state: crdtState,
          updatedAt: mergedChapter.updatedAt,
        });
      }

      // Giữ lại các chương chỉ có ở local mà remote chưa có
      for (const localChap of localChapters) {
        if (!bundle.chapters.some((r) => r.id === localChap.id)) {
          chaptersToSave.push(localChap);
        }
      }

      // Lưu tất cả chapters và CRDT states
      await saveChaptersToDB(chaptersToSave);
      await saveCrdtStates(crdtStatesToSave);

      // Cập nhật thông tin dự án
      const updatedChaptersMeta: ChapterMetadata[] = chaptersToSave.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      const mergedProject: StoryProject = {
        ...(localProject || {}),
        ...bundle.project,
        id: projectId,
        chapters: updatedChaptersMeta,
        driveFileId,
        driveStorageFormat: 'bundle',
        updatedAt: new Date().toISOString(),
      };

      await saveProjectToDB(mergedProject);

      onProgress?.({
        status: 'success',
        message: `Đồng bộ thành công! (Đã hợp nhất ${mergedCount} chương, thêm mới ${newCount} chương)`,
        progressPercent: 100,
      });

      return {
        success: true,
        mergedChaptersCount: mergedCount,
        newChaptersCount: newCount,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Lỗi không xác định khi đồng bộ gói dự án';
      onProgress?.({
        status: 'error',
        message: `Lỗi đồng bộ gói: ${errorMsg}`,
        progressPercent: 0,
        error: errorMsg,
      });
      return {
        success: false,
        mergedChaptersCount: 0,
        newChaptersCount: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Nạp dự án được chia sẻ từ 1 file gói dự án duy nhất (luồng cộng tác viên)
   */
  public async importBundle(
    client: DriveRestClient,
    accessToken: string,
    driveFileId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<StoryProject> {
    onProgress?.({
      status: 'syncing',
      message: 'Đang tải gói dữ liệu từ Google Drive...',
      progressPercent: 20,
    });

    const bundle = await client.downloadJsonFile<ProjectBundle>(accessToken, driveFileId);
    if (!bundle || !bundle.project || !Array.isArray(bundle.chapters)) {
      throw new Error('Tệp đã chọn không phải là gói dự án hợp lệ (AI Dịch Truyện).');
    }

    const projectId = bundle.project.id;
    const existingLocalProject = await getProjectFromDB(projectId);

    // Nếu đã tồn tại dự án local, chuyển sang luồng merge
    if (existingLocalProject) {
      await this.pullBundle(client, accessToken, projectId, driveFileId, onProgress);
      const updated = await getProjectFromDB(projectId);
      return updated!;
    }

    onProgress?.({
      status: 'syncing',
      message: `Đang nạp ${bundle.chapters.length} chương vào bộ nhớ...`,
      progressPercent: 60,
    });

    const chaptersToSave: Chapter[] = [];
    const crdtStatesToSave = [];

    for (const remoteChap of bundle.chapters) {
      const { mergedChapter, crdtState } = mergeChapterCrdt({
        projectId,
        chapterId: remoteChap.id,
        localChapter: null,
        remoteChapter: remoteChap,
        remoteCrdtSnapshot: remoteChap.crdtSnapshot || null,
      });

      chaptersToSave.push(mergedChapter);
      crdtStatesToSave.push({
        chapterId: remoteChap.id,
        projectId,
        state: crdtState,
        updatedAt: mergedChapter.updatedAt,
      });
    }

    await saveChaptersToDB(chaptersToSave);
    await saveCrdtStates(crdtStatesToSave);

    const importedChaptersMeta: ChapterMetadata[] = chaptersToSave.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    const importedProject: StoryProject = {
      ...bundle.project,
      chapters: importedChaptersMeta,
      driveFileId,
      driveStorageFormat: 'bundle',
      isShared: true,
      isOwner: false,
    };

    await saveProjectToDB(importedProject);

    onProgress?.({
      status: 'success',
      message: `Đã nạp dự án "${importedProject.title}" (${chaptersToSave.length} chương) thành công!`,
      progressPercent: 100,
    });

    return importedProject;
  }

  /**
   * Tự động chuyển đổi dự án dạng granular cũ của chủ sở hữu thành dạng gói bundle 1-file
   */
  public async migrateOwnerProjectToBundle(
    client: DriveRestClient,
    accessToken: string,
    projectId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<string> {
    const project = await getProjectFromDB(projectId);
    if (!project) {
      throw new Error(`Không tìm thấy dự án ${projectId}`);
    }

    onProgress?.({
      status: 'syncing',
      message: `Đang nâng cấp lưu trữ dự án "${project.title}" sang gói 1-file...`,
      progressPercent: 30,
    });

    const { fileId } = await this.pushBundle(client, accessToken, projectId, onProgress);
    return fileId;
  }
}

export const driveBundleSync = new DriveBundleSync();

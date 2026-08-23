import { StoryProject, Chapter } from '../../types';
import {
  SharedProjectManifest,
  ChapterManifestItem,
  ChapterConflictInfo,
  SyncProgress,
  SelectedDriveFile,
  FailedChapterPull,
  GranularProjectSyncSummary,
} from '../../types/googleDriveSync';
import {
  getProjectFromDB,
  saveProjectToDB,
  getChaptersByProjectFromDB,
  saveChapterToDB,
} from '../db';
import { createChapterYDoc, exportDocUpdate } from '../crdtDocManager';
import { DriveRestClient, DRIVE_FILES_ENDPOINT, MANIFEST_FILE_NAME } from './driveRestClient';
import { reconcileProjectTimestamps } from './driveProjectSync';


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
 * Chuyển tiêu đề chương thành slug ngắn gọn an toàn cho tên file (tối đa 30 ký tự)
 */
export function sanitizeChapterTitleSlug(title: string): string {
  if (!title) return '';
  return title
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // Thay ký tự đặc biệt bằng dấu gạch ngang
    .slice(0, 30)
    .replace(/^-+|-+$/g, '');        // Bỏ gạch ngang ở đầu/cuối sau khi cắt
}


/**
 * Tạo tên file chương rõ ràng, dễ phân biệt trên Google Drive / Picker
 * Ví dụ: "chapter_001_chuong-1-yem-nguc.json" hoặc "chapter_012.json"
 */
export function formatChapterFileName(index: number, title?: string, chapId?: string): string {
  const padIndex = String(index + 1).padStart(3, '0');
  const slug = sanitizeChapterTitleSlug(title || '');
  if (slug) {
    return `chapter_${padIndex}_${slug}.json`;
  }
  return `chapter_${padIndex}.json`;
}

/**
 * Đóng gói chapter JSON kèm CRDT binary update snapshot (Base64) để làm bản backup dự phòng.
 */
export function encodeChapterWithCrdt(projectId: string, chap: Chapter): string {
  try {
    const session = createChapterYDoc(projectId, chap.id, chap);
    const updateBytes = exportDocUpdate(session.doc);
    let binaryString = '';
    for (let b = 0; b < updateBytes.length; b++) {
      binaryString += String.fromCharCode(updateBytes[b]);
    }
    const crdtSnapshot = typeof btoa !== 'undefined' ? btoa(binaryString) : Buffer.from(updateBytes).toString('base64');
    return JSON.stringify({
      ...chap,
      crdtSnapshot,
    }, null, 2);
  } catch (e) {
    return JSON.stringify(chap, null, 2);
  }
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
    chapters: chapters.map((c, i) => ({
      id: c.id,
      title: c.title,
      fileName: formatChapterFileName(i, c.title, c.id),
      updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
      status: c.status || 'not_started',
    })),
  };
}

export class DriveGranularSync {
  /**
   * Di chuyển dự án từ monolithic sang subfolder riêng và chia nhỏ từng file chương
   */
  public async migrateProjectToGranularSubfolder(
    client: DriveRestClient,
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

    const subfolderId = await client.ensureProjectSubfolder(accessToken, projectId);
    const chapters = await getChaptersByProjectFromDB(projectId);

    onProgress?.({
      status: 'syncing',
      message: 'Đang tải lên thông tin dự án (project.json)...',
      progressPercent: 25,
    });

    // 1. Tải lên project.json
    await client.uploadJsonFile(
      accessToken,
      subfolderId,
      'project.json',
      JSON.stringify(project, null, 2)
    );

    // 2. Tách và tải lên từng file chương với tên có số thứ tự + tiêu đề
    const chapterManifestItems: ChapterManifestItem[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const chap = chapters[i];
      const percent = Math.round(30 + ((i + 1) / chapters.length) * 60);

      onProgress?.({
        status: 'syncing',
        message: `Đang chia nhỏ chương ${i + 1}/${chapters.length}: ${chap.title}...`,
        progressPercent: percent,
      });

      const fileName = formatChapterFileName(i, chap.title, chap.id);

      const fileId = await client.uploadJsonFile(
        accessToken,
        subfolderId,
        fileName,
        encodeChapterWithCrdt(projectId, chap)
      );

      chapterManifestItems.push({
        id: chap.id,
        title: chap.title,
        fileName,
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

    await client.uploadJsonFile(
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
    client: DriveRestClient,
    accessToken: string,
    projectId: string,
    driveFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<GranularProjectSyncSummary & { conflicts: ChapterConflictInfo[] }> {
    try {
      // Kiểm tra folder còn tồn tại trước khi làm bất cứ điều gì
      const stillExists = await client.fileExists(accessToken, driveFolderId);
      if (!stillExists) {
        onProgress?.({
          status: 'syncing',
          message: 'Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới...',
          progressPercent: 15,
        });

        // Tạo lại toàn bộ subfolder + upload lại chapter local hiện có
        await this.migrateProjectToGranularSubfolder(
          client,
          accessToken,
          projectId,
          onProgress
        );

        const localChapters = await getChaptersByProjectFromDB(projectId);

        return {
          success: true,
          uploadedChapters: localChapters.length,
          downloadedChapters: 0,
          failedPullCount: 0,
          failedChapters: [],
          conflicts: [],
        };
      }

      onProgress?.({
        status: 'syncing',
        message: 'Đang kiểm tra dữ liệu chương từ thư mục chia sẻ...',
        progressPercent: 10,
      });

      const localProject = await getProjectFromDB(projectId);
      const localChapters = await getChaptersByProjectFromDB(projectId);
      const localChaptersMap = new Map(localChapters.map((c) => [c.id, c]));

      // Tải remote manifest trong subfolder
      let manifestFileId = selectedFiles?.find((f) => f.name === MANIFEST_FILE_NAME)?.id;
      if (!manifestFileId) {
        const query = `'${driveFolderId}' in parents and name = '${MANIFEST_FILE_NAME}' and trashed = false`;
        const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;
        const manifestRes = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (manifestRes.ok) {
          const data = await manifestRes.json();
          if (data.files && data.files.length > 0) {
            manifestFileId = data.files[0].id;
          }
        }
      }

      let remoteManifest: SharedProjectManifest | null = null;
      if (manifestFileId) {
        try {
          remoteManifest = await client.downloadJsonFile<SharedProjectManifest>(
            accessToken,
            manifestFileId
          );
        } catch (manifestErr) {
          console.warn('Không thể tải file manifest.json từ Drive:', manifestErr);
        }
      }

      const remoteChapters = remoteManifest?.chapters || [];
      const remoteChaptersMap = new Map(remoteChapters.map((c) => [c.id, c]));

      let uploadedChapters = 0;
      let downloadedChapters = 0;
      let failedPullCount = 0;
      const failedChapters: FailedChapterPull[] = [];
      const conflicts: ChapterConflictInfo[] = [];

      const allChapterIds = Array.from(
        new Set([...Array.from(localChaptersMap.keys()), ...Array.from(remoteChaptersMap.keys())])
      );

      for (let i = 0; i < allChapterIds.length; i++) {
        const chapId = allChapterIds[i];
        const local = localChaptersMap.get(chapId);
        const remoteMeta = remoteChaptersMap.get(chapId);
        const percent = Math.round(15 + ((i + 1) / (allChapterIds.length || 1)) * 75);

        onProgress?.({
          status: 'syncing',
          message: `Đang đồng bộ chương: ${local?.title || remoteMeta?.title || chapId}...`,
          progressPercent: percent,
        });

        const action = reconcileChapterTimestamps(local?.updatedAt, remoteMeta?.updatedAt);

        if (action === 'push' && local) {
          const fileName = remoteMeta?.fileName || formatChapterFileName(i, local.title, local.id);
          const fileId = await client.uploadJsonFile(
            accessToken,
            driveFolderId,
            fileName,
            encodeChapterWithCrdt(projectId, local)
          );

          remoteChaptersMap.set(local.id, {
            id: local.id,
            title: local.title,
            fileName,
            updatedAt: local.updatedAt || new Date().toISOString(),
            status: local.status || 'not_started',
            fileId,
          });
          uploadedChapters++;
        } else if (action === 'pull' && remoteMeta) {
          // Tìm file ID của chapter
          let fileId = remoteMeta.fileId;
          const expectedFileName = remoteMeta.fileName || formatChapterFileName(i, remoteMeta.title, chapId);
          if (!fileId && selectedFiles) {
            fileId = selectedFiles.find(
              (f) =>
                (remoteMeta.fileName && f.name === remoteMeta.fileName) ||
                f.name === expectedFileName ||
                f.name === `chapter_${chapId}.json` ||
                f.name.includes(chapId) ||
                (remoteMeta.fileId && f.id === remoteMeta.fileId)
            )?.id;
          }

          if (!fileId) {
            const chapSearchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(
              `'${driveFolderId}' in parents and (name = '${expectedFileName}' or name = 'chapter_${chapId}.json') and trashed = false`
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
            try {
              const remoteChapterData = await client.downloadJsonFile<Chapter>(accessToken, fileId);
              await saveChapterToDB(remoteChapterData);
              downloadedChapters++;
            } catch (pullErr: any) {
              failedPullCount++;
              failedChapters.push({
                id: chapId,
                title: remoteMeta.title || chapId,
                error: pullErr.message || 'Lỗi tải tệp chương',
              });
              console.warn(`Không thể tải chương ${chapId}:`, pullErr);
            }
          } else {
            failedPullCount++;
            failedChapters.push({
              id: chapId,
              title: remoteMeta.title || chapId,
              error: 'Không tìm thấy file trên Google Drive hoặc chưa cấp quyền',
            });
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

      await client.uploadJsonFile(
        accessToken,
        driveFolderId,
        MANIFEST_FILE_NAME,
        JSON.stringify(updatedManifest, null, 2)
      );

      const statusMsg =
        failedPullCount > 0
          ? `Đã đồng bộ ${uploadedChapters + downloadedChapters} chương (có ${failedPullCount} chương tải lỗi)`
          : `Đồng bộ chương hoàn tất! (Tải lên: ${uploadedChapters}, Tải về: ${downloadedChapters})`;

      onProgress?.({
        status: failedPullCount > 0 && downloadedChapters === 0 && uploadedChapters === 0 ? 'error' : 'success',
        message: statusMsg,
        progressPercent: 100,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
      });

      return {
        success: true,
        uploadedChapters,
        downloadedChapters,
        failedPullCount,
        failedChapters,
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
        failedPullCount: 0,
        failedChapters: [],
        conflicts: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Nhập toàn bộ dự án và các chương từ thư mục được chia sẻ vào IndexedDB.
   * Chấp nhận danh sách `selectedFiles` đã được cấp quyền từ Google Picker để tải trực tiếp mà không bị lỗi quyền.
   */
  public async importProjectFromSharedFolder(
    client: DriveRestClient,
    accessToken: string,
    sharedFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<StoryProject> {
    // Kiểm tra sớm xem thư mục có tồn tại không
    const folderExists = await client.fileExists(accessToken, sharedFolderId);
    if (!folderExists) {
      throw new Error(
        'Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). ' +
        'Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới.'
      );
    }

    onProgress?.({
      status: 'syncing',
      message: 'Đang tải thông tin dự án từ thư mục chia sẻ...',
      progressPercent: 15,
    });

    // 1. Tải project.json
    let projectFileId = selectedFiles?.find((f) => f.name === 'project.json')?.id;

    if (!projectFileId && !selectedFiles) {
      const projQuery = `'${sharedFolderId}' in parents and name = 'project.json' and trashed = false`;
      const projSearchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(projQuery)}&fields=files(id, name)&spaces=drive`;
      const projRes = await fetch(projSearchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!projRes.ok) {
        throw new Error(`Không thể tìm thấy tệp project.json trong thư mục (HTTP ${projRes.status})`);
      }

      const projData = await projRes.json();
      if (projData.files && projData.files.length > 0) {
        projectFileId = projData.files[0].id;
      }
    }

    if (!projectFileId) {
      if (selectedFiles) {
        throw new Error(
          'Chưa cấp quyền cho tệp: project.json. Vui lòng mở lại và chọn TẤT CẢ tệp trong hộp thoại Google Picker (Ctrl+A / Cmd+A).'
        );
      }
      throw new Error('Thư mục được chọn không chứa tệp project.json hợp lệ của AI Dịch Truyện.');
    }

    const project = await client.downloadJsonFile<StoryProject>(accessToken, projectFileId);

    // 2. Tải manifest.json
    let manifestFileId = selectedFiles?.find((f) => f.name === MANIFEST_FILE_NAME)?.id;

    if (!manifestFileId && !selectedFiles) {
      const manifestQuery = `'${sharedFolderId}' in parents and name = '${MANIFEST_FILE_NAME}' and trashed = false`;
      const manifestSearchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(manifestQuery)}&fields=files(id, name)&spaces=drive`;
      const manifestRes = await fetch(manifestSearchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (manifestRes.ok) {
        const manifestData = await manifestRes.json();
        if (manifestData.files && manifestData.files.length > 0) {
          manifestFileId = manifestData.files[0].id;
        }
      }
    }

    let manifest: SharedProjectManifest | null = null;
    if (manifestFileId) {
      try {
        manifest = await client.downloadJsonFile<SharedProjectManifest>(
          accessToken,
          manifestFileId
        );
      } catch (manifestErr) {
        console.warn('Không thể đọc manifest.json:', manifestErr);
      }
    }

    const chapters = manifest?.chapters || [];

    // 3. Pre-download validation: kiểm tra toàn bộ danh sách chương trước khi tải
    if (selectedFiles && chapters.length > 0) {
      const missingFiles: string[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const chapMeta = chapters[i];
        const expectedFileName = chapMeta.fileName || formatChapterFileName(i, chapMeta.title, chapMeta.id);
        const hasFile = selectedFiles.some(
          (f) =>
            (chapMeta.fileName && f.name === chapMeta.fileName) ||
            f.name === expectedFileName ||
            f.name === `chapter_${chapMeta.id}.json` ||
            f.name.includes(chapMeta.id) ||
            (chapMeta.fileId && f.id === chapMeta.fileId)
        );
        if (!hasFile) {
          missingFiles.push(expectedFileName);
        }
      }

      if (missingFiles.length > 0) {
        throw new Error(
          `Chưa cấp quyền cho các tệp: ${missingFiles.join(', ')}. Vui lòng mở lại và chọn TẤT CẢ tệp trong hộp thoại Google Picker (Ctrl+A / Cmd+A).`
        );
      }
    }

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

      const expectedFileName = chapMeta.fileName || formatChapterFileName(i, chapMeta.title, chapMeta.id);
      let fileId =
        selectedFiles?.find(
          (f) =>
            (chapMeta.fileName && f.name === chapMeta.fileName) ||
            f.name === expectedFileName ||
            f.name === `chapter_${chapMeta.id}.json` ||
            f.name.includes(chapMeta.id) ||
            (chapMeta.fileId && f.id === chapMeta.fileId)
        )?.id || chapMeta.fileId;

      if (fileId) {
        try {
          const chap = await client.downloadJsonFile<Chapter>(accessToken, fileId);
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
}


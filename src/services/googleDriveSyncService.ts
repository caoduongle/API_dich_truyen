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
  DriveRestClient,
  DRIVE_FILES_ENDPOINT,
  DRIVE_UPLOAD_ENDPOINT,
  APP_FOLDER_NAME,
  MANIFEST_FILE_NAME,
} from './google-drive/driveRestClient';

import {
  DriveProjectSync,
  reconcileProjectTimestamps,
  serializeProjectForDrive,
} from './google-drive/driveProjectSync';

import {
  DriveGranularSync,
  reconcileChapterTimestamps,
  encodeChapterWithCrdt,
  buildSharedProjectManifest,
  formatChapterFileName,
  sanitizeChapterTitleSlug,
} from './google-drive/driveGranularSync';

export {
  DRIVE_FILES_ENDPOINT,
  DRIVE_UPLOAD_ENDPOINT,
  APP_FOLDER_NAME,
  MANIFEST_FILE_NAME,
  reconcileProjectTimestamps,
  reconcileChapterTimestamps,
  encodeChapterWithCrdt,
  serializeProjectForDrive,
  buildSharedProjectManifest,
  formatChapterFileName,
  sanitizeChapterTitleSlug,
  DriveRestClient,
  DriveProjectSync,
  DriveGranularSync,
};

export class GoogleDriveSyncService {
  private client = new DriveRestClient();
  private projectSync = new DriveProjectSync();
  private granularSync = new DriveGranularSync();

  public async ensureAppFolder(accessToken: string): Promise<string> {
    return this.client.ensureAppFolder(accessToken);
  }

  public async ensureProjectSubfolder(accessToken: string, projectId: string): Promise<string> {
    return this.client.ensureProjectSubfolder(accessToken, projectId);
  }

  public async uploadJsonFile(
    accessToken: string,
    folderId: string,
    fileName: string,
    jsonString: string
  ): Promise<string> {
    return this.client.uploadJsonFile(accessToken, folderId, fileName, jsonString);
  }

  public async downloadJsonFile<T = any>(accessToken: string, fileId: string): Promise<T> {
    return this.client.downloadJsonFile<T>(accessToken, fileId);
  }

  public async fetchRemoteManifest(accessToken: string): Promise<DriveSyncManifest | null> {
    return this.client.fetchRemoteManifest(accessToken);
  }

  public async migrateProjectToGranularSubfolder(
    accessToken: string,
    projectId: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<string> {
    return this.granularSync.migrateProjectToGranularSubfolder(
      this.client,
      accessToken,
      projectId,
      onProgress
    );
  }

  public async syncGranularProject(
    accessToken: string,
    projectId: string,
    driveFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<{
    success: boolean;
    uploadedChapters: number;
    downloadedChapters: number;
    failedPullCount: number;
    failedChapters: { id: string; title?: string; error?: string }[];
    conflicts: ChapterConflictInfo[];
    error?: string;
  }> {
    return this.granularSync.syncGranularProject(
      this.client,
      accessToken,
      projectId,
      driveFolderId,
      onProgress,
      selectedFiles
    );
  }

  public async syncGranularProjectFiles(
    accessToken: string,
    projectId: string,
    driveFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<{
    success: boolean;
    uploadedChapters: number;
    downloadedChapters: number;
    failedPullCount: number;
    failedChapters: { id: string; title?: string; error?: string }[];
    conflicts: ChapterConflictInfo[];
    error?: string;
  }> {
    return this.syncGranularProject(accessToken, projectId, driveFolderId, onProgress, selectedFiles);
  }


  public async importProjectFromSharedFolder(
    accessToken: string,
    sharedFolderId: string,
    onProgress?: (progress: SyncProgress) => void,
    selectedFiles?: { id: string; name: string }[]
  ): Promise<StoryProject> {
    return this.granularSync.importProjectFromSharedFolder(
      this.client,
      accessToken,
      sharedFolderId,
      onProgress,
      selectedFiles
    );
  }

  public async pushAllToDrive(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; syncedProjects: number; error?: string }> {
    return this.projectSync.pushAllToDrive(
      this.client,
      accessToken,
      onProgress,
      (token, prjId, fId) => this.syncGranularProject(token, prjId, fId)
    );
  }

  public async pullAllFromDrive(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ success: boolean; restoredProjects: number; error?: string }> {
    return this.projectSync.pullAllFromDrive(
      this.client,
      accessToken,
      onProgress,
      (token, fId) => this.importProjectFromSharedFolder(token, fId)
    );
  }

  public async syncBiDirectional(
    accessToken: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{
    success: boolean;
    uploadedCount: number;
    downloadedCount: number;
    failedPullCount: number;
    conflicts: SyncConflictInfo[];
  }> {
    return this.projectSync.syncBiDirectional(
      this.client,
      accessToken,
      onProgress,
      (token, prjId, fId) => this.syncGranularProject(token, prjId, fId)
    );
  }
}

export const googleDriveSyncService = new GoogleDriveSyncService();


export type SyncStateStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict' | 'offline';

export interface DriveProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  chapterCount: number;
  glossaryCount: number;
  projectFileId?: string;
  chaptersFileId?: string;
}

export interface DriveSyncManifest {
  version: string;
  lastSyncTimestamp: string;
  projects: DriveProjectSummary[];
}

export interface SyncProgress {
  status: SyncStateStatus;
  message: string;
  currentProjectTitle?: string;
  progressPercent: number;
  lastSyncedAt?: string;
  error?: string;
}

export interface SyncConflictInfo {
  projectId: string;
  projectTitle: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localChapterCount: number;
  remoteChapterCount: number;
}

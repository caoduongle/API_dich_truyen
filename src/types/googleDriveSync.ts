import { Chapter } from '../types';

export type SyncStateStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict' | 'offline';

export interface DriveProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  chapterCount: number;
  glossaryCount: number;
  projectFileId?: string;
  chaptersFileId?: string;
  driveFolderId?: string;
  storageFormat?: 'monolithic' | 'granular';
  isShared?: boolean;
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

export interface CollaboratorPermission {
  permissionId: string;
  emailAddress: string;
  displayName?: string;
  role: 'writer' | 'reader' | 'owner';
  photoLink?: string;
}

export interface ChapterManifestItem {
  id: string;
  title: string;
  updatedAt: string;
  status: 'not_started' | 'in_progress' | 'completed';
  fileId?: string;
}

export interface SharedProjectManifest {
  version: string;
  projectId: string;
  title: string;
  updatedAt: string;
  chapters: ChapterManifestItem[];
}

export interface ChapterConflictInfo {
  chapterId: string;
  chapterTitle: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localChapter: Chapter;
  remoteChapter: Chapter;
}

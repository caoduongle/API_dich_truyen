import { Chapter, GlossaryItem, PendingGlossaryItem, ChapterMetadata, StoryProject } from '../types';

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
  driveFileId?: string;
  storageFormat?: 'monolithic' | 'granular' | 'bundle';
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
  fileName?: string;
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

export interface SelectedDriveFile {
  id: string;
  name: string;
  mimeType?: string;
}

export interface OpenFilePickerOptions {
  accessToken: string;
  pickerApiKey?: string;
  folderId: string;
  title?: string;
  onFilesSelected: (files: SelectedDriveFile[]) => void;
  onCancel?: () => void;
}

export interface OpenBundlePickerOptions {
  accessToken: string;
  pickerApiKey?: string;
  title?: string;
  onFileSelected: (file: SelectedDriveFile) => void;
  onCancel?: () => void;
}

export interface FailedChapterPull {
  id: string;
  title?: string;
  error?: string;
}

export interface GranularProjectSyncSummary {
  success: boolean;
  uploadedChapters: number;
  downloadedChapters: number;
  failedPullCount: number;
  failedChapters: FailedChapterPull[];
  error?: string;
}

export interface BundleProjectData {
  id: string;
  title: string;
  author: string;
  genre: string;
  tone: string;
  description: string;
  glossary: GlossaryItem[];
  pendingGlossary: PendingGlossaryItem[];
  chapters: ChapterMetadata[];
  createdAt: string;
  updatedAt?: string;
  collaborators?: StoryProject['collaborators'];
  translationQueueState?: StoryProject['translationQueueState'];
  glossaryScanQueueState?: StoryProject['glossaryScanQueueState'];
  ignoredDuplicatePairs?: string[];
}

export interface BundleChapterData extends Chapter {
  crdtSnapshot?: string;
  crdtStateVector?: string;
}

export interface ProjectBundle {
  bundleVersion: number;
  exportedAt: string;
  project: BundleProjectData;
  chapters: BundleChapterData[];
}

export interface CrdtStateRecord {
  chapterId: string;
  projectId: string;
  state: Uint8Array;
  updatedAt: string;
}


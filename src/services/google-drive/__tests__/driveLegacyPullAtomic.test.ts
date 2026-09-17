import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveProjectSync } from '../driveProjectSync';
import { DriveRestClient } from '../driveRestClient';
import { StoryProject, Chapter } from '../../../types';
import * as db from '../../db';

vi.mock('../../db', () => ({
  getProjectsFromDB: vi.fn(async () => []),
  saveProjectToDB: vi.fn(async () => {}),
  atomicSaveProjectBundle: vi.fn(async () => {}),
  getChaptersByProjectFromDB: vi.fn(async () => []),
  saveChapterToDB: vi.fn(async () => {}),
}));

describe('Drive Legacy Monolithic Pull - Atomic Transaction (User Story 3)', () => {
  const token = 'test_token';
  const folderId = 'folder_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyProject: StoryProject = {
    id: 'p_mono_1',
    title: 'Monolithic Project',
    author: 'Author',
    genre: 'Tiên Hiệp',
    tone: 'Cổ phong',
    description: 'Description',
    chapters: [],
    glossary: [],
    pendingGlossary: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() + 10000).toISOString(),
  };

  const dummyChapters: Chapter[] = [
    {
      id: 'c1',
      projectId: 'p_mono_1',
      title: 'Chương 1',
      sourceText: 'Source 1',
      rawTranslation: '',
      polishedTranslation: '',
      paragraphs: [],
      translatedLines: [],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'c2',
      projectId: 'p_mono_1',
      title: 'Chương 2',
      sourceText: 'Source 2',
      rawTranslation: '',
      polishedTranslation: '',
      paragraphs: [],
      translatedLines: [],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it('downloads both project and chapters before atomically saving with atomicSaveProjectBundle', async () => {
    const mockClient = new DriveRestClient();
    vi.spyOn(mockClient, 'ensureAppFolder').mockResolvedValue(folderId);
    vi.spyOn(mockClient, 'fetchRemoteManifest').mockResolvedValue({
      version: '1.0.0',
      lastSyncTimestamp: new Date().toISOString(),
      projects: [
        {
          id: 'p_mono_1',
          title: 'Monolithic Project',
          updatedAt: dummyProject.updatedAt!,
          chapterCount: 2,
          glossaryCount: 0,
          projectFileId: 'file_proj_1',
          chaptersFileId: 'file_chap_1',
          storageFormat: 'monolithic',
        },
      ],
    });

    vi.spyOn(mockClient, 'downloadJsonFile').mockImplementation(async (_token, fileId) => {
      if (fileId === 'file_proj_1') return dummyProject as any;
      if (fileId === 'file_chap_1') return dummyChapters as any;
      throw new Error(`Unexpected fileId: ${fileId}`);
    });

    vi.spyOn(mockClient, 'uploadJsonFile').mockResolvedValue('file_manifest_new');

    const sync = new DriveProjectSync();
    await sync.pullAllFromDrive(mockClient, token);

    // Assert atomicSaveProjectBundle was called with both project and all chapters
    expect(db.atomicSaveProjectBundle).toHaveBeenCalledWith(dummyProject, dummyChapters);
    expect(db.atomicSaveProjectBundle).toHaveBeenCalledTimes(1);

    // Assert saveProjectToDB was NOT called individually
    expect(db.saveProjectToDB).not.toHaveBeenCalled();
    expect(db.saveChapterToDB).not.toHaveBeenCalled();
  });

  it('aborts without any DB commit if chapters file download fails', async () => {
    const mockClient = new DriveRestClient();
    vi.spyOn(mockClient, 'ensureAppFolder').mockResolvedValue(folderId);
    vi.spyOn(mockClient, 'fetchRemoteManifest').mockResolvedValue({
      version: '1.0.0',
      lastSyncTimestamp: new Date().toISOString(),
      projects: [
        {
          id: 'p_mono_1',
          title: 'Monolithic Project',
          updatedAt: dummyProject.updatedAt!,
          chapterCount: 2,
          glossaryCount: 0,
          projectFileId: 'file_proj_1',
          chaptersFileId: 'file_chap_1',
          storageFormat: 'monolithic',
        },
      ],
    });

    vi.spyOn(mockClient, 'downloadJsonFile').mockImplementation(async (_token, fileId) => {
      if (fileId === 'file_proj_1') return dummyProject as any;
      if (fileId === 'file_chap_1') throw new Error('Network timeout downloading chapters');
      throw new Error(`Unexpected fileId: ${fileId}`);
    });

    const sync = new DriveProjectSync();
    const result = await sync.pullAllFromDrive(mockClient, token);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network timeout downloading chapters');

    // Assert atomicSaveProjectBundle, saveProjectToDB, and saveChapterToDB were NEVER called!
    expect(db.atomicSaveProjectBundle).not.toHaveBeenCalled();
    expect(db.saveProjectToDB).not.toHaveBeenCalled();
    expect(db.saveChapterToDB).not.toHaveBeenCalled();
  });
});

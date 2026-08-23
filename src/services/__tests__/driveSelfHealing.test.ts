import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveRestClient, DRIVE_FILES_ENDPOINT, APP_FOLDER_NAME } from '../google-drive/driveRestClient';
import { DriveGranularSync } from '../google-drive/driveGranularSync';
import { DriveProjectSync } from '../google-drive/driveProjectSync';
import { StoryProject, Chapter } from '../../types';

// Mock DB layer
vi.mock('../db', () => {
  let mockProjects: Record<string, StoryProject> = {};
  let mockChapters: Record<string, Chapter[]> = {};

  return {
    getProjectFromDB: vi.fn(async (id: string) => mockProjects[id] || null),
    saveProjectToDB: vi.fn(async (p: StoryProject) => {
      mockProjects[p.id] = { ...p };
    }),
    getProjectsFromDB: vi.fn(async () => Object.values(mockProjects)),
    getChaptersByProjectFromDB: vi.fn(async (projectId: string) => mockChapters[projectId] || []),
    saveChapterToDB: vi.fn(async (chap: Chapter) => {
      const list = mockChapters[chap.projectId || ''] || [];
      const idx = list.findIndex((c) => c.id === chap.id);
      if (idx >= 0) list[idx] = { ...chap };
      else list.push({ ...chap });
      mockChapters[chap.projectId || ''] = list;
    }),
    __resetMockDb: (projects: Record<string, StoryProject>, chapters: Record<string, Chapter[]>) => {
      mockProjects = { ...projects };
      mockChapters = { ...chapters };
    },
  };
});

describe('Google Drive Folder Self-Healing and Error Recovery', () => {
  const token = 'mock_access_token_123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('DriveRestClient.fileExists (T002 & T003)', () => {
    it('returns true when file exists and is not trashed (200 OK, trashed: false)', async () => {
      const client = new DriveRestClient();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'valid_folder_1', trashed: false }),
      });

      const exists = await client.fileExists(token, 'valid_folder_1');
      expect(exists).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${DRIVE_FILES_ENDPOINT}/valid_folder_1?fields=id,trashed`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    });

    it('returns false when file is trashed (200 OK, trashed: true)', async () => {
      const client = new DriveRestClient();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'trashed_folder_1', trashed: true }),
      });

      const exists = await client.fileExists(token, 'trashed_folder_1');
      expect(exists).toBe(false);
    });

    it('returns false when API returns 404 Not Found', async () => {
      const client = new DriveRestClient();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const exists = await client.fileExists(token, 'non_existent_id');
      expect(exists).toBe(false);
    });

    it('returns false when API returns 403 Forbidden', async () => {
      const client = new DriveRestClient();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      const exists = await client.fileExists(token, 'forbidden_id');
      expect(exists).toBe(false);
    });

    it('returns false when network fetch throws an error', async () => {
      const client = new DriveRestClient();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const exists = await client.fileExists(token, 'any_id');
      expect(exists).toBe(false);
    });

    it('returns false immediately for empty or whitespace fileId without calling fetch', async () => {
      const client = new DriveRestClient();
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      expect(await client.fileExists(token, '')).toBe(false);
      expect(await client.fileExists(token, '   ')).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('DriveRestClient.ensureAppFolder Cache Invalidation (T008 & T009)', () => {
    it('returns cachedFolderId when verified still alive', async () => {
      const client = new DriveRestClient();
      (client as any).cachedFolderId = 'cached_root_123';

      vi.spyOn(client, 'fileExists').mockResolvedValue(true);
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const folderId = await client.ensureAppFolder(token);
      expect(folderId).toBe('cached_root_123');
      expect(client.fileExists).toHaveBeenCalledWith(token, 'cached_root_123');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('invalidates cachedFolderId when remote folder is deleted and recreates/searches root folder', async () => {
      const client = new DriveRestClient();
      (client as any).cachedFolderId = 'stale_root_deleted';

      vi.spyOn(client, 'fileExists').mockResolvedValue(false);

      // Mock search query returning existing or newly created folder
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ id: 'new_recreated_root_456' }),
          });
        }
        // Search query returned no files
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ files: [] }),
        });
      });

      const folderId = await client.ensureAppFolder(token);
      expect(folderId).toBe('new_recreated_root_456');
      expect((client as any).cachedFolderId).toBe('new_recreated_root_456');
    });
  });

  describe('DriveGranularSync.syncGranularProject Self-Healing (T004 & T005)', () => {
    const mockProj: StoryProject = {
      id: 'proj_heal_1',
      title: 'Thôn Phệ Tinh Không',
      author: 'Ngã Cật Tây Hồng Thị',
      genre: 'Khoa Huyễn',
      tone: 'Hào hùng',
      description: 'Truyện tu chân tương lai',
      driveFolderId: 'old_deleted_folder_999',
      driveStorageFormat: 'granular',
      isOwner: true,
      chapters: [
        { id: 'c1', title: 'Chương 1', status: 'completed', createdAt: '2026-08-20T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z' },
        { id: 'c2', title: 'Chương 2', status: 'completed', createdAt: '2026-08-20T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z' },
      ],
      glossary: [],
      pendingGlossary: [],
      createdAt: '2026-08-20T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
    };

    const mockChaps: Chapter[] = [
      {
        id: 'c1',
        projectId: 'proj_heal_1',
        title: 'Chương 1: La Phong',
        sourceText: '第一章 罗峰',
        rawTranslation: '',
        polishedTranslation: 'Chương 1: La Phong',
        paragraphs: ['第一章 罗峰'],
        translatedLines: ['Chương 1: La Phong'],
        status: 'completed',
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      },
      {
        id: 'c2',
        projectId: 'proj_heal_1',
        title: 'Chương 2: Đột phá',
        sourceText: '第二章 突破',
        rawTranslation: '',
        polishedTranslation: 'Chương 2: Đột phá',
        paragraphs: ['第二章 突破'],
        translatedLines: ['Chương 2: Đột phá'],
        status: 'completed',
        createdAt: '2026-08-20T00:00:00Z',
        updatedAt: '2026-08-20T00:00:00Z',
      },
    ];

    it('detects missing driveFolderId, notifies user, calls migration, and returns success', async () => {
      const { __resetMockDb } = await import('../db') as any;
      __resetMockDb({ [mockProj.id]: mockProj }, { [mockProj.id]: mockChaps });

      const client = new DriveRestClient();
      const granularSync = new DriveGranularSync();

      // Mock fileExists returning false for the deleted folder
      vi.spyOn(client, 'fileExists').mockResolvedValue(false);

      // Mock migration method
      const migrateSpy = vi.spyOn(granularSync, 'migrateProjectToGranularSubfolder').mockImplementation(
        async (_c, _tok, _pid, onProg) => {
          onProg?.({ status: 'syncing', message: 'Tạo thư mục mới...', progressPercent: 50 });
          return 'new_healed_subfolder_777';
        }
      );

      const progressMessages: string[] = [];
      const result = await granularSync.syncGranularProject(
        client,
        token,
        mockProj.id,
        mockProj.driveFolderId!,
        (p) => {
          if (p.message) progressMessages.push(p.message);
        }
      );

      expect(client.fileExists).toHaveBeenCalledWith(token, 'old_deleted_folder_999');
      expect(progressMessages).toContain('Thư mục Drive cũ không còn tồn tại. Đang tạo lại backup mới...');
      expect(migrateSpy).toHaveBeenCalledWith(client, token, mockProj.id, expect.any(Function));
      expect(result.success).toBe(true);
      expect(result.uploadedChapters).toBe(2);
      expect(result.downloadedChapters).toBe(0);
      expect(result.failedPullCount).toBe(0);
    });
  });

  describe('DriveGranularSync.importProjectFromSharedFolder Error Handling (T006 & T007)', () => {
    it('throws clear Vietnamese error when sharedFolderId is missing or trashed on Drive', async () => {
      const client = new DriveRestClient();
      const granularSync = new DriveGranularSync();

      vi.spyOn(client, 'fileExists').mockResolvedValue(false);

      await expect(
        granularSync.importProjectFromSharedFolder(client, token, 'deleted_shared_folder_555')
      ).rejects.toThrow(
        'Thư mục chia sẻ này không còn tồn tại trên Google Drive (có thể đã bị xoá). Vui lòng chọn lại một thư mục dự án còn tồn tại, hoặc đồng bộ lại (Push) để tạo backup mới.'
      );

      expect(client.fileExists).toHaveBeenCalledWith(token, 'deleted_shared_folder_555');
    });

    it('proceeds to look for project.json when sharedFolderId exists', async () => {
      const client = new DriveRestClient();
      const granularSync = new DriveGranularSync();

      vi.spyOn(client, 'fileExists').mockResolvedValue(true);

      // Mock search returning empty project.json
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ files: [] }),
      });

      await expect(
        granularSync.importProjectFromSharedFolder(client, token, 'valid_existing_folder_888')
      ).rejects.toThrow('Thư mục được chọn không chứa tệp project.json hợp lệ');
    });
  });

  describe('Multi-Project Batch Push Resilience (T010)', () => {
    it('successfully completes batch push when a granular project triggers self-healing', async () => {
      const projectA: StoryProject = {
        id: 'proj_healthy',
        title: 'Dự Án Khỏe',
        author: 'Tác Giả A',
        genre: 'Tiên Hiệp',
        tone: 'Hào hùng',
        description: 'Mô tả dự án khỏe',
        glossary: [],
        pendingGlossary: [],
        driveFolderId: 'healthy_folder_111',
        driveStorageFormat: 'granular',
        chapters: [{ id: 'c1', title: 'Chương 1', status: 'completed', createdAt: '', updatedAt: '' }],
        createdAt: '',
        updatedAt: '',
      };

      const projectB: StoryProject = {
        id: 'proj_deleted_folder',
        title: 'Dự Án Bị Xoá Folder',
        author: 'Tác Giả B',
        genre: 'Đô Thị',
        tone: 'Hài hước',
        description: 'Mô tả dự án bị xoá',
        glossary: [],
        pendingGlossary: [],
        driveFolderId: 'deleted_folder_222',
        driveStorageFormat: 'granular',
        chapters: [{ id: 'c2', title: 'Chương 1', status: 'completed', createdAt: '', updatedAt: '' }],
        createdAt: '',
        updatedAt: '',
      };

      const { __resetMockDb } = await import('../db') as any;
      __resetMockDb(
        { [projectA.id]: projectA, [projectB.id]: projectB },
        {
          [projectA.id]: [{ id: 'c1', projectId: projectA.id, title: 'Chương 1', sourceText: '', rawTranslation: '', polishedTranslation: '', paragraphs: [], translatedLines: [], status: 'completed', createdAt: '', updatedAt: '' }],
          [projectB.id]: [{ id: 'c2', projectId: projectB.id, title: 'Chương 1', sourceText: '', rawTranslation: '', polishedTranslation: '', paragraphs: [], translatedLines: [], status: 'completed', createdAt: '', updatedAt: '' }],
        }
      );

      const client = new DriveRestClient();
      vi.spyOn(client, 'ensureAppFolder').mockResolvedValue('root_app_folder');

      const projectSync = new DriveProjectSync();

      // Mock onSyncGranularProject representing granular sync handler
      const granularSyncHandler = vi.fn().mockImplementation(async (_tok, projId, _fId) => {
        if (projId === 'proj_deleted_folder') {
          // Self-heals and returns success
          return { success: true, uploadedChapters: 1 };
        }
        return { success: true, uploadedChapters: 1 };
      });

      const result = await projectSync.pushAllToDrive(
        client,
        token,
        undefined,
        granularSyncHandler
      );

      expect(result.success).toBe(true);
      expect(result.syncedProjects).toBe(2);
      expect(granularSyncHandler).toHaveBeenCalledWith(token, 'proj_deleted_folder', 'deleted_folder_222');
    });
  });
});

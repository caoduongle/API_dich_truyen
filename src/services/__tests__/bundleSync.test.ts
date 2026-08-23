import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DriveBundleSync } from '../google-drive/driveBundleSync';
import { StoryProject, Chapter } from '../../types';
import { ProjectBundle } from '../../types/googleDriveSync';

// Mock DB layer
vi.mock('../db', () => {
  let mockProjects: Record<string, StoryProject> = {};
  let mockChapters: Record<string, Chapter[]> = {};
  let mockCrdtStates: Record<string, any> = {};

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
    saveChaptersToDB: vi.fn(async (chaps: Chapter[]) => {
      for (const c of chaps) {
        const list = mockChapters[c.projectId || ''] || [];
        const idx = list.findIndex((x) => x.id === c.id);
        if (idx >= 0) list[idx] = { ...c };
        else list.push({ ...c });
        mockChapters[c.projectId || ''] = list;
      }
    }),
    getCrdtState: vi.fn(async (chapterId: string) => mockCrdtStates[chapterId] || null),
    saveCrdtState: vi.fn(async (rec: any) => {
      mockCrdtStates[rec.chapterId] = { ...rec };
    }),
    saveCrdtStates: vi.fn(async (recs: any[]) => {
      for (const r of recs) mockCrdtStates[r.chapterId] = { ...r };
    }),
    __resetMockDb: (projects: Record<string, StoryProject>, chapters: Record<string, Chapter[]>, crdt: Record<string, any> = {}) => {
      mockProjects = { ...projects };
      mockChapters = { ...chapters };
      mockCrdtStates = { ...crdt };
    },
  };
});

describe('DriveBundleSync Service', () => {
  let bundleSync: DriveBundleSync;
  let mockClient: any;

  const mockProject: StoryProject = {
    id: 'proj_bundle_1',
    title: 'Phàm Nhân Tu Tiên',
    author: 'Vong Ngữ',
    genre: 'Tiên Hiệp',
    tone: 'Điềm tĩnh',
    description: 'Truyện tiên hiệp kinh điển',
    glossary: [
      {
        id: 'glo_1',
        chinese: '韩立',
        pinyin: 'Han Li',
        vietnamese: 'Hàn Lập',
        type: 'character',
        note: 'Hàn Chạy Nhanh',
        createdAt: '2026-08-20T10:00:00Z',
      },
    ],
    pendingGlossary: [],
    chapters: [
      {
        id: 'chap_1',
        title: 'Chương 1: Sơn thôn thiếu niên',
        status: 'completed',
        createdAt: '2026-08-20T09:00:00Z',
        updatedAt: '2026-08-22T04:00:00Z',
      },
    ],
    createdAt: '2026-08-20T09:00:00Z',
    updatedAt: '2026-08-22T04:00:00Z',
  };

  const mockChapters: Chapter[] = [
    {
      id: 'chap_1',
      projectId: 'proj_bundle_1',
      title: 'Chương 1: Sơn thôn thiếu niên',
      sourceText: '第一章 山村少年',
      rawTranslation: 'Chương 1: Thiếu niên thôn núi',
      polishedTranslation: 'Hồi 1: Thiếu niên nơi sơn thôn',
      paragraphs: ['第一章 山村少年'],
      translatedLines: ['Hồi 1: Thiếu niên nơi sơn thôn'],
      status: 'completed',
      createdAt: '2026-08-20T09:00:00Z',
      updatedAt: '2026-08-22T04:00:00Z',
    },
  ];

  beforeEach(async () => {
    bundleSync = new DriveBundleSync();
    const dbModule: any = await import('../db');
    dbModule.__resetMockDb(
      { [mockProject.id]: mockProject },
      { [mockProject.id]: mockChapters }
    );

    mockClient = {
      ensureAppFolder: vi.fn(async () => 'app_folder_123'),
      uploadJsonFile: vi.fn(async () => 'bundle_file_drive_999'),
      downloadJsonFile: vi.fn(async () => ({
        bundleVersion: 1,
        exportedAt: '2026-08-23T10:00:00Z',
        project: { ...mockProject },
        chapters: mockChapters.map((c) => ({ ...c, crdtSnapshot: '' })),
      })),
    };
  });

  it('builds a valid ProjectBundle with chapter CRDT snapshots', async () => {
    const bundle = await bundleSync.buildProjectBundle('proj_bundle_1');

    expect(bundle.bundleVersion).toBe(1);
    expect(bundle.project.id).toBe('proj_bundle_1');
    expect(bundle.project.title).toBe('Phàm Nhân Tu Tiên');
    expect(bundle.chapters.length).toBe(1);
    expect(bundle.chapters[0].id).toBe('chap_1');
    expect(bundle.chapters[0].crdtSnapshot).toBeDefined();
    expect(typeof bundle.chapters[0].crdtSnapshot).toBe('string');
  });

  it('throws error when building bundle for non-existent project', async () => {
    await expect(bundleSync.buildProjectBundle('proj_non_existent')).rejects.toThrow(
      'Không tìm thấy dự án với ID: proj_non_existent'
    );
  });

  it('pushes project bundle to Google Drive root app folder and updates DB storage format', async () => {
    const progressUpdates: any[] = [];
    const res = await bundleSync.pushBundle(
      mockClient,
      'mock_token',
      'proj_bundle_1',
      (p) => progressUpdates.push(p)
    );

    expect(res.fileId).toBe('bundle_file_drive_999');
    expect(mockClient.ensureAppFolder).toHaveBeenCalledWith('mock_token');
    expect(mockClient.uploadJsonFile).toHaveBeenCalled();

    const { getProjectFromDB } = await import('../db');
    const updated = await getProjectFromDB('proj_bundle_1');
    expect(updated?.driveFileId).toBe('bundle_file_drive_999');
    expect(updated?.driveStorageFormat).toBe('bundle');
    expect(progressUpdates.some((p) => p.status === 'success')).toBe(true);
  });

  it('imports shared project from single bundle file without 404s', async () => {
    const remoteBundle: ProjectBundle = {
      bundleVersion: 1,
      exportedAt: '2026-08-23T12:00:00Z',
      project: {
        id: 'proj_shared_from_peer',
        title: 'Mục Thần Ký',
        author: 'Trạch Trư',
        genre: 'Huyền Huyễn',
        tone: 'Hào sảng',
        description: 'Đại Khư tàn lão thôn',
        glossary: [],
        pendingGlossary: [],
        chapters: [
          {
            id: 'chap_mtk_1',
            title: 'Chương 1: Tàn Lão Thôn',
            status: 'completed',
            createdAt: '2026-08-23T10:00:00Z',
            updatedAt: '2026-08-23T12:00:00Z',
          },
        ],
        createdAt: '2026-08-23T10:00:00Z',
      },
      chapters: [
        {
          id: 'chap_mtk_1',
          projectId: 'proj_shared_from_peer',
          title: 'Chương 1: Tàn Lão Thôn',
          sourceText: '第一章 残老村',
          rawTranslation: 'Chương 1: Tàn Lão thôn',
          polishedTranslation: 'Hồi 1: Làng Tàn Lão',
          paragraphs: ['第一章 残老村'],
          translatedLines: ['Hồi 1: Làng Tàn Lão'],
          status: 'completed',
          createdAt: '2026-08-23T10:00:00Z',
          updatedAt: '2026-08-23T12:00:00Z',
        },
      ],
    };

    mockClient.downloadJsonFile = vi.fn(async () => remoteBundle);

    const imported = await bundleSync.importBundle(mockClient, 'mock_token', 'drive_file_mtk_123');

    expect(imported.id).toBe('proj_shared_from_peer');
    expect(imported.title).toBe('Mục Thần Ký');
    expect(imported.isOwner).toBe(false);
    expect(imported.isShared).toBe(true);
    expect(imported.driveStorageFormat).toBe('bundle');
    expect(imported.driveFileId).toBe('drive_file_mtk_123');

    const { getChaptersByProjectFromDB } = await import('../db');
    const chaps = await getChaptersByProjectFromDB('proj_shared_from_peer');
    expect(chaps.length).toBe(1);
    expect(chaps[0].title).toBe('Chương 1: Tàn Lão Thôn');
  });

  it('pulls remote bundle and safely updates local chapters', async () => {
    const pullRes = await bundleSync.pullBundle(
      mockClient,
      'mock_token',
      'proj_bundle_1',
      'bundle_file_drive_999'
    );

    expect(pullRes.success).toBe(true);
    expect(pullRes.mergedChaptersCount).toBe(1);
    expect(pullRes.newChaptersCount).toBe(0);
  });
});

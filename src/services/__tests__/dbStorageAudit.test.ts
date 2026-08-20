import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { verifyStorageIntegrity } from '../../utils/storageAudit';
import { StoryProject, Chapter } from '../../types';

describe('User Story 2: Authoritative Project & Content Storage in IndexedDB (TASK 13)', () => {
  let mockLocalStorageData: Record<string, string> = {};
  let mockProjectsStore: Map<string, any> = new Map();
  let mockChaptersStore: Map<string, any> = new Map();

  const storageMock: Storage = {
    getItem: (key: string) => mockLocalStorageData[key] ?? null,
    setItem: (key: string, value: string) => {
      mockLocalStorageData[key] = String(value);
    },
    removeItem: (key: string) => {
      delete mockLocalStorageData[key];
    },
    clear: () => {
      mockLocalStorageData = {};
    },
    key: (index: number) => Object.keys(mockLocalStorageData)[index] || null,
    get length() {
      return Object.keys(mockLocalStorageData).length;
    },
  };

  beforeEach(() => {
    mockLocalStorageData = {};
    mockProjectsStore.clear();
    mockChaptersStore.clear();
    vi.stubGlobal('localStorage', storageMock);

    // Mock IDB transaction implementation
    const mockDB: any = {
      transaction: (storeNames: string | string[], mode: string) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx: any = {
          oncomplete: null,
          onerror: null,
          objectStore: (name: string) => {
            const storeMap = name === 'projects' ? mockProjectsStore : mockChaptersStore;
            return {
              get: (id: string) => {
                const req: any = { result: storeMap.get(id), onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
              getAll: () => {
                const req: any = { result: Array.from(storeMap.values()), onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
              put: (item: any) => {
                storeMap.set(item.id, item);
                const req: any = { result: item.id, onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
              delete: (id: string) => {
                storeMap.delete(id);
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
              indexNames: {
                contains: (idxName: string) => idxName === 'projectId',
              },
              index: (idxName: string) => ({
                openKeyCursor: (range: any) => {
                  const targetProjectId = range?.only || range;
                  const matchingKeys = Array.from(mockChaptersStore.entries())
                    .filter(([_, chap]) => chap.projectId === targetProjectId)
                    .map(([key]) => key);
                  let cursorIdx = 0;
                  const req: any = { onsuccess: null, onerror: null };
                  setTimeout(() => {
                    const makeCursor = () => {
                      if (cursorIdx >= matchingKeys.length) {
                        req.result = null;
                        req.onsuccess?.({ target: req });
                        return;
                      }
                      const primaryKey = matchingKeys[cursorIdx];
                      req.result = {
                        primaryKey,
                        continue: () => {
                          cursorIdx++;
                          makeCursor();
                        },
                      };
                      req.onsuccess?.({ target: req });
                    };
                    makeCursor();
                  }, 0);
                  return req;
                },
              }),
            };
          },
        };
        setTimeout(() => tx.oncomplete?.(), 5);
        return tx;
      },
    };

    vi.stubGlobal('IDBKeyRange', {
      only: (val: any) => ({ only: val }),
    });

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: any = { result: mockDB, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('normalizes chapters and stores full manuscripts in chapters store, never in localStorage', async () => {
    const { saveProjectToDB, getProjectsFromDB, getChapterFromDB } = await import('../db');

    const fullChapter: Chapter = {
      id: 'chap_101',
      projectId: 'proj_novel_1',
      title: 'Chương 1: Đấu Khí Đại Lục',
      sourceText: '这里是属于斗气的世界，没有花俏艳丽的魔法...',
      rawTranslation: 'Nơi này là thế giới thuộc về Đấu Khí...',
      polishedTranslation: 'Đây là thế giới của đấu khí...',
      paragraphs: ['这里是属于斗气的世界，没有花俏艳丽的魔法...'],
      translatedLines: ['Đây là thế giới của đấu khí...'],
      status: 'completed',
      createdAt: '2026-08-20T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
    };

    const project: StoryProject = {
      id: 'proj_novel_1',
      title: 'Đấu Phá Thương Khung',
      author: 'Thiên Tằm Thổ Đậu',
      genre: 'xianxia',
      tone: 'truyện chữ cổ điển',
      description: 'Hành trình của Tiêu Viêm',
      glossary: [
        {
          id: 'glo_1',
          chinese: '斗气',
          pinyin: 'dòuqì',
          vietnamese: 'Đấu Khí',
          type: 'term',
          note: 'Thuật ngữ chính',
        },
      ],
      pendingGlossary: [],
      chapters: [fullChapter],
      createdAt: '2026-08-20T00:00:00Z',
    };

    // Save project
    await saveProjectToDB(project);

    // 1. Verify IndexedDB contents
    const loadedProjects = await getProjectsFromDB();
    expect(loadedProjects).toHaveLength(1);
    expect(loadedProjects[0].id).toBe('proj_novel_1');
    expect(loadedProjects[0].title).toBe('Đấu Phá Thương Khung');
    // Chapter in project summary should only contain metadata
    expect((loadedProjects[0].chapters[0] as any).sourceText).toBeUndefined();

    // Full chapter is retrieved from chapters store
    const loadedChapter = await getChapterFromDB('chap_101');
    expect(loadedChapter).toBeDefined();
    expect(loadedChapter?.sourceText).toContain('这里是属于斗气的世界');
    expect(loadedChapter?.polishedTranslation).toContain('Đây là thế giới của đấu khí');

    // 2. Verify zero leakage in localStorage
    const report = verifyStorageIntegrity(storageMock);
    expect(report.isValid).toBe(true);
    expect(report.forbiddenKeysFound).toHaveLength(0);
    expect(storageMock.getItem('projects')).toBeNull();
    expect(storageMock.getItem('chapters')).toBeNull();
  });

  it('cascades deletion of all chapter texts when deleting a project from IndexedDB', async () => {
    const { saveProjectToDB, getProjectsFromDB, getChapterFromDB, deleteProjectFromDB } = await import('../db');

    const project: StoryProject = {
      id: 'proj_to_delete',
      title: 'Truyện Sắp Xóa',
      author: 'Tác Giả A',
      genre: 'wuxia',
      tone: 'kiếm hiệp',
      description: '',
      glossary: [],
      pendingGlossary: [],
      chapters: [
        {
          id: 'chap_del_1',
          projectId: 'proj_to_delete',
          title: 'Chương 1',
          sourceText: 'Nội dung chương 1...',
          rawTranslation: '',
          polishedTranslation: '',
          paragraphs: ['Nội dung chương 1...'],
          translatedLines: [],
          status: 'completed',
          createdAt: '2026-08-20T00:00:00Z',
          updatedAt: '2026-08-20T00:00:00Z',
        },
        {
          id: 'chap_del_2',
          projectId: 'proj_to_delete',
          title: 'Chương 2',
          sourceText: 'Nội dung chương 2...',
          rawTranslation: '',
          polishedTranslation: '',
          paragraphs: ['Nội dung chương 2...'],
          translatedLines: [],
          status: 'completed',
          createdAt: '2026-08-20T00:00:00Z',
          updatedAt: '2026-08-20T00:00:00Z',
        },
      ] as any,
      createdAt: '2026-08-20T00:00:00Z',
    };

    await saveProjectToDB(project);
    expect(await getChapterFromDB('chap_del_1')).toBeDefined();
    expect(await getChapterFromDB('chap_del_2')).toBeDefined();

    // Delete project
    await deleteProjectFromDB('proj_to_delete');

    const projectsAfter = await getProjectsFromDB();
    expect(projectsAfter.find((p) => p.id === 'proj_to_delete')).toBeUndefined();
    expect(await getChapterFromDB('chap_del_1')).toBeNull();
    expect(await getChapterFromDB('chap_del_2')).toBeNull();
  });
});

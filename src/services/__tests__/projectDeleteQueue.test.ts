import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveProjectToDB,
  deleteProjectFromDB,
  deleteProjectCrdtDatabases,
  deleteChapterFromDB,
  deleteChaptersByProjectFromDB,
  getCrdtState,
  saveChapterToDB,
  saveChaptersToDB,
  saveCrdtState,
  saveCrdtStates,
  atomicSaveProjectBundle,
  resetProjectWriteChainsForTest,
  getProjectWriteChainsSizeForTest,
  resetDBInstanceForTesting,
  CrdtStateRecord,
  recordDeletionManifest,
  getPendingDeletionManifests,
  recoverPendingDeletions,
  initDB,
  DeletionManifestRecord,
} from '../db';
import {
  registerCrdtPersistence,
  destroyCrdtPersistence,
  destroyAllCrdtPersistencesForProject,
  getActivePersistenceCountForTest,
  clearActivePersistencesForTest,
} from '../crdtPersistenceRegistry';
import {
  enqueueProjectSave,
  enqueueProjectDelete,
  waitForQueueIdle,
  resetProjectWriteQueueForTest,
} from '../projectStorageQueue';
import {
  Chapter,
  ChapterMetadata,
  StoryProject,
} from '../../types';

describe('Project Delete Queue Serialization & Resurrection Guard (User Story 1)', () => {
  const mockProjects = new Map<string, any>();
  const mockChapters = new Map<string, any>();
  const mockCrdtStates = new Map<string, any>();
  const mockManifests = new Map<string, any>();
  const executionOrder: string[] = [];
  const deletedDatabases: string[] = [];
  const knownDatabases = new Set<string>();

  beforeEach(() => {
    mockProjects.clear();
    mockChapters.clear();
    mockCrdtStates.clear();
    mockManifests.clear();
    executionOrder.length = 0;
    resetDBInstanceForTesting();
    resetProjectWriteChainsForTest();
    resetProjectWriteQueueForTest();

    const mockDB: any = {
      objectStoreNames: {
        contains: (name: string) => ['projects', 'chapters', 'crdt_states', 'deletion_manifests'].includes(name),
      },
      transaction: (_storeNames: string | string[], _mode: string) => {
        let activeRequests = 0;
        let isCommitted = false;
        const tx: any = {
          oncomplete: null,
          onerror: null,
          onabort: null,
        };

        const tryComplete = () => {
          if (activeRequests === 0 && !isCommitted) {
            isCommitted = true;
            queueMicrotask(() => tx.oncomplete?.());
          }
        };

        const schedule = (cb: () => void) => {
          activeRequests++;
          queueMicrotask(() => {
            cb();
            activeRequests--;
            tryComplete();
          });
        };

        // Fallback for transactions where no operations are immediately queued
        setTimeout(() => tryComplete(), 50);

        tx.objectStore = (name: string) => {
          if (name === 'projects') {
            return {
              get: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  req.result = mockProjects.get(id);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              put: (item: any) => {
                const req: any = { result: item.id, onsuccess: null, onerror: null };
                schedule(() => {
                  mockProjects.set(item.id, item);
                  executionOrder.push(`save_project_${item.id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              delete: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  mockProjects.delete(id);
                  executionOrder.push(`delete_project_${id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
            };
          }
          if (name === 'chapters') {
            return {
              indexNames: { contains: () => false },
              get: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  const item = mockChapters.get(id);
                  req.result = item ? JSON.parse(JSON.stringify(item)) : undefined;
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              openCursor: () => {
                const entries = Array.from(mockChapters.values());
                let idx = 0;
                const cursorReq: any = { result: null, onsuccess: null, onerror: null };
                const advance = () => {
                  schedule(() => {
                    if (idx < entries.length) {
                      const currentVal = entries[idx++];
                      cursorReq.result = {
                        value: currentVal,
                        primaryKey: currentVal.id,
                        delete: () => {
                          mockChapters.delete(currentVal.id);
                          executionOrder.push(`delete_chapter_${currentVal.id}`);
                        },
                        continue: () => {
                          advance();
                        },
                      };
                    } else {
                      cursorReq.result = null;
                    }
                    cursorReq.onsuccess?.({ target: cursorReq });
                  });
                };
                advance();
                return cursorReq;
              },
              put: (item: any) => {
                const req: any = { result: item.id, onsuccess: null, onerror: null };
                schedule(() => {
                  mockChapters.set(item.id, item);
                  executionOrder.push(`save_chapter_${item.id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              delete: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  mockChapters.delete(id);
                  executionOrder.push(`delete_chapter_${id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
            };
          }
          if (name === 'crdt_states') {
            return {
              indexNames: { contains: () => false },
              get: (id: string) => {
                const req: any = { result: null, onsuccess: null, onerror: null };
                schedule(() => {
                  const item = mockCrdtStates.get(id);
                  req.result = item ? JSON.parse(JSON.stringify(item)) : null;
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              openCursor: () => {
                const entries = Array.from(mockCrdtStates.values());
                let idx = 0;
                const cursorReq: any = { result: null, onsuccess: null, onerror: null };
                const advance = () => {
                  schedule(() => {
                    if (idx < entries.length) {
                      const currentVal = entries[idx++];
                      cursorReq.result = {
                        value: currentVal,
                        primaryKey: currentVal.chapterId,
                        delete: () => {
                          mockCrdtStates.delete(currentVal.chapterId);
                          executionOrder.push(`delete_crdt_${currentVal.chapterId}`);
                        },
                        continue: () => {
                          advance();
                        },
                      };
                    } else {
                      cursorReq.result = null;
                    }
                    cursorReq.onsuccess?.({ target: cursorReq });
                  });
                };
                advance();
                return cursorReq;
              },
              put: (item: any) => {
                const req: any = { result: item.chapterId, onsuccess: null, onerror: null };
                schedule(() => {
                  mockCrdtStates.set(item.chapterId, item);
                  executionOrder.push(`save_crdt_${item.chapterId}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              delete: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  mockCrdtStates.delete(id);
                  executionOrder.push(`delete_crdt_${id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
            };
          }
          if (name === 'deletion_manifests') {
            return {
              indexNames: { contains: (idx: string) => idx === 'status' || idx === 'projectId' },
              index: (_idx: string) => ({
                getAll: (query?: any) => {
                  const req: any = { result: [], onsuccess: null, onerror: null };
                  schedule(() => {
                    const list = Array.from(mockManifests.values()).filter(
                      (m) => query === undefined || m.status === query
                    );
                    req.result = list;
                    req.onsuccess?.({ target: req });
                  });
                  return req;
                },
              }),
              get: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  req.result = mockManifests.get(id);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              getAll: () => {
                const req: any = { result: [], onsuccess: null, onerror: null };
                schedule(() => {
                  req.result = Array.from(mockManifests.values());
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              put: (item: any) => {
                const req: any = { result: item.id, onsuccess: null, onerror: null };
                schedule(() => {
                  mockManifests.set(item.id, item);
                  executionOrder.push(`save_manifest_${item.id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
              delete: (id: string) => {
                const req: any = { result: undefined, onsuccess: null, onerror: null };
                schedule(() => {
                  mockManifests.delete(id);
                  executionOrder.push(`delete_manifest_${id}`);
                  req.onsuccess?.({ target: req });
                });
                return req;
              },
            };
          }
          return {
            indexNames: { contains: () => false },
            openKeyCursor: () => {
              const req: any = { result: null, onsuccess: null, onerror: null };
              schedule(() => {
                req.onsuccess?.({ target: req });
              });
              return req;
            },
            delete: () => {},
          };
        };
        return tx;
      },
    };

    deletedDatabases.length = 0;
    knownDatabases.clear();

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: any = { result: mockDB, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      },
      deleteDatabase: vi.fn().mockImplementation((name: string) => {
        deletedDatabases.push(name);
        knownDatabases.delete(name);
        const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      }),
      databases: vi.fn().mockImplementation(async () => {
        return Array.from(knownDatabases).map((name) => ({ name }));
      }),
    });
  });

  afterEach(() => {
    resetDBInstanceForTesting();
    resetProjectWriteChainsForTest();
    resetProjectWriteQueueForTest();
    deletedDatabases.length = 0;
    knownDatabases.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const createDummyProject = (id: string, title: string): StoryProject => ({
    id,
    title,
    author: 'Author',
    genre: 'Tiên Hiệp',
    tone: 'Cổ phong',
    description: 'Description',
    chapters: [],
    glossary: [],
    pendingGlossary: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('guarantees deleteProjectFromDB executes strictly after in-flight save on the same project (no resurrection)', async () => {
    const project = createDummyProject('p_race_1', 'Race Test Project');

    // Simulate in-flight save immediately followed by delete
    const savePromise = saveProjectToDB(project);
    const deletePromise = deleteProjectFromDB(project.id);

    await Promise.all([savePromise, deletePromise]);

    // Check execution order: save MUST precede delete
    const projectOps = executionOrder.filter(
      (op) => op.startsWith('save_project_') || op.startsWith('delete_project_')
    );
    expect(projectOps).toEqual(['save_project_p_race_1', 'delete_project_p_race_1']);

    // Check persistent state: project must NOT be resurrected
    expect(mockProjects.has('p_race_1')).toBe(false);
  });

  it('cleans up projectWriteChains entry after operation settles to prevent memory leak', async () => {
    const project = createDummyProject('p_leak_1', 'Memory Leak Test');

    const savePromise = saveProjectToDB(project);
    // While in-flight, map holds an active chain
    expect(getProjectWriteChainsSizeForTest()).toBe(1);

    await savePromise;

    // After settling, map entry must be cleaned up
    expect(getProjectWriteChainsSizeForTest()).toBe(0);

    // After delete settles, map entry must also be cleaned up
    await deleteProjectFromDB(project.id);
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  it('coordinates enqueueProjectSave and enqueueProjectDelete through projectStorageQueue', async () => {
    const project = createDummyProject('p_queue_1', 'Queue Test');

    const saveP = enqueueProjectSave(project);
    const deleteP = enqueueProjectDelete(project.id);

    await waitForQueueIdle('p_queue_1');
    await Promise.all([saveP, deleteP]);

    const projectOps = executionOrder.filter(
      (op) => op.startsWith('save_project_') || op.startsWith('delete_project_')
    );
    expect(projectOps).toEqual(['save_project_p_queue_1', 'delete_project_p_queue_1']);
    expect(mockProjects.has('p_queue_1')).toBe(false);
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  const createDummyChapter = (id: string, projectId: string, title: string = 'Chương 1'): Chapter => ({
    id,
    projectId,
    title,
    sourceText: '原文',
    rawTranslation: 'Thô',
    polishedTranslation: 'Mượt',
    paragraphs: ['原文'],
    translatedLines: ['Mượt'],
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    qaIssues: [],
  });

  it('guarantees saveChapterToDB executes before concurrent deleteProjectFromDB and leaves 0 orphan chapters', async () => {
    const project = createDummyProject('p_chap_race_1', 'Concurrent Chapter Race');
    await saveProjectToDB(project);
    expect(mockProjects.has('p_chap_race_1')).toBe(true);

    const chapter = createDummyChapter('chap_race_1', 'p_chap_race_1', 'Chương 1');

    // Concurrent saveChapterToDB immediately followed by deleteProjectFromDB
    const chapterPromise = saveChapterToDB(chapter);
    const deletePromise = deleteProjectFromDB(project.id);

    await Promise.all([chapterPromise, deletePromise]);

    // Check execution order: chapter save MUST precede project delete
    expect(executionOrder).toContain('save_chapter_chap_race_1');
    expect(executionOrder).toContain('delete_project_p_chap_race_1');
    const saveIdx = executionOrder.indexOf('save_chapter_chap_race_1');
    const deleteIdx = executionOrder.indexOf('delete_project_p_chap_race_1');
    expect(saveIdx).toBeLessThan(deleteIdx);

    // After delete completes, 0 chapters and 0 project records should remain
    expect(mockProjects.has('p_chap_race_1')).toBe(false);
    expect(mockChapters.has('chap_race_1')).toBe(false);
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  it('aborts saveChapterToDB cleanly when parent project has been deleted (orphan resurrection guard)', async () => {
    const project = createDummyProject('p_tombstone_1', 'Tombstone Project');
    await saveProjectToDB(project);

    // Xóa dự án trước
    await deleteProjectFromDB(project.id);
    expect(mockProjects.has('p_tombstone_1')).toBe(false);

    // Bây giờ cố gắng lưu chương sau khi dự án cha đã bị xóa
    const orphanChapter = createDummyChapter('chap_orphan_1', 'p_tombstone_1', 'Chương mồ côi');
    await saveChapterToDB(orphanChapter);

    // Chương mồ côi KHÔNG được lưu vào IndexedDB
    expect(mockChapters.has('chap_orphan_1')).toBe(false);
    expect(executionOrder).not.toContain('save_chapter_chap_orphan_1');
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  it('serializes batch saveChaptersToDB and deleteProjectFromDB leaving 0 orphan chapters', async () => {
    const project = createDummyProject('p_batch_race_1', 'Batch Race Project');
    await saveProjectToDB(project);

    const c1 = createDummyChapter('chap_b1', 'p_batch_race_1', 'Chương 1');
    const c2 = createDummyChapter('chap_b2', 'p_batch_race_1', 'Chương 2');

    const batchPromise = saveChaptersToDB([c1, c2]);
    const deletePromise = deleteProjectFromDB(project.id);

    await Promise.all([batchPromise, deletePromise]);

    // Dự án và toàn bộ chương của nó phải được xóa sạch hoàn toàn
    expect(mockProjects.has('p_batch_race_1')).toBe(false);
    expect(mockChapters.has('chap_b1')).toBe(false);
    expect(mockChapters.has('chap_b2')).toBe(false);
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  it('aborts saveCrdtState and saveCrdtStates when parent project has been deleted', async () => {
    const project = createDummyProject('p_crdt_del_1', 'CRDT Guard Project');
    await saveProjectToDB(project);
    await deleteProjectFromDB(project.id);

    // 1. Thử lưu đơn lẻ CRDT cho project đã xóa
    const singleCrdt: CrdtStateRecord = {
      chapterId: 'chap_crdt_1',
      projectId: 'p_crdt_del_1',
      state: new Uint8Array([1, 2, 3]),
      updatedAt: new Date().toISOString(),
    };
    await saveCrdtState(singleCrdt);
    expect(mockCrdtStates.has('chap_crdt_1')).toBe(false);

    // 2. Thử lưu hàng loạt CRDT cho project đã xóa
    const batchCrdt: CrdtStateRecord[] = [
      {
        chapterId: 'chap_crdt_2',
        projectId: 'p_crdt_del_1',
        state: new Uint8Array([4, 5, 6]),
        updatedAt: new Date().toISOString(),
      },
    ];
    await saveCrdtStates(batchCrdt);
    expect(mockCrdtStates.has('chap_crdt_2')).toBe(false);
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  it('cleans up projectWriteChains entry after saveChapterToDB settles', async () => {
    const project = createDummyProject('p_leak_chap', 'Chapter Leak Test');
    await saveProjectToDB(project);
    expect(getProjectWriteChainsSizeForTest()).toBe(0);

    const chapter = createDummyChapter('chap_leak_1', 'p_leak_chap');
    const savePromise = saveChapterToDB(chapter);
    expect(getProjectWriteChainsSizeForTest()).toBe(1);

    await savePromise;
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  it('resolves missing chapter.projectId from existing record in IndexedDB and serializes under parent project', async () => {
    const project = createDummyProject('p_resolve_1', 'Resolve Project');
    await saveProjectToDB(project);

    // Lưu chương ban đầu có projectId
    const initialChapter = createDummyChapter('chap_resolve_1', 'p_resolve_1');
    await saveChapterToDB(initialChapter);
    expect(mockChapters.get('chap_resolve_1')?.projectId).toBe('p_resolve_1');

    // Lưu cập nhật chương nhưng thiếu thuộc tính projectId
    const partialChapter: any = {
      id: 'chap_resolve_1',
      title: 'Chương 1: Đã cập nhật tiêu đề',
      sourceText: '原文 mới',
      rawTranslation: 'Thô mới',
      polishedTranslation: 'Mượt mới',
      paragraphs: ['原文 mới'],
      translatedLines: ['Mượt mới'],
      status: 'completed',
      createdAt: initialChapter.createdAt,
      updatedAt: new Date().toISOString(),
      qaIssues: [],
    };

    await saveChapterToDB(partialChapter);
    expect(mockChapters.get('chap_resolve_1')?.title).toBe('Chương 1: Đã cập nhật tiêu đề');
    expect(getProjectWriteChainsSizeForTest()).toBe(0);
  });

  describe('User Story 1: CRDT Database Eradication on Project Deletion', () => {
    it('deletes all chapter-specific crdt_${projectId}_${chapterId} databases for all chapters in the project', async () => {
      const project = createDummyProject('p_crdt_del_all', 'CRDT Del Test');
      await saveProjectToDB(project);

      const c1 = createDummyChapter('c1', 'p_crdt_del_all');
      const c2 = createDummyChapter('c2', 'p_crdt_del_all');
      await saveChaptersToDB([c1, c2]);

      // Simulate existing y-indexeddb databases for these chapters
      knownDatabases.add('crdt_p_crdt_del_all_c1');
      knownDatabases.add('crdt_p_crdt_del_all_c2');

      await deleteProjectFromDB('p_crdt_del_all');

      expect(deletedDatabases).toContain('crdt_p_crdt_del_all_c1');
      expect(deletedDatabases).toContain('crdt_p_crdt_del_all_c2');
    });

    it('purges dedicated CRDT databases derived from project.chapters even if detached from chapters store (US4)', async () => {
      const project = createDummyProject('p_meta_chapters', 'Meta Chapters Proj');
      project.chapters = [
        { id: 'c_meta_1', title: 'Chapter Meta 1', createdAt: new Date().toISOString() } as any,
      ];
      await saveProjectToDB(project);

      knownDatabases.add('crdt_p_meta_chapters_c_meta_1');

      await deleteProjectFromDB('p_meta_chapters');

      expect(deletedDatabases).toContain('crdt_p_meta_chapters_c_meta_1');
    });

    it('purges chapters, crdt_states, and dedicated CRDT databases in deleteChaptersByProjectFromDB (US4)', async () => {
      const project = createDummyProject('p_bulk_chap_del', 'Bulk Chap Del Proj');
      await saveProjectToDB(project);

      const c1 = createDummyChapter('c_bulk_1', 'p_bulk_chap_del');
      const c2 = createDummyChapter('c_bulk_2', 'p_bulk_chap_del');
      await saveChaptersToDB([c1, c2]);

      await saveCrdtState({
        chapterId: 'c_bulk_1',
        projectId: 'p_bulk_chap_del',
        state: new Uint8Array([1, 2, 3]),
        updatedAt: new Date().toISOString(),
      });
      await saveCrdtState({
        chapterId: 'c_bulk_2',
        projectId: 'p_bulk_chap_del',
        state: new Uint8Array([4, 5, 6]),
        updatedAt: new Date().toISOString(),
      });

      knownDatabases.add('crdt_p_bulk_chap_del_c_bulk_1');
      knownDatabases.add('crdt_p_bulk_chap_del_c_bulk_2');

      await deleteChaptersByProjectFromDB('p_bulk_chap_del');

      // Chapters store is cleared for this project
      expect(mockChapters.has('c_bulk_1')).toBe(false);
      expect(mockChapters.has('c_bulk_2')).toBe(false);

      // CRDT states store is cleared for this project
      expect(mockCrdtStates.has('c_bulk_1')).toBe(false);
      expect(mockCrdtStates.has('c_bulk_2')).toBe(false);

      // Dedicated CRDT databases are purged
      expect(deletedDatabases).toContain('crdt_p_bulk_chap_del_c_bulk_1');
      expect(deletedDatabases).toContain('crdt_p_bulk_chap_del_c_bulk_2');
    });

    it('purges CRDT databases derived strictly from known project chapters without prefix collision with sibling projects (US2)', async () => {
      // Project A: proj_100
      const projectA = createDummyProject('proj_100', 'Project 100');
      await saveProjectToDB(projectA);
      const cA1 = createDummyChapter('c_100_1', 'proj_100');
      await saveChapterToDB(cA1);

      // Project B: proj_100_200 (starts with proj_100_)
      const projectB = createDummyProject('proj_100_200', 'Project 100_200');
      await saveProjectToDB(projectB);
      const cB1 = createDummyChapter('c_200_1', 'proj_100_200');
      await saveChapterToDB(cB1);

      knownDatabases.add('crdt_proj_100_c_100_1');
      knownDatabases.add('crdt_proj_100_200_c_200_1');

      // Delete only Project A
      await deleteProjectFromDB('proj_100');

      expect(deletedDatabases).toContain('crdt_proj_100_c_100_1');
      // Sibling project sharing prefix MUST NOT be deleted!
      expect(deletedDatabases).not.toContain('crdt_proj_100_200_c_200_1');
      expect(knownDatabases.has('crdt_proj_100_200_c_200_1')).toBe(true);
    });

    it('destroys active in-memory persistence providers before deleting databases (US1)', async () => {
      let providerDestroyed = false;
      registerCrdtPersistence('crdt_p_persist_c1', {
        destroy: vi.fn().mockImplementation(() => {
          providerDestroyed = true;
        }),
      });

      expect(getActivePersistenceCountForTest()).toBe(1);

      await deleteProjectCrdtDatabases('p_persist', ['c1']);

      expect(providerDestroyed).toBe(true);
      expect(getActivePersistenceCountForTest()).toBe(0);
      expect(deletedDatabases).toContain('crdt_p_persist_c1');
    });

    it('handles onblocked by waiting for onsuccess instead of resolving immediately (US1)', async () => {
      let onblockedFired = false;
      let resolved = false;

      (indexedDB.deleteDatabase as any).mockImplementationOnce((name: string) => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null };
        queueMicrotask(() => {
          onblockedFired = true;
          req.onblocked?.({ target: req });
          setTimeout(() => {
            deletedDatabases.push(name);
            req.onsuccess?.({ target: req });
          }, 30);
        });
        return req;
      });

      const promise = deleteProjectCrdtDatabases('p_blocked_test', ['chap_blocked']).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      while (!onblockedFired) {
        await new Promise((r) => setTimeout(r, 5));
      }
      expect(onblockedFired).toBe(true);
      expect(resolved).toBe(false); // MUST NOT resolve on onblocked!

      await promise;
      expect(resolved).toBe(true);
      expect(deletedDatabases).toContain('crdt_p_blocked_test_chap_blocked');
    });

    it('rejects when deleteDatabase errors out (US1)', async () => {
      (indexedDB.deleteDatabase as any).mockImplementationOnce((_name: string) => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null, error: new Error('IDB delete error') };
        setTimeout(() => {
          req.onerror?.({ target: req });
        }, 10);
        return req;
      });

      await expect(
        deleteProjectCrdtDatabases('p_error_test', ['chap_err'])
      ).rejects.toThrow('IDB delete error');
    });

    it('propagates rejection when deleteProjectFromDB encounters CRDT database error (US1)', async () => {
      const p = createDummyProject('p_proj_crdt_err', 'Error Proj');
      await saveProjectToDB(p);
      const c = createDummyChapter('chap_proj_err', 'p_proj_crdt_err');
      await saveChapterToDB(c);

      (indexedDB.deleteDatabase as any).mockImplementation((_name: string) => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null, error: new Error('CRDT Project Delete Error') };
        setTimeout(() => {
          req.onerror?.({ target: req });
        }, 10);
        return req;
      });

      await expect(
        deleteProjectFromDB('p_proj_crdt_err')
      ).rejects.toThrow('CRDT Project Delete Error');
    });

    it('propagates rejection when deleteChapterFromDB encounters CRDT database error (US1)', async () => {
      const p = createDummyProject('p_chap_crdt_err', 'Error Proj');
      await saveProjectToDB(p);
      const c = createDummyChapter('chap_del_err', 'p_chap_crdt_err');
      await saveChapterToDB(c);

      (indexedDB.deleteDatabase as any).mockImplementation((_name: string) => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null, error: new Error('CRDT Chapter Delete Error') };
        setTimeout(() => {
          req.onerror?.({ target: req });
        }, 10);
        return req;
      });

      await expect(
        deleteChapterFromDB('chap_del_err', 'p_chap_crdt_err')
      ).rejects.toThrow('CRDT Chapter Delete Error');
    });

    it('deleteProjectCrdtDatabases works gracefully without indexedDB.databases()', async () => {
      // Temporarily remove databases function to simulate Firefox or environments without it
      const originalDatabases = (indexedDB as any).databases;
      delete (indexedDB as any).databases;

      try {
        await deleteProjectCrdtDatabases('p_firefox', ['chap_1', 'chap_2']);
        expect(deletedDatabases).toContain('crdt_p_firefox_chap_1');
        expect(deletedDatabases).toContain('crdt_p_firefox_chap_2');
      } finally {
        (indexedDB as any).databases = originalDatabases;
      }
    });
  });

  describe('Feature 146 User Story 1: Durable Deletion Manifest & Startup Recovery (T006, T007)', () => {
    it('recovers pending deletion manifests, deletes physical databases, and removes completed manifests on recoverPendingDeletions (T006)', async () => {
      const manifest: DeletionManifestRecord = {
        id: 'manifest_pending_test_1',
        projectId: 'p_recover_proj',
        chapterIds: ['chap_rec_1', 'chap_rec_2'],
        physicalDbNames: ['crdt_p_recover_proj_chap_rec_1', 'crdt_p_recover_proj_chap_rec_2'],
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await recordDeletionManifest(manifest);
      expect(mockManifests.size).toBe(1);

      const result = await recoverPendingDeletions();
      expect(result.recoveredCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(deletedDatabases).toContain('crdt_p_recover_proj_chap_rec_1');
      expect(deletedDatabases).toContain('crdt_p_recover_proj_chap_rec_2');
      expect(mockManifests.size).toBe(0);
    });

    it('retains manifest if physical database deletion fails during recovery (T006)', async () => {
      (indexedDB.deleteDatabase as any).mockImplementation((_name: string) => {
        const req: any = {
          result: undefined,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          error: new Error('Simulated physical DB delete failure during recovery'),
        };
        setTimeout(() => req.onerror?.({ target: req }), 10);
        return req;
      });

      const manifest: DeletionManifestRecord = {
        id: 'manifest_fail_test',
        projectId: 'p_fail_proj',
        chapterIds: ['chap_fail_1'],
        physicalDbNames: ['crdt_p_fail_proj_chap_fail_1'],
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await recordDeletionManifest(manifest);
      expect(mockManifests.size).toBe(1);

      const result = await recoverPendingDeletions();
      expect(result.recoveredCount).toBe(0);
      expect(result.failedCount).toBe(1);
      // Manifest MUST NOT be removed if physical deletion failed
      expect(mockManifests.has('manifest_fail_test')).toBe(true);
    });

    it('records deletion manifest atomically with catalog commit and removes it on successful deletion (T007)', async () => {
      const p = createDummyProject('p_manifest_order_test', 'Order Test Project');
      p.chapters = [{ id: 'chap_mf_1', title: 'Chapter 1' } as any];
      await saveProjectToDB(p);
      const c = createDummyChapter('chap_mf_1', 'p_manifest_order_test');
      await saveChapterToDB(c);

      executionOrder.length = 0;
      await deleteProjectFromDB('p_manifest_order_test');

      const manifestSaveIdx = executionOrder.findIndex((op) => op.startsWith('save_manifest_'));
      const projectDeleteIdx = executionOrder.findIndex((op) => op === 'delete_project_p_manifest_order_test');
      const manifestDeleteIdx = executionOrder.findIndex((op) => op.startsWith('delete_manifest_'));

      expect(manifestSaveIdx).toBeGreaterThanOrEqual(0);
      expect(projectDeleteIdx).toBeGreaterThanOrEqual(0);
      expect(manifestDeleteIdx).toBeGreaterThan(manifestSaveIdx);
      expect(manifestDeleteIdx).toBeGreaterThan(projectDeleteIdx);
      expect(mockManifests.size).toBe(0);
      expect(deletedDatabases).toContain('crdt_p_manifest_order_test_chap_mf_1');
    });

    it('persists manifest in storage when physical deletion fails so it can be recovered later (T007)', async () => {
      const p = createDummyProject('p_unrecovered_crash', 'Crash Test Project');
      await saveProjectToDB(p);
      const c = createDummyChapter('chap_crash_1', 'p_unrecovered_crash');
      await saveChapterToDB(c);

      (indexedDB.deleteDatabase as any).mockImplementation((_name: string) => {
        const req: any = {
          result: undefined,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          error: new Error('Crash during physical database eradication'),
        };
        setTimeout(() => req.onerror?.({ target: req }), 10);
        return req;
      });

      await expect(deleteProjectFromDB('p_unrecovered_crash')).rejects.toThrow(
        'Crash during physical database eradication'
      );

      // Primary records were deleted, but manifest MUST remain durable in storage
      expect(mockProjects.has('p_unrecovered_crash')).toBe(false);
      expect(mockManifests.size).toBe(1);
      const pendingManifests = await getPendingDeletionManifests();
      expect(pendingManifests).toHaveLength(1);
      expect(pendingManifests[0].projectId).toBe('p_unrecovered_crash');
      expect(pendingManifests[0].chapterIds).toContain('chap_crash_1');

      // Now restore working physical deletion and run recovery
      (indexedDB.deleteDatabase as any).mockImplementation((name: string) => {
        deletedDatabases.push(name);
        const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      });

      const recoveryResult = await recoverPendingDeletions();
      expect(recoveryResult.recoveredCount).toBe(1);
      expect(mockManifests.size).toBe(0);
      expect(deletedDatabases).toContain('crdt_p_unrecovered_crash_chap_crash_1');
    });

    it('records deletion manifest during executeDeleteChaptersByProjectFromDB and removes it on success (T007)', async () => {
      const p = createDummyProject('p_bulk_chap_del', 'Bulk Chap Delete');
      await saveProjectToDB(p);
      const c1 = createDummyChapter('c_bulk_1', 'p_bulk_chap_del');
      const c2 = createDummyChapter('c_bulk_2', 'p_bulk_chap_del');
      await saveChaptersToDB([c1, c2]);

      executionOrder.length = 0;
      await deleteChaptersByProjectFromDB('p_bulk_chap_del');

      const manifestSaveIdx = executionOrder.findIndex((op) => op.startsWith('save_manifest_'));
      const manifestDeleteIdx = executionOrder.findIndex((op) => op.startsWith('delete_manifest_'));

      expect(manifestSaveIdx).toBeGreaterThanOrEqual(0);
      expect(manifestDeleteIdx).toBeGreaterThan(manifestSaveIdx);
      expect(mockManifests.size).toBe(0);
      expect(deletedDatabases).toContain('crdt_p_bulk_chap_del_c_bulk_1');
      expect(deletedDatabases).toContain('crdt_p_bulk_chap_del_c_bulk_2');
    });
  });

  describe('User Story 2: Fail-Closed Orphan Guard for Unparented Chapters', () => {
    it('aborts saveChapterToDB cleanly and writes 0 records when chapter lacks projectId and cannot be found in DB', async () => {
      const orphanChapter: any = {
        id: 'orphan_no_project_record',
        title: 'Orphan Without Project',
        sourceText: '原文',
        rawTranslation: 'Thô',
      };

      await saveChapterToDB(orphanChapter);

      expect(mockChapters.has('orphan_no_project_record')).toBe(false);
      expect(getProjectWriteChainsSizeForTest()).toBe(0);
    });

    it('saveChaptersToDB omits unparented chapters lacking projectId without throwing', async () => {
      const project = createDummyProject('p_parent_valid', 'Valid Parent');
      await saveProjectToDB(project);

      const validChapter = createDummyChapter('c_valid_1', 'p_parent_valid');
      const orphanChapter: any = {
        id: 'c_orphan_batch',
        title: 'Orphan Batch Chapter',
        sourceText: '原文',
      };

      await saveChaptersToDB([validChapter, orphanChapter]);

      expect(mockChapters.has('c_valid_1')).toBe(true);
      expect(mockChapters.has('c_orphan_batch')).toBe(false);
      expect(getProjectWriteChainsSizeForTest()).toBe(0);
    });
  });

  describe('User Story 3: Strict Transaction Durability (transaction.oncomplete)', () => {
    it('saveChapterToDB resolves after transaction commits to disk', async () => {
      const project = createDummyProject('p_durability', 'Durability Project');
      await saveProjectToDB(project);

      const chapter = createDummyChapter('c_dur_1', 'p_durability');
      let completed = false;

      const promise = saveChapterToDB(chapter).then(() => {
        completed = true;
      });

      expect(completed).toBe(false);
      await promise;
      expect(completed).toBe(true);
      expect(mockChapters.has('c_dur_1')).toBe(true);
    });
  });

  describe('Feature 144 User Story 3: Complete CRDT Cleanup on Single Chapter Deletion', () => {
    it('deletes from CHAPTERS_STORE, CRDT_STATES_STORE, and deletes dedicated CRDT DB', async () => {
      const project = createDummyProject('p_single_chap_del', 'Single Chap Del Project');
      await saveProjectToDB(project);

      const chapter = createDummyChapter('c_to_delete', 'p_single_chap_del');
      await saveChapterToDB(chapter);

      await saveCrdtState({
        chapterId: 'c_to_delete',
        projectId: 'p_single_chap_del',
        state: new Uint8Array([1, 2, 3]),
        updatedAt: new Date().toISOString(),
      });

      knownDatabases.add('crdt_p_single_chap_del_c_to_delete');

      expect(mockChapters.has('c_to_delete')).toBe(true);
      expect(mockCrdtStates.has('c_to_delete')).toBe(true);

      await deleteChapterFromDB('c_to_delete', 'p_single_chap_del');

      expect(mockChapters.has('c_to_delete')).toBe(false);
      expect(mockCrdtStates.has('c_to_delete')).toBe(false);
      expect(deletedDatabases).toContain('crdt_p_single_chap_del_c_to_delete');
    });
  });

  describe('Feature 144 User Story 4: Strict Fail-Closed Semantics for CRDT State Persistence', () => {
    it('aborts saveCrdtState and writes 0 records when record lacks projectId', async () => {
      const unparentedRecord: any = {
        chapterId: 'crdt_no_proj',
        state: new Uint8Array([1]),
      };

      await saveCrdtState(unparentedRecord);

      expect(mockCrdtStates.has('crdt_no_proj')).toBe(false);
    });

    it('saveCrdtStates omits unparented records lacking projectId', async () => {
      const project = createDummyProject('p_valid_crdt', 'Valid Parent');
      await saveProjectToDB(project);
      const chapter = createDummyChapter('crdt_valid_1', 'p_valid_crdt');
      await saveChapterToDB(chapter);

      const validRecord: CrdtStateRecord = {
        chapterId: 'crdt_valid_1',
        projectId: 'p_valid_crdt',
        state: new Uint8Array([1]),
        updatedAt: new Date().toISOString(),
      };
      const invalidRecord: any = {
        chapterId: 'crdt_invalid_1',
        state: new Uint8Array([2]),
      };

      await saveCrdtStates([validRecord, invalidRecord]);

      expect(mockCrdtStates.has('crdt_valid_1')).toBe(true);
      expect(mockCrdtStates.has('crdt_invalid_1')).toBe(false);
    });
  });

  describe('Feature 144 User Story 5: Project Boundary Validation in Atomic Bundle Saves', () => {
    it('throws validation error when CRDT state item belongs to a different project', async () => {
      const projectA = createDummyProject('proj_A', 'Project A');
      const chapterA = createDummyChapter('chap_A_1', 'proj_A');

      const foreignCrdtItem = {
        chapterId: 'chap_A_1',
        projectId: 'proj_B', // Different from proj_A!
        state: new Uint8Array([1, 2]),
      };

      await expect(
        atomicSaveProjectBundle(projectA, [chapterA], [foreignCrdtItem as any])
      ).rejects.toThrow(/Mismatched projectId in CRDT state/);

      expect(mockProjects.has('proj_A')).toBe(false);
      expect(mockChapters.has('chap_A_1')).toBe(false);
    });
  });

  describe('Feature 145 User Story 5: Relational Foreign-Key Ownership Integrity (T020, T021)', () => {
    it('refuses to re-parent an existing chapter to another projectId in saveChapterToDB (T020)', async () => {
      const project1 = createDummyProject('proj_original', 'Original Project');
      const project2 = createDummyProject('proj_attacker', 'Attacker Project');
      await saveProjectToDB(project1);
      await saveProjectToDB(project2);

      const originalChapter = createDummyChapter('c_locked', 'proj_original');
      originalChapter.title = 'Original Title';
      await saveChapterToDB(originalChapter);

      expect(mockChapters.get('c_locked')?.projectId).toBe('proj_original');

      // Attempt to overwrite existing chapter with a different projectId
      const hijackedChapter = createDummyChapter('c_locked', 'proj_attacker');
      hijackedChapter.title = 'Hijacked Title';
      await expect(saveChapterToDB(hijackedChapter)).rejects.toThrow(
        /Relational integrity violation: Cannot re-parent chapter/
      );

      // Verify it aborted without modifying the existing record
      const stored = mockChapters.get('c_locked');
      expect(stored.projectId).toBe('proj_original');
      expect(stored.title).toBe('Original Title');
    });

    it('refuses to re-parent an existing chapter to another projectId in batch saveChaptersToDB (T020, T011)', async () => {
      const project1 = createDummyProject('proj_orig_batch', 'Original Project');
      const project2 = createDummyProject('proj_attack_batch', 'Attacker Project');
      await saveProjectToDB(project1);
      await saveProjectToDB(project2);

      const originalChapter = createDummyChapter('c_batch_locked', 'proj_orig_batch');
      originalChapter.title = 'Original Batch Title';
      await saveChapterToDB(originalChapter);

      const hijackedChapter = createDummyChapter('c_batch_locked', 'proj_attack_batch');
      hijackedChapter.title = 'Hijacked Batch Title';
      await expect(saveChaptersToDB([hijackedChapter])).rejects.toThrow(
        /Relational integrity violation: Cannot re-parent chapter/
      );

      const stored = mockChapters.get('c_batch_locked');
      expect(stored.projectId).toBe('proj_orig_batch');
      expect(stored.title).toBe('Original Batch Title');
    });

    it('refuses to save CRDT state for a chapter belonging to a different project (T021, T013)', async () => {
      const project1 = createDummyProject('proj_crdt_parent', 'Project 1');
      const project2 = createDummyProject('proj_crdt_foreign', 'Project 2');
      await saveProjectToDB(project1);
      await saveProjectToDB(project2);

      const chapter = createDummyChapter('c_crdt_bound', 'proj_crdt_parent');
      await saveChapterToDB(chapter);

      // Attempt to save CRDT state referencing c_crdt_bound under proj_crdt_foreign
      const mismatchedRecord: CrdtStateRecord = {
        chapterId: 'c_crdt_bound',
        projectId: 'proj_crdt_foreign',
        state: new Uint8Array([9, 9, 9]),
        updatedAt: new Date().toISOString(),
      };

      await expect(saveCrdtState(mismatchedRecord)).rejects.toThrow(
        /Relational integrity violation: Chapter "c_crdt_bound" belongs to project "proj_crdt_parent"/
      );

      // Verify that CRDT state was not saved
      expect(mockCrdtStates.has('c_crdt_bound')).toBe(false);
    });

    it('refuses to save CRDT states in batch when chapters belong to a different project (T021, T013)', async () => {
      const project1 = createDummyProject('proj_batch_crdt_1', 'Project 1');
      const project2 = createDummyProject('proj_batch_crdt_2', 'Project 2');
      await saveProjectToDB(project1);
      await saveProjectToDB(project2);

      const chapter = createDummyChapter('c_batch_bound', 'proj_batch_crdt_1');
      await saveChapterToDB(chapter);

      const mismatchedRecord: CrdtStateRecord = {
        chapterId: 'c_batch_bound',
        projectId: 'proj_batch_crdt_2',
        state: new Uint8Array([8, 8, 8]),
        updatedAt: new Date().toISOString(),
      };

      await expect(saveCrdtStates([mismatchedRecord])).rejects.toThrow(
        /Relational integrity violation: Chapter "c_batch_bound" belongs to project "proj_batch_crdt_1"/
      );

      expect(mockCrdtStates.has('c_batch_bound')).toBe(false);
    });

    it('rejects saveCrdtState when referenced chapter does not exist in store (T012)', async () => {
      const project = createDummyProject('proj_missing_c', 'Missing Chapter Proj');
      await saveProjectToDB(project);

      const orphanCrdt: CrdtStateRecord = {
        chapterId: 'nonexistent_chap',
        projectId: 'proj_missing_c',
        state: new Uint8Array([1, 2, 3]),
        updatedAt: new Date().toISOString(),
      };

      await expect(saveCrdtState(orphanCrdt)).rejects.toThrow(
        /Relational integrity violation: Chapter "nonexistent_chap" does not exist in store/
      );
      expect(mockCrdtStates.has('nonexistent_chap')).toBe(false);
    });

    it('rejects saveCrdtStates in batch when referenced chapter does not exist in store (T012)', async () => {
      const project = createDummyProject('proj_missing_batch_c', 'Missing Chapter Batch Proj');
      await saveProjectToDB(project);

      const orphanCrdt: CrdtStateRecord = {
        chapterId: 'batch_nonexistent_chap',
        projectId: 'proj_missing_batch_c',
        state: new Uint8Array([4, 5, 6]),
        updatedAt: new Date().toISOString(),
      };

      await expect(saveCrdtStates([orphanCrdt])).rejects.toThrow(
        /Relational integrity violation: Chapter "batch_nonexistent_chap" does not exist in store/
      );
      expect(mockCrdtStates.has('batch_nonexistent_chap')).toBe(false);
    });
  });

  describe('Feature 145 User Story 6: Collision-Safe Persistence Management & Multi-Instance Cleanup (T024, T025)', () => {
    it('destroys all registered persistence provider instances for a single database (T024)', async () => {
      const p1Destroy = vi.fn();
      const p2Destroy = vi.fn();

      const provider1 = { destroy: p1Destroy };
      const provider2 = { destroy: p2Destroy };

      registerCrdtPersistence('crdt_multi_p1_c1', provider1, 'multi_p1', 'c1');
      registerCrdtPersistence('crdt_multi_p1_c1', provider2, 'multi_p1', 'c1');

      expect(getActivePersistenceCountForTest()).toBe(2);

      await destroyCrdtPersistence('crdt_multi_p1_c1');

      expect(p1Destroy).toHaveBeenCalledTimes(1);
      expect(p2Destroy).toHaveBeenCalledTimes(1);
      expect(getActivePersistenceCountForTest()).toBe(0);
    });

    it('destroys providers for proj_100 without affecting proj_100_200 (T025)', async () => {
      const p100Destroy = vi.fn();
      const p100_200Destroy = vi.fn();

      const providerP100 = { destroy: p100Destroy };
      const providerP100_200 = { destroy: p100_200Destroy };

      registerCrdtPersistence('crdt_proj_100_c1', providerP100, 'proj_100', 'c1');
      registerCrdtPersistence('crdt_proj_100_200_c1', providerP100_200, 'proj_100_200', 'c1');

      expect(getActivePersistenceCountForTest()).toBe(2);

      // Destroy all persistences for proj_100
      await destroyAllCrdtPersistencesForProject('proj_100');

      // providerP100 MUST be destroyed
      expect(p100Destroy).toHaveBeenCalledTimes(1);
      // providerP100_200 MUST NOT be destroyed
      expect(p100_200Destroy).not.toHaveBeenCalled();

      // Only 1 provider remains active
      expect(getActivePersistenceCountForTest()).toBe(1);

      // Clean up
      await destroyAllCrdtPersistencesForProject('proj_100_200');
      expect(p100_200Destroy).toHaveBeenCalledTimes(1);
      expect(getActivePersistenceCountForTest()).toBe(0);
    });
  });

  describe('Feature 146 User Story 4: Canonical Project Identity in Chapter Operations (T019)', () => {
    it('rejects deleteChapterFromDB when provided projectId conflicts with stored chapter (T019)', async () => {
      const projectA = createDummyProject('proj_original_owner', 'Original Owner Project');
      await saveProjectToDB(projectA);

      const chapter = createDummyChapter('c_mismatch_guard', 'proj_original_owner');
      await saveChapterToDB(chapter);

      await expect(
        deleteChapterFromDB('c_mismatch_guard', 'proj_attacker_id')
      ).rejects.toThrow('Mismatched projectId for chapter c_mismatch_guard: expected proj_original_owner, got proj_attacker_id');

      // The chapter must remain in storage
      expect(mockChapters.has('c_mismatch_guard')).toBe(true);
    });

    it('resolves canonical projectId from storage when projectId is omitted in deleteChapterFromDB (T019)', async () => {
      const project = createDummyProject('proj_auto_resolve', 'Auto Resolve Project');
      await saveProjectToDB(project);

      const chapter = createDummyChapter('c_auto_resolve', 'proj_auto_resolve');
      await saveChapterToDB(chapter);

      knownDatabases.add('crdt_proj_auto_resolve_c_auto_resolve');

      // Call without specifying projectId parameter
      await deleteChapterFromDB('c_auto_resolve');

      // Must be removed from catalog
      expect(mockChapters.has('c_auto_resolve')).toBe(false);
      // Dedicated physical DB must be resolved and deleted
      expect(deletedDatabases).toContain('crdt_proj_auto_resolve_c_auto_resolve');
    });
  });

  describe('Feature 146 User Story 5: Fail-Closed Discovery and Provider Release (T023, T024)', () => {
    it('rejects deleteProjectCrdtDatabases if chapter ID discovery encounters an error (T023)', async () => {
      resetDBInstanceForTesting();

      // Re-stub indexedDB.open to return a database whose transaction for projects store fails on get
      vi.stubGlobal('indexedDB', {
        open: () => {
          const faultyDB = {
            objectStoreNames: { contains: () => true },
            transaction: (_storeNames: any) => {
              const tx: any = { oncomplete: null, onerror: null, onabort: null };
              setTimeout(() => tx.oncomplete?.(), 10);
              tx.objectStore = (name: string) => {
                if (name === 'projects') {
                  return {
                    get: () => {
                      const req: any = { error: new Error('Simulated discovery failure'), onsuccess: null, onerror: null };
                      setTimeout(() => req.onerror?.({ target: req }), 0);
                      return req;
                    },
                  };
                }
                return {
                  indexNames: { contains: () => false },
                  index: () => ({
                    getAll: () => {
                      const req: any = { result: [], onsuccess: null, onerror: null };
                      setTimeout(() => req.onsuccess?.({ target: req }), 0);
                      return req;
                    },
                  }),
                  getAll: () => {
                    const req: any = { result: [], onsuccess: null, onerror: null };
                    setTimeout(() => req.onsuccess?.({ target: req }), 0);
                    return req;
                  },
                };
              };
              return tx;
            },
          };
          const req: any = { result: faultyDB, onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        },
        deleteDatabase: () => {
          const req: any = { onsuccess: null, onerror: null, onblocked: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        },
      });

      await expect(deleteProjectCrdtDatabases('proj_disc_fail')).rejects.toThrow('Simulated discovery failure');
    });

    it('retains provider references in registry and propagates error if provider .destroy() throws (T024)', async () => {
      clearActivePersistencesForTest();

      const faultyDestroy = vi.fn().mockRejectedValue(new Error('Simulated provider destruction failure'));
      const provider = { destroy: faultyDestroy };

      registerCrdtPersistence('crdt_proj_fail_test_c1', provider as any, 'proj_fail_test', 'c1');
      expect(getActivePersistenceCountForTest()).toBe(1);

      await expect(
        destroyCrdtPersistence('crdt_proj_fail_test_c1')
      ).rejects.toThrow('Simulated provider destruction failure');

      // Provider reference MUST be retained in registry for future retry
      expect(getActivePersistenceCountForTest()).toBe(1);

      // Subsequent successful destroy cleans up
      faultyDestroy.mockResolvedValueOnce(undefined);
      await destroyCrdtPersistence('crdt_proj_fail_test_c1');
      expect(getActivePersistenceCountForTest()).toBe(0);
    });
  describe('User Story 2: Single Chapter Deletion Manifest (T012, T013)', () => {
    it('records deletion manifest inside atomic transaction during deleteChapterFromDB and removes it on success (T012)', async () => {
      const p = createDummyProject('p_single_chap_del', 'Single Chap Delete');
      await saveProjectToDB(p);
      const c1 = createDummyChapter('c_single_1', 'p_single_chap_del');
      await saveChapterToDB(c1);

      executionOrder.length = 0;
      await deleteChapterFromDB('c_single_1', 'p_single_chap_del');

      const manifestSaveIdx = executionOrder.findIndex((op) => op.startsWith('save_manifest_'));
      const manifestDeleteIdx = executionOrder.findIndex((op) => op.startsWith('delete_manifest_'));

      expect(manifestSaveIdx).toBeGreaterThanOrEqual(0);
      expect(manifestDeleteIdx).toBeGreaterThan(manifestSaveIdx);
      expect(mockManifests.size).toBe(0);
      expect(deletedDatabases).toContain('crdt_p_single_chap_del_c_single_1');
    });

    it('persists manifest in storage when physical deletion fails during single chapter deletion (T013)', async () => {
      const p = createDummyProject('p_single_crash', 'Single Crash Project');
      await saveProjectToDB(p);
      const c = createDummyChapter('c_single_crash', 'p_single_crash');
      await saveChapterToDB(c);

      (indexedDB.deleteDatabase as any).mockImplementationOnce((_name: string) => {
        const req: any = {
          result: undefined,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          error: new Error('Crash during single chapter physical deletion'),
        };
        setTimeout(() => req.onerror?.({ target: req }), 10);
        return req;
      });

      await expect(deleteChapterFromDB('c_single_crash', 'p_single_crash')).rejects.toThrow(
        'Crash during single chapter physical deletion'
      );

      // Manifest MUST remain durable in storage
      expect(mockManifests.size).toBe(1);
      const pendingManifests = await getPendingDeletionManifests();
      expect(pendingManifests).toHaveLength(1);
      expect(pendingManifests[0].projectId).toBe('p_single_crash');
      expect(pendingManifests[0].chapterIds).toContain('c_single_crash');
    });
  });

  });

  describe('User Story 3: Protect Project Write Paths from Bypassing FK Guard (T018, T019)', () => {
    it('saveProjectToDB refuses to re-parent an existing chapter to another projectId (T018)', async () => {
      const p1 = createDummyProject('proj_save_proj_orig', 'Original');
      await saveProjectToDB(p1);
      const c = createDummyChapter('c_save_proj_locked', 'proj_save_proj_orig');
      await saveChapterToDB(c);

      const p2 = createDummyProject('proj_save_proj_attacker', 'Attacker');
      p2.chapters = [ { ...c, projectId: 'proj_save_proj_attacker' } as any ];
      
      await expect(saveProjectToDB(p2)).rejects.toThrow(
        'Relational integrity violation: Cannot re-parent chapter "c_save_proj_locked" from project "proj_save_proj_orig" to "proj_save_proj_attacker".'
      );
      // Verify atomic abort: attacker project was NOT persisted and chapter ownership remains untouched
      expect(mockProjects.has('proj_save_proj_attacker')).toBe(false);
      expect(mockChapters.get('c_save_proj_locked').projectId).toBe('proj_save_proj_orig');
    });

    it('atomicSaveProjectBundle refuses to re-parent an existing chapter to another projectId (T019)', async () => {
      const p1 = createDummyProject('proj_atomic_orig', 'Original');
      await saveProjectToDB(p1);
      const c = createDummyChapter('c_atomic_locked', 'proj_atomic_orig');
      await saveChapterToDB(c);

      const p2 = createDummyProject('proj_atomic_attacker', 'Attacker');
      
      await expect(atomicSaveProjectBundle({ ...p2, id: 'proj_atomic_attacker' }, [ { ...c, projectId: 'proj_atomic_attacker' } ])).rejects.toThrow(
        'Relational integrity violation: Cannot re-parent chapter "c_atomic_locked" from project "proj_atomic_orig" to "proj_atomic_attacker".'
      );
      // Verify atomic abort: attacker project was NOT persisted and chapter ownership remains untouched
      expect(mockProjects.has('proj_atomic_attacker')).toBe(false);
      expect(mockChapters.get('c_atomic_locked').projectId).toBe('proj_atomic_orig');
    });


    it('atomicSaveProjectBundle rejects when CRDT state references a chapterId not in the bundle (US1)', async () => {
      const p = createDummyProject('p_us1_orphan', 'Orphan Project');
      const crdtState = { chapterId: 'c_not_in_bundle', projectId: 'p_us1_orphan', state: new Uint8Array([1]) };
      
      await expect(atomicSaveProjectBundle(p, [], [crdtState])).rejects.toThrow(
        '[atomicSaveProjectBundle] Orphan CRDT state: chapter c_not_in_bundle is not present in the bundle chapters.'
      );
    });

    it('atomicSaveProjectBundle rejects when CRDT state references a chapter belonging to another project (US1)', async () => {
      const p = createDummyProject('p_us1_cross', 'Cross Project');
      const c = createDummyChapter('c_us1_cross', 'p_other_project');
      const crdtState = { chapterId: 'c_us1_cross', projectId: 'p_us1_cross', state: new Uint8Array([1]) };
      
      await expect(atomicSaveProjectBundle(p, [c], [crdtState])).rejects.toThrow(
        '[atomicSaveProjectBundle] Mismatched projectId in CRDT state: chapter c_us1_cross belongs to project "p_other_project" which does not match bundle projectId "p_us1_cross".'
      );
    });
  });

  describe('User Story 2: Fail-Closed Chapter Deletion (US2)', () => {
    it('deleteChapterFromDB rejects when chapter does not exist in store (US2)', async () => {
      await expect(deleteChapterFromDB('c_not_exist_us2')).rejects.toThrow('Chapter "c_not_exist_us2" not found in canonical store');
    });

    it('deleteChapterFromDB rejects when DB lookup throws an error (US2)', async () => {
      const spy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, error: new Error('Simulated DB lookup error') };
        setTimeout(() => {
          req.onerror?.({ target: req });
        }, 10);
        return req;
      });

      try {
        const dbModule = await import('../db');
        dbModule.resetDBInstanceForTesting();
        await expect(dbModule.deleteChapterFromDB('c_error_us2')).rejects.toThrow('Simulated DB lookup error');
      } finally {
        spy.mockRestore();
        const dbModule = await import('../db');
        dbModule.resetDBInstanceForTesting();
      }
    });
  });

  describe('User Story 3: Project Chapters Metadata Ownership Guard (US3)', () => {
    it('saveProjectToDB rejects when project.chapters metadata references a chapter owned by a different project (US3)', async () => {
      const p1 = createDummyProject('p_us3_owner', 'Owner Project');
      await saveProjectToDB(p1);
      const c1 = createDummyChapter('c_us3_shared', 'p_us3_owner');
      await saveChapterToDB(c1);

      const p2 = createDummyProject('p_us3_attacker', 'Attacker Project');
      p2.chapters = [
        { id: 'c_us3_shared', title: 'Shared', status: 'completed', createdAt: '0', updatedAt: '0' }
      ];

      await expect(saveProjectToDB(p2)).rejects.toThrow(
        'Relational integrity violation: Cannot re-parent chapter "c_us3_shared" from project "p_us3_owner" to "p_us3_attacker".'
      );
    });

    it('saveProjectToDB succeeds when project.chapters metadata references a non-existent chapter (lazy sync allowed) (US3)', async () => {
      const p = createDummyProject('p_us3_lazy', 'Lazy Project');
      p.chapters = [
        { id: 'c_us3_nonexistent', title: 'Not Here', status: 'not_started', createdAt: 0, updatedAt: 0 } as unknown as ChapterMetadata
      ];

      await saveProjectToDB(p);
      
      const db = await initDB();
      const saved = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const req = store.get('p_us3_lazy');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      expect(saved?.chapters?.length).toBe(1);
      expect(saved?.chapters?.[0].id).toBe('c_us3_nonexistent');
    });
  });


  describe('User Story 4: Fail-Closed Deletion Database Error Propagation (T024, T025)', () => {
    it('aborts deleteProjectFromDB and retains manifest if provider .destroy() throws (T024)', async () => {
      const p = createDummyProject('p_prov_fail', 'Prov Fail');
      await saveProjectToDB(p);
      const c = createDummyChapter('c_prov_fail_1', 'p_prov_fail');
      await saveChapterToDB(c);

      clearActivePersistencesForTest();
      const faultyDestroy = vi.fn().mockRejectedValue(new Error('Simulated provider destruction failure during project delete'));
      const provider = { destroy: faultyDestroy };
      registerCrdtPersistence('crdt_p_prov_fail_c_prov_fail_1', provider as any, 'p_prov_fail', 'c_prov_fail_1');

      await expect(deleteProjectFromDB('p_prov_fail')).rejects.toThrow('Simulated provider destruction failure during project delete');

      const pendingManifests = await getPendingDeletionManifests();
      expect(pendingManifests.some(m => m.projectId === 'p_prov_fail')).toBe(true);
      expect(deletedDatabases).not.toContain('crdt_p_prov_fail_c_prov_fail_1');
    });
  });


  describe('User Story 4: Fail-Closed Deletion Database Error Propagation (Part 2 - T028)', () => {
    it('recoverPendingDeletions returns failedCount > 0 if manifest retrieval throws (T028)', async () => {
      const spy = vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        const req: any = { result: undefined, onsuccess: null, onerror: null, error: new Error('Simulated DB open failure') };
        setTimeout(() => {
          req.onerror?.({ target: req });
        }, 10);
        return req;
      });

      try {
        resetDBInstanceForTesting();
        const result = await recoverPendingDeletions();
        expect(result.failedCount).toBeGreaterThan(0);
      } finally {
        spy.mockRestore();
        resetDBInstanceForTesting();
      }
    });
  });


  describe('User Story 5: Discovery Consistency Across Concurrency Windows (T031)', () => {
    it('manifest includes ALL discovered chapter IDs even if discovered during cursor traversal (US5, T031)', async () => {
      // Create a dummy project and chapter
      const p1 = createDummyProject('proj_us5_disc', 'Project US5');
      await saveProjectToDB(p1);
      
      const c1 = createDummyChapter('c_known', 'proj_us5_disc');
      await saveChapterToDB(c1);

      // Access the mock DB instance from the globally stubbed indexedDB.open()
      const req = (indexedDB.open('whatever') as any);
      const db = req.result;
      const originalTx = db.transaction;
      
      let injected = false;

      db.transaction = function(storeNames: string | string[], mode: string) {
        // Intercept the readwrite transaction for deletion (it locks projects, chapters, deletion_manifests, etc)
        if (mode === 'readwrite' && Array.isArray(storeNames) && storeNames.includes('deletion_manifests')) {
          if (!injected) {
            injected = true;
            // Inject a chapter into the mocked chapters map JUST BEFORE the transaction cursors run.
            // This simulates concurrent addition of a chapter after the initial discoverProjectChapterIds() call.
            const hiddenChap = createDummyChapter('c_hidden_disc', 'proj_us5_disc');
            mockChapters.set('c_hidden_disc', hiddenChap);
          }
        }
        return originalTx.apply(this, arguments);
      };

      try {
        (indexedDB.deleteDatabase as any).mockImplementationOnce((_name: string) => {
          const req: any = { result: undefined, onsuccess: null, onerror: null, onblocked: null, error: new Error('Simulated physical deletion failure') };
          setTimeout(() => req.onerror?.({ target: req }), 0);
          return req;
        });

        await expect(deleteProjectFromDB('proj_us5_disc')).rejects.toThrow('Simulated physical deletion failure');
        
        // Assert that the manifest contains BOTH known and hidden chapters
        let pendingManifests = Array.from(mockManifests.values());
        expect(pendingManifests.length).toBeGreaterThan(0);
        
        const manifest = pendingManifests.find(m => m.projectId === 'proj_us5_disc');
        expect(manifest).toBeDefined();
        if (manifest) {
          expect(manifest.chapterIds).toContain('c_known');
          expect(manifest.chapterIds).toContain('c_hidden_disc'); // Proves US5 discovery works
          expect(manifest.physicalDbNames).toContain('crdt_proj_us5_disc_c_known');
          expect(manifest.physicalDbNames).toContain('crdt_proj_us5_disc_c_hidden_disc');
        }
      } finally {
        db.transaction = originalTx;
      }
    });


  describe('User Story 4: Strict CRDT State Retrieval API (US4)', () => {
    it('getCrdtState returns null when expected project ID mismatches (T021)', async () => {
      const p = createDummyProject('p_us4_strict', 'Strict');
      const c = createDummyChapter('c_us4_strict', 'p_us4_strict');
      const crdt = { chapterId: 'c_us4_strict', projectId: 'p_us4_strict', state: new Uint8Array([1,2,3]) };
      
      await atomicSaveProjectBundle(p, [c], [crdt]);

      // Should return null if wrong project ID is provided
      const result = await getCrdtState('c_us4_strict', 'p_wrong_id');
      expect(result).toBeNull();
    });

    it('getCrdtState returns the state when expected project ID matches or is omitted (T022)', async () => {
      const p = createDummyProject('p_us4_strict_2', 'Strict 2');
      const c = createDummyChapter('c_us4_strict_2', 'p_us4_strict_2');
      const crdt = { chapterId: 'c_us4_strict_2', projectId: 'p_us4_strict_2', state: new Uint8Array([1,2,3]) };
      
      await atomicSaveProjectBundle(p, [c], [crdt]);

      // Match
      const resultMatch = await getCrdtState('c_us4_strict_2', 'p_us4_strict_2');
      expect(resultMatch).not.toBeNull();
      expect(resultMatch?.projectId).toBe('p_us4_strict_2');

      // Omitted (backward compatibility)
      const resultOmit = await getCrdtState('c_us4_strict_2');
      expect(resultOmit).not.toBeNull();
      expect(resultOmit?.projectId).toBe('p_us4_strict_2');
    });
  });
  });
});

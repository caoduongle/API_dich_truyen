import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveProjectToDB,
  deleteProjectFromDB,
  deleteProjectCrdtDatabases,
  saveChapterToDB,
  saveChaptersToDB,
  saveCrdtState,
  saveCrdtStates,
  waitForProjectWrites,
  resetProjectWriteChainsForTest,
  getProjectWriteChainsSizeForTest,
  resetDBInstanceForTesting,
  CrdtStateRecord,
} from '../db';
import {
  enqueueProjectSave,
  enqueueProjectDelete,
  waitForQueueIdle,
  resetProjectWriteQueueForTest,
} from '../projectStorageQueue';
import { Chapter, StoryProject } from '../../types';

describe('Project Delete Queue Serialization & Resurrection Guard (User Story 1)', () => {
  const mockProjects = new Map<string, any>();
  const mockChapters = new Map<string, any>();
  const mockCrdtStates = new Map<string, any>();
  const executionOrder: string[] = [];
  const deletedDatabases: string[] = [];
  const knownDatabases = new Set<string>();

  beforeEach(() => {
    mockProjects.clear();
    mockChapters.clear();
    mockCrdtStates.clear();
    executionOrder.length = 0;
    resetDBInstanceForTesting();
    resetProjectWriteChainsForTest();
    resetProjectWriteQueueForTest();

    const mockDB: any = {
      objectStoreNames: {
        contains: (name: string) => ['projects', 'chapters', 'crdt_states'].includes(name),
      },
      transaction: (storeNames: string | string[], mode: string) => {
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
    expect(executionOrder).toEqual(['save_project_p_race_1', 'delete_project_p_race_1']);

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

    expect(executionOrder).toEqual(['save_project_p_queue_1', 'delete_project_p_queue_1']);
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

    it('sweeps lingering crdt_${projectId}_* databases discovered via indexedDB.databases()', async () => {
      const project = createDummyProject('p_sweep', 'Sweep Project');
      await saveProjectToDB(project);
      const c1 = createDummyChapter('c1', 'p_sweep');
      await saveChapterToDB(c1);

      // Register active chapter DB + orphan DB from previous deleted session + other project DB
      knownDatabases.add('crdt_p_sweep_c1');
      knownDatabases.add('crdt_p_sweep_orphan_old');
      knownDatabases.add('crdt_other_project_c99');

      await deleteProjectFromDB('p_sweep');

      expect(deletedDatabases).toContain('crdt_p_sweep_c1');
      expect(deletedDatabases).toContain('crdt_p_sweep_orphan_old');
      expect(deletedDatabases).not.toContain('crdt_other_project_c99');
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
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveProjectToDB,
  deleteProjectFromDB,
  waitForProjectWrites,
  resetProjectWriteChainsForTest,
  getProjectWriteChainsSizeForTest,
  resetDBInstanceForTesting,
} from '../db';
import {
  enqueueProjectSave,
  enqueueProjectDelete,
  waitForQueueIdle,
  resetProjectWriteQueueForTest,
} from '../projectStorageQueue';
import { StoryProject } from '../../types';

describe('Project Delete Queue Serialization & Resurrection Guard (User Story 1)', () => {
  const mockProjects = new Map<string, any>();
  const mockChapters = new Map<string, any>();
  const executionOrder: string[] = [];

  beforeEach(() => {
    mockProjects.clear();
    mockChapters.clear();
    executionOrder.length = 0;
    resetDBInstanceForTesting();
    resetProjectWriteChainsForTest();
    resetProjectWriteQueueForTest();

    const mockDB: any = {
      objectStoreNames: {
        contains: (name: string) => ['projects', 'chapters', 'crdt_states'].includes(name),
      },
      transaction: (storeNames: string | string[], mode: string) => {
        const tx: any = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore: (name: string) => {
            if (name === 'projects') {
              return {
                get: (id: string) => {
                  const item = mockProjects.get(id);
                  const req: any = { result: item, onsuccess: null, onerror: null };
                  setTimeout(() => req.onsuccess?.({ target: req }), 0);
                  return req;
                },
                put: (item: any) => {
                  mockProjects.set(item.id, item);
                  executionOrder.push(`save_project_${item.id}`);
                  const req: any = { result: item.id, onsuccess: null, onerror: null };
                  setTimeout(() => req.onsuccess?.({ target: req }), 0);
                  return req;
                },
                delete: (id: string) => {
                  mockProjects.delete(id);
                  executionOrder.push(`delete_project_${id}`);
                  const req: any = { result: undefined, onsuccess: null, onerror: null };
                  setTimeout(() => req.onsuccess?.({ target: req }), 0);
                  return req;
                },
              };
            }
            if (name === 'chapters') {
              return {
                indexNames: { contains: () => false },
                openCursor: () => {
                  const req: any = { result: null, onsuccess: null, onerror: null };
                  setTimeout(() => req.onsuccess?.({ target: req }), 0);
                  return req;
                },
                put: (item: any) => {
                  mockChapters.set(item.id, item);
                  const req: any = { result: item.id, onsuccess: null, onerror: null };
                  setTimeout(() => req.onsuccess?.({ target: req }), 0);
                  return req;
                },
                delete: (id: string) => {
                  mockChapters.delete(id);
                  const req: any = { result: undefined, onsuccess: null, onerror: null };
                  setTimeout(() => req.onsuccess?.({ target: req }), 0);
                  return req;
                },
              };
            }
            return {
              indexNames: { contains: () => false },
              openKeyCursor: () => {
                const req: any = { result: null, onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.({ target: req }), 0);
                return req;
              },
              delete: () => {},
            };
          },
        };
        setTimeout(() => tx.oncomplete?.(), 10);
        return tx;
      },
    };

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: any = { result: mockDB, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
      },
    });
  });

  afterEach(() => {
    resetDBInstanceForTesting();
    resetProjectWriteChainsForTest();
    resetProjectWriteQueueForTest();
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
});

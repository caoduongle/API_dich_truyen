import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  estimateStorageUsage,
  classifyStorageError,
  resetDBInstanceForTesting,
  getProjectsResultFromDB,
  getProjectResultFromDB,
  saveProjectToDB,
  deleteProjectFromDB,
  validateBundleInput,
} from '../db';
import { handleDBUpgrade } from '../dbMigration';

describe('IndexedDB Services & Storage Estimation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('estimateStorageUsage()', () => {
    it('returns null when navigator.storage is unavailable', async () => {
      vi.stubGlobal('navigator', {});
      const res = await estimateStorageUsage();
      expect(res).toBeNull();
    });

    it('calculates usage and percentage accurately when storage estimate is available', async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        usage: 50 * 1024 * 1024, // 50MB
        quota: 1000 * 1024 * 1024, // 1000MB (~1GB)
      });

      vi.stubGlobal('navigator', {
        storage: {
          estimate: mockEstimate,
        },
      });

      const res = await estimateStorageUsage();
      expect(res).not.toBeNull();
      expect(res?.usage).toBe(50 * 1024 * 1024);
      expect(res?.quota).toBe(1000 * 1024 * 1024);
      expect(res?.percentUsed).toBe(5);
      expect(res?.isNearLimit).toBe(false);
      expect(res?.formattedUsage).toBe('50 MB');
    });

    it('sets isNearLimit to true when usage exceeds 80%', async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        usage: 850 * 1024 * 1024, // 850MB
        quota: 1000 * 1024 * 1024, // 1000MB
      });

      vi.stubGlobal('navigator', {
        storage: {
          estimate: mockEstimate,
        },
      });

      const res = await estimateStorageUsage();
      expect(res).not.toBeNull();
      expect(res?.percentUsed).toBe(85);
      expect(res?.isNearLimit).toBe(true);
    });

    it('handles navigator.storage.estimate errors gracefully', async () => {
      const mockEstimate = vi.fn().mockRejectedValue(new Error('Permission denied'));

      vi.stubGlobal('navigator', {
        storage: {
          estimate: mockEstimate,
        },
      });

      const res = await estimateStorageUsage();
      expect(res).toBeNull();
    });
  });

  describe('handleDBUpgrade()', () => {
    it('creates object stores and indexes on empty database', () => {
      const createdStores = new Set<string>();
      const createdIndexes = new Set<string>();

      const mockChaptersStore = {
        indexNames: {
          contains: (name: string) => createdIndexes.has(name),
        },
        createIndex: vi.fn((name: string) => {
          createdIndexes.add(name);
        }),
      };

      const mockCrdtStore = {
        indexNames: {
          contains: (name: string) => createdIndexes.has(`crdt_${name}`),
        },
        createIndex: vi.fn((name: string) => {
          createdIndexes.add(`crdt_${name}`);
        }),
      };

      const mockDB: any = {
        objectStoreNames: {
          contains: (name: string) => createdStores.has(name),
        },
        createObjectStore: vi.fn((name: string) => {
          createdStores.add(name);
          if (name === 'chapters') return mockChaptersStore;
          if (name === 'crdt_states') return mockCrdtStore;
          return {};
        }),
      };

      handleDBUpgrade(mockDB, 0, 4, null);

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('projects', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('chapters', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('crdt_states', { keyPath: 'chapterId' });
      expect(mockChaptersStore.createIndex).toHaveBeenCalledWith('projectId', 'projectId', { unique: false });
      expect(mockCrdtStore.createIndex).toHaveBeenCalledWith('projectId', 'projectId', { unique: false });
    });
  });

  describe('classifyStorageError', () => {
    it('classifies QuotaExceededError correctly', () => {
      const res = classifyStorageError({ name: 'QuotaExceededError', message: 'Quota exceeded' });
      expect(res.code).toBe('QUOTA_EXCEEDED');
      expect(res.message).toContain('đầy');
    });

    it('classifies SecurityError or blocked/denied as STORAGE_BLOCKED', () => {
      expect(classifyStorageError({ name: 'SecurityError', message: 'The operation is insecure' }).code).toBe('STORAGE_BLOCKED');
      expect(classifyStorageError({ name: 'InvalidStateError', message: 'Invalid state' }).code).toBe('STORAGE_BLOCKED');
      expect(classifyStorageError(new Error('IndexedDB access is blocked in incognito')).code).toBe('STORAGE_BLOCKED');
      expect(classifyStorageError(new Error('Permission denied')).code).toBe('STORAGE_BLOCKED');
    });

    it('classifies VersionError and AbortError correctly', () => {
      expect(classifyStorageError({ name: 'VersionError', message: 'Version changed' }).code).toBe('VERSION_ERROR');
      expect(classifyStorageError({ name: 'AbortError', message: 'Transaction was aborted' }).code).toBe('TRANSACTION_ABORTED');
    });

    it('classifies unknown errors as UNKNOWN_ERROR', () => {
      const res = classifyStorageError(new Error('Something unusual'));
      expect(res.code).toBe('UNKNOWN_ERROR');
      expect(res.message).toContain('Something unusual');
    });
  });

  describe('StorageResult wrappers: getProjectsResultFromDB & getProjectResultFromDB', () => {
    beforeEach(() => {
      resetDBInstanceForTesting();
    });

    afterEach(() => {
      resetDBInstanceForTesting();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('returns StorageError with STORAGE_BLOCKED when IndexedDB open fails due to blocked permissions', async () => {
      const mockOpenRequest: any = {
        set onerror(cb: any) {
          setTimeout(() => {
            this.error = { name: 'SecurityError', message: 'Access denied' };
            cb();
          }, 0);
        },
      };
      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => mockOpenRequest),
      });

      const res = await getProjectsResultFromDB();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('STORAGE_BLOCKED');
        expect(res.error.message).toContain('từ chối hoặc bị khóa');
      }
    });

    it('returns StorageSuccess with empty array when DB has no projects', async () => {
      const mockGetAllRequest: any = {
        set onsuccess(cb: any) {
          this.result = [];
          setTimeout(() => cb(), 0);
        },
      };
      const mockTransaction = {
        objectStore: vi.fn(() => ({
          getAll: vi.fn(() => mockGetAllRequest),
        })),
      };
      const mockDB: any = {
        transaction: vi.fn(() => mockTransaction),
        onclose: null,
        onversionchange: null,
      };
      const mockOpenRequest: any = {
        set onsuccess(cb: any) {
          this.result = mockDB;
          setTimeout(() => cb(), 0);
        },
      };
      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => mockOpenRequest),
      });

      const res = await getProjectsResultFromDB();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual([]);
      }
    });

    it('returns StorageSuccess with project data and handles getProjectResultFromDB find', async () => {
      const mockProjects = [
        { id: 'p1', title: 'Project 1', chapters: [] },
        { id: 'p2', title: 'Project 2', chapters: [] },
      ];
      const mockGetAllRequest: any = {
        set onsuccess(cb: any) {
          this.result = mockProjects;
          setTimeout(() => cb(), 0);
        },
      };
      const mockTransaction = {
        objectStore: vi.fn(() => ({
          getAll: vi.fn(() => mockGetAllRequest),
        })),
      };
      const mockDB: any = {
        transaction: vi.fn(() => mockTransaction),
        onclose: null,
        onversionchange: null,
      };
      const mockOpenRequest: any = {
        set onsuccess(cb: any) {
          this.result = mockDB;
          setTimeout(() => cb(), 0);
        },
      };
      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => mockOpenRequest),
      });

      const allRes = await getProjectsResultFromDB();
      expect(allRes.ok).toBe(true);
      if (allRes.ok) {
        expect(allRes.data.length).toBe(2);
      }

      const singleFound = await getProjectResultFromDB('p1');
      expect(singleFound.ok).toBe(true);
      if (singleFound.ok) {
        expect(singleFound.data?.title).toBe('Project 1');
      }

      const singleNotFound = await getProjectResultFromDB('non-existent');
      expect(singleNotFound.ok).toBe(true);
      if (singleNotFound.ok) {
        expect(singleNotFound.data).toBeNull();
      }
    });

    it('serializes concurrent saveProjectToDB calls per projectId in strict FIFO order', async () => {
      resetDBInstanceForTesting();
      const executionOrder: string[] = [];
      const putMock = vi.fn().mockImplementation((val: any) => {
        if (val && val.title) {
          executionOrder.push(val.title);
        }
      });

      const mockTransaction = {
        objectStore: vi.fn(() => ({
          put: putMock,
        })),
        set oncomplete(cb: any) {
          setTimeout(() => cb(), 5);
        },
      };

      const mockDB: any = {
        transaction: vi.fn(() => mockTransaction),
        onclose: null,
        onversionchange: null,
      };

      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => {
          const req: any = {
            result: mockDB,
            set onsuccess(cb: any) {
              setTimeout(() => cb(), 0);
            },
          };
          return req;
        }),
      });

      const p1 = { id: 'proj_same', title: 'Write 1', chapters: [] } as any;
      const p2 = { id: 'proj_same', title: 'Write 2', chapters: [] } as any;
      const p3 = { id: 'proj_same', title: 'Write 3', chapters: [] } as any;

      await Promise.all([
        saveProjectToDB(p1),
        saveProjectToDB(p2),
        saveProjectToDB(p3),
      ]);

      expect(executionOrder).toEqual(['Write 1', 'Write 2', 'Write 3']);
    });

    it('executes interleaved sequence [save A1 -> save A2 -> delete A -> save A3] in strict chronological FIFO order', async () => {
      resetDBInstanceForTesting();
      const executionLog: string[] = [];

      const mockProjectsStore = {
        get: vi.fn(() => {
          const req: any = {
            onsuccess: null,
            onerror: null,
            result: { id: 'proj_seq', title: 'A2', chapters: [] },
          };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        put: vi.fn((val: any) => {
          if (val && val.title) {
            executionLog.push(`save:${val.title}`);
          }
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        delete: vi.fn((id: any) => {
          executionLog.push(`delete:${id}`);
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
      };

      const mockChaptersStore = {
        get: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null, result: undefined };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        put: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        delete: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        index: vi.fn(() => ({
          openCursor: vi.fn(() => {
            const req: any = { onsuccess: null, onerror: null, result: null };
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
          }),
        })),
      };

      const mockCrdtStore = {
        index: vi.fn(() => ({
          openCursor: vi.fn(() => {
            const req: any = { onsuccess: null, onerror: null, result: null };
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
          }),
        })),
        delete: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
      };

      const mockManifestsStore = {
        getAll: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null, result: [] };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        put: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
        delete: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
      };

      const mockTransaction = {
        objectStore: vi.fn((name: string) => {
          if (name === 'projects') return mockProjectsStore;
          if (name === 'chapters') return mockChaptersStore;
          if (name === 'deletion_manifests') return mockManifestsStore;
          return mockCrdtStore;
        }),
        set oncomplete(cb: any) {
          setTimeout(() => cb(), 10);
        },
      };

      const mockDB: any = {
        transaction: vi.fn(() => mockTransaction),
        objectStoreNames: {
          contains: vi.fn(() => true),
        },
        onclose: null,
        onversionchange: null,
      };

      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => {
          const req: any = {
            result: mockDB,
            set onsuccess(cb: any) {
              setTimeout(() => cb(), 0);
            },
          };
          return req;
        }),
        databases: vi.fn().mockResolvedValue([]),
        deleteDatabase: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.({ target: req }), 0);
          return req;
        }),
      });

      const projectId = 'proj_seq';
      const a1 = { id: projectId, title: 'A1', chapters: [] } as any;
      const a2 = { id: projectId, title: 'A2', chapters: [] } as any;
      const a3 = { id: projectId, title: 'A3', chapters: [] } as any;

      const p1 = saveProjectToDB(a1);
      const p2 = saveProjectToDB(a2);
      const pDelete = deleteProjectFromDB(projectId);
      const p3 = saveProjectToDB(a3);

      await Promise.all([p1, p2, pDelete, p3]);

      expect(executionLog).toEqual([
        'save:A1',
        'save:A2',
        'delete:proj_seq',
        'save:A3',
      ]);
    });
  });

  describe('validateBundleInput()', () => {
    const mockProject = { id: 'p1', title: 'Test Project' } as any;
    const mockChapters = [
      { id: 'c1', projectId: 'p1', title: 'Chapter 1' },
      { id: 'c2', projectId: 'p1', title: 'Chapter 2' },
    ] as any;

    it('passes when crdtStates is undefined or empty', () => {
      expect(() => validateBundleInput(mockProject, mockChapters, undefined)).not.toThrow();
      expect(() => validateBundleInput(mockProject, mockChapters, [])).not.toThrow();
    });

    it('passes when all crdtStates correspond to bundle chapters with matching projectId', () => {
      const crdtStates = [
        { chapterId: 'c1', update: new Uint8Array([1, 2, 3]) } as any,
        { chapterId: 'c2', update: new Uint8Array([4, 5, 6]) } as any,
      ];
      expect(() => validateBundleInput(mockProject, mockChapters, crdtStates)).not.toThrow();
    });

    it('throws when crdtState references a chapter not in the bundle chapters', () => {
      const crdtStates = [
        { chapterId: 'orphan_c3', update: new Uint8Array([1]) } as any,
      ];
      expect(() => validateBundleInput(mockProject, mockChapters, crdtStates)).toThrow(
        '[atomicSaveProjectBundle] Orphan CRDT state: chapter orphan_c3 is not present in the bundle chapters.'
      );
    });

    it('throws when chapter in bundle has mismatched projectId', () => {
      const chaptersWithMismatchedProject = [
        { id: 'c1', projectId: 'p1', title: 'Chapter 1' },
        { id: 'c2', projectId: 'other_project', title: 'Chapter 2' },
      ] as any;
      const crdtStates = [
        { chapterId: 'c2', update: new Uint8Array([1]) } as any,
      ];
      expect(() => validateBundleInput(mockProject, chaptersWithMismatchedProject, crdtStates)).toThrow(
        '[atomicSaveProjectBundle] Mismatched projectId in CRDT state: chapter c2 belongs to project "other_project" which does not match bundle projectId "p1".'
      );
    });
  });
});

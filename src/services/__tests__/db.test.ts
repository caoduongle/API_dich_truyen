import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  estimateStorageUsage,
  classifyStorageError,
  resetDBInstanceForTesting,
  getProjectsResultFromDB,
  getProjectResultFromDB,
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
  });
});

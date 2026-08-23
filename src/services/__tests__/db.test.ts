import { describe, it, expect, vi, afterEach } from 'vitest';
import { estimateStorageUsage } from '../db';
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
});

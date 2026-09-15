import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getProjectsResultFromDB,
  getChapterResultFromDB,
  getProjectsFromDB,
  getChapterFromDB,
  resetDBInstanceForTesting,
} from '../db';

describe('dbStorageAudit - Transparency of IndexedDB Query Results', () => {
  beforeEach(() => {
    resetDBInstanceForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetDBInstanceForTesting();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('distinguishes between empty database (success with []) and storage access error in getProjectsResultFromDB', async () => {
    // 1. Success case: Empty DB -> ok: true, data: []
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
    const mockOpenSuccess: any = {
      set onsuccess(cb: any) {
        this.result = mockDB;
        setTimeout(() => cb(), 0);
      },
    };

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => mockOpenSuccess),
    });

    const emptyResult = await getProjectsResultFromDB();
    expect(emptyResult.ok).toBe(true);
    if (emptyResult.ok) {
      expect(emptyResult.data).toEqual([]);
    }

    // 2. Storage Error case: IndexedDB permission blocked
    resetDBInstanceForTesting();
    const mockOpenError: any = {
      set onerror(cb: any) {
        setTimeout(() => {
          this.error = { name: 'SecurityError', message: 'The operation is insecure or blocked' };
          cb();
        }, 0);
      },
    };
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => mockOpenError),
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const errorResult = await getProjectsResultFromDB();
    expect(errorResult.ok).toBe(false);
    if (!errorResult.ok) {
      expect(errorResult.error.code).toBe('STORAGE_BLOCKED');
      expect(errorResult.error.message).toContain('từ chối hoặc bị khóa');
    }

    // getProjectsFromDB fallback returns [] and logs warning
    const fallbackProjects = await getProjectsFromDB();
    expect(fallbackProjects).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[IndexedDB] getProjectsFromDB() thất bại do sự cố lưu trữ:'),
      expect.any(String)
    );
  });

  it('distinguishes between non-existent chapter (success with null) and storage error in getChapterResultFromDB', async () => {
    // 1. Success case: Chapter not found -> ok: true, data: null
    const mockGetRequest: any = {
      set onsuccess(cb: any) {
        this.result = undefined;
        setTimeout(() => cb(), 0);
      },
    };
    const mockTransaction = {
      objectStore: vi.fn(() => ({
        get: vi.fn(() => mockGetRequest),
      })),
    };
    const mockDB: any = {
      transaction: vi.fn(() => mockTransaction),
      onclose: null,
      onversionchange: null,
    };
    const mockOpenSuccess: any = {
      set onsuccess(cb: any) {
        this.result = mockDB;
        setTimeout(() => cb(), 0);
      },
    };

    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => mockOpenSuccess),
    });

    const notFoundRes = await getChapterResultFromDB('non_existent_123');
    expect(notFoundRes.ok).toBe(true);
    if (notFoundRes.ok) {
      expect(notFoundRes.data).toBeNull();
    }

    // 2. Storage Error case
    resetDBInstanceForTesting();
    const mockOpenError: any = {
      set onerror(cb: any) {
        setTimeout(() => {
          this.error = { name: 'QuotaExceededError', message: 'Disk space full' };
          cb();
        }, 0);
      },
    };
    vi.stubGlobal('indexedDB', {
      open: vi.fn(() => mockOpenError),
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const errorRes = await getChapterResultFromDB('chap_123');
    expect(errorRes.ok).toBe(false);
    if (!errorRes.ok) {
      expect(errorRes.error.code).toBe('QUOTA_EXCEEDED');
    }

    // getChapterFromDB fallback returns null and logs warning
    const fallbackChapter = await getChapterFromDB('chap_123');
    expect(fallbackChapter).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[IndexedDB] getChapterFromDB(chap_123) thất bại do sự cố lưu trữ:'),
      expect.any(String)
    );
  });
});

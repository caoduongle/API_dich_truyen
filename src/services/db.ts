import { StoryProject, Chapter, ChapterMetadata } from '../types';
import {
  PROJECTS_STORE,
  CHAPTERS_STORE,
  handleDBUpgrade,
  migrateLegacyProjects,
} from './dbMigration';
import { STORAGE_CONFIG } from '@shared/constants';

export { PROJECTS_STORE, CHAPTERS_STORE };

const { DB_NAME, DB_VERSION, NEAR_LIMIT_PERCENT, NEAR_LIMIT_MIN_BYTES } = STORAGE_CONFIG;

let dbInstance: IDBDatabase | null = null;

/**
 * Format số byte thành chuỗi dung lượng đọc được (B, KB, MB, GB)
 */
function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Interface thông tin dung lượng bộ nhớ IndexedDB
 */
export interface StorageUsageEstimate {
  usage: number; // dung lượng đã dùng (bytes)
  quota: number; // hạn mức khả dụng (bytes)
  percentUsed: number; // tỷ lệ phần trăm đã dùng (0 - 100)
  isNearLimit: boolean; // cảnh báo khi >= 80% hoặc còn dưới 100MB
  formattedUsage: string;
  formattedQuota: string;
}

/**
 * Kiểm tra hạn mức và dung lượng đĩa đã sử dụng của trình duyệt (IndexedDB / CacheStorage)
 */
export const estimateStorageUsage = async (): Promise<StorageUsageEstimate | null> => {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 1000) / 10 : 0;
      const remainingBytes = quota - usage;
      const isNearLimit = percentUsed >= NEAR_LIMIT_PERCENT || (quota > 0 && remainingBytes < NEAR_LIMIT_MIN_BYTES);

      return {
        usage,
        quota,
        percentUsed,
        isNearLimit,
        formattedUsage: formatBytes(usage),
        formattedQuota: formatBytes(quota),
      };
    } catch (err) {
      console.warn('[IndexedDB] Không thể ước tính dung lượng bộ nhớ:', err);
      return null;
    }
  }
  return null;
};

/**
 * Helper thực hiện retry với exponential backoff cho các thao tác ghi dữ liệu dễ bị lock / timeout
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 150,
  context = 'IndexedDB Operation'
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      // Nếu dbInstance bị đóng hoặc hỏng kết nối, xóa cache instance để mở lại kết nối mới
      if (dbInstance && (err?.name === 'InvalidStateError' || err?.name === 'TransactionInactiveError')) {
        try {
          dbInstance.close();
        } catch (_) {}
        dbInstance = null;
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 50;
        console.warn(`[${context}] Lỗi ở lần thử ${attempt + 1}/${maxRetries + 1}, thử lại sau ${Math.round(delay)}ms:`, err?.message || err);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      dbInstance = db;
      db.onclose = () => {
        dbInstance = null;
      };
      db.onversionchange = () => {
        db.close();
        dbInstance = null;
      };
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = request.result;
      handleDBUpgrade(db, event.oldVersion, event.newVersion, request.transaction);
    };
  });
};

export const getProjectsFromDB = async (): Promise<StoryProject[]> => {
  try {
    const db = await initDB();
    const rawProjects = await new Promise<any[]>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });

    return await migrateLegacyProjects(rawProjects, db);
  } catch (err) {
    console.error('IndexedDB Get All Projects Error:', err);
    return [];
  }
};

export const saveProjectToDB = async (project: StoryProject): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();

    // 1. Tách các chương có sourceText sang store chapters
    const chaptersToSave: Chapter[] = [];
    const normalizedChaptersMeta: ChapterMetadata[] = [];

    if (project.chapters && Array.isArray(project.chapters)) {
      for (const chap of project.chapters) {
        if ('sourceText' in chap) {
          chaptersToSave.push({
            ...(chap as Chapter),
            projectId: project.id,
          });
          normalizedChaptersMeta.push({
            id: chap.id,
            title: chap.title,
            status: chap.status || 'not_started',
            createdAt: chap.createdAt,
            updatedAt: chap.updatedAt,
          });
        } else {
          normalizedChaptersMeta.push(chap as ChapterMetadata);
        }
      }
    }

    // 2. Lưu đồng bộ trong 1 transaction
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite');
      const projectsStore = transaction.objectStore(PROJECTS_STORE);
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      for (const chap of chaptersToSave) {
        chaptersStore.put(chap);
      }

      const projectToSave = {
        ...project,
        chapters: normalizedChaptersMeta,
      };
      projectsStore.put(projectToSave);
    });
  }, 3, 150, 'saveProjectToDB');
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite');
      const projectsStore = transaction.objectStore(PROJECTS_STORE);
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // 1. Xóa record project
      projectsStore.delete(id);

      // 2. Xóa tất cả các chapters của project
      if (chaptersStore.indexNames.contains('projectId')) {
        const index = chaptersStore.index('projectId');
        const cursorRequest = index.openKeyCursor(IDBKeyRange.only(id));
        cursorRequest.onerror = () => reject(cursorRequest.error);
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
          if (cursor) {
            chaptersStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      } else {
        const cursorRequest = chaptersStore.openCursor();
        cursorRequest.onerror = () => reject(cursorRequest.error);
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            if (cursor.value.projectId === id) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }
    });
  }, 3, 150, 'deleteProjectFromDB');
};

export const getChapterFromDB = async (id: string): Promise<Chapter | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readonly');
      const store = transaction.objectStore(CHAPTERS_STORE);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (err) {
    console.error('IndexedDB Get Chapter Error:', err);
    return null;
  }
};

export const saveChapterToDB = async (chapter: Chapter): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = transaction.objectStore(CHAPTERS_STORE);
      const request = store.put(chapter);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }, 3, 100, 'saveChapterToDB');
};

/**
 * Lưu danh sách chương vào IndexedDB (critical path trong quá trình dịch hàng loạt).
 * Tích hợp cơ chế retry tự động khi gặp lock cạnh tranh giữa các worker/tab.
 */
export const saveChaptersToDB = async (chapters: Chapter[]): Promise<void> => {
  if (!chapters || chapters.length === 0) return;
  return withRetry(async () => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = transaction.objectStore(CHAPTERS_STORE);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
      for (const chap of chapters) {
        store.put(chap);
      }
    });
  }, 3, 150, 'saveChaptersToDB');
};

export const deleteChapterFromDB = async (id: string): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = transaction.objectStore(CHAPTERS_STORE);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }, 3, 100, 'deleteChapterFromDB');
};

export const getChaptersByProjectFromDB = async (projectId: string): Promise<Chapter[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readonly');
      const store = transaction.objectStore(CHAPTERS_STORE);
      if (!store.indexNames.contains('projectId')) {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all = request.result || [];
          resolve(all.filter((c: any) => c.projectId === projectId));
        };
        return;
      }
      const index = store.index('projectId');
      const request = index.getAll(projectId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (err) {
    console.error('IndexedDB Get Chapters By Project Error:', err);
    return [];
  }
};

export const deleteChaptersByProjectFromDB = async (projectId: string): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readwrite');
      const store = transaction.objectStore(CHAPTERS_STORE);
      if (!store.indexNames.contains('projectId')) {
        resolve();
        return;
      }
      const index = store.index('projectId');
      const request = index.openKeyCursor(IDBKeyRange.only(projectId));
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }, 3, 150, 'deleteChaptersByProjectFromDB');
};

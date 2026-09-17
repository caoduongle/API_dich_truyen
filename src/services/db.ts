import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { CrdtStateRecord } from '../types/googleDriveSync';
import {
  PROJECTS_STORE,
  CHAPTERS_STORE,
  CRDT_STATES_STORE,
  handleDBUpgrade,
  migrateLegacyProjects,
} from './dbMigration';
import { STORAGE_CONFIG } from '../config/constants';
import {
  StorageResult,
  StorageError,
  StorageErrorCode,
  createStorageSuccess,
  createStorageError,
} from './storageResult';

export { PROJECTS_STORE, CHAPTERS_STORE, CRDT_STATES_STORE };
export type { StorageResult, StorageError, StorageErrorCode, CrdtStateRecord };

export interface CrdtBinaryStateItem {
  chapterId: string;
  state: Uint8Array;
}

export interface AtomicProjectBundleInput {
  project: StoryProject;
  chapters: Chapter[];
  crdtStates?: CrdtBinaryStateItem[];
}

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

export function resetDBInstanceForTesting(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_) {}
  }
  dbInstance = null;
  projectWriteChains.clear();
}

export function classifyStorageError(err: any): { code: StorageErrorCode; message: string } {
  const name = err?.name || '';
  const message = err?.message || String(err);
  if (name === 'QuotaExceededError') {
    return { code: 'QUOTA_EXCEEDED', message: 'Dung lượng lưu trữ IndexedDB đã đầy.' };
  }
  if (name === 'SecurityError' || name === 'InvalidStateError' || message.includes('blocked') || message.includes('denied') || message.includes('Permission')) {
    return { code: 'STORAGE_BLOCKED', message: 'Truy cập IndexedDB bị từ chối hoặc bị khóa.' };
  }
  if (name === 'VersionError') {
    return { code: 'VERSION_ERROR', message: 'Lỗi xung đột phiên bản cơ sở dữ liệu IndexedDB.' };
  }
  if (name === 'AbortError') {
    return { code: 'TRANSACTION_ABORTED', message: 'Giao tác lưu trữ bị hủy bỏ.' };
  }
  return { code: 'UNKNOWN_ERROR', message: `Lỗi IndexedDB: ${message}` };
}

/**
 * Lấy toàn bộ danh sách dự án kèm thông tin trạng thái lỗi chi tiết (StorageResult)
 */
export const getProjectsResultFromDB = async (): Promise<StorageResult<StoryProject[]>> => {
  try {
    const db = await initDB();
    const rawProjects = await new Promise<any[]>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });

    const migrated = await migrateLegacyProjects(rawProjects, db);
    return createStorageSuccess(migrated);
  } catch (err: any) {
    console.error('IndexedDB Get All Projects Error:', err);
    const classified = classifyStorageError(err);
    return createStorageError(classified.code, classified.message, err);
  }
};

/**
 * Lấy thông tin một dự án theo ID kèm trạng thái lỗi chi tiết (StorageResult)
 */
export const getProjectResultFromDB = async (projectId: string): Promise<StorageResult<StoryProject | null>> => {
  try {
    const projectsRes = await getProjectsResultFromDB();
    if (!projectsRes.ok) {
      return projectsRes;
    }
    const project = projectsRes.data.find((p) => p.id === projectId) || null;
    return createStorageSuccess(project);
  } catch (err: any) {
    console.error('IndexedDB Get Project Error:', err);
    const classified = classifyStorageError(err);
    return createStorageError(classified.code, classified.message, err);
  }
};

export const getProjectsFromDB = async (): Promise<StoryProject[]> => {
  const res = await getProjectsResultFromDB();
  if (!res.ok) {
    console.warn('[IndexedDB] getProjectsFromDB() thất bại do sự cố lưu trữ:', res.error.message);
    return [];
  }
  return res.data;
};

export const getProjectFromDB = async (projectId: string): Promise<StoryProject | null> => {
  const res = await getProjectResultFromDB(projectId);
  if (!res.ok) {
    console.warn(`[IndexedDB] getProjectFromDB(${projectId}) thất bại do sự cố lưu trữ:`, res.error.message);
    return null;
  }
  return res.data;
};

const projectWriteChains = new Map<string, Promise<void>>();

export const resetProjectWriteChainsForTest = (): void => {
  projectWriteChains.clear();
};

export const getProjectWriteChainsSizeForTest = (): number => {
  return projectWriteChains.size;
};

/**
 * Trợ thủ khóa cấp dự án sử dụng Web Locks API (navigator.locks).
 * Đồng bộ hóa các thao tác ghi và xóa dự án trên nhiều tab của trình duyệt.
 * Tự động fallback về thực thi trực tiếp khi chạy trên môi trường không hỗ trợ Web Locks (Node.js / Vitest).
 */
export async function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  if (!projectId) {
    return fn();
  }
  if (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    return withRetry(
      () =>
        navigator.locks.request(`project-lock-${projectId}`, async () => {
          return fn();
        }),
      3,
      50,
      `withProjectLock:${projectId}`
    );
  }
  return fn();
}

/**
 * Đưa một tác vụ ghi liên quan đến project vào hàng đợi tuần tự (Write Serialization Queue).
 * Kết hợp tuần tự hóa trong cùng tab (qua projectWriteChains) và đa tab (qua withProjectLock).
 */
export const enqueueProjectWrite = <T = void>(projectId: string | undefined, fn: () => Promise<T>): Promise<T> => {
  if (!projectId) {
    return fn();
  }

  const currentChain = projectWriteChains.get(projectId) || Promise.resolve();

  let nextChain: Promise<any>;
  nextChain = currentChain
    .catch(() => {
      // Đảm bảo lỗi từ tác vụ ghi trước không làm tắc nghẽn tác vụ tiếp theo
    })
    .then(async () => {
      return withProjectLock(projectId, fn);
    })
    .finally(() => {
      if (projectWriteChains.get(projectId) === nextChain) {
        projectWriteChains.delete(projectId);
      }
    });

  projectWriteChains.set(projectId, nextChain);
  return nextChain;
};

const executeSaveProjectToDB = async (project: StoryProject): Promise<void> => {
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

/**
 * Lưu dữ liệu dự án vào IndexedDB kèm cơ chế tuần tự hóa ghi (Write Serialization Queue).
 * Đảm bảo mọi lời gọi tới saveProjectToDB từ bất kỳ caller nào (UI hooks, Google Drive sync)
 * đều được thực thi tuần tự theo từng projectId, loại bỏ triệt để tranh chấp dữ liệu (Race Condition).
 */
export const saveProjectToDB = async (project: StoryProject): Promise<void> => {
  if (!project || !project.id) {
    return executeSaveProjectToDB(project);
  }
  return enqueueProjectWrite(project.id, () => executeSaveProjectToDB(project));
};

const executeAtomicSaveProjectBundle = async (
  project: StoryProject,
  chapters: Chapter[],
  crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]
): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    const crdtStoreName = db.objectStoreNames && typeof db.objectStoreNames.contains === 'function' && db.objectStoreNames.contains(CRDT_STATES_STORE)
      ? CRDT_STATES_STORE
      : (db.objectStoreNames && typeof db.objectStoreNames.contains === 'function' && db.objectStoreNames.contains('crdt_docs') ? 'crdt_docs' : null);

    const storesToLock = crdtStoreName
      ? [PROJECTS_STORE, CHAPTERS_STORE, crdtStoreName]
      : [PROJECTS_STORE, CHAPTERS_STORE];

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storesToLock, 'readwrite');
      const projectsStore = transaction.objectStore(PROJECTS_STORE);
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
      const crdtStore = crdtStoreName ? transaction.objectStore(crdtStoreName) : null;

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      // 1. Lưu toàn bộ chapters
      for (const chap of chapters) {
        chaptersStore.put({
          ...chap,
          projectId: project.id,
        });
      }

      // 2. Lưu trạng thái CRDT nếu có
      if (crdtStore && crdtStates && crdtStates.length > 0) {
        for (const item of crdtStates) {
          const rec: CrdtStateRecord = {
            chapterId: item.chapterId,
            projectId: ('projectId' in item && item.projectId) ? item.projectId : project.id,
            state: item.state,
            updatedAt: ('updatedAt' in item && (item as any).updatedAt)
              ? (item as any).updatedAt
              : (project.updatedAt || new Date().toISOString()),
          };
          crdtStore.put(rec);
        }
      }

      // 3. Chuẩn hóa chapter metadata và lưu project
      const normalizedChaptersMeta: ChapterMetadata[] = chapters.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status || 'not_started',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      const projectToSave: StoryProject = {
        ...project,
        chapters: normalizedChaptersMeta,
      };
      projectsStore.put(projectToSave);
    });
  }, 3, 150, 'atomicSaveProjectBundle');
};

/**
 * Lưu trữ nguyên tử metadata dự án, toàn bộ danh sách chương và trạng thái CRDT trong 1 IDBTransaction duy nhất.
 * Xếp vào hàng đợi ghi tuần tự theo projectId để đảm bảo đồng bộ hoàn toàn với saveProjectToDB.
 */
export const atomicSaveProjectBundle = async (
  project: StoryProject,
  chapters: Chapter[],
  crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]
): Promise<void> => {
  if (!project || !project.id) {
    return executeAtomicSaveProjectBundle(project, chapters, crdtStates);
  }
  return enqueueProjectWrite(project.id, () => executeAtomicSaveProjectBundle(project, chapters, crdtStates));
};

/**
 * Chờ cho tất cả tác vụ ghi dự án đang xử lý hoàn tất (hoặc cho một projectId cụ thể)
 */
export const waitForProjectWrites = async (projectId?: string): Promise<void> => {
  if (projectId) {
    const chain = projectWriteChains.get(projectId);
    if (chain) {
      await chain.catch(() => {});
    }
  } else {
    const allChains = Array.from(projectWriteChains.values());
    await Promise.all(allChains.map((c) => c.catch(() => {})));
  }
};

const executeDeleteProjectFromDB = async (id: string): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    const chapterIdsToDelete: string[] = [];

    return new Promise<void>((resolve, reject) => {
      const storesToLock = [PROJECTS_STORE, CHAPTERS_STORE];
      const crdtStoreName = (db.objectStoreNames && typeof db.objectStoreNames.contains === 'function' && db.objectStoreNames.contains(CRDT_STATES_STORE))
        ? CRDT_STATES_STORE
        : (db.objectStoreNames && typeof db.objectStoreNames.contains === 'function' && db.objectStoreNames.contains('crdt_docs') ? 'crdt_docs' : null);

      if (crdtStoreName) {
        storesToLock.push(crdtStoreName);
      }
      const transaction = db.transaction(storesToLock, 'readwrite');
      const projectsStore = transaction.objectStore(PROJECTS_STORE);
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = async () => {
        try {
          await deleteProjectCrdtDatabases(id, chapterIdsToDelete);
        } catch (crdtErr) {
          console.warn(`[deleteProjectFromDB] Cảnh báo khi dọn CRDT databases cho dự án ${id}:`, crdtErr);
        }
        resolve();
      };

      // 1. Xóa record project
      projectsStore.delete(id);

      // 2. Xóa tất cả các chapters của project và thu thập chapterId để dọn dẹp CRDT databases
      if (chaptersStore.indexNames && typeof chaptersStore.indexNames.contains === 'function' && chaptersStore.indexNames.contains('projectId')) {
        const index = chaptersStore.index('projectId');
        const cursorRequest = index.openKeyCursor(IDBKeyRange.only(id));
        cursorRequest.onerror = () => reject(cursorRequest.error);
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
          if (cursor) {
            chapterIdsToDelete.push(String(cursor.primaryKey));
            chaptersStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
      } else if (typeof chaptersStore.openCursor === 'function') {
        const cursorRequest = chaptersStore.openCursor();
        cursorRequest.onerror = () => reject(cursorRequest.error);
        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            if (cursor.value.projectId === id) {
              chapterIdsToDelete.push(cursor.value.id || String(cursor.primaryKey));
              cursor.delete();
            }
            cursor.continue();
          }
        };
      }

      // 3. Xóa CRDT states của project nếu có
      if (crdtStoreName) {
        const crdtStore = transaction.objectStore(crdtStoreName);
        if (crdtStore.indexNames && typeof crdtStore.indexNames.contains === 'function' && crdtStore.indexNames.contains('projectId')) {
          const index = crdtStore.index('projectId');
          const cursorRequest = index.openKeyCursor(IDBKeyRange.only(id));
          cursorRequest.onerror = () => reject(cursorRequest.error);
          cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
            if (cursor) {
              crdtStore.delete(cursor.primaryKey);
              cursor.continue();
            }
          };
        }
      }
    });
  }, 3, 150, 'deleteProjectFromDB');
};

/**
 * Xóa sạch tất cả các database IndexedDB riêng do y-indexeddb tạo ra (crdt_${projectId}_${chapterId})
 * cho toàn bộ các chương của một dự án.
 * Đồng thời quét và dọn sạch các DB có tiền tố crdt_${projectId}_ qua indexedDB.databases() nếu môi trường hỗ trợ.
 */
export const deleteProjectCrdtDatabases = async (
  projectId: string,
  knownChapterIds?: string[]
): Promise<void> => {
  if (!projectId || typeof indexedDB === 'undefined' || typeof indexedDB.deleteDatabase !== 'function') {
    return;
  }

  const dbsToDelete = new Set<string>();

  // 1. Thêm các database theo danh sách chapterId đã biết
  if (knownChapterIds && knownChapterIds.length > 0) {
    for (const chapId of knownChapterIds) {
      if (chapId) {
        dbsToDelete.add(`crdt_${projectId}_${chapId}`);
      }
    }
  }

  // 2. Quét thêm bằng indexedDB.databases() nếu môi trường hỗ trợ để bắt cả các chapter mồ côi
  if (typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      const prefix = `crdt_${projectId}_`;
      if (Array.isArray(dbs)) {
        for (const dbInfo of dbs) {
          if (dbInfo && dbInfo.name && dbInfo.name.startsWith(prefix)) {
            dbsToDelete.add(dbInfo.name);
          }
        }
      }
    } catch (enumErr) {
      console.warn(`[deleteProjectCrdtDatabases] Không thể liệt kê danh sách IndexedDB databases:`, enumErr);
    }
  }

  // 3. Thực hiện xóa từng database
  const deletePromises: Promise<void>[] = [];
  for (const dbName of dbsToDelete) {
    deletePromises.push(
      new Promise<void>((resolve) => {
        try {
          const req = indexedDB.deleteDatabase(dbName);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve(); // Tiếp tục dọn các DB khác nếu một DB gặp lỗi
          req.onblocked = () => resolve();
        } catch {
          resolve();
        }
      })
    );
  }

  await Promise.all(deletePromises);
};

/**
 * Xóa dự án khỏi IndexedDB kèm tuần tự hóa hàng đợi ghi (Write Serialization Queue).
 * Xếp vào hàng đợi projectWriteChains theo projectId để đảm bảo mọi thao tác lưu trước đó
 * hoàn tất trước khi xóa, loại bỏ triệt để race condition hồi sinh dự án (project resurrection).
 */
export const deleteProjectFromDB = async (id: string): Promise<void> => {
  if (!id) return;
  return enqueueProjectWrite(id, () => executeDeleteProjectFromDB(id));
};

/**
 * Lấy nội dung một chương theo ID kèm trạng thái lỗi chi tiết (StorageResult)
 */
export const getChapterResultFromDB = async (id: string): Promise<StorageResult<Chapter | null>> => {
  try {
    const db = await initDB();
    const chapter = await new Promise<Chapter | null>((resolve, reject) => {
      const transaction = db.transaction(CHAPTERS_STORE, 'readonly');
      const store = transaction.objectStore(CHAPTERS_STORE);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
    return createStorageSuccess(chapter);
  } catch (err: any) {
    console.error(`[IndexedDB] Get Chapter Result Error for ${id}:`, err);
    const classified = classifyStorageError(err);
    return createStorageError(classified.code, classified.message, err);
  }
};

export const getChapterFromDB = async (id: string): Promise<Chapter | null> => {
  const res = await getChapterResultFromDB(id);
  if (!res.ok) {
    console.warn(`[IndexedDB] getChapterFromDB(${id}) thất bại do sự cố lưu trữ:`, res.error.message);
    return null;
  }
  return res.data;
};

/**
 * Trộn thông tin chương một cách an toàn nhằm ngăn chặn tình trạng ghi đè chuỗi rỗng
 * làm mất bản gốc (sourceText), dịch thô (rawTranslation) hoặc đoạn văn (paragraphs) đã có từ trước.
 */
export const mergeSafeguardChapter = (existing: Chapter | undefined, incoming: Chapter): Chapter => {
  if (!existing) return incoming;

  const incomingSourceEmpty = !incoming.sourceText || incoming.sourceText.trim() === '';
  const existingSourcePresent = Boolean(existing.sourceText && existing.sourceText.trim() !== '');

  const incomingRawEmpty = incoming.rawTranslation === undefined || incoming.rawTranslation.trim() === '';
  const existingRawPresent = Boolean(existing.rawTranslation && existing.rawTranslation.trim() !== '');

  const needsSourceGuard = incomingSourceEmpty && existingSourcePresent;
  const needsRawGuard = incomingRawEmpty && existingRawPresent;

  if (needsSourceGuard || needsRawGuard) {
    console.warn(
      `[saveChapterToDB] Safeguard triggered for chapter ${incoming.id}: preserving non-empty existing fields (sourceText: ${needsSourceGuard}, rawTranslation: ${needsRawGuard}).`
    );
    return {
      ...incoming,
      sourceText: needsSourceGuard ? existing.sourceText : incoming.sourceText,
      rawTranslation: needsRawGuard ? existing.rawTranslation : incoming.rawTranslation,
      paragraphs:
        needsSourceGuard && (!incoming.paragraphs || incoming.paragraphs.length === 0)
          ? existing.paragraphs
          : incoming.paragraphs,
    };
  }

  return incoming;
};

const executeSaveChapterToDB = async (chapter: Chapter, projectId?: string): Promise<void> => {
  if (!projectId) {
    console.warn(`[saveChapterToDB] Bỏ qua lưu chương ${chapter.id}: thiếu parent projectId.`);
    return;
  }

  return withRetry(async () => {
    const db = await initDB();
    const hasProjectsStore = Boolean(
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(PROJECTS_STORE)
    );

    const storesToLock = hasProjectsStore ? [PROJECTS_STORE, CHAPTERS_STORE] : [CHAPTERS_STORE];
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storesToLock, 'readwrite');
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      const proceedWithSave = () => {
        const getRequest = chaptersStore.get(chapter.id);
        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          const existing = getRequest.result as Chapter | undefined;
          const chapterToSave = mergeSafeguardChapter(existing, chapter);
          const putRequest = chaptersStore.put(chapterToSave);
          putRequest.onerror = () => reject(putRequest.error);
        };
      };

      if (hasProjectsStore) {
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const projectReq = projectsStore.get(projectId);
        projectReq.onerror = () => reject(projectReq.error);
        projectReq.onsuccess = () => {
          const parentProject = projectReq.result;
          if (!parentProject) {
            console.warn(
              `[saveChapterToDB] Bỏ qua lưu chương ${chapter.id} vì dự án cha ${projectId} không tồn tại hoặc đã bị xóa.`
            );
            resolve();
            return;
          }
          proceedWithSave();
        };
      } else {
        proceedWithSave();
      }
    });
  }, 3, 100, 'saveChapterToDB');
};

export const saveChapterToDB = async (chapter: Chapter): Promise<void> => {
  let projectId = chapter.projectId;
  if (!projectId && chapter.id) {
    try {
      const existing = await getChapterFromDB(chapter.id);
      if (existing?.projectId) {
        projectId = existing.projectId;
        chapter = { ...chapter, projectId };
      }
    } catch {
      // Bỏ qua lỗi tra cứu
    }
  }

  // Fail-Closed Guard: Nếu không xác định được projectId, hủy lưu để tránh tạo orphan record
  if (!projectId) {
    console.warn(
      `[saveChapterToDB] Bỏ qua lưu chương ${chapter.id || 'unknown'}: thiếu parent projectId và không tra cứu được từ DB (Fail-closed orphan guard).`
    );
    return;
  }

  return enqueueProjectWrite(projectId, () => executeSaveChapterToDB(chapter, projectId));
};

const executeSaveChaptersToDB = async (chapters: Chapter[], projectId?: string): Promise<void> => {
  if (!chapters || chapters.length === 0) return;
  if (!projectId) {
    console.warn(`[saveChaptersToDB] Bỏ qua lưu danh sách chương: thiếu parent projectId.`);
    return;
  }

  return withRetry(async () => {
    const db = await initDB();
    const hasProjectsStore = Boolean(
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(PROJECTS_STORE)
    );

    const storesToLock = hasProjectsStore ? [PROJECTS_STORE, CHAPTERS_STORE] : [CHAPTERS_STORE];
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storesToLock, 'readwrite');
      const store = transaction.objectStore(CHAPTERS_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      const proceedWithBatchSave = () => {
        for (const chap of chapters) {
          const getReq = store.get(chap.id);
          getReq.onerror = () => reject(getReq.error);
          getReq.onsuccess = () => {
            const existing = getReq.result as Chapter | undefined;
            const chapterToSave = mergeSafeguardChapter(existing, chap);
            const putReq = store.put(chapterToSave);
            putReq.onerror = () => reject(putReq.error);
          };
        }
      };

      if (hasProjectsStore) {
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const projReq = projectsStore.get(projectId);
        projReq.onerror = () => reject(projReq.error);
        projReq.onsuccess = () => {
          const parentProject = projReq.result;
          if (!parentProject) {
            console.warn(
              `[saveChaptersToDB] Bỏ qua lưu ${chapters.length} chương vì dự án cha ${projectId} không tồn tại hoặc đã bị xóa.`
            );
            resolve();
            return;
          }
          proceedWithBatchSave();
        };
      } else {
        proceedWithBatchSave();
      }
    });
  }, 3, 150, 'saveChaptersToDB');
};

/**
 * Lưu danh sách chương vào IndexedDB (critical path trong quá trình dịch hàng loạt).
 * Tích hợp cơ chế retry tự động khi gặp lock cạnh tranh giữa các worker/tab.
 * Đảm bảo các trường sourceText và rawTranslation không bị xóa bởi mảng ghi đè rỗng.
 */
export const saveChaptersToDB = async (chapters: Chapter[]): Promise<void> => {
  if (!chapters || chapters.length === 0) return;

  const groups = new Map<string, Chapter[]>();

  for (const chap of chapters) {
    let effectiveProjectId = chap.projectId;
    if (!effectiveProjectId && chap.id) {
      try {
        const existing = await getChapterFromDB(chap.id);
        if (existing?.projectId) {
          effectiveProjectId = existing.projectId;
        }
      } catch {
        // Bỏ qua lỗi tra cứu
      }
    }

    if (effectiveProjectId) {
      const list = groups.get(effectiveProjectId) || [];
      list.push({ ...chap, projectId: effectiveProjectId });
      groups.set(effectiveProjectId, list);
    } else {
      console.warn(
        `[saveChaptersToDB] Bỏ qua lưu chương ${chap.id || 'unknown'}: thiếu parent projectId (Fail-closed orphan guard).`
      );
    }
  }

  const tasks: Promise<void>[] = [];

  for (const [projectId, group] of groups.entries()) {
    tasks.push(enqueueProjectWrite(projectId, () => executeSaveChaptersToDB(group, projectId)));
  }

  await Promise.all(tasks);
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

const executeDeleteChaptersByProjectFromDB = async (projectId: string): Promise<void> => {
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

export const deleteChaptersByProjectFromDB = async (projectId: string): Promise<void> => {
  return enqueueProjectWrite(projectId, () => executeDeleteChaptersByProjectFromDB(projectId));
};

// ==============================================================================
// CRDT STATE STORAGE HELPERS (IndexedDB crdt_states store)
// ==============================================================================

export const getCrdtState = async (chapterId: string): Promise<CrdtStateRecord | null> => {
  try {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(CRDT_STATES_STORE)) {
      return null;
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CRDT_STATES_STORE, 'readonly');
      const store = transaction.objectStore(CRDT_STATES_STORE);
      const request = store.get(chapterId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (err) {
    console.error('IndexedDB Get CRDT State Error:', err);
    return null;
  }
};

const executeSaveCrdtState = async (record: CrdtStateRecord): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(CRDT_STATES_STORE)) return;

    const projectId = record.projectId;
    const hasProjectsStore = Boolean(
      projectId &&
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(PROJECTS_STORE)
    );

    const storesToLock = hasProjectsStore ? [PROJECTS_STORE, CRDT_STATES_STORE] : [CRDT_STATES_STORE];

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storesToLock, 'readwrite');
      const store = transaction.objectStore(CRDT_STATES_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      const proceedWithSave = () => {
        const request = store.put(record);
        request.onerror = () => reject(request.error);
      };

      if (hasProjectsStore && projectId) {
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const projReq = projectsStore.get(projectId);
        projReq.onerror = () => reject(projReq.error);
        projReq.onsuccess = () => {
          const parentProject = projReq.result;
          if (!parentProject) {
            console.warn(
              `[saveCrdtState] Bỏ qua lưu CRDT state cho chương ${record.chapterId} vì dự án cha ${projectId} không tồn tại hoặc đã bị xóa.`
            );
            resolve();
            return;
          }
          proceedWithSave();
        };
      } else {
        proceedWithSave();
      }
    });
  }, 3, 100, 'saveCrdtState');
};

export const saveCrdtState = async (record: CrdtStateRecord): Promise<void> => {
  const projectId = record.projectId;
  return enqueueProjectWrite(projectId, () => executeSaveCrdtState(record));
};

const executeSaveCrdtStates = async (records: CrdtStateRecord[], projectId?: string): Promise<void> => {
  if (!records || records.length === 0) return;
  return withRetry(async () => {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(CRDT_STATES_STORE)) return;

    const hasProjectsStore = Boolean(
      projectId &&
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(PROJECTS_STORE)
    );

    const storesToLock = hasProjectsStore ? [PROJECTS_STORE, CRDT_STATES_STORE] : [CRDT_STATES_STORE];

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storesToLock, 'readwrite');
      const store = transaction.objectStore(CRDT_STATES_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      const proceedWithBatchSave = () => {
        for (const rec of records) {
          const request = store.put(rec);
          request.onerror = () => reject(request.error);
        }
      };

      if (hasProjectsStore && projectId) {
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const projReq = projectsStore.get(projectId);
        projReq.onerror = () => reject(projReq.error);
        projReq.onsuccess = () => {
          const parentProject = projReq.result;
          if (!parentProject) {
            console.warn(
              `[saveCrdtStates] Bỏ qua lưu ${records.length} CRDT states vì dự án cha ${projectId} không tồn tại hoặc đã bị xóa.`
            );
            resolve();
            return;
          }
          proceedWithBatchSave();
        };
      } else {
        proceedWithBatchSave();
      }
    });
  }, 3, 150, 'saveCrdtStates');
};

export const saveCrdtStates = async (records: CrdtStateRecord[]): Promise<void> => {
  if (!records || records.length === 0) return;

  const groups = new Map<string, CrdtStateRecord[]>();
  const unassigned: CrdtStateRecord[] = [];

  for (const rec of records) {
    if (rec.projectId) {
      const list = groups.get(rec.projectId) || [];
      list.push(rec);
      groups.set(rec.projectId, list);
    } else {
      unassigned.push(rec);
    }
  }

  const tasks: Promise<void>[] = [];

  for (const [projectId, group] of groups.entries()) {
    tasks.push(enqueueProjectWrite(projectId, () => executeSaveCrdtStates(group, projectId)));
  }

  if (unassigned.length > 0) {
    tasks.push(executeSaveCrdtStates(unassigned));
  }

  await Promise.all(tasks);
};

export const deleteCrdtState = async (chapterId: string): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(CRDT_STATES_STORE)) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CRDT_STATES_STORE, 'readwrite');
      const store = transaction.objectStore(CRDT_STATES_STORE);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      const request = store.delete(chapterId);
      request.onerror = () => reject(request.error);
    });
  }, 3, 100, 'deleteCrdtState');
};

const executeDeleteCrdtStatesByProject = async (projectId: string): Promise<void> => {
  return withRetry(async () => {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(CRDT_STATES_STORE)) return;
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CRDT_STATES_STORE, 'readwrite');
      const store = transaction.objectStore(CRDT_STATES_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      if (!store.indexNames || typeof store.indexNames.contains !== 'function' || !store.indexNames.contains('projectId')) {
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
        }
      };
    });
  }, 3, 150, 'deleteCrdtStatesByProject');
};

export const deleteCrdtStatesByProject = async (projectId: string): Promise<void> => {
  return enqueueProjectWrite(projectId, () => executeDeleteCrdtStatesByProject(projectId));
};


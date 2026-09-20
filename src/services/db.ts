import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { CrdtStateRecord } from '../types/googleDriveSync';
import {
  PROJECTS_STORE,
  CHAPTERS_STORE,
  CRDT_STATES_STORE,
  DELETION_MANIFESTS_STORE,
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
import {
  destroyCrdtPersistence,
  destroyAllCrdtPersistencesForProject,
} from './crdtPersistenceRegistry';

export { PROJECTS_STORE, CHAPTERS_STORE, CRDT_STATES_STORE, DELETION_MANIFESTS_STORE };
export type { StorageResult, StorageError, StorageErrorCode, CrdtStateRecord };

export interface DeletionManifestRecord {
  id: string;
  projectId: string;
  chapterIds: string[];
  physicalDbNames: string[];
  createdAt: string;
  status: 'pending' | 'completed';
}

export function assertChapterOwnership(existing: Chapter | undefined, incomingProjectId: string, chapterId: string): void {
  if (existing && existing.projectId && existing.projectId !== incomingProjectId) {
    throw new Error(`Relational integrity violation: Cannot re-parent chapter "${chapterId}" from project "${existing.projectId}" to "${incomingProjectId}".`);
  }
}

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
      // Không retry các lỗi vi phạm toàn vẹn quan hệ (Relational integrity violation)
      if (err?.message && err.message.startsWith('Relational integrity violation')) {
        throw err;
      }
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

      // T010: Khởi chạy phục hồi các thao tác xóa dở dang trong background khi bootstrap
      recoverPendingDeletions().catch((err) => {
        console.warn('[initDB] Lỗi khi chạy recoverPendingDeletions nền:', err);
      });
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
      if (typeof store.getAll === 'function') {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      } else {
        const results: any[] = [];
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
      }
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
const activeExclusiveProjects = new Set<string>();

export const isProjectInExclusiveSection = (projectId: string): boolean => {
  return activeExclusiveProjects.has(projectId);
};

export const resetProjectWriteChainsForTest = (): void => {
  projectWriteChains.clear();
  activeExclusiveProjects.clear();
};

export const getProjectWriteChainsSizeForTest = (): number => {
  return projectWriteChains.size;
};

/**
 * Thực thi một tác vụ trong vùng critical section độc quyền của dự án.
 * Đảm bảo các tác vụ ghi đang dở dang đã hoàn tất và không có tác vụ ghi mới nào chen ngang.
 * Cho phép các thao tác xóa trong cùng context chạy trực tiếp không bị deadlock.
 */
export const runInProjectExclusiveSection = async <T>(
  projectId: string,
  action: () => Promise<T>
): Promise<T> => {
  if (!projectId) {
    return action();
  }
  return enqueueProjectWrite(projectId, async () => {
    activeExclusiveProjects.add(projectId);
    try {
      return await action();
    } finally {
      activeExclusiveProjects.delete(projectId);
    }
  });
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
    const outcome = await withRetry(
      () =>
        navigator.locks.request(`project-lock-${projectId}`, async () => {
          try {
            const value = await fn();
            return { ok: true as const, value };
          } catch (error) {
            return { ok: false as const, error };
          }
        }),
      3,
      50,
      `withProjectLock:${projectId}`
    );

    if (!outcome.ok) {
      throw outcome.error;
    }
    return outcome.value;
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

    let normalizedChaptersMeta: ChapterMetadata[] = [];
    if (project.chapters && Array.isArray(project.chapters)) {
      for (const chap of project.chapters) {
        if ('sourceText' in chap) {
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

    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite');
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const chaptersStore = transaction.objectStore(CHAPTERS_STORE);

        let isAborted = false;
        transaction.onerror = () => {
          if (!isAborted) reject(transaction.error);
        };
        transaction.onabort = () => {
          // Handled via reject() on validation or error
        };
        transaction.oncomplete = () => resolve();

        const chaptersToSave = (project.chapters && Array.isArray(project.chapters))
          ? project.chapters.filter((c: any) => 'sourceText' in c)
          : [];

        if (normalizedChaptersMeta.length === 0) {
          const projectToSave = {
            ...project,
            chapters: normalizedChaptersMeta,
          };
          projectsStore.put(projectToSave);
          return;
        }

        let pending = normalizedChaptersMeta.length;
        for (const meta of normalizedChaptersMeta) {
          const req = chaptersStore.get(meta.id);
          req.onerror = () => {
            if (!isAborted) {
              isAborted = true;
              try { transaction.abort(); } catch (_) {}
              reject(req.error);
            }
          };
          req.onsuccess = () => {
            if (isAborted) return;
            const existing = req.result as Chapter | undefined;
            try {
              assertChapterOwnership(existing, project.id, meta.id);
            } catch (err) {
              isAborted = true;
              try { transaction.abort(); } catch (_) {}
              reject(err);
              return;
            }

            pending--;
            if (pending === 0) {
              for (const chap of chaptersToSave) {
                chaptersStore.put({ ...chap, projectId: project.id });
              }
              const projectToSave = {
                ...project,
                chapters: normalizedChaptersMeta,
              };
              projectsStore.put(projectToSave);
            }
          };
        }
      } catch (e) {
        reject(e);
      }
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

/**
 * Kiểm tra tính toàn vẹn của dữ liệu đầu vào (in-memory validation) trước khi mở giao dịch IndexedDB.
 * Đảm bảo mọi CRDT state thuộc về một chương hợp lệ trong bundle và có projectId khớp với project.
 */
export function validateBundleInput(
  project: StoryProject,
  chapters: Chapter[],
  crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]
): void {
  if (!crdtStates || crdtStates.length === 0) return;

  const validChapterIds = new Set(chapters.map(c => c.id));
  const chapterIdToProjectId = new Map(chapters.map(c => [c.id, c.projectId]));
  for (const crdt of crdtStates) {
    if (!validChapterIds.has(crdt.chapterId)) {
      throw new Error(`[atomicSaveProjectBundle] Orphan CRDT state: chapter ${crdt.chapterId} is not present in the bundle chapters.`);
    }

    const chapProjectId = chapterIdToProjectId.get(crdt.chapterId);
    if (chapProjectId !== project.id) {
      throw new Error(`[atomicSaveProjectBundle] Mismatched projectId in CRDT state: chapter ${crdt.chapterId} belongs to project "${chapProjectId}" which does not match bundle projectId "${project.id}".`);
    }
  }
}

const executeAtomicSaveProjectBundle = async (
  project: StoryProject,
  chapters: Chapter[],
  crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]
): Promise<void> => {
  return withRetry(async () => {
    // Validate in-memory bundle structure before acquiring DB transaction locks
    validateBundleInput(project, chapters, crdtStates);

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

      let isAborted = false;
      transaction.onerror = () => {
        if (!isAborted) reject(transaction.error);
      };
      transaction.onabort = () => {
        // Handled via reject() on validation or error
      };
      transaction.oncomplete = () => resolve();

      const proceedWithBundleWrites = () => {
        // 1. Lưu toàn bộ chapters
        for (const chap of chapters) {
          const chapToSave = { ...chap, projectId: project.id };
          const putReq = chaptersStore.put(chapToSave);
          putReq.onerror = () => reject(putReq.error);
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
      };

      if (chapters.length === 0) {
        proceedWithBundleWrites();
        return;
      }

      // Pre-validate all chapters inside the transaction before any write
      let pendingChecks = chapters.length;
      for (const chap of chapters) {
        const getReq = chaptersStore.get(chap.id);
        getReq.onerror = () => {
          if (!isAborted) {
            isAborted = true;
            try { transaction.abort(); } catch (_) {}
            reject(getReq.error);
          }
        };
        getReq.onsuccess = () => {
          if (isAborted) return;
          const existing = getReq.result as Chapter | undefined;
          try {
            assertChapterOwnership(existing, project.id, chap.id);
          } catch (err) {
            isAborted = true;
            console.warn(`[atomicSaveProjectBundle] ${(err as Error).message}`);
            try {
              transaction.abort();
            } catch (_) {}
            reject(err);
            return;
          }

          pendingChecks--;
          if (pendingChecks === 0) {
            proceedWithBundleWrites();
          }
        };
      }
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
  if (project && project.id && crdtStates && crdtStates.length > 0) {
    for (const item of crdtStates) {
      if ('projectId' in item && item.projectId && item.projectId !== project.id) {
        throw new Error(
          `[atomicSaveProjectBundle] Mismatched projectId in CRDT state: chapter ${item.chapterId} has projectId "${item.projectId}" which does not match bundle projectId "${project.id}".`
        );
      }
    }
  }
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

/**
 * Trợ thủ xóa IndexedDB an toàn:
 * - Chỉ resolve khi onsuccess fires (không resolve trên onblocked/onerror).
 * - Trên onblocked: chờ onsuccess với bounded timeout 5000ms.
 * - Trên onerror hoặc timeout: reject với lỗi.
 */
export function executeDeleteDatabase(dbName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const req = indexedDB.deleteDatabase(dbName);
      let isSettled = false;
      let blockedTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (blockedTimer) {
          clearTimeout(blockedTimer);
          blockedTimer = null;
        }
      };

      req.onsuccess = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve();
      };

      req.onerror = () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(req.error || new Error(`IndexedDB deleteDatabase failed for "${dbName}"`));
      };

      req.onblocked = () => {
        console.warn(
          `[executeDeleteDatabase] Deletion blocked for database "${dbName}". Waiting for open connections to close...`
        );
        if (!blockedTimer) {
          blockedTimer = setTimeout(() => {
            if (isSettled) return;
            isSettled = true;
            reject(
              new Error(`Timed out waiting for database "${dbName}" deletion (blocked by active connection)`)
            );
          }, 5000);
        }
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Ghi nhận một manifest xóa dở dang vào store deletion_manifests
 * trước khi thực hiện thao tác xóa dữ liệu catalog chính.
 * 
 * @deprecated Use atomic writing within IDB transaction inside deleteProjectFromDB / deleteChapterFromDB instead. 
 * This is kept for backward compatibility and testing.
 */
export async function recordDeletionManifest(manifest: DeletionManifestRecord): Promise<void> {
  return withRetry(async () => {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(DELETION_MANIFESTS_STORE)) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DELETION_MANIFESTS_STORE, 'readwrite');
      const store = tx.objectStore(DELETION_MANIFESTS_STORE);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      tx.oncomplete = () => resolve();

      const req = store.put(manifest);
      req.onerror = () => reject(req.error);
    });
  }, 3, 100, 'recordDeletionManifest');
}

export const recordPendingDeletion = recordDeletionManifest;

/**
 * Xóa một manifest xóa sau khi tất cả database vật lý liên quan đã được dọn dẹp xong.
 */
export async function removeDeletionManifest(id: string): Promise<void> {
  return withRetry(async () => {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(DELETION_MANIFESTS_STORE)) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DELETION_MANIFESTS_STORE, 'readwrite');
      const store = tx.objectStore(DELETION_MANIFESTS_STORE);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      tx.oncomplete = () => resolve();

      const req = store.delete(id);
      req.onerror = () => reject(req.error);
    });
  }, 3, 100, 'removeDeletionManifest');
}

/**
 * Lấy tất cả các deletion manifests đang ở trạng thái pending.
 */
export async function getPendingDeletionManifests(): Promise<DeletionManifestRecord[]> {
  const db = await initDB();
  if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(DELETION_MANIFESTS_STORE)) {
    return [];
  }
  return new Promise<DeletionManifestRecord[]>((resolve, reject) => {
    const tx = db.transaction(DELETION_MANIFESTS_STORE, 'readonly');
    const store = tx.objectStore(DELETION_MANIFESTS_STORE);
    if (store.indexNames && typeof store.indexNames.contains === 'function' && store.indexNames.contains('status')) {
      const index = store.index('status');
      const req = index.getAll('pending');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as DeletionManifestRecord[]) || []);
    } else {
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const all = (req.result as DeletionManifestRecord[]) || [];
        resolve(all.filter((m) => m.status === 'pending'));
      };
    }
  });
}

/**
 * Quét các deletion manifests dở dang và xóa nốt các database vật lý CRDT còn sót.
 */
export async function recoverPendingDeletions(): Promise<{ recoveredCount: number; failedCount: number }> {
  let pending: DeletionManifestRecord[] = [];
  try {
    pending = await getPendingDeletionManifests();
  } catch (err) {
    console.warn('[recoverPendingDeletions] Lỗi tra cứu manifests:', err);
    return { recoveredCount: 0, failedCount: 1 };
  }
  let recoveredCount = 0;
  let failedCount = 0;

  for (const manifest of pending) {
    let manifestClean = true;
    const dbNames = (manifest.physicalDbNames && manifest.physicalDbNames.length > 0)
      ? manifest.physicalDbNames
      : (manifest.chapterIds || []).map((cid) => `crdt_${manifest.projectId}_${cid}`);

    for (const dbName of dbNames) {
      try {
        await executeDeleteDatabase(dbName);
      } catch (err) {
        manifestClean = false;
        console.warn(`[recoverPendingDeletions] Thất bại khi dọn dẹp db vật lý "${dbName}" cho manifest ${manifest.id}:`, err);
      }
    }

    if (manifestClean) {
      try {
        await removeDeletionManifest(manifest.id);
        recoveredCount++;
      } catch (err) {
        console.warn(`[recoverPendingDeletions] Không thể xóa manifest ${manifest.id}:`, err);
        failedCount++;
      }
    } else {
      failedCount++;
    }
  }

  return { recoveredCount, failedCount };
}

/**
 * Khám phá toàn bộ danh sách chapterIds thuộc về một project từ cả 3 nguồn:
 * 1. projects store (thuộc tính chapters của StoryProject)
 * 2. chapters store (cursor theo index projectId hoặc toàn bảng)
 * 3. crdt_states store (cursor theo index projectId hoặc toàn bảng)
 *
 * Không swallow lỗi; nếu xảy ra lỗi truy vấn, ném lỗi ra ngoài (Fail-Closed).
 */
export async function discoverProjectChapterIds(projectId: string): Promise<string[]> {
  if (!projectId) return [];
  const chapterIds = new Set<string>();
  const db = await initDB();
  if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function') {
    return [];
  }

  // 1. Tra cứu chapters từ Projects Store
  if (db.objectStoreNames.contains(PROJECTS_STORE)) {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE);
    const getReq = store.get(projectId);
    await new Promise<void>((resolve, reject) => {
      getReq.onsuccess = () => {
        const proj = getReq.result;
        if (proj?.chapters && Array.isArray(proj.chapters)) {
          for (const c of proj.chapters) {
            if (c?.id) chapterIds.add(c.id);
          }
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // 2. Tra cứu chapters từ Chapters Store
  if (db.objectStoreNames.contains(CHAPTERS_STORE)) {
    const tx = db.transaction(CHAPTERS_STORE, 'readonly');
    const store = tx.objectStore(CHAPTERS_STORE);
    if (store.indexNames && typeof store.indexNames.contains === 'function' && store.indexNames.contains('projectId')) {
      const idx = store.index('projectId');
      const cursorReq = idx.openKeyCursor(IDBKeyRange.only(projectId));
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest<IDBCursor | null>).result;
          if (cursor) {
            chapterIds.add(String(cursor.primaryKey));
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } else if (typeof store.openCursor === 'function') {
      const cursorReq = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            if (cursor.value && cursor.value.projectId === projectId) {
              const chapId = cursor.value.id || String(cursor.primaryKey);
              if (chapId) chapterIds.add(chapId);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    }
  }

  // 3. Tra cứu chapters từ Crdt Store
  const crdtStoreName = (db.objectStoreNames.contains(CRDT_STATES_STORE))
    ? CRDT_STATES_STORE
    : (db.objectStoreNames.contains('crdt_docs') ? 'crdt_docs' : null);

  if (crdtStoreName) {
    const tx = db.transaction(crdtStoreName, 'readonly');
    const store = tx.objectStore(crdtStoreName);
    if (store.indexNames && typeof store.indexNames.contains === 'function' && store.indexNames.contains('projectId')) {
      const idx = store.index('projectId');
      const cursorReq = idx.openKeyCursor(IDBKeyRange.only(projectId));
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest<IDBCursor | null>).result;
          if (cursor) {
            chapterIds.add(String(cursor.primaryKey));
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } else if (typeof store.openCursor === 'function') {
      const cursorReq = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            if (cursor.value && cursor.value.projectId === projectId) {
              const chapId = cursor.value.chapterId || String(cursor.primaryKey);
              if (chapId) chapterIds.add(chapId);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    }
  }

  return Array.from(chapterIds);
}

/**
 * Xóa sạch database IndexedDB riêng do y-indexeddb tạo ra cho một chương cụ thể (crdt_${projectId}_${chapterId}).
 */
export const deleteChapterCrdtDatabase = async (
  projectId: string,
  chapterId: string
): Promise<void> => {
  if (!projectId || !chapterId || typeof indexedDB === 'undefined' || typeof indexedDB.deleteDatabase !== 'function') {
    return;
  }
  const dbName = `crdt_${projectId}_${chapterId}`;
  await destroyCrdtPersistence(dbName);
  await executeDeleteDatabase(dbName);
};

/**
 * Xóa sạch tất cả các database IndexedDB riêng do y-indexeddb tạo ra (crdt_${projectId}_${chapterId})
 * cho toàn bộ các chương của một dự án.
 *
 * Tuyệt đối không dùng prefix startsWith("crdt_" + projectId + "_") trên indexedDB.databases()
 * để ngăn chặn xóa nhầm database của các dự án có chung tiền tố ID (ví dụ proj_123 và proj_123_456).
 */
export const deleteProjectCrdtDatabases = async (
  projectId: string,
  knownChapterIds?: string[]
): Promise<void> => {
  if (!projectId || typeof indexedDB === 'undefined' || typeof indexedDB.deleteDatabase !== 'function') {
    return;
  }

  // 1. Đóng kết nối các active in-memory persistences trong session trước khi xóa database
  await destroyAllCrdtPersistencesForProject(projectId, knownChapterIds);

  const allChapterIds = new Set<string>();

  if (knownChapterIds && knownChapterIds.length > 0) {
    for (const chapId of knownChapterIds) {
      if (chapId) {
        allChapterIds.add(chapId);
      }
    }
  }

  // 2. Tra cứu thêm chapterIds từ DB để bảo đảm không sót chapter nào (Fail-Closed: propagate errors)
  const discovered = await discoverProjectChapterIds(projectId);
  for (const chapId of discovered) {
    if (chapId) {
      allChapterIds.add(chapId);
    }
  }

  // 3. Tạo danh sách các DB cần xóa chính xác tuyệt đối: crdt_${projectId}_${chapId}
  const dbsToDelete = new Set<string>();
  for (const chapId of allChapterIds) {
    if (chapId) {
      dbsToDelete.add(`crdt_${projectId}_${chapId}`);
    }
  }

  // 4. Thực hiện xóa từng database với xác nhận onsuccess nghiêm ngặt
  const deletePromises: Promise<void>[] = [];
  for (const dbName of dbsToDelete) {
    deletePromises.push(executeDeleteDatabase(dbName));
  }

  await Promise.all(deletePromises);
};

const executeDeleteProjectFromDB = async (id: string): Promise<void> => {
  // 1. Khám phá toàn bộ chapterIds của dự án TRƯỚC KHI xóa primary records
  const discoveredChapterIds = await discoverProjectChapterIds(id);
  const chapterIdsToDelete = [...discoveredChapterIds];
  let manifestId = '';

  try {
    await withRetry(async () => {
      const db = await initDB();

      return new Promise<void>((resolve, reject) => {
        const storesToLock = [PROJECTS_STORE, CHAPTERS_STORE, DELETION_MANIFESTS_STORE];
        const crdtStoreName = (db.objectStoreNames && typeof db.objectStoreNames.contains === 'function' && db.objectStoreNames.contains(CRDT_STATES_STORE))
          ? CRDT_STATES_STORE
          : (db.objectStoreNames && typeof db.objectStoreNames.contains === 'function' && db.objectStoreNames.contains('crdt_docs') ? 'crdt_docs' : null);

        if (crdtStoreName) {
          storesToLock.push(crdtStoreName);
        }
        const transaction = db.transaction(storesToLock, 'readwrite');
        const projectsStore = transaction.objectStore(PROJECTS_STORE);
        const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
        const manifestsStore = transaction.objectStore(DELETION_MANIFESTS_STORE);

        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
        transaction.oncomplete = () => resolve();

        let pendingOps = 2;
        if (crdtStoreName) pendingOps++;

        const checkDone = () => {
          pendingOps--;
          if (pendingOps === 0) {
            manifestId = `manifest_${Date.now()}_${id}_${Math.random().toString(36).slice(2, 7)}`;
            const physicalDbNames = Array.from(new Set(chapterIdsToDelete.map((cid) => `crdt_${id}_${cid}`)));
            const manifest: DeletionManifestRecord = {
              id: manifestId,
              projectId: id,
              chapterIds: [...chapterIdsToDelete],
              physicalDbNames,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            manifestsStore.put(manifest);
          }
        };

        // 1. Thu thập chapterIds từ project.chapters trước khi xóa record project
        const getProjReq = projectsStore.get(id);
        getProjReq.onerror = () => reject(getProjReq.error);
        getProjReq.onsuccess = () => {
          const proj = getProjReq.result;
          if (proj?.chapters && Array.isArray(proj.chapters)) {
            for (const c of proj.chapters) {
              if (c?.id && !chapterIdsToDelete.includes(c.id)) {
                chapterIdsToDelete.push(c.id);
              }
            }
          }
          projectsStore.delete(id);
          checkDone();
        };

        // 2. Xóa tất cả các chapters của project và thu thập chapterId để dọn dẹp CRDT databases
        if (chaptersStore.indexNames && typeof chaptersStore.indexNames.contains === 'function' && chaptersStore.indexNames.contains('projectId')) {
          const index = chaptersStore.index('projectId');
          const cursorRequest = index.openKeyCursor(IDBKeyRange.only(id));
          cursorRequest.onerror = () => reject(cursorRequest.error);
          cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
            if (cursor) {
              const chapId = String(cursor.primaryKey);
              if (!chapterIdsToDelete.includes(chapId)) {
                chapterIdsToDelete.push(chapId);
              }
              chaptersStore.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              checkDone();
            }
          };
        } else if (typeof chaptersStore.openCursor === 'function') {
          const cursorRequest = chaptersStore.openCursor();
          cursorRequest.onerror = () => reject(cursorRequest.error);
          cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              if (cursor.value.projectId === id) {
                const chapId = cursor.value.id || String(cursor.primaryKey);
                if (!chapterIdsToDelete.includes(chapId)) {
                  chapterIdsToDelete.push(chapId);
                }
                cursor.delete();
              }
              cursor.continue();
            } else {
              checkDone();
            }
          };
        } else {
          checkDone();
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
                const chapId = String(cursor.primaryKey);
                if (!chapterIdsToDelete.includes(chapId)) {
                  chapterIdsToDelete.push(chapId);
                }
                crdtStore.delete(cursor.primaryKey);
                cursor.continue();
              } else {
                checkDone();
              }
            };
          } else if (typeof crdtStore.openCursor === 'function') {
            const cursorRequest = crdtStore.openCursor();
            cursorRequest.onerror = () => reject(cursorRequest.error);
            cursorRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (cursor) {
                if (cursor.value && cursor.value.projectId === id) {
                  const chapId = cursor.value.chapterId || String(cursor.primaryKey);
                  if (!chapterIdsToDelete.includes(chapId)) {
                    chapterIdsToDelete.push(chapId);
                  }
                  cursor.delete();
                }
                cursor.continue();
              } else {
                checkDone();
              }
            };
          } else {
            checkDone();
          }
        }
      });
    }, 3, 150, 'deleteProjectFromDB_primary');

    // 4. Sau khi primary transaction commit thành công, dọn dẹp các database vật lý CRDT
    // BẮT BUỘC propagate lỗi nếu deleteProjectCrdtDatabases thất bại (Fail-Closed)
    await deleteProjectCrdtDatabases(id, chapterIdsToDelete);

    // 5. Khi toàn bộ database vật lý đã được dọn dẹp thành công, gỡ bỏ manifest
    await removeDeletionManifest(manifestId);
  } catch (err) {
    // Giữ nguyên manifest trong DB để phục hồi ở lần chạy tiếp theo
    throw err;
  }
};

/**
 * Xóa dự án khỏi IndexedDB kèm tuần tự hóa hàng đợi ghi (Write Serialization Queue).
 * Xếp vào hàng đợi projectWriteChains theo projectId để đảm bảo mọi thao tác lưu trước đó
 * hoàn tất trước khi xóa, loại bỏ triệt để race condition hồi sinh dự án (project resurrection).
 */
export const deleteProjectFromDB = async (
  id: string,
  options?: { skipQueue?: boolean }
): Promise<void> => {
  if (!id) return;
  if (options?.skipQueue || activeExclusiveProjects.has(id)) {
    return executeDeleteProjectFromDB(id);
  }
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
          try {
            assertChapterOwnership(existing, projectId, chapter.id);
          } catch (err) {
            console.warn(`[saveChapterToDB] ${(err as Error).message}`);
            try {
              transaction.abort();
            } catch (_) {}
            reject(err);
            return;
          }
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
            try {
              assertChapterOwnership(existing, projectId, chap.id);
            } catch (err) {
              console.warn(`[saveChaptersToDB] ${(err as Error).message}`);
              try {
                transaction.abort();
              } catch (_) {}
              reject(err);
              return;
            }
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

export const deleteChapterFromDB = async (
  id: string,
  projectId?: string,
  options?: { skipQueue?: boolean }
): Promise<void> => {
  if (!id) return;

  const res = await getChapterResultFromDB(id);
  if (!res.ok) {
    throw res.error; // propagate DB lookup error to satisfy US2 fail-close behavior
  }
  
  const storedChapter = res.data;
  if (!storedChapter) {
    throw new Error(`Chapter "${id}" not found in canonical store`);
  }

  if (storedChapter && storedChapter.projectId) {
    if (projectId && projectId !== storedChapter.projectId) {
      throw new Error(`Mismatched projectId for chapter ${id}: expected ${storedChapter.projectId}, got ${projectId}`);
    }
  }

  const resolvedProjectId = storedChapter?.projectId || projectId;

  const executeDelete = async () => {
    let manifestId = '';
    
    try {
      await withRetry(async () => {
        const db = await initDB();
        const hasCrdtStore = Boolean(
          db.objectStoreNames &&
          typeof db.objectStoreNames.contains === 'function' &&
          db.objectStoreNames.contains(CRDT_STATES_STORE)
        );
        const storesToLock = hasCrdtStore ? [CHAPTERS_STORE, CRDT_STATES_STORE, DELETION_MANIFESTS_STORE] : [CHAPTERS_STORE, DELETION_MANIFESTS_STORE];

        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(storesToLock, 'readwrite');
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
          transaction.oncomplete = () => resolve();

          const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
          const reqChap = chaptersStore.delete(id);
          reqChap.onerror = () => reject(reqChap.error);

          if (hasCrdtStore) {
            const crdtStore = transaction.objectStore(CRDT_STATES_STORE);
            const reqCrdt = crdtStore.delete(id);
            reqCrdt.onerror = () => reject(reqCrdt.error);
          }

          if (resolvedProjectId) {
            manifestId = `manifest_chap_${Date.now()}_${id}_${Math.random().toString(36).slice(2, 7)}`;
            const manifest: DeletionManifestRecord = {
              id: manifestId,
              projectId: resolvedProjectId,
              chapterIds: [id],
              physicalDbNames: [`crdt_${resolvedProjectId}_${id}`],
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            const manifestsStore = transaction.objectStore(DELETION_MANIFESTS_STORE);
            manifestsStore.put(manifest);
          }
        });
      }, 3, 100, 'deleteChapterFromDB');

      // Sau khi transaction commit xong, dọn CRDT database vật lý của chính chapter đó
      if (resolvedProjectId) {
        await deleteChapterCrdtDatabase(resolvedProjectId, id);
        if (manifestId) {
          await removeDeletionManifest(manifestId);
        }
      }
    } catch (err) {
      throw err;
    }
  };

  if (resolvedProjectId && !options?.skipQueue && !activeExclusiveProjects.has(resolvedProjectId)) {
    return enqueueProjectWrite(resolvedProjectId, executeDelete);
  }
  return executeDelete();
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
  // 1. Khám phá toàn bộ chapterIds của dự án TRƯỚC KHI xóa primary records
  const discoveredChapterIds = await discoverProjectChapterIds(projectId);
  const deletedChapterIds = [...discoveredChapterIds];
  let manifestId = '';

  try {
    await withRetry(async () => {
      const db = await initDB();
      const hasCrdtStore = Boolean(
        db.objectStoreNames &&
        typeof db.objectStoreNames.contains === 'function' &&
        db.objectStoreNames.contains(CRDT_STATES_STORE)
      );
      const storesToLock = hasCrdtStore ? [CHAPTERS_STORE, CRDT_STATES_STORE, DELETION_MANIFESTS_STORE] : [CHAPTERS_STORE, DELETION_MANIFESTS_STORE];

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storesToLock, 'readwrite');
        const store = transaction.objectStore(CHAPTERS_STORE);
        const manifestsStore = transaction.objectStore(DELETION_MANIFESTS_STORE);

        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
        transaction.oncomplete = () => resolve();

        let pendingOps = 1;
        if (hasCrdtStore) pendingOps++;

        const checkDone = () => {
          pendingOps--;
          if (pendingOps === 0) {
            manifestId = `manifest_${Date.now()}_${projectId}_${Math.random().toString(36).slice(2, 7)}`;
            const physicalDbNames = Array.from(new Set(deletedChapterIds.map((cid) => `crdt_${projectId}_${cid}`)));
            const manifest: DeletionManifestRecord = {
              id: manifestId,
              projectId,
              chapterIds: [...deletedChapterIds],
              physicalDbNames,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            manifestsStore.put(manifest);
          }
        };

        if (store.indexNames && typeof store.indexNames.contains === 'function' && store.indexNames.contains('projectId')) {
          const index = store.index('projectId');
          const request = index.openKeyCursor(IDBKeyRange.only(projectId));
          request.onerror = () => reject(request.error);
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
            if (cursor) {
              const chapId = String(cursor.primaryKey);
              if (!deletedChapterIds.includes(chapId)) {
                deletedChapterIds.push(chapId);
              }
              store.delete(cursor.primaryKey);
              cursor.continue();
            } else {
              checkDone();
            }
          };
        } else if (typeof store.openCursor === 'function') {
          const cursorRequest = store.openCursor();
          cursorRequest.onerror = () => reject(cursorRequest.error);
          cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              if (cursor.value && cursor.value.projectId === projectId) {
                const chapId = cursor.value.id || String(cursor.primaryKey);
                if (!deletedChapterIds.includes(chapId)) {
                  deletedChapterIds.push(chapId);
                }
                cursor.delete();
              }
              cursor.continue();
            } else {
              checkDone();
            }
          };
        } else {
          checkDone();
        }

        if (hasCrdtStore) {
          const crdtStore = transaction.objectStore(CRDT_STATES_STORE);
          if (crdtStore.indexNames && typeof crdtStore.indexNames.contains === 'function' && crdtStore.indexNames.contains('projectId')) {
            const index = crdtStore.index('projectId');
            const request = index.openKeyCursor(IDBKeyRange.only(projectId));
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
              if (cursor) {
                const chapId = String(cursor.primaryKey);
                if (!deletedChapterIds.includes(chapId)) {
                  deletedChapterIds.push(chapId);
                }
                crdtStore.delete(cursor.primaryKey);
                cursor.continue();
              } else {
                checkDone();
              }
            };
          } else if (typeof crdtStore.openCursor === 'function') {
            const cursorRequest = crdtStore.openCursor();
            cursorRequest.onerror = () => reject(cursorRequest.error);
            cursorRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
              if (cursor) {
                if (cursor.value && cursor.value.projectId === projectId) {
                  const chapId = cursor.value.chapterId || String(cursor.primaryKey);
                  if (!deletedChapterIds.includes(chapId)) {
                    deletedChapterIds.push(chapId);
                  }
                  cursor.delete();
                }
                cursor.continue();
              } else {
                checkDone();
              }
            };
          } else {
            checkDone();
          }
        }
      });
    }, 3, 150, 'deleteChaptersByProjectFromDB');

    // Sau khi primary transaction commit thành công, dọn dẹp các database vật lý CRDT
    await deleteProjectCrdtDatabases(projectId, deletedChapterIds);

    // Gỡ bỏ manifest khi dọn dẹp thành công
    await removeDeletionManifest(manifestId);
  } catch (err) {
    throw err;
  }
};

export const deleteChaptersByProjectFromDB = async (
  projectId: string,
  options?: { skipQueue?: boolean }
): Promise<void> => {
  if (!projectId) return;
  if (options?.skipQueue || activeExclusiveProjects.has(projectId)) {
    return executeDeleteChaptersByProjectFromDB(projectId);
  }
  return enqueueProjectWrite(projectId, () => executeDeleteChaptersByProjectFromDB(projectId));
};

// ==============================================================================
// CRDT STATE STORAGE HELPERS (IndexedDB crdt_states store)
// ==============================================================================

export const getCrdtState = async (chapterId: string, expectedProjectId?: string): Promise<CrdtStateRecord | null> => {
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
      request.onsuccess = () => {
        const result = request.result;
        if (result && expectedProjectId && result.projectId !== expectedProjectId) {
          console.warn(`[getCrdtState] Project identity mismatch during CRDT hydration: expected "${expectedProjectId}", found "${result.projectId}"`);
          resolve(null);
        } else {
          resolve(result || null);
        }
      };
    });
  } catch (err) {
    console.error('IndexedDB Get CRDT State Error:', err);
    return null;
  }
};

export const getCrdtStatesByProject = async (projectId: string): Promise<CrdtStateRecord[]> => {
  if (!projectId) return [];
  try {
    const db = await initDB();
    if (!db.objectStoreNames || typeof db.objectStoreNames.contains !== 'function' || !db.objectStoreNames.contains(CRDT_STATES_STORE)) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CRDT_STATES_STORE, 'readonly');
      const store = transaction.objectStore(CRDT_STATES_STORE);
      if (store.indexNames && typeof store.indexNames.contains === 'function' && store.indexNames.contains('projectId')) {
        const index = store.index('projectId');
        const request = index.getAll(projectId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      } else {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const all: CrdtStateRecord[] = request.result || [];
          resolve(all.filter((r) => r.projectId === projectId));
        };
      }
    });
  } catch (err) {
    console.error('IndexedDB Get CRDT States By Project Error:', err);
    return [];
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
    const hasChaptersStore = Boolean(
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(CHAPTERS_STORE)
    );

    const storesToLock: string[] = [CRDT_STATES_STORE];
    if (hasProjectsStore) storesToLock.push(PROJECTS_STORE);
    if (hasChaptersStore) storesToLock.push(CHAPTERS_STORE);

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

      const proceedWithChapterCheck = () => {
        if (hasChaptersStore) {
          const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
          const chapReq = chaptersStore.get(record.chapterId);
          chapReq.onerror = () => reject(chapReq.error);
          chapReq.onsuccess = () => {
            const chapter = chapReq.result as Chapter | undefined;
            if (!chapter) {
              const err = new Error(
                `Relational integrity violation: Chapter "${record.chapterId}" does not exist in store.`
              );
              console.warn(`[saveCrdtState] ${err.message}`);
              try {
                transaction.abort();
              } catch (_) {}
              reject(err);
              return;
            }
            if (chapter.projectId && chapter.projectId !== projectId) {
              const err = new Error(
                `Relational integrity violation: Chapter "${record.chapterId}" belongs to project "${chapter.projectId}", not "${projectId}".`
              );
              console.warn(`[saveCrdtState] ${err.message}`);
              try {
                transaction.abort();
              } catch (_) {}
              reject(err);
              return;
            }
            proceedWithSave();
          };
        } else {
          proceedWithSave();
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
              `[saveCrdtState] Bỏ qua lưu CRDT state cho chương ${record.chapterId} vì dự án cha ${projectId} không tồn tại hoặc đã bị xóa.`
            );
            resolve();
            return;
          }
          proceedWithChapterCheck();
        };
      } else {
        proceedWithChapterCheck();
      }
    });
  }, 3, 100, 'saveCrdtState');
};

export const saveCrdtState = async (record: CrdtStateRecord): Promise<void> => {
  if (!record || !record.projectId) {
    console.warn(
      `[saveCrdtState] Bỏ qua lưu CRDT state cho chương ${record?.chapterId || 'unknown'}: thiếu parent projectId (Fail-closed orphan guard).`
    );
    return;
  }
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
    const hasChaptersStore = Boolean(
      db.objectStoreNames &&
      typeof db.objectStoreNames.contains === 'function' &&
      db.objectStoreNames.contains(CHAPTERS_STORE)
    );

    const storesToLock: string[] = [CRDT_STATES_STORE];
    if (hasProjectsStore) storesToLock.push(PROJECTS_STORE);
    if (hasChaptersStore) storesToLock.push(CHAPTERS_STORE);

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storesToLock, 'readwrite');
      const store = transaction.objectStore(CRDT_STATES_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Transaction aborted'));
      transaction.oncomplete = () => resolve();

      const proceedWithBatchSave = () => {
        for (const rec of records) {
          if (hasChaptersStore) {
            const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
            const chapReq = chaptersStore.get(rec.chapterId);
            chapReq.onerror = () => reject(chapReq.error);
            chapReq.onsuccess = () => {
              const chapter = chapReq.result as Chapter | undefined;
              if (!chapter) {
                const err = new Error(
                  `Relational integrity violation: Chapter "${rec.chapterId}" does not exist in store.`
                );
                console.warn(`[saveCrdtStates] ${err.message}`);
                try {
                  transaction.abort();
                } catch (_) {}
                reject(err);
                return;
              }
              if (chapter.projectId && chapter.projectId !== projectId) {
                const err = new Error(
                  `Relational integrity violation: Chapter "${rec.chapterId}" belongs to project "${chapter.projectId}", not "${projectId}".`
                );
                console.warn(`[saveCrdtStates] ${err.message}`);
                try {
                  transaction.abort();
                } catch (_) {}
                reject(err);
                return;
              }
              const request = store.put(rec);
              request.onerror = () => reject(request.error);
            };
          } else {
            const request = store.put(rec);
            request.onerror = () => reject(request.error);
          }
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

  for (const rec of records) {
    if (rec && rec.projectId) {
      const list = groups.get(rec.projectId) || [];
      list.push(rec);
      groups.set(rec.projectId, list);
    } else {
      console.warn(
        `[saveCrdtStates] Bỏ qua lưu CRDT state cho chương ${rec?.chapterId || 'unknown'}: thiếu parent projectId (Fail-closed orphan guard).`
      );
    }
  }

  const tasks: Promise<void>[] = [];

  for (const [projectId, group] of groups.entries()) {
    tasks.push(enqueueProjectWrite(projectId, () => executeSaveCrdtStates(group, projectId)));
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


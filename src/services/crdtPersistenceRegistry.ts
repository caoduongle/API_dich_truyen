export interface CrdtPersistenceProvider {
  destroy(): Promise<void> | void;
}

export interface RegisteredPersistenceItem {
  provider: CrdtPersistenceProvider;
  projectId?: string;
  chapterId?: string;
}

const activePersistences = new Map<string, Set<RegisteredPersistenceItem>>();

/**
 * Đăng ký instance IndexeddbPersistence đang hoạt động trong session hiện tại.
 * Hỗ trợ lưu trữ nhiều provider trên cùng một dbName (Set).
 */
export function registerCrdtPersistence(
  dbName: string,
  provider: CrdtPersistenceProvider,
  projectId?: string,
  chapterId?: string
): void {
  if (!dbName || !provider) return;
  let set = activePersistences.get(dbName);
  if (!set) {
    set = new Set();
    activePersistences.set(dbName, set);
  }
  for (const item of set) {
    if (item.provider === provider) {
      if (projectId) item.projectId = projectId;
      if (chapterId) item.chapterId = chapterId;
      return;
    }
  }
  set.add({ provider, projectId, chapterId });
}

/**
 * Hủy đăng ký instance IndexeddbPersistence khi hook unmount hoặc đổi chương.
 */
export function unregisterCrdtPersistence(dbName: string, provider?: CrdtPersistenceProvider): void {
  if (!dbName) return;
  const set = activePersistences.get(dbName);
  if (!set) return;

  if (!provider) {
    activePersistences.delete(dbName);
    return;
  }

  for (const item of set) {
    if (item.provider === provider) {
      set.delete(item);
      break;
    }
  }

  if (set.size === 0) {
    activePersistences.delete(dbName);
  }
}

/**
 * Đóng kết nối và giải phóng toàn bộ instances persistence trước khi xóa database vật lý.
 * Fail-closed: Chỉ xóa provider khỏi registry khi .destroy() thành công, và lan truyền lỗi nếu thất bại.
 */
export async function destroyCrdtPersistence(dbName: string): Promise<void> {
  if (!dbName) return;
  const set = activePersistences.get(dbName);
  if (set && set.size > 0) {
    const items = Array.from(set);
    const errors: unknown[] = [];
    for (const item of items) {
      try {
        await item.provider.destroy();
        set.delete(item);
      } catch (e) {
        console.warn(`[destroyCrdtPersistence] Cảnh báo khi đóng persistence provider cho ${dbName}:`, e);
        errors.push(e);
      }
    }
    if (set.size === 0) {
      activePersistences.delete(dbName);
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }
}

/**
 * Đóng toàn bộ các kết nối persistence đang mở cho một dự án cụ thể.
 * Ưu tiên knownChapterIds chính xác. Nếu không truyền, chỉ hủy các provider có
 * projectId khớp chính xác tuyệt đối (tránh va chạm prefix giữa proj_100 và proj_100_200).
 */
export async function destroyAllCrdtPersistencesForProject(
  projectId: string,
  knownChapterIds?: string[]
): Promise<void> {
  if (!projectId) return;
  const targetDbNames = new Set<string>();

  if (knownChapterIds && knownChapterIds.length > 0) {
    for (const chapId of knownChapterIds) {
      if (chapId) {
        const dbName = `crdt_${projectId}_${chapId}`;
        if (activePersistences.has(dbName)) {
          targetDbNames.add(dbName);
        }
      }
    }
  } else {
    // Không có knownChapterIds:
    for (const [dbName, set] of activePersistences.entries()) {
      let matches = false;
      for (const item of set) {
        if (item.projectId) {
          if (item.projectId === projectId) {
            matches = true;
            break;
          }
        }
      }
      if (matches) {
        targetDbNames.add(dbName);
        continue;
      }

      // Nếu không có explicit projectId, chỉ fallback khi dbName khớp format crdt_${projectId}_${chapterId}
      // VÀ item không mang projectId của project khác
      let hasDifferentProject = false;
      for (const item of set) {
        if (item.projectId && item.projectId !== projectId) {
          hasDifferentProject = true;
          break;
        }
      }
      if (!hasDifferentProject && dbName.startsWith(`crdt_${projectId}_`)) {
        targetDbNames.add(dbName);
      }
    }
  }

  const promises = Array.from(targetDbNames).map((dbName) => destroyCrdtPersistence(dbName));
  await Promise.all(promises);
}

/**
 * Trợ thủ kiểm thử: Lấy tổng số lượng persistence provider đang active across all dbNames.
 */
export function getActivePersistenceCountForTest(): number {
  let count = 0;
  for (const set of activePersistences.values()) {
    count += set.size;
  }
  return count;
}

/**
 * Trợ thủ kiểm thử: Xóa sạch map active persistences.
 */
export function clearActivePersistencesForTest(): void {
  activePersistences.clear();
}

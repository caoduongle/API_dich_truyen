export interface CrdtPersistenceProvider {
  destroy(): Promise<void> | void;
}

const activePersistences = new Map<string, CrdtPersistenceProvider>();

/**
 * Đăng ký instance IndexeddbPersistence đang hoạt động trong session hiện tại.
 */
export function registerCrdtPersistence(dbName: string, provider: CrdtPersistenceProvider): void {
  if (!dbName || !provider) return;
  activePersistences.set(dbName, provider);
}

/**
 * Hủy đăng ký instance IndexeddbPersistence khi hook unmount hoặc đổi chương.
 */
export function unregisterCrdtPersistence(dbName: string, provider?: CrdtPersistenceProvider): void {
  if (!dbName) return;
  const existing = activePersistences.get(dbName);
  if (!provider || existing === provider) {
    activePersistences.delete(dbName);
  }
}

/**
 * Đóng kết nối và giải phóng instance persistence trước khi xóa database vật lý.
 */
export async function destroyCrdtPersistence(dbName: string): Promise<void> {
  if (!dbName) return;
  const provider = activePersistences.get(dbName);
  if (provider) {
    activePersistences.delete(dbName);
    try {
      await provider.destroy();
    } catch (e) {
      console.warn(`[destroyCrdtPersistence] Cảnh báo khi đóng persistence provider cho ${dbName}:`, e);
    }
  }
}

/**
 * Đóng toàn bộ các kết nối persistence đang mở cho một dự án cụ thể.
 */
export async function destroyAllCrdtPersistencesForProject(
  projectId: string,
  knownChapterIds?: string[]
): Promise<void> {
  if (!projectId) return;
  const promises: Promise<void>[] = [];

  if (knownChapterIds && knownChapterIds.length > 0) {
    for (const chapId of knownChapterIds) {
      if (chapId) {
        const dbName = `crdt_${projectId}_${chapId}`;
        if (activePersistences.has(dbName)) {
          promises.push(destroyCrdtPersistence(dbName));
        }
      }
    }
  } else {
    // Nếu không có knownChapterIds, quét các provider có tên khớp với format `crdt_${projectId}_`
    // Lưu ý: Đây là in-memory map của tab hiện tại
    for (const dbName of Array.from(activePersistences.keys())) {
      if (dbName.startsWith(`crdt_${projectId}_`)) {
        promises.push(destroyCrdtPersistence(dbName));
      }
    }
  }

  await Promise.all(promises);
}

/**
 * Trợ thủ kiểm thử: Lấy số lượng persistence provider đang active.
 */
export function getActivePersistenceCountForTest(): number {
  return activePersistences.size;
}

/**
 * Trợ thủ kiểm thử: Xóa sạch map active persistences.
 */
export function clearActivePersistencesForTest(): void {
  activePersistences.clear();
}

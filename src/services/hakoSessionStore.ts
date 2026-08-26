/**
 * Persistent IndexedDB store for Moderator Hako Quality Checker Sessions
 * Feature: 075-moderator-quality-checker
 *
 * Isolated in its own dedicated database (HakoQualityCheckerDB) to guarantee
 * zero interference with translation database or StoryProject schemas.
 */

import { QualityReviewSession } from '../types/hakoChecker';

const DB_NAME = 'HakoQualityCheckerDB';
const DB_VERSION = 1;
const STORE_NAME = 'hako_quality_sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB không khả dụng trong môi trường này.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('novelUrl', 'novelUrl', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở IndexedDB HakoQualityCheckerDB'));
  });
}

/**
 * Lưu hoặc cập nhật phiên kiểm định chất lượng
 */
export async function saveSession(session: QualityReviewSession): Promise<QualityReviewSession> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const updatedSession = {
      ...session,
      updatedAt: new Date().toISOString(),
    };
    const req = store.put(updatedSession);

    req.onsuccess = () => resolve(updatedSession);
    req.onerror = () => reject(req.error || new Error('Lỗi khi lưu phiên kiểm định vào IndexedDB'));
  });
}

/**
 * Lấy thông tin một phiên kiểm định theo ID
 */
export async function getSession(id: string): Promise<QualityReviewSession | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Lỗi khi đọc phiên kiểm định'));
  });
}

/**
 * Lấy phiên làm việc gần đây nhất
 */
export async function getLatestSession(): Promise<QualityReviewSession | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items: QualityReviewSession[] = req.result || [];
      if (items.length === 0) {
        resolve(null);
        return;
      }
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(items[0]);
    };
    req.onerror = () => reject(req.error || new Error('Lỗi khi lấy phiên gần nhất'));
  });
}

/**
 * Danh sách toàn bộ các phiên kiểm định
 */
export async function listSessions(): Promise<QualityReviewSession[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items: QualityReviewSession[] = req.result || [];
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      resolve(items);
    };
    req.onerror = () => reject(req.error || new Error('Lỗi khi tải danh sách phiên'));
  });
}

/**
 * Xóa một phiên kiểm định
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Lỗi khi xóa phiên kiểm định'));
  });
}

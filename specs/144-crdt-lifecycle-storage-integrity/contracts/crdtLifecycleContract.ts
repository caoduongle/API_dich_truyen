/**
 * Contract definitions for CRDT lifecycle, persistence registry, and storage integrity.
 * Feature: 144-crdt-lifecycle-storage-integrity
 */

import type { IndexeddbPersistence } from 'y-indexeddb';
import type { Chapter, StoryProject } from '../../../src/types';
import type { CrdtStateRecord } from '../../../src/types/googleDriveSync';

export interface ICrdtPersistenceRegistry {
  /**
   * Đăng ký instance IndexeddbPersistence đang hoạt động trong session hiện tại.
   */
  registerCrdtPersistence(dbName: string, provider: IndexeddbPersistence): void;

  /**
   * Hủy đăng ký instance IndexeddbPersistence khi hook unmount hoặc đổi chương.
   */
  unregisterCrdtPersistence(dbName: string, provider?: IndexeddbPersistence): void;

  /**
   * Đóng kết nối và giải phóng instance persistence trước khi xóa database vật lý.
   */
  destroyCrdtPersistence(dbName: string): Promise<void>;

  /**
   * Đóng toàn bộ các kết nối persistence đang mở cho một dự án cụ thể.
   */
  destroyAllCrdtPersistencesForProject(projectId: string, knownChapterIds?: string[]): Promise<void>;
}

export type LockOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export interface IStorageIntegrityApi {
  /**
   * Xóa một chapter khỏi CHAPTERS_STORE, CRDT_STATES_STORE và xóa database crdt_${projectId}_${chapterId}.
   * Resolves strictly on transaction.oncomplete.
   */
  deleteChapterFromDB(chapterId: string, projectId?: string): Promise<void>;

  /**
   * Xóa toàn bộ chapters của một project, resolves strictly on transaction.oncomplete.
   */
  deleteChaptersByProjectFromDB(projectId: string): Promise<void>;

  /**
   * Xóa vật lý các database crdt_${projectId}_${chapterId}.
   * Resolves chỉ khi onsuccess fired; reject khi onerror hoặc blocked timeout.
   */
  deleteProjectCrdtDatabases(projectId: string, knownChapterIds?: string[]): Promise<void>;

  /**
   * Lấy toàn bộ CRDT state records thuộc một dự án (phục vụ backup/undo).
   */
  getCrdtStatesByProject(projectId: string): Promise<CrdtStateRecord[]>;

  /**
   * Lưu CRDT state record với cơ chế fail-closed (bỏ qua nếu thiếu projectId).
   */
  saveCrdtState(record: CrdtStateRecord): Promise<void>;

  /**
   * Lưu danh sách CRDT state records với cơ chế fail-closed (lọc bỏ các record thiếu projectId).
   */
  saveCrdtStates(records: CrdtStateRecord[]): Promise<void>;

  /**
   * Lưu nguyên tử project bundle và CRDT states, xác thực nghiêm ngặt projectId.
   */
  atomicSaveProjectBundle(
    project: StoryProject,
    chapters: Chapter[],
    crdtStates?: CrdtStateRecord[]
  ): Promise<void>;
}

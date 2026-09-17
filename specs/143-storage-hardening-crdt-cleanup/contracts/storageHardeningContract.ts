/**
 * Contract: Storage Hardening, CRDT Cleanup & Serialization Interface
 * Feature: 143-storage-hardening-crdt-cleanup
 */

import type { Chapter } from '../../../src/types';

export interface StorageHardeningContract {
  /**
   * Physically deletes all dedicated chapter CRDT databases (crdt_${projectId}_${chapterId})
   * using indexedDB.deleteDatabase and browser database enumeration.
   */
  deleteProjectCrdtDatabases(projectId: string, chapterIds?: string[]): Promise<void>;

  /**
   * Persists a chapter to IndexedDB.
   * Fail-Closed Policy:
   * - Aborts and logs a diagnostic warning if projectId cannot be found or resolved.
   * - Ensures durable write by resolving only upon transaction.oncomplete.
   */
  saveChapterToDB(chapter: Chapter): Promise<void>;

  /**
   * Wraps an asynchronous operation in a Web Lock with retry mechanics.
   * Retries up to 3 times with exponential backoff if lock acquisition rejects.
   */
  withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T>;
}

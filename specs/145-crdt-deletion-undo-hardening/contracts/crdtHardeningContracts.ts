/**
 * Contracts & Interfaces for CRDT Deletion Error Propagation and Undo Integrity Hardening
 */

import { Chapter, StoryProject } from '../../../src/types';

export interface CrdtStateRecord {
  chapterId: string;
  projectId?: string;
  update: Uint8Array;
  updatedAt: number;
}

export interface CrdtPersistenceProvider {
  destroy(): Promise<void> | void;
}

export interface RegisteredPersistenceItem {
  provider: CrdtPersistenceProvider;
  projectId?: string;
  chapterId?: string;
}

/**
 * Persistence Registry Contract
 */
export interface ICrdtPersistenceRegistry {
  register(dbName: string, provider: CrdtPersistenceProvider, projectId?: string, chapterId?: string): void;
  unregister(dbName: string, provider?: CrdtPersistenceProvider): void;
  destroy(dbName: string): Promise<void>;
  destroyAllForProject(projectId: string, knownChapterIds?: string[]): Promise<void>;
  getActiveCount(): number;
  clear(): void;
}

/**
 * Storage Operations Contract
 */
export interface IStorageDeletionService {
  /**
   * Deletes a project and all associated chapters and CRDT databases.
   * MUST reject if CRDT database deletion fails or times out.
   */
  deleteProjectFromDB(id: string): Promise<void>;

  /**
   * Deletes a single chapter and its associated CRDT state and dedicated database.
   * MUST reject if CRDT database deletion fails.
   */
  deleteChapterFromDB(id: string, projectId?: string): Promise<void>;

  /**
   * Deletes all chapters for a project, cleaning up CRDT states and dedicated databases.
   * MUST resolve strictly on transaction.oncomplete and reject on error.
   */
  deleteChaptersByProjectFromDB(projectId: string): Promise<void>;

  /**
   * Deletes dedicated CRDT databases for the given project and chapter IDs.
   * MUST resolve strictly on onsuccess and reject on error or persistent onblocked timeout.
   */
  deleteProjectCrdtDatabases(projectId: string, knownChapterIds?: string[]): Promise<void>;
}

/**
 * Foreign-Key & Storage Validation Contract
 */
export interface IStorageIntegrityGuard {
  /**
   * Saves a chapter while enforcing:
   * 1. Existence of parent project
   * 2. Immutability of chapter's parent projectId (re-parenting prohibited)
   */
  saveChapterToDB(chapter: Chapter): Promise<void>;

  /**
   * Saves a CRDT state while enforcing:
   * 1. Requirement of valid projectId
   * 2. Existence of parent project
   * 3. Association of target chapter to the given projectId
   */
  saveCrdtState(record: CrdtStateRecord): Promise<void>;
}

/**
 * Project Write Queue Contract
 */
export interface IProjectStorageQueue {
  enqueueProjectSave(project: StoryProject): Promise<void>;
  enqueueProjectDelete(id: string): Promise<void>;
  waitForQueueIdle(projectId?: string): Promise<void>;
  resetProjectWriteQueueForTest(): void;
}

/**
 * Project Write Queue & Serialization Boundary Contract
 * Defines strict serialization semantics for all writes across projects, chapters, and CRDT states.
 */

import { Chapter, StoryProject } from '../../../src/types';
import { CrdtStateRecord, CrdtBinaryStateItem } from '../../../src/services/db';

export interface IProjectWriteQueueService {
  /**
   * Serializes project metadata save through project write chain and optional Web Locks
   */
  saveProjectToDB(project: StoryProject): Promise<void>;

  /**
   * Serializes bundle save through project write chain
   */
  atomicSaveProjectBundle(
    project: StoryProject,
    chapters: Chapter[],
    crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]
  ): Promise<void>;

  /**
   * Serializes project deletion, guaranteeing all pending saves finish before project & child records are deleted
   */
  deleteProjectFromDB(id: string): Promise<void>;

  /**
   * Serializes chapter save through the parent project's write chain.
   * If parent project was deleted, aborts cleanly without writing orphan records.
   */
  saveChapterToDB(chapter: Chapter): Promise<void>;

  /**
   * Serializes multiple chapters save through respective project write chains.
   */
  saveChaptersToDB(chapters: Chapter[]): Promise<void>;

  /**
   * Serializes CRDT state save through the parent project's write chain.
   * If parent project was deleted, aborts cleanly.
   */
  saveCrdtState(record: CrdtStateRecord): Promise<void>;

  /**
   * Serializes multiple CRDT states save through respective project write chains.
   */
  saveCrdtStates(records: CrdtStateRecord[]): Promise<void>;

  /**
   * Cross-tab mutual exclusion helper via Web Locks API (falls back in-memory)
   */
  withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T>;

  /**
   * Awaits completion of all active in-flight writes for a specific project or all projects
   */
  waitForProjectWrites(projectId?: string): Promise<void>;

  /**
   * Test utilities for queue introspection and reset
   */
  getProjectWriteChainsSizeForTest(): number;
  resetProjectWriteChainsForTest(): void;
}

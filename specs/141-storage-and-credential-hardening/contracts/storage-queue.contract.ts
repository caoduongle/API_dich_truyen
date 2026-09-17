/**
 * Contract: Project Storage Queue & Atomic Operations
 * Feature: 141-storage-and-credential-hardening
 */

import { StoryProject, Chapter } from '../../../src/types';

export interface IProjectStorageQueue {
  /**
   * Enqueues a project write operation into the per-project write chain.
   * Guarantees serialized execution and cleans up map entry upon completion.
   */
  saveProjectToDB(project: StoryProject): Promise<void>;

  /**
   * Enqueues a project deletion into the per-project write chain.
   * Ensures deletion executes strictly after all prior queued saves for the given projectId,
   * completely eliminating project resurrection race conditions.
   * Cleans up the queue map entry upon completion.
   */
  deleteProjectFromDB(id: string): Promise<void>;

  /**
   * Atomically commits project metadata, chapters, and CRDT states in a single IDBTransaction.
   * Serialized in the per-project write chain.
   */
  atomicSaveProjectBundle(
    project: StoryProject,
    chapters: Chapter[],
    crdtStates?: any[]
  ): Promise<void>;

  /**
   * Waits for pending writes for a specific project or all projects to resolve.
   */
  waitForProjectWrites(projectId?: string): Promise<void>;
}

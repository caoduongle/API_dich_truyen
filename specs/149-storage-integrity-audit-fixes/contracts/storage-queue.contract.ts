/**
 * Storage Write Queue Contract
 * Defines the public boundary for project serialization operations.
 */

import type { StoryProject } from '../../../src/types';

export interface StorageQueueService {
  /**
   * Enqueues a project save operation in strict FIFO order for the project.
   * Execution of saveProjectToDB must be sequenced lazily.
   */
  enqueueProjectSave(project: StoryProject): Promise<void>;

  /**
   * Enqueues a project deletion operation in strict FIFO order for the project.
   * Ensures pending saves complete before the project is deleted.
   */
  enqueueProjectDelete(id: string): Promise<void>;

  /**
   * Waits for all active queued writes to settle.
   * If projectId is provided, waits for that project's write chain.
   * If omitted, waits for all active project write chains across the system.
   */
  waitForQueueIdle(projectId?: string): Promise<void>;

  /**
   * Executes an action inside an exclusive section for the given project,
   * guaranteeing no concurrent writes interleave.
   */
  runInProjectExclusiveSection<T>(projectId: string, action: () => Promise<T>): Promise<T>;
}

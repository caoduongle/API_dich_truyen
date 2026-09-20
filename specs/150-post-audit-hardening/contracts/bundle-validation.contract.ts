/**
 * Contract: Database Write Bundle Validation
 * Distinguishes in-memory input structural integrity from in-transaction stored state ownership.
 */

import type { StoryProject, Chapter } from '../../../src/types';
import type { CrdtBinaryStateItem } from '../../../src/services/db';
import type { CrdtStateRecord } from '../../../src/types/googleDriveSync';

export interface BundleValidator {
  /**
   * In-memory invariant check executed BEFORE acquiring IndexedDB transaction locks.
   * Validates that all CRDT states correspond to valid chapters present in the incoming bundle
   * and that chapter project references match the bundle project ID.
   * Throws Error on invariant failure.
   */
  validateBundleInput(
    project: StoryProject,
    chapters: Chapter[],
    crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]
  ): void;

  /**
   * In-transaction invariant guard executed inside an active IDB readwrite transaction.
   * Reads stored chapter records to assert existing records are not re-parented across projects.
   * Throws Error on relational integrity violation.
   */
  assertChapterOwnership(
    existing: Chapter | undefined,
    incomingProjectId: string,
    chapterId: string
  ): void;
}

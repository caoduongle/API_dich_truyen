/**
 * Contract: CRDT Storage Lifecycle Recovery and Invariant Hardening
 * Feature: 146-crdt-storage-lifecycle-recovery
 */

import { Chapter, StoryProject } from '../../../src/types';
import { CrdtStateRecord } from '../../../src/types/googleDriveSync';

export interface DeletionManifestRecord {
  id: string;
  projectId: string;
  chapterIds: string[];
  physicalDbNames: string[];
  createdAt: string;
  status: 'pending' | 'completed';
}

/**
 * 1. Durable Deletion Manifest & Recovery Worker Contract
 */
export interface IDeletionManifestManager {
  /**
   * Persists a durable deletion manifest in the DELETION_MANIFESTS_STORE prior to destructive deletion.
   */
  recordPendingDeletion(manifest: DeletionManifestRecord): Promise<void>;

  /**
   * Removes or marks a deletion manifest complete after all physical databases are confirmed deleted.
   */
  removeDeletionManifest(id: string): Promise<void>;

  /**
   * Retrieves all currently pending deletion manifests from storage.
   */
  getPendingDeletionManifests(): Promise<DeletionManifestRecord[]>;

  /**
   * Scans pending deletion manifests and executes physical database cleanup.
   * Called during application bootstrap and DB initialization.
   */
  recoverPendingDeletions(): Promise<{ recoveredCount: number; failedCount: number }>;
}

/**
 * 2. Exclusive Project Critical Section Contract
 */
export interface IExclusiveProjectSection {
  /**
   * Executes an action within the project's serialized write chain without allowing
   * intervening saves between snapshot capture and deletion execution.
   */
  runInProjectExclusiveSection<T>(projectId: string, action: () => Promise<T>): Promise<T>;
}

/**
 * 3. Strict Fail-Closed Relational Integrity Contract
 */
export interface IStrictRelationalIntegrityGuard {
  /**
   * Saves a chapter while enforcing:
   * 1. Immutability of chapter's parent projectId (MUST reject if existing.projectId !== incoming.projectId).
   * 2. Transaction abort on violation (silent write drop prohibited).
   */
  saveChapterToDB(chapter: Chapter): Promise<void>;

  /**
   * Saves chapters in batch with strict rejection on any ownership conflict.
   */
  saveChaptersToDB(chapters: Chapter[]): Promise<void>;

  /**
   * Saves a CRDT state while enforcing:
   * 1. Existence of parent chapter in primary catalog (MUST reject if !chapter).
   * 2. Association of target chapter to record.projectId (MUST reject on mismatch).
   * 3. Transaction abort on violation.
   */
  saveCrdtState(record: CrdtStateRecord): Promise<void>;

  /**
   * Batch version of saveCrdtState enforcing chapter existence and project matching per record.
   */
  saveCrdtStates(records: CrdtStateRecord[]): Promise<void>;
}

/**
 * 4. Canonical Chapter Deletion Contract
 */
export interface ICanonicalChapterDeletion {
  /**
   * Deletes a chapter while resolving and validating canonical projectId:
   * - If supplied projectId does not match stored chapter's projectId, MUST reject.
   * - If projectId omitted, MUST resolve canonical projectId from storage.
   */
  deleteChapterFromDB(id: string, projectId?: string): Promise<void>;
}

/**
 * 5. Hydration Project Ownership Contract
 */
export interface ICrdtHydrationGuard {
  /**
   * Queries CRDT state snapshot with optional projectId enforcement.
   */
  getCrdtState(chapterId: string, expectedProjectId?: string): Promise<CrdtStateRecord | null>;
}

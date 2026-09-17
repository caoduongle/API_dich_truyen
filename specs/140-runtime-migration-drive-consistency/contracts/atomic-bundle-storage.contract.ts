/**
 * Contract: Atomic Project Bundle Storage & Unified Serialization Queue
 * Feature: 140-runtime-migration-drive-consistency
 */

import { StoryProject, Chapter } from '../../../src/types';

export interface CrdtBinaryStateItem {
  chapterId: string;
  state: Uint8Array;
}

export interface IAtomicBundleStorage {
  /**
   * Lưu trữ đồng thời và nguyên tử metadata dự án, toàn bộ chương và các trạng thái CRDT.
   * Chạy trên một IDBTransaction duy nhất trên các stores ['projects', 'chapters', 'crdt_docs'].
   * Được tuần tự hóa theo từng `projectId` trong hàng đợi ghi Promise Chain.
   */
  atomicSaveProjectBundle(
    project: StoryProject,
    chapters: Chapter[],
    crdtStates?: CrdtBinaryStateItem[]
  ): Promise<void>;

  /**
   * Lưu dự án đơn lẻ có hàng đợi tuần tự hóa FIFO theo `projectId`.
   */
  saveProjectToDB(project: StoryProject): Promise<void>;

  /**
   * Ủy quyền lưu dự án từ UI hooks tới hàng đợi tuần tự hóa duy nhất của saveProjectToDB.
   */
  enqueueProjectSave(project: StoryProject): Promise<void>;
}

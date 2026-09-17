/**
 * Project Storage Write Queue
 * Quản lý hàng đợi ghi tuần tự cho các thao tác lưu dự án vào IndexedDB.
 * Ủy quyền trực tiếp tới saveProjectToDB (được tuần tự hóa per-projectId qua projectWriteChains trong db.ts).
 */

import { StoryProject } from '../types';
import { saveProjectToDB, waitForProjectWrites, resetProjectWriteChainsForTest } from './db';

let writeChain: Promise<void> = Promise.resolve();

/**
 * Đưa tác vụ lưu dự án vào hàng đợi ghi tuần tự.
 * Ủy quyền trực tiếp tới saveProjectToDB để thống nhất với serialization queue của Drive sync.
 */
export function enqueueProjectSave(project: StoryProject): Promise<void> {
  const savePromise = saveProjectToDB(project);
  writeChain = writeChain
    .catch(() => {})
    .then(() => savePromise)
    .catch(() => {});
  return savePromise;
}

/**
 * Chờ cho tất cả các tác vụ ghi trong hàng đợi hiện tại hoàn tất.
 * Phục vụ cho kiểm thử và đồng bộ trước khi đóng/chuyển trang.
 */
export function waitForQueueIdle(projectId?: string): Promise<void> {
  return Promise.all([writeChain.catch(() => {}), waitForProjectWrites(projectId)]).then(() => {});
}

/**
 * Đặt lại hàng đợi (chỉ dùng cho môi trường kiểm thử unit tests).
 */
export function resetProjectWriteQueueForTest(): void {
  writeChain = Promise.resolve();
  resetProjectWriteChainsForTest();
}

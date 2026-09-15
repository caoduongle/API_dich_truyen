/**
 * Contract: Project Storage Write Serialization
 * Định nghĩa ranh giới tuần tự hóa cho mọi thao tác ghi dữ liệu dự án vào IndexedDB
 */

import type { StoryProject } from '../../../src/types';

export interface IProjectStorageQueue {
  /**
   * Xếp một thao tác lưu dự án vào hàng đợi tuần tự hóa của dự án đó
   * Đảm bảo các tác vụ trên cùng một projectId được thực thi nối tiếp theo thứ tự FIFO
   */
  enqueueProjectSave(project: StoryProject): Promise<void>;

  /**
   * Xóa hàng đợi của một dự án (phục vụ dọn dẹp hoặc kiểm thử)
   */
  clearProjectQueue?(projectId: string): void;

  /**
   * Kiểm tra xem một dự án hiện có tác vụ ghi đang chờ xử lý hay không
   */
  isProjectQueuePending?(projectId: string): boolean;
}

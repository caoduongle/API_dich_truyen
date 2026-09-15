/**
 * Contract: Project Write Queue
 * Định nghĩa giao diện tuần tự hóa các tác vụ ghi dự án vào IndexedDB
 */

import { StoryProject } from '../../../src/types';

export interface IProjectStorageQueue {
  /**
   * Đưa tác vụ lưu dự án vào hàng đợi tuần tự.
   * Đảm bảo các lần ghi được cam kết theo đúng thứ tự FIFO.
   */
  enqueueProjectSave(project: StoryProject): Promise<void>;

  /**
   * Chờ toàn bộ các tác vụ ghi đang chờ trong hàng đợi hoàn thành (dùng cho kiểm thử hoặc flush trước đóng trang).
   */
  waitForQueueIdle(): Promise<void>;
}

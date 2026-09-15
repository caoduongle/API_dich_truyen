/**
 * Project Storage Write Queue
 * Quản lý hàng đợi ghi tuần tự (FIFO) cho các thao tác lưu dự án vào IndexedDB
 * Ngăn chặn race condition khi người dùng thêm/sửa cẩm nang hoặc cập nhật nhanh liên tiếp
 */

import { StoryProject } from '../types';
import { saveProjectToDB } from './db';

let writeChain: Promise<void> = Promise.resolve();

/**
 * Đưa tác vụ lưu dự án vào hàng đợi ghi tuần tự.
 * Đảm bảo các lần ghi vào IndexedDB được thực hiện nối tiếp nhau theo thứ tự gọi (FIFO).
 */
export function enqueueProjectSave(project: StoryProject): Promise<void> {
  writeChain = writeChain
    .catch(() => {
      // Đảm bảo lỗi từ tác vụ ghi trước không làm đứt chuỗi cho các tác vụ ghi tiếp theo
    })
    .then(async () => {
      await saveProjectToDB(project);
    });

  return writeChain;
}

/**
 * Chờ cho tất cả các tác vụ ghi trong hàng đợi hiện tại hoàn tất.
 * Phục vụ cho kiểm thử và đồng bộ trước khi đóng/chuyển trang.
 */
export function waitForQueueIdle(): Promise<void> {
  return writeChain.catch(() => {});
}

/**
 * Đặt lại hàng đợi (chỉ dùng cho môi trường kiểm thử unit tests).
 */
export function resetProjectWriteQueueForTest(): void {
  writeChain = Promise.resolve();
}

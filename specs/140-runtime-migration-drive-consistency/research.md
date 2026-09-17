# Technical Research: Kích Hoạt Di Trú Hạn Mức Runtime, Nhất Quán Lưu Trữ Drive & Phân Đoạn Theo Ngân Sách Token (140-runtime-migration-drive-consistency)

**Feature**: `140-runtime-migration-drive-consistency`  
**Date**: 2026-09-15  
**Spec**: [spec.md](./spec.md)

---

## Nghiên Cứu 1: Kích Hoạt Di Trú Custom Limits Trong Runtime Lifecycle

### Vấn Đề
Thuật toán `migrateCustomLimits(apiKeys: string[])` trong `src/utils/customLimitsStorage.ts` đã được cài đặt và kiểm thử đơn vị độc lập. Tuy nhiên, nếu một module đọc `getStoredCustomLimits()` trước khi hàm di trú được kích hoạt với danh sách khóa đang hoạt động, cấu hình cá nhân `maxRpd` của người dùng nâng cấp từ bản cũ (lưu dưới chuỗi hex lặp 8 ký tự của hash 32-bit) sẽ không thể tìm thấy dưới mã băm SHA-256 mới.

### Phân Tích Các Phương Án Kích Hoạt
1. **Phương án A**: Chỉ gọi trong `useAIConfig.ts` khi người dùng mở giao diện Cài đặt API.
   - *Hạn chế*: Nếu người dùng vào thẳng trang Dịch truyện mà không mở Cài đặt, di trú chưa được kích hoạt.
2. **Phương án B**: Chỉ gọi trong `initKeySchedule()` của `geminiKeyScheduler.ts`.
   - *Hạn chế*: Bảng điều khiển Quota hiển thị trước khi dịch có thể vẫn đọc cấu hình cũ nếu chưa khởi tạo scheduler.
3. **Phương án C (Lựa chọn tối ưu - Defense in Depth)**:
   - Tích hợp tại 3 điểm chốt chặn then chốt:
     - **Điểm 1 - Khởi động / Nạp khóa**: Trong [`migrateAndLoadApiKeys()`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useAIConfig.ts#L27), ngay sau khi đọc được danh sách `cleanKeys` từ `sessionStorage` hoặc `localStorage`, lập tức gọi `migrateCustomLimits(cleanKeys)`.
     - **Điểm 2 - Scheduler Initialization**: Trong [`initKeySchedule(apiKeys)`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/gemini/geminiKeyScheduler.ts#L17), gọi `migrateCustomLimits(rawKeys)` ngay trước khi gán `customLimits = getStoredCustomLimits()`.
     - **Điểm 3 - Tự động di trú tại hàm đọc**: Bổ sung tham số tùy chọn `getStoredCustomLimits(apiKeys?: string[])`, tự động thực thi di trú nếu `apiKeys` được truyền vào.

### Quyết Định Kỹ Thuật
- Áp dụng Phương án C.
- Kết quả: 100% các luồng nạp khóa và tra cứu hạn ngạch đều được bảo vệ, triệt tiêu hoàn toàn nguy cơ cấu hình hạn mức cá nhân bị bỏ sót.

---

## Nghiên Cứu 2: Hợp Nhất Ranh Giới Tuần Tự Hóa & Giao Dịch Nguyên Tử Cho Google Drive Bundle Pull

### Vấn Đề
1. **Phân mảnh hàng đợi ghi dự án**: UI sử dụng `enqueueProjectSave()` (`projectStorageQueue.ts`), trong khi Google Drive sync gọi trực tiếp `saveProjectToDB()`. Dù `saveProjectToDB()` đã có Promise chain nội tại, sự tồn tại của hai hàng đợi độc lập có thể tạo ra độ trễ hoặc xung đột thứ tự.
2. **Nguy cơ Partial-Commit khi pull bundle**: Trong [`pullBundle()`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/google-drive/driveBundleSync.ts#L225), ba thao tác ghi được thực hiện nối tiếp qua 3 transaction IndexedDB riêng biệt:
   ```ts
   await saveChaptersToDB(chaptersToSave);
   await saveCrdtStates(crdtStatesToSave);
   await saveProjectToDB(mergedProject);
   ```
   Nếu `saveProjectToDB()` gặp lỗi (ví dụ QuotaExceededError hoặc ngắt tab), các chương mới đã được lưu nhưng metadata của dự án (danh sách `project.chapters`) không được cập nhật, khiến dữ liệu bị mồ côi hoặc không hiển thị trên giao diện.

### Giải Pháp Kiến Trúc
1. **Hợp nhất hàng đợi ghi**:
   - Chuyển `enqueueProjectSave(project)` trong `src/services/projectStorageQueue.ts` thành hàm chuyển tiếp (forwarder) gọi trực tiếp `saveProjectToDB(project)`.
   - Toàn bộ ứng dụng (UI hooks và Google Drive) quy tụ về một điểm serialization duy nhất là `projectWriteQueue` theo `projectId` trong `src/services/db.ts`.
2. **Giao dịch đa Store nguyên tử (Atomic Multi-Store Transaction)**:
   - Tận dụng tính năng chuẩn của IndexedDB API: một transaction có thể mở đồng thời trên nhiều object stores:
     ```ts
     const tx = db.transaction(['projects', 'chapters', 'crdt_docs'], 'readwrite');
     ```
   - Xây dựng hàm `atomicSaveProjectBundle(project, chapters, crdtStates)` trong `src/services/db.ts`:
     - Ghi đồng thời project vào store `projects`, toàn bộ chapters vào store `chapters`, và crdtStates vào store `crdt_docs`.
     - Nếu bất kỳ thao tác `put` nào thất bại, transaction tự động `abort()`, toàn bộ dữ liệu trong IndexedDB quay về trạng thái trước khi pull.
     - Hàm này cũng được xếp vào `projectWriteQueue.get(project.id)` để bảo đảm tính tuần tự với các thao tác ghi khác của cùng dự án.

---

## Nghiên Cứu 3: Thuật Toán Phân Đoạn Song Ngữ Gom Lũy Kế Token (Greedy Accumulative Packing)

### Vấn Đề
Thuật toán hiện tại tính `targetParts = Math.ceil(totalTokens / maxTokensPerChunk)` rồi chia đều theo số lượng đoạn văn:
$$\text{partIndex} = \text{round}\left(\frac{i \times \text{paragraphsCount}}{\text{targetParts}}\right)$$
Nếu một đoạn văn có kích thước 1800 tokens trong khi các đoạn khác chỉ 100 tokens, cách chia đều số đoạn văn có thể đẩy đoạn 1800 tokens vào chung một chunk với các đoạn khác, khiến chunk đó vượt xa `maxTokensPerChunk`.

### Giải Pháp Thuật Toán: Gom Lũy Kế (Accumulative Packing)
1. **Bước 1**: Tách danh sách đoạn văn nguồn ($S_1, S_2, \dots, S_n$) và thô ($R_1, R_2, \dots, R_m$).
2. **Bước 2**: Tính toán kích thước token cho từng đoạn văn nguồn bằng `estimateTokenCount(S_i)` và đoạn thô bằng `estimateTokenCount(R_i)`. Trọng số token của cặp đoạn là $\max(\text{token}(S_i), \text{token}(R_j))$.
3. **Bước 3 - Gom nhóm thông minh**:
   - Khởi tạo chunk đầu tiên.
   - Duyệt lần lượt qua các đoạn văn. Nếu việc thêm đoạn văn tiếp theo khiến tổng token của chunk vượt quá `maxTokensPerChunk`:
     - Nếu chunk hiện tại đã có ít nhất 1 đoạn: đóng chunk hiện tại và mở chunk mới.
     - Nếu chunk hiện tại chưa có đoạn nào (bản thân đoạn văn đơn lẻ đã $> maxTokensPerChunk$): đưa trọn vẹn đoạn văn này vào chunk và đóng lại ngay để bảo vệ ranh giới đoạn văn (không cắt ngang).
4. **Bước 4 - Ánh xạ song ngữ**:
   - Ánh xạ tỷ lệ ranh giới đoạn văn giữa hai ngôn ngữ dựa trên vị trí phần trăm $[0, 1]$ tương đối trong văn bản.
   - Kẹp an toàn (`Math.max(start + 1, end)`) để bảo đảm mỗi chunk luôn có ít nhất một đoạn văn trọn vẹn ở cả hai ngôn ngữ.

### Đánh Giá Tính Tương Thích Ngược
- Nếu không truyền `maxTokensPerChunk`, hàm tiếp tục hoạt động theo chữ ký positional hoặc chia theo `targetParts` như cũ.
- Toàn bộ 9 tests hiện có trong `bilingualSplit.test.ts` tiếp tục pass 100%.

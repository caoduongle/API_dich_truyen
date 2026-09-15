# Phase 0 Research: Gia Cố Ngữ Nghĩa Trạng Thái, Chỉ Số Vòng Đời & Toàn Vẹn Lưu Trữ

**Feature**: `139-state-semantics-storage-hardening`  
**Date**: 2026-09-15  
**Spec**: [spec.md](./spec.md)

---

## 1. Nghiên Cứu Vòng Đời Yêu Cầu Logic & Thất Bại Tổng Thể (`failedRequestsTotal/Today`)

### Vấn đề
Trong kiến trúc xoay vòng khóa API (Key Rotation), một yêu cầu logic từ người dùng (`logicalRequest`) có thể thực hiện nhiều lượt thử tới nhà cung cấp (`providerAttempts`).
Ví dụ:
```text
Logical Request #1 (Dịch đoạn văn)
  ├── Attempt #1 (Key A) -> 429 Rate Limit (recordFailure)
  ├── Attempt #2 (Key B) -> 503 Overload   (recordFailure)
  └── Attempt #3 (Key C) -> 200 OK         (recordSuccess)
=> Kết quả: logicalRequestsTotal: 1, successfulRequestsTotal: 1, failedRequestsTotal: 0
             providerAttemptsTotal: 3, failedAttemptsTotal: 2, successfulAttemptsTotal: 1
```
Tuy nhiên, nếu Attempt #3 cũng thất bại hoặc gặp lỗi nghiêm trọng (hết toàn bộ keys, lỗi mạng toàn diện):
Hiện tại `localQuotaTracker.recordFailure()` chỉ tăng `failedAttemptsTotal/Today`, còn `failedRequestsTotal/Today` không bao giờ được tăng ở bất kỳ đâu trong codebase, khiến metric này luôn bằng 0.

### Quyết định (Decision)
1. Thêm phương thức `recordLogicalFailure(now?: number)` vào `LocalQuotaTracker`:
   - Tăng `this.summaryStats.failedRequestsTotal++`.
   - Tăng `this.summaryStats.failedRequestsToday++`.
   - Lưu trạng thái vào `sessionStorage`.
2. Trong `geminiClient.ts`:
   - Khi luồng xử lý quyết định ném lỗi ra ngoài (`throw lastError`, `throw quotaErr`, v.v.) sau khi đã thử hết keys hoặc gặp lỗi không thể cứu vãn:
     Gọi `localQuotaTracker.recordLogicalFailure()`.
   - Bảo đảm chỉ gọi đúng 1 lần cho mỗi yêu cầu logic thất bại (thông qua cờ `logicalFailureRecorded`).

### Giải pháp thay thế đã xem xét (Alternatives Considered)
- *Tự động tăng `failedRequestsTotal` trong `recordFailure` khi `attemptsCount === rawKeys.length - 1`*: Bị loại vì logic quyết định kết thúc một logical request nằm ở client điều phối (`geminiClient`), không phải ở tầng tracker bị động. Tracker không biết trước liệu caller có còn danh sách keys dự phòng nào khác hay không.

---

## 2. Nghiên Cứu Tách Bạch Bộ Đếm Thử Lại (`retriesTotal`) Khỏi Thất Bại Provider

### Vấn đề
Trong `localQuotaTracker.recordFailure()`, code hiện tại luôn thực hiện:
```ts
this.summaryStats.retriesTotal++;
this.summaryStats.retriesToday++;
```
Điều này sai lệch nghiêm trọng vì:
- Các lỗi 400 (Bad Request), 401/403 (AuthFailed) không bao giờ được retry nhưng vẫn bị đếm là retry.
- Lượt thất bại ở key cuối cùng (khi hết key để rotate) cũng bị tính là retry dù thực tế không có lần retry nào diễn ra.

### Quyết định (Decision)
1. Xóa bỏ dòng tăng `retriesTotal++` và `retriesToday++` khỏi `recordFailure()`.
2. Bổ sung phương thức `recordRetry(key?: string, now?: number)` trong `LocalQuotaTracker`:
   - Tăng `summaryStats.retriesTotal++` và `summaryStats.retriesToday++`.
   - Tăng `keyStats.retriesTotal++` và `keyStats.retriesToday++` cho key cụ thể (nếu có).
3. Trong `geminiClient.ts`:
   - Chỉ gọi `localQuotaTracker.recordRetry(currentKey)` khi:
     - Phát hiện lỗi có thể retry/rotate (`isRateLimitOrOverload` hoặc lỗi mạng thử lại được).
     - Tìm được key tiếp theo hợp lệ (`nextIdx !== -1`).
     - Chuẩn bị bước vào vòng lặp tiếp theo (`currentKeyIdx = nextIdx; attemptsCount++; continue;`).

---

## 3. Nghiên Cứu Ranh Giới Tuần Tự Hóa Lưu Trữ Dự Án (`saveProjectToDB`)

### Vấn đề
Hàng đợi `projectStorageQueue.ts` trước đó đã được tạo và áp dụng cho `useProjects.ts`.
Tuy nhiên, các file đồng bộ Google Drive:
- `src/services/google-drive/driveBundleSync.ts`
- `src/services/google-drive/driveProjectSync.ts`
- `src/services/google-drive/driveGranularSync.ts`
và một số nhánh trong `useProjects.ts` vẫn gọi trực tiếp `saveProjectToDB(...)`.
Hệ quả: Tác vụ ghi từ Drive sync ngầm và tác vụ ghi từ UI chạy song song trên 2 kênh khác nhau, không chung một hàng đợi, tạo nguy cơ ghi đè snapshot cũ lên snapshot mới.

### Quyết định (Decision)
Đưa serialization xuống ngay bên trong `saveProjectToDB()` tại `src/services/db.ts`:
1. Sử dụng một Map quản lý Promise Chain theo từng `projectId`:
   ```ts
   const projectSaveQueues = new Map<string, Promise<void>>();
   ```
2. Khi `saveProjectToDB(project)` được gọi:
   - Xác định `projectId = project.id`.
   - Nối tiếp tác vụ ghi vào promise chain của `projectId` đó.
   - Thao tác ghi thực tế với IndexedDB chỉ bắt đầu khi tác vụ trước đó hoàn tất.
   - Bắt lỗi an toàn (`.catch()`) để một lỗi ghi không làm nghẽn vĩnh viễn các tác vụ ghi tiếp theo.
3. `projectStorageQueue.ts` có thể giữ lại như một facade mỏng gọi tới `saveProjectToDB` để giữ tương thích ngược 100% với các test hiện có, trong khi bản thân `saveProjectToDB` trở thành chốt chặn an toàn cho **toàn bộ callers** trong codebase.

### Giải pháp thay thế đã xem xét (Alternatives Considered)
- *Import và bọc `enqueueProjectSave` trong từng file Drive Sync*: Bị loại vì dễ bỏ sót các caller mới trong tương lai. Đưa serialization vào chính `saveProjectToDB` đảm bảo bất biến kiến trúc (architectural invariant) ở mức cơ sở dữ liệu.

---

## 4. Nghiên Cứu Cơ Chế Di Trú Mã Băm Khóa API (Migration Legacy Hash -> SHA-256)

### Vấn đề
Trước phiên bản 138, trên môi trường trình duyệt:
- Thuật toán băm là băm số nguyên 32-bit (hex 8 ký tự lặp 8 lần hoặc chuỗi ngắn).
- Bản ghi `localStorage['gemini_quota_custom_limits']` và `sessionStorage['gemini_local_quota_tracker_v1']` sử dụng mã băm cũ này làm key.
- Khi nâng cấp sang SHA-256 (64 hex characters), hàm `hashApiKey(key)` sinh ra chuỗi khác hoàn toàn, dẫn đến `customLimits[keyHash]` không tìm thấy cấu hình cũ của người dùng.

### Quyết định (Decision)
1. Trong `src/utils/customLimitsStorage.ts`:
   - Định nghĩa hàm `legacyHashApiKey(key: string): string` tái hiện chính xác thuật toán 32-bit cũ:
     ```ts
     export function legacyHashApiKey(key: string): string {
       if (!key) return '';
       const trimmed = key.trim();
       let hash = 0;
       for (let i = 0; i < trimmed.length; i++) {
         hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
         hash |= 0;
       }
       return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
     }
     ```
   - Cung cấp hàm `migrateCustomLimits(apiKeys: string[]): { migratedCount: number }`:
     - Nạp `getStoredCustomLimits()`.
     - Với mỗi key trong `apiKeys`:
       - Tính `oldHash = legacyHashApiKey(key)`.
       - Tính `newHash = hashApiKey(key)`.
       - Nếu tồn tại `customLimits[oldHash]` và chưa có `customLimits[newHash]`:
         Gán `customLimits[newHash] = customLimits[oldHash]`, xóa `customLimits[oldHash]`.
     - Lưu lại cấu hình vào `localStorage`.
2. Trong `LocalQuotaTracker.loadFromStorage()`:
   - Tương tự, nếu `keyStats` chứa `keyHash` có dạng legacy hash (khác 64 hex characters hoặc khớp với legacy hash của active keys), tự động di trú sang SHA-256 tương ứng khi nhận danh sách keys.

---

## 5. Nghiên Cứu Đồng Bộ Hóa Hợp Đồng & Runtime Phân Đoạn Song Ngữ

### Vấn đề
Interface `BilingualSplitOptions` đã được khai báo trong `src/services/translation/types.ts`:
```ts
export interface BilingualSplitOptions {
  sourceText: string;
  rawText: string;
  targetParts?: number;
  maxTokensPerChunk?: number;
}
```
Hợp đồng `IBilingualSplitter` nằm trong specs `137-pipeline-stabilization-refactor`.
Hàm `splitBilingualAdaptively` trong `bilingualSplit.ts` cần đảm bảo:
- Hỗ trợ đầy đủ cả 2 chữ ký nạp chồng (overload): Dạng object options và dạng positional arguments.
- Xử lý chính xác logic `maxTokensPerChunk`: Nếu `maxTokensPerChunk` được truyền và ước tính token của văn bản nguồn vượt quá ngưỡng này, tự động nâng `targetParts = Math.max(targetParts, Math.ceil(estSourceTokens / maxTokensPerChunk))` mà không làm vỡ các khối đoạn văn hoàn chỉnh.
- Xuất khẩu chính thức interface `IBilingualSplitter` trong `src/services/translation/types.ts` và export adapter hoặc implementation trực tiếp.

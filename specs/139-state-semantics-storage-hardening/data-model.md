# Phase 1 Data Model: Gia Cố Ngữ Nghĩa Trạng Thái, Chỉ Số Vòng Đời & Toàn Vẹn Lưu Trữ

**Feature**: `139-state-semantics-storage-hardening`  
**Date**: 2026-09-15  
**Spec**: [spec.md](./spec.md)

---

## 1. Thực Thể Chỉ Số Thống Kê Vòng Đời Yêu Cầu (`LogicalSummaryStats`)

Đại diện cho tổng hợp số liệu đo lường ở cấp độ yêu cầu logic của người dùng và các lượt thử thực tế tới nhà cung cấp API:

```typescript
export interface LogicalSummaryStats {
  // Chỉ số cấp Yêu Cầu Logic (Logical Request)
  logicalRequestsTotal: number;       // Tổng số yêu cầu logic đã gửi
  logicalRequestsToday: number;       // Số yêu cầu logic trong ngày (PST)
  successfulRequestsTotal: number;    // Số yêu cầu logic thành công hoàn toàn
  successfulRequestsToday: number;    // Số yêu cầu logic thành công trong ngày
  failedRequestsTotal: number;        // Số yêu cầu logic thất bại hoàn toàn (sau khi thử hết keys/lỗi dứt điểm)
  failedRequestsToday: number;        // Số yêu cầu logic thất bại trong ngày
  retriesTotal: number;               // Tổng số lần thực sự xoay tua hoặc thử lại (retry/rotate)
  retriesToday: number;               // Số lần thử lại trong ngày

  // Chỉ số cấp Lượt Thử Nhà Cung Cấp (Provider Attempts)
  providerAttemptsTotal: number;      // Tổng số cuộc gọi HTTP gửi tới Gemini
  providerAttemptsToday: number;      // Số cuộc gọi HTTP trong ngày
  successfulAttemptsTotal: number;    // Số cuộc gọi HTTP nhận phản hồi 200 OK
  successfulAttemptsToday: number;    // Số cuộc gọi HTTP 200 OK trong ngày
  failedAttemptsTotal: number;        // Số cuộc gọi HTTP lỗi (4xx, 5xx, mạng)
  failedAttemptsToday: number;        // Số cuộc gọi HTTP lỗi trong ngày

  lastResetDay: string;               // Ngày định dạng YYYY-MM-DD theo giờ Los Angeles (PST)
}
```

### Quy Tắc Chuyển Đổi Trạng Thái & Ràng Buộc Bất Biến (Invariants):
1. `logicalRequestsTotal = successfulRequestsTotal + failedRequestsTotal + [requestsInFlight]`
2. `providerAttemptsTotal = successfulAttemptsTotal + failedAttemptsTotal`
3. `providerAttemptsTotal >= logicalRequestsTotal` (vì 1 logical request có thể thử nhiều lần qua nhiều khóa)
4. Mỗi lần gọi `recordLogicalRequest()` tăng `logicalRequestsTotal` và `logicalRequestsToday`.
5. Mỗi lần gọi `recordSuccess()` khi yêu cầu kết thúc tăng `successfulRequestsTotal` và `successfulRequestsToday`.
6. Mỗi lần gọi `recordLogicalFailure()` khi yêu cầu kết thúc thất bại tăng `failedRequestsTotal` và `failedRequestsToday`.
7. Mỗi lần gọi `recordRetry()` khi xoay sang khóa mới hoặc thử lại tăng `retriesTotal` và `retriesToday`.
8. Gọi `recordFailure()` chỉ tăng `failedAttemptsTotal` và `failedAttemptsToday`, **KHÔNG** làm tăng `retriesTotal` hay `failedRequestsTotal`.

---

## 2. Thực Thể Hàng Đợi Tuần Tự Hóa Lưu Trữ Dự Án (`ProjectWriteQueue`)

Quản lý chuỗi Promise Chain theo từng `projectId` trong `src/services/db.ts`:

```typescript
export interface ProjectWriteTask {
  projectId: string;
  project: StoryProject;
  queuedAt: number;
}

// Cấu trúc nội tại quản lý hàng đợi ghi:
type ProjectPromiseChainMap = Map<string, Promise<void>>;
```

### Cơ chế vận hành:
- Mỗi khi `saveProjectToDB(project)` được gọi:
  ```text
  Lấy Promise hiện tại của project.id (hoặc Promise.resolve() nếu chưa có).
  Tạo Promise mới = currentPromise.then(() => performActualSave(project)).catch(...)
  Cập nhật Map với Promise mới.
  Trả về Promise mới cho caller.
  ```
- Đảm bảo tính độc lập: Các dự án có `projectId` khác nhau được ghi đồng thời (không block lẫn nhau). Các thao tác cùng `projectId` luôn thực thi tuần tự 100%.

---

## 3. Thực Thể Di Trú Cấu Hình Hạn Mức Tùy Chỉnh (`CustomLimitMigration`)

Mô tả cấu trúc dữ liệu cấu hình hạn mức và kết quả di trú:

```typescript
export interface CustomLimit {
  maxRpd?: number;
  maxRpm?: number;
  maxTpm?: number;
}

export interface CustomLimitMigrationResult {
  migratedCount: number;
  legacyCount: number;
  currentCount: number;
  migratedKeys: string[];
}
```

### Quy Tắc Di Trú:
1. Phát hiện mã băm cũ:
   - Thuật toán cũ sinh chuỗi có độ dài khác 64 hex hoặc trùng khớp với `legacyHashApiKey(key)`.
2. Khớp mã:
   - Với mỗi key trong danh sách API keys hoạt động:
     - `oldHash = legacyHashApiKey(key)`
     - `newHash = hashApiKey(key)`
     - Nếu `storage[oldHash]` tồn tại, sao chép sang `storage[newHash]` và xóa mục `storage[oldHash]`.
3. Tính bảo toàn: Nếu không tìm thấy key gốc tương ứng, bản ghi cũ được giữ nguyên trong lưu trữ dự phòng, không bị xóa bỏ vô cớ.

---

## 4. Thực Thể Cấu Hình Phân Đoạn Song Ngữ (`BilingualSplitOptions`)

```typescript
export interface BilingualSplitOptions {
  sourceText: string;
  rawText: string;
  targetParts?: number;
  maxTokensPerChunk?: number;
}

export interface TranslationChunk {
  chunkIndex: number;
  totalChunks: number;
  sourceText: string;
  rawText: string;
  sourceParagraphRange: {
    start: number;
    end: number;
  };
  rawParagraphRange: {
    start: number;
    end: number;
  };
  estimatedTokens: number;
}
```

### Quy Tắc Tính Toán:
1. `cleanSource = sourceText.trim()`, `cleanRaw = rawText.trim()`.
2. Nếu `maxTokensPerChunk > 0` và `estSourceTokens > maxTokensPerChunk`:
   `targetParts = Math.max(targetParts, Math.ceil(estSourceTokens / maxTokensPerChunk))`.
3. Số lượng phần bị chặn trên bởi số đoạn văn khả dụng:
   `parts = Math.max(1, Math.min(targetParts, sourceParas.length, rawParas.length))`.
4. Không bao giờ để sinh ra khối rỗng (`actualEnd >= start + 1`).

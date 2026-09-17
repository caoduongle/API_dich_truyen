# Data Model: Kích Hoạt Di Trú Hạn Mức Runtime, Nhất Quán Lưu Trữ Drive & Phân Đoạn Theo Ngân Sách Token (140-runtime-migration-drive-consistency)

**Feature**: `140-runtime-migration-drive-consistency`  
**Date**: 2026-09-15  
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## 1. Mô Hình Thực Thể (Entity Models)

### 1.1 AtomicProjectBundleInput (Gói Lưu Trữ Đa Store Nguyên Tử)

Đại diện cho dữ liệu đầu vào của một giao dịch cập nhật nguyên tử trên IndexedDB cho một dự án, bao gồm metadata dự án, toàn bộ nội dung chương và các trạng thái CRDT đồng bộ.

```typescript
export interface AtomicProjectBundleInput {
  /** Thông tin metadata của dự án (Store: 'projects') */
  project: StoryProject;
  /** Danh sách các chương cần lưu đồng thời (Store: 'chapters') */
  chapters: Chapter[];
  /** Danh sách trạng thái nhị phân CRDT tùy chọn tương ứng từng chương (Store: 'crdt_docs') */
  crdtStates?: Array<{
    chapterId: string;
    state: Uint8Array;
  }>;
}
```

**Ràng buộc dữ liệu & Toàn vẹn**:
- `project.id` không được rỗng.
- Tất cả `chapter.projectId` trong mảng `chapters` phải khớp với `project.id`.
- Mọi thao tác ghi phải hoàn tất trên cùng một `IDBTransaction` với scope `['projects', 'chapters', 'crdt_docs']`. Nếu bất kỳ thao tác nào thất bại, transaction kích hoạt `abort()` tự động.

---

### 1.2 CustomLimitMigrationState (Trạng Thái Di Trú Hạn Mức Runtime)

Đại diện cho kết quả kiểm tra và di trú cấu hình hạn mức từ mã băm cũ sang chuẩn SHA-256.

```typescript
export interface CustomLimitMigrationState {
  /** Số lượng mục cấu hình đã chuyển đổi thành công sang SHA-256 */
  migratedCount: number;
  /** Số lượng mục cấu hình cũ còn lại chưa thể di trú (thiếu pre-image) */
  legacyCount: number;
  /** Tổng số mục cấu hình hiện tại trong kho lưu trữ */
  currentCount: number;
  /** Danh sách các mã băm SHA-256 mới đã được tạo */
  migratedKeys: string[];
}
```

---

### 1.3 TokenWeightedSplitOptions (Cấu Hình Phân Đoạn Theo Trọng Số Token)

Mở rộng `BilingualSplitOptions` hỗ trợ gom đoạn lũy kế theo ngân sách token.

```typescript
export interface TokenWeightedSplitOptions {
  /** Văn bản nguồn (tiếng Trung) */
  sourceText: string;
  /** Văn bản thô (tiếng Việt) */
  rawText: string;
  /** Số phần chia mục tiêu mặc định khi không truyền maxTokensPerChunk */
  targetParts?: number;
  /** Giới hạn token tối đa cho mỗi chunk */
  maxTokensPerChunk?: number;
}
```

---

## 2. Vòng Đời & Luồng Dữ Liệu (Lifecycle & State Flow)

### 2.1 Luồng Khởi Động & Di Trú Hạn Mức Runtime

```mermaid
sequenceDiagram
    participant User as Người dùng
    participant App as App / useAIConfig
    participant Migrator as customLimitsStorage
    participant Storage as localStorage
    participant Scheduler as geminiKeyScheduler

    User->>App: Mở ứng dụng / Tải phiên làm việc
    App->>App: migrateAndLoadApiKeys()
    App->>Migrator: migrateCustomLimits(cleanKeys)
    Migrator->>Storage: Đọc 'gemini_quota_custom_limits'
    alt Có mã băm cũ (lặp 8 ký tự hex)
        Migrator->>Storage: Ghi lại dưới mã băm SHA-256 mới
        Migrator->>Storage: Xóa mã băm cũ
    end
    App-->>User: Sẵn sàng dịch thuật

    User->>Scheduler: Bắt đầu dịch chương
    Scheduler->>Scheduler: initKeySchedule(apiKeys)
    Scheduler->>Migrator: migrateCustomLimits(rawKeys) (Bảo vệ dự phòng)
    Scheduler->>Migrator: getStoredCustomLimits()
    Scheduler-->>User: Tra cứu hạn mức chính xác 100%
```

### 2.2 Luồng Giao Dịch Nguyên Tử Khi Kéo Gói Từ Google Drive

```mermaid
sequenceDiagram
    participant Drive as Google Drive v3
    participant Sync as driveBundleSync
    participant DB as IndexedDB Service (db.ts)
    participant IDB as IndexedDB Engine

    Drive->>Sync: Tải tệp project_bundle.json
    Sync->>Sync: Giải nén bundle (project, chapters, crdt)
    Sync->>DB: atomicSaveProjectBundle(mergedProject, chapters, crdtStates)
    DB->>DB: Đưa vào hàng đợi Promise Chain theo projectId
    DB->>IDB: Mở transaction ['projects', 'chapters', 'crdt_docs'] (readwrite)
    IDB->>IDB: put('projects', project)
    IDB->>IDB: put('chapters', ...chapters)
    IDB->>IDB: put('crdt_docs', ...crdtStates)
    alt Có lỗi I/O hoặc QuotaExceededError
        IDB-->>DB: tx.abort() (Rollback toàn bộ)
        DB-->>Sync: Ném lỗi ngoại lệ an toàn
        Sync-->>Drive: Báo lỗi đồng bộ - Cơ sở dữ liệu nguyên vẹn
    else Thành công
        IDB-->>DB: tx.oncomplete
        DB-->>Sync: Hoàn tất tuần tự an toàn
    end
```

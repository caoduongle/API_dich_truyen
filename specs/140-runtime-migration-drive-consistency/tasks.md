# Tasks: Kích Hoạt Di Trú Hạn Mức Runtime, Nhất Quán Lưu Trữ Drive & Phân Đoạn Theo Ngân Sách Token (140-runtime-migration-drive-consistency)

**Input**: Design documents from `/specs/140-runtime-migration-drive-consistency/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Exact file paths are specified in each description

---

## Phase 1: Setup & Baseline Verification

**Purpose**: Xác minh trạng thái ban đầu của kho mã nguồn trước khi thực hiện thay đổi

- [x] T001 Chạy kiểm thử baseline toàn bộ hệ thống để đảm bảo toàn bộ 86 tệp test hiện có đang pass qua lệnh `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Chuẩn bị các kiểu dữ liệu và hợp đồng nền tảng trước khi triển khai các User Story

- [x] T002 [P] Bổ sung tham số tùy chọn `apiKeys?: string[]` cho interface của `getStoredCustomLimits` trong `src/utils/customLimitsStorage.ts`
- [x] T003 [P] Khai báo kiểu `CrdtBinaryStateItem` và `AtomicProjectBundleInput` trong `src/services/db.ts`

**Checkpoint**: Nền tảng hợp đồng sẵn sàng — quá trình hiện thực hóa các User Story có thể bắt đầu độc lập

---

## Phase 3: User Story 1 - Tự Động Di Trú Hạn Mức Cá Nhân Khi Nạp Khóa & Khởi Tạo Scheduler (Priority: P1) 🎯 MVP

**Goal**: Tự động gọi `migrateCustomLimits(apiKeys)` ngay khi nạp khóa (`useAIConfig.ts`), khi khởi tạo điều phối (`geminiKeyScheduler.ts`), và khi đọc cấu hình (`customLimitsStorage.ts`), bảo đảm người dùng cũ nâng cấp không bị mất cấu hình `maxRpd`.

**Independent Test**: Nạp cấu hình hạn mức vào `localStorage` dưới mã băm 32-bit cũ, gọi `initKeySchedule([key])` hoặc `migrateAndLoadApiKeys()`, xác nhận cấu hình tự động chuyển sang SHA-256 và scheduler nhận diện chính xác `maxRpd`.

### Tests for User Story 1 🧪
- [x] T004 [P] [US1] Viết unit tests cho `getStoredCustomLimits(apiKeys)` tự động kích hoạt di trú trong `src/utils/__tests__/customLimitsStorage.test.ts`
- [x] T005 [P] [US1] Viết unit tests cho `initKeySchedule(apiKeys)` tự động kích hoạt di trú trước khi đọc limits trong `src/services/gemini/__tests__/geminiKeyScheduler.test.ts`
- [x] T006 [P] [US1] Viết unit tests cho `migrateAndLoadApiKeys()` kích hoạt di trú khi nạp keys trong `src/utils/__tests__/credentialStorage.test.ts`

### Implementation for User Story 1
- [x] T007 [US1] Cập nhật hàm `getStoredCustomLimits(apiKeys?: string[])` trong `src/utils/customLimitsStorage.ts` tự động gọi `migrateCustomLimits(apiKeys)` nếu mảng khóa được cung cấp
- [x] T008 [US1] Cập nhật hàm `initKeySchedule(apiKeys)` trong `src/services/gemini/geminiKeyScheduler.ts` tự động gọi `migrateCustomLimits(rawKeys)` trước khi tra cứu `getStoredCustomLimits()`
- [x] T009 [US1] Cập nhật hàm `migrateAndLoadApiKeys()` trong `src/hooks/useAIConfig.ts` tự động gọi `migrateCustomLimits(cleanKeys)` ngay khi nạp danh sách khóa hợp lệ

**Checkpoint**: User Story 1 hoàn thành — hạn mức cá nhân của người dùng nâng cấp từ bản cũ luôn có hiệu lực ngay từ lượt gọi đầu tiên

---

## Phase 4: User Story 2 - Hợp Nhất Tuần Tự Hóa Lưu Trữ & Giao Dịch Nguyên Tử Cho Drive Sync (Priority: P2)

**Goal**: Hợp nhất hàng đợi `enqueueProjectSave` ủy quyền thẳng cho `saveProjectToDB`, và xây dựng hàm giao dịch đa store nguyên tử `atomicSaveProjectBundle` trên IndexedDB cho `pullBundle`, triệt tiêu hoàn toàn nguy cơ partial-commit.

**Independent Test**: Kích hoạt đồng thời các thao tác lưu dự án từ UI và Drive xác nhận cùng đi qua 1 queue tuần tự theo `projectId`; giả lập lỗi khi pull bundle xác nhận không bị partial-commit (rollback toàn bộ).

### Tests for User Story 2 🧪
- [x] T010 [P] [US2] Viết unit tests cho `enqueueProjectSave` ủy quyền trực tiếp tới `saveProjectToDB` FIFO trong `src/services/__tests__/projectStorageQueue.test.ts`
- [x] T011 [P] [US2] Viết unit tests cho `atomicSaveProjectBundle` đa store transaction và rollback khi lỗi trong `src/services/__tests__/db.test.ts`
- [x] T012 [P] [US2] Viết unit tests cho `pullBundle` sử dụng `atomicSaveProjectBundle` trong `src/services/google-drive/__tests__/driveBundleSync.test.ts`

### Implementation for User Story 2
- [x] T013 [US2] Hiện thực hóa `atomicSaveProjectBundle(project, chapters, crdtStates)` trên IDBTransaction đa store `['projects', 'chapters', 'crdt_docs']` và xếp vào `projectWriteQueue` trong `src/services/db.ts`
- [x] T014 [US2] Cập nhật `enqueueProjectSave()` trong `src/services/projectStorageQueue.ts` ủy quyền trực tiếp và đồng bộ với `saveProjectToDB()` trong `src/services/db.ts`
- [x] T015 [US2] Cập nhật `pullBundle()` trong `src/services/google-drive/driveBundleSync.ts` sử dụng `atomicSaveProjectBundle` thay thế 3 bước lưu rời rạc

**Checkpoint**: User Story 2 hoàn thành — toàn bộ các luồng ghi dự án dùng chung 1 hàng đợi và tiến trình kéo gói Drive đạt tính nguyên tử 100%

---

## Phase 5: User Story 3 - Phân Đoạn Song Ngữ Thích Ứng Theo Ngân Sách Token Thực Tế (Priority: P3)

**Goal**: Nâng cấp thuật toán `splitBilingualAdaptively` gom các đoạn văn liên tiếp theo tổng lũy kế kích thước token (Greedy Accumulative Packing by Token Weight), bảo đảm bám sát `maxTokensPerChunk` ngay cả khi kích thước các đoạn văn phân bổ lệch nhau.

**Independent Test**: Cung cấp văn bản có các đoạn văn dài ngắn lệch nhau (150, 200, 1800, 100, 150, 200) với `maxTokensPerChunk = 1000`, xác nhận đoạn 1800 đứng riêng trong 1 chunk trọn vẹn và các đoạn nhỏ được gom lại mà không bị cắt vụn.

### Tests for User Story 3 🧪
- [x] T016 [P] [US3] Viết unit tests cho `splitBilingualAdaptively` gom đoạn lũy kế token thông minh với đoạn văn dài ngắn lệch nhau trong `src/services/translation/__tests__/bilingualSplit.test.ts`

### Implementation for User Story 3
- [x] T017 [US3] Nâng cấp `splitBilingualAdaptively()` trong `src/services/translation/bilingualSplit.ts` áp dụng thuật toán Greedy Accumulative Packing theo `maxTokensPerChunk`
- [x] T018 [US3] Đảm bảo cấu trúc kết quả phân đoạn tuân thủ giao thức `IBilingualTokenPackingSplitter` trong `src/services/translation/bilingualSplit.ts`

**Checkpoint**: User Story 3 hoàn thành — các đoạn văn lệch kích cỡ được chia cân bằng chính xác theo ngân sách token thực tế mà không bị vỡ ranh giới câu/đoạn.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cập nhật tài liệu, kiểm thử toàn diện và vượt qua toàn bộ các cổng chất lượng

- [x] T019 [P] Cập nhật tài liệu kỹ thuật kiến trúc trong `docs/model-system.md`
- [x] T020 [P] Chạy toàn bộ các kịch bản kiểm thử trong `specs/140-runtime-migration-drive-consistency/quickstart.md`
- [x] T021 Chạy toàn bộ các cổng chất lượng bắt buộc của dự án: `npm run lint`, `npm test`, `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Không có phụ thuộc — chạy ngay.
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 — mở đường cho các User Story.
- **User Story 1 (Phase 3)**: Độc lập (tập trung vào `customLimitsStorage`, `geminiKeyScheduler`, `useAIConfig`).
- **User Story 2 (Phase 4)**: Độc lập (tập trung vào `db.ts`, `projectStorageQueue`, `driveBundleSync`).
- **User Story 3 (Phase 5)**: Độc lập (tập trung vào `bilingualSplit.ts`).
- **Polish (Phase 6)**: Phụ thuộc vào việc hoàn tất toàn bộ 3 User Stories.

### Parallel Opportunities
- Các task có đánh dấu `[P]` trong từng Phase có thể được thực hiện song song:
  - T002 và T003 (Foundational types)
  - T004, T005, T006 (Tests cho US1)
  - T010, T011, T012 (Tests cho US2)
  - T016 (Tests cho US3)
  - T019 và T020 (Polish docs & quickstart)

---

## Implementation Strategy

### MVP Scope (User Story 1)
- **Hoàn thành P1**: Kích hoạt triệt để di trú hạn mức cá nhân trong runtime lifecycle để bảo vệ ngay lập tức người dùng nâng cấp.
- **Tiếp tục P2**: Hợp nhất hàng đợi tuần tự hóa và giao dịch nguyên tử cho Google Drive sync.
- **Tiếp tục P3**: Tối ưu hóa gom đoạn lũy kế token cho phân đoạn song ngữ.
- **Nghiệm thu**: Vượt qua 100% `npm run lint`, `npm test`, `npm run build`.

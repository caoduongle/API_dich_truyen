# Tasks: Gia Cố Ngữ Nghĩa Trạng Thái, Chỉ Số Vòng Đời & Toàn Vẹn Lưu Trữ (139-state-semantics-storage-hardening)

**Feature Branch**: `139-state-semantics-storage-hardening`  
**Input**: Feature specification from [`specs/139-state-semantics-storage-hardening/spec.md`](./spec.md) | Implementation plan from [`specs/139-state-semantics-storage-hardening/plan.md`](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực môi trường và chuẩn bị nền tảng kiểm thử trước khi tiến hành sửa đổi

- [x] T001 Khởi chạy kiểm tra chất lượng ban đầu để đảm bảo toàn bộ tests hiện có sạch sẽ với `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Khai báo các kiểu dữ liệu và hợp đồng cốt lõi mà các user stories phụ thuộc vào

**⚠️ CRITICAL**: Phải hoàn thành giai đoạn này trước khi triển khai các User Story

- [x] T002 [P] Bổ sung định nghĩa `recordLogicalFailure` và `recordRetry` vào `IQuotaLifecycleTracker` trong `src/types/quota.ts`
- [x] T003 [P] Xuất khẩu `IBilingualSplitter` và interface `BilingualSplitOptions` hoàn chỉnh trong `src/services/translation/types.ts`

**Checkpoint**: Nền tảng hợp đồng kiểu sẵn sàng — các User Story có thể tiến hành độc lập

---

## Phase 3: User Story 1 - Ghi Nhận Chính Xác Vòng Đời Yêu Cầu Logic & Thất Bại Tổng Thể (Priority: P1) 🎯 MVP

**Goal**: Cung cấp `recordLogicalFailure()` và tích hợp vào `geminiClient.ts` để ghi nhận chính xác `failedRequestsTotal` và `failedRequestsToday` khi toàn bộ các lượt thử thất bại

**Independent Test**: Giả lập logical request gửi qua 3 keys bị lỗi 429/mạng, xác nhận `failedRequestsTotal` tăng chính xác 1 đơn vị; nếu key thứ hai thành công thì `failedRequestsTotal` giữ nguyên 0

### Tests for User Story 1 🧪
- [x] T004 [P] [US1] Viết unit tests cho `recordLogicalFailure()` và vòng đời logical request trong `src/services/__tests__/localQuotaTracker.test.ts`
- [x] T005 [P] [US1] Viết unit tests cho `generateTextDirect` kiểm tra `failedRequestsTotal` tăng khi toàn bộ keys cạn kiệt trong `src/services/gemini/__tests__/geminiClient.test.ts`

### Implementation for User Story 1
- [x] T006 [US1] Hiện thực hóa phương thức `recordLogicalFailure(now?: number)` trong `src/services/localQuotaTracker.ts` để tăng `failedRequestsTotal` và `failedRequestsToday`
- [x] T007 [US1] Tích hợp gọi `localQuotaTracker.recordLogicalFailure()` khi ném lỗi kết thúc luồng yêu cầu logic trong `src/services/gemini/geminiClient.ts`

**Checkpoint**: User Story 1 hoàn thành — bảng điều khiển hạn ngạch hiển thị chính xác số yêu cầu logic thất bại

---

## Phase 4: User Story 2 - Tách Biệt Bộ Đếm Thử Lại Khỏi Sự Cố Không Thử Lại (Priority: P1) 🎯 MVP

**Goal**: Loại bỏ việc tăng `retriesTotal` trong `recordFailure()`, bổ sung `recordRetry()` và chỉ kích hoạt khi thực sự chuyển sang khóa tiếp theo hoặc retry

**Independent Test**: Gửi request nhận lỗi 401/400 kiểm tra `retriesTotal` KHÔNG tăng; gửi request nhận lỗi 429 và xoay tua sang khóa tiếp theo kiểm tra `retriesTotal` tăng đúng 1 đơn vị

### Tests for User Story 2 🧪
- [x] T008 [P] [US2] Viết unit tests trong `src/services/__tests__/localQuotaTracker.test.ts` xác nhận `recordFailure()` không làm tăng `retriesTotal` và `recordRetry()` tăng chính xác
- [x] T009 [P] [US2] Viết unit tests trong `src/services/gemini/__tests__/geminiClient.test.ts` xác nhận lỗi 401/400 không tăng `retriesTotal`, chỉ xoay khóa mới tăng `retriesTotal`

### Implementation for User Story 2
- [x] T010 [US2] Xóa bỏ `this.summaryStats.retriesTotal++` và `retriesToday++` khỏi `recordFailure()` trong `src/services/localQuotaTracker.ts`
- [x] T011 [US2] Hiện thực hóa phương thức `recordRetry(key?: string, now?: number)` trong `src/services/localQuotaTracker.ts`
- [x] T012 [US2] Tích hợp gọi `localQuotaTracker.recordRetry(currentKey)` tại các điểm xoay sang khóa mới (`findNextKey`) trong `src/services/gemini/geminiClient.ts`

**Checkpoint**: User Story 2 hoàn thành — số lần retry phản ánh trung thực hành vi hệ thống, không còn bị đếm khống bởi các lỗi không retry

---

## Phase 5: User Story 3 - Tuần Tự Hóa Toàn Diện Mọi Nguồn Ghi Dữ Liệu Dự Án (Priority: P1) 🎯 MVP

**Goal**: Đưa cơ chế tuần tự hóa Promise Chain theo `projectId` vào trực tiếp bên trong `saveProjectToDB()` tại `src/services/db.ts`, tự động bảo vệ mọi caller (UI hooks và Google Drive sync)

**Independent Test**: Kích hoạt 5 thao tác ghi đồng thời với delay ngẫu nhiên vào cùng 1 project, xác nhận tất cả được thực thi tuần tự theo thứ tự FIFO và không có snapshot cũ ghi đè snapshot mới

### Tests for User Story 3 🧪
- [x] T013 [P] [US3] Viết unit tests kiểm tra tuần tự hóa FIFO đa nguồn gọi đồng thời trong `src/services/__tests__/projectStorageQueue.test.ts` và `src/services/__tests__/dbStorageAudit.test.ts`

### Implementation for User Story 3
- [x] T014 [US3] Hiện thực hóa hàng đợi Promise Chain theo `projectId` trực tiếp bên trong hàm `saveProjectToDB()` tại `src/services/db.ts`
- [x] T015 [US3] Tối ưu `src/services/projectStorageQueue.ts` để đồng bộ và chuyển tiếp an toàn qua `saveProjectToDB()`, duy trì 100% tương thích ngược
- [x] T016 [US3] Xác nhận và kiểm tra các callers trong `src/services/google-drive/driveBundleSync.ts`, `driveProjectSync.ts`, `driveGranularSync.ts` và `src/hooks/useProjects.ts` hoạt động nhất quán

**Checkpoint**: User Story 3 hoàn thành — toàn bộ các luồng ghi dự án trong hệ thống được bảo vệ an toàn khỏi Race Condition

---

## Phase 6: User Story 4 - Tự Động Di Trú Dữ Liệu Cấu Hình Hạn Mức Tùy Chỉnh (Priority: P2)

**Goal**: Xây dựng thuật toán nhận diện mã băm 32-bit cũ và tự động di trú sang SHA-256 mới trong `customLimitsStorage.ts` và `localQuotaTracker.ts`

**Independent Test**: Nạp cấu hình `localStorage` với mã băm cũ (chuỗi hex 8 ký tự lặp), gọi hàm di trú với active keys, xác nhận cấu hình được chuyển sang mã băm SHA-256 (64 hex) đầy đủ và chính xác

### Tests for User Story 4 🧪
- [x] T017 [P] [US4] Viết unit tests cho `legacyHashApiKey()` và `migrateCustomLimits()` trong `src/utils/__tests__/customLimitsStorage.test.ts`
- [x] T018 [P] [US4] Viết unit tests cho quá trình tải `keyStats` từ `sessionStorage` tự động chuẩn hóa hash trong `src/services/__tests__/localQuotaTracker.test.ts`

### Implementation for User Story 4
- [x] T019 [US4] Hiện thực hóa `legacyHashApiKey()` và `migrateCustomLimits(apiKeys: string[])` trong `src/utils/customLimitsStorage.ts`
- [x] T020 [US4] Tích hợp cơ chế tự động di trú khi nạp cấu hình và nạp trạng thái trong `src/services/localQuotaTracker.ts`

**Checkpoint**: User Story 4 hoàn thành — người dùng nâng cấp từ phiên bản cũ không bị mất cấu hình hạn mức cá nhân

---

## Phase 7: User Story 5 - Đồng Bộ Hóa Toàn Diện Hợp Đồng & Runtime Phân Đoạn Song Ngữ (Priority: P2)

**Goal**: Hoàn thiện và xuất khẩu implementation `IBilingualSplitter`, đảm bảo `splitBilingualAdaptively` hỗ trợ trọn vẹn `maxTokensPerChunk` và tương thích ngược với tham số vị trí

**Independent Test**: Gọi `splitBilingualAdaptively({ sourceText, rawText, maxTokensPerChunk: 300 })`, xác nhận số lượng chunks tự động tăng để thỏa mãn giới hạn token và các đoạn văn không bị cắt đứt

### Tests for User Story 5 🧪
- [x] T021 [P] [US5] Viết unit tests cho `splitBilingualAdaptively` với tham số `maxTokensPerChunk` trong `src/services/translation/__tests__/bilingualSplit.test.ts`

### Implementation for User Story 5
- [x] T022 [US5] Cập nhật và tối ưu thuật toán tính `targetParts` theo `maxTokensPerChunk` trong `src/services/translation/bilingualSplit.ts`
- [x] T023 [US5] Xuất khẩu đối tượng triển khai `IBilingualSplitter` trong `src/services/translation/bilingualSplit.ts` và `src/services/translation/types.ts`

**Checkpoint**: User Story 5 hoàn thành — hợp đồng và thực thi runtime phân đoạn song ngữ đạt tính nhất quán 100%

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hoàn thiện tài liệu, chạy xác thực toàn diện và kiểm tra các cổng chất lượng

- [x] T024 [P] Cập nhật tài liệu kỹ thuật mô hình trong `docs/model-system.md` đồng bộ với các lifecycle metrics mới
- [x] T025 [P] Chạy toàn bộ các kịch bản kiểm thử trong `specs/139-state-semantics-storage-hardening/quickstart.md`
- [x] T026 Chạy toàn bộ các cổng chất lượng bắt buộc của dự án: `npm run lint`, `npm test`, `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Không có phụ thuộc — bắt đầu ngay
- **Foundational (Phase 2)**: Phụ thuộc Phase 1 — CHẶN toàn bộ các User Story
- **User Stories (Phase 3 -> 7)**:
  - US1 (Phase 3) và US2 (Phase 4) có thể chạy song song hoặc tuần tự vì đều liên quan đến `localQuotaTracker` và `geminiClient`
  - US3 (Phase 5) độc lập hoàn toàn (tập trung vào `src/services/db.ts`)
  - US4 (Phase 6) độc lập (tập trung vào `src/utils/customLimitsStorage.ts`)
  - US5 (Phase 7) độc lập (tập trung vào `src/services/translation/bilingualSplit.ts`)
- **Polish (Phase 8)**: Phụ thuộc vào việc hoàn tất toàn bộ 5 User Stories

### Parallel Opportunities
- Các task có đánh dấu `[P]` trong từng Phase có thể được thực hiện song song:
  - T002 và T003 (Foundational types)
  - T004 và T005 (Tests cho US1)
  - T008 và T009 (Tests cho US2)
  - T013 (Tests cho US3)
  - T017 và T018 (Tests cho US4)
  - T021 (Tests cho US5)
  - T024 và T025 (Polish docs & quickstart)

---

## Implementation Strategy

### MVP Scope (User Story 1, 2, 3)
- **Hoàn thành P1**: Sửa dứt điểm `failedRequestsTotal`, tách `retriesTotal`, và đưa mọi thao tác ghi `saveProjectToDB` vào Promise Chain tuần tự.
- **Tiếp tục P2**: Di trú hash cũ sang SHA-256 (US4) và đồng bộ hợp đồng song ngữ (US5).
- **Nghiệm thu**: Pass 100% `npm run lint`, `npm test`, `npm run build`.

# Tasks: Cải tiến Xuất & Nhập File Cẩm Nang Từ Điển

**Input**: Design documents from `specs/165-glossary-import-export-upgrade/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/glossary-io-contract.md`

**Tests**: Bổ sung unit tests cho module thuần `src/services/glossaryIO.ts` (được yêu cầu trong `plan.md` & `AGENTS.md` §14).

**Organization**: Tasks được nhóm theo từng User Story để triển khai và kiểm thử độc lập, ưu tiên P1 (MVP) trước.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc task chưa hoàn thành)
- **[Story]**: Nhãn User Story (`[US1]`, `[US2]`, `[US3]`, `[US4]`) — không gắn cho Setup / Foundational / Polish

---

## Phase 1: Setup (Chuẩn bị & Đồng bộ Thiết kế)

**Purpose**: Khớp đường dẫn module thực tế và các ràng buộc an toàn từ review trước khi viết code.

- [X] T001 Cập nhật đường dẫn `isHanEquivalent` (`src/lib/sinoNormalize.ts`) và quy tắc bảo mật/batching (CSV formula injection, JSON whitelist, file size limit, `DD/MM/YYYY` deterministic parsing, batch `overwrite` qua `onUpdateProject`) trong `specs/165-glossary-import-export-upgrade/plan.md` và `specs/165-glossary-import-export-upgrade/contracts/glossary-io-contract.md`

---

## Phase 2: Foundational (Hạ tầng dùng chung cho Xuất & Nhập)

**Purpose**: Khởi tạo module thuần `src/services/glossaryIO.ts` với các kiểu dữ liệu và hàm xử lý ngày tháng làm nền tảng cho mọi User Story.

**⚠️ CRITICAL**: Hoàn thành Phase 2 trước khi triển khai US1–US4.

- [X] T002 Tạo file `src/services/glossaryIO.ts` định nghĩa các interface `GlossaryExportFormat`, `GlossaryExportScope`, `GlossaryExportOptions`, `GlossaryImportParseResult`, `ImportConflictItem`, `GlossaryImportPreview`, `DuplicateResolutionStrategy` và hằng số giới hạn kích thước tệp (10 MB)
- [X] T003 Hiện thực `formatGlossaryCreatedDate` (`DD/MM/YYYY` hoặc `'—'`) và `parseGlossaryCreatedDate` (parse tường minh `DD/MM/YYYY[ HH:mm[:ss]]`, `YYYY-MM-DD`, ISO-8601; từ chối ngày không hợp lệ như `31/02/2026`; không dùng `new Date(raw)` cho định dạng Việt Nam) trong `src/services/glossaryIO.ts`

**Checkpoint**: Module `glossaryIO.ts` biên dịch sạch và sẵn sàng cho các hàm serialize/parse của từng story.

---

## Phase 3: User Story 1 - Xuất file từ điển kèm Ngày thêm và thông tin đầy đủ (Priority: P1) 🎯 MVP

**Goal**: Mọi tệp Markdown xuất ra có cột **Ngày thêm** cho từng mục từ (hiển thị `—` cho mục cũ), thông tin dự án ở phần đầu, và hỗ trợ xuất toàn bộ hoặc theo bộ lọc hiện tại.

**Independent Test**: Xuất từ điển có mục có `createdAt` và mục không có `createdAt`, xác nhận bảng Markdown có 5 cột với cột `Ngày thêm` đúng định dạng và phạm vi xuất khớp bộ lọc.

### Implementation for User Story 1

- [X] T004 [US1] Hiện thực `serializeGlossaryToMd` và hàm điều phối `serializeGlossary` (hỗ trợ `projectName`, thời điểm xuất, tổng số mục, bảng 5 cột gồm `Ngày thêm`, escape `|` và `\n`, đặt tên tệp theo slug dự án) trong `src/services/glossaryIO.ts`
- [X] T005 [US1] Cập nhật `useGlossaryState` trong `src/hooks/useGlossaryState.ts` thêm `exportGlossary(options)` hỗ trợ `scope: 'all' | 'filtered'` (dùng `filteredGlossary` hoặc `glossary`), giữ `exportGlossaryToMd` làm alias tương thích ngược
- [X] T006 [P] [US1] Tạo component `src/components/glossary-manager/ExportGlossaryModal.tsx` tuân thủ design system "Mực & Chu Sa" (`Modal`, `Button`, `Badge`, `cn`) cho phép chọn phạm vi xuất (`toàn bộ` vs `đang lọc`) và định dạng (mặc định `.md`)
- [X] T007 [US1] Cập nhật `src/components/glossary-manager/GlossaryHeader.tsx` và `src/components/GlossaryManager.tsx` để kết nối nút xuất từ điển với `ExportGlossaryModal` (hoặc xuất nhanh `.md` + tùy chọn phạm vi)

**Checkpoint**: User Story 1 hoạt động độc lập — xuất `.md` có cột **Ngày thêm** và hỗ trợ phạm vi đang lọc.

---

## Phase 4: User Story 2 - Nhập trực tiếp tệp từ điển có cấu trúc & giữ nguyên Ngày thêm (Priority: P1)

**Goal**: Tự động đọc trực tiếp tệp `.md` có cấu trúc bảng (bao gồm tệp vừa xuất từ app) hoàn toàn ngoại tuyến, không gọi AI, không cắt ngắn dữ liệu, và bảo toàn `Ngày thêm`; tự động fallback sang AI (`analyzeGuidelinesDirect`) cho văn xuôi tự do.

**Independent Test**: Xuất `.md` từ dự án A (có `Ngày thêm`), nhập lại vào dự án B khi không có API key AI và xác nhận khôi phục 100% mục từ + `Ngày thêm`.

### Implementation for User Story 2

- [X] T008 [US2] Hiện thực `parseMarkdownGlossaryTable` và `parseStructuredGlossaryFile` cho `.md` (nhận diện heading nhóm `## ...` để suy ra `GlossaryType`, map linh hoạt tên cột kể cả `Ngày thêm`, unescape `\|`, phát hiện tệp văn xuôi không có bảng trả `null`) trong `src/services/glossaryIO.ts`
- [X] T009 [US2] Hiện thực `analyzeGlossaryImportConflicts` sử dụng `isHanEquivalent` (`src/lib/sinoNormalize.ts`) và chuẩn hóa nghĩa Việt để tách `cleanItems` và `conflicts` (kèm `existingId` cho trùng Tiếng Trung và phát hiện lặp nội bộ tệp) trong `src/services/glossaryIO.ts`
- [X] T010 [US2] Cập nhật luồng nhập trong `src/hooks/useGlossaryState.ts`: kiểm tra kích thước tệp, ưu tiên `parseStructuredGlossaryFile` trước (giữ `createdAt` nếu có), chỉ gọi `analyzeGuidelinesDirect` khi trả `null` (văn xuôi tự do) hoặc người dùng yêu cầu dùng AI

**Checkpoint**: User Story 2 hoạt động độc lập — round-trip `.md` ngoại tuyến giữ nguyên `Ngày thêm`, văn xuôi tự do vẫn dùng AI bình thường.

---

## Phase 5: User Story 3 - Kéo-thả, xem trước và xử lý xung đột linh hoạt khi nhập cẩm nang (Priority: P2)

**Goal**: Kích hoạt kéo-thả tệp thực tế trên vùng tải lên, hiển thị bản xem trước thống kê (chế độ đọc trực tiếp vs AI, số từ mới, số từ trùng, số dòng bỏ qua) và cho phép chọn chiến lược xử lý trùng lặp hàng loạt (`skip` / `overwrite` / `review`).

**Independent Test**: Kéo-thả tệp có từ mới và từ trùng vào hộp thoại nhập, xem bản xem trước và thử từng tùy chọn `Bỏ qua`, `Ghi đè`, `Rà soát trùng lặp`.

### Implementation for User Story 3

- [X] T011 [US3] Cập nhật `src/hooks/useGlossaryState.ts` bổ sung state `importPreview`, `handleImportFile(file: File)`, `confirmImport(strategy: DuplicateResolutionStrategy)` (xử lý `overwrite` theo batch qua `onUpdateProject` khi có sẵn để tránh N lần ghi IndexedDB, giữ quy tắc xung đột chéo theo contract), `retryImportWithAi()`, và `resetImportPreview()`
- [X] T012 [US3] Cập nhật `src/components/glossary-manager/ImportGuidelinesModal.tsx` bổ sung sự kiện kéo-thả thực tế (`onDragOver`, `onDragLeave`, `onDrop`), chỉ báo chế độ phân tích (`Trực tiếp` / `AI`), màn hình xem trước thống kê + cảnh báo, nút chọn chiến lược trùng lặp (`Bỏ qua`, `Ghi đè`, `Đưa vào rà soát`), và thông báo lỗi tiếng Việt rõ ràng
- [X] T013 [US3] Cập nhật `src/components/GlossaryManager.tsx` truyền đầy đủ props mới từ `useGlossaryState` xuống `ImportGuidelinesModal`

**Checkpoint**: User Story 3 hoạt động độc lập — kéo-thả, xem trước và xử lý trùng lặp hàng loạt hoàn chỉnh.

---

## Phase 6: User Story 4 - Hỗ trợ đa định dạng xuất/nhập phổ biến (Markdown, JSON, CSV) (Priority: P3)

**Goal**: Cho phép xuất và nhập từ điển ở định dạng `.csv` (UTF-8 BOM, chống CSV Formula Injection) và `.json` (sao lưu trọn vẹn `variants`, `characterProfile`, `createdAt`, validate whitelist chống prototype pollution).

**Independent Test**: Xuất `.csv` và `.json`, kiểm tra `Ngày thêm` và dữ liệu tiếng Việt, sau đó nhập lại từng định dạng và xác nhận dữ liệu khớp hoàn toàn.

### Implementation for User Story 4

- [X] T014 [P] [US4] Hiện thực serializer & parser `.csv` (UTF-8 BOM `\uFEFF`, RFC 4180 quote/newline, sanitize công thức `=`, `+`, `-`, `@`, `\t`, `\r`, nhận diện `,` hoặc `;`, giữ `Ngày thêm`) trong `src/services/glossaryIO.ts`
- [X] T015 [P] [US4] Hiện thực serializer & parser `.json` (schema `{ version: 1, exportedAt, projectName, total, items }`, whitelist trường hợp lệ chống prototype pollution, chuẩn hóa `GlossaryType` và `normalizeCharacterProfile` từ `src/lib/glossaryMatch.ts`) trong `src/services/glossaryIO.ts`
- [X] T016 [US4] Mở rộng `accept=".md,.txt,.csv,.json"` và nhãn định dạng trong `src/components/glossary-manager/ImportGuidelinesModal.tsx` và `src/components/glossary-manager/ExportGlossaryModal.tsx`

**Checkpoint**: Tất cả 3 định dạng `.md`, `.csv`, `.json` hoạt động đầy đủ cho cả xuất và nhập.

---

## Phase 7: Polish, Testing & Quality Gates

**Purpose**: Kiểm thử tự động toàn diện cho `glossaryIO` và `useGlossaryState`, rà soát diff và chạy toàn bộ baseline quality gates.

- [X] T017 [P] Viết unit tests toàn diện trong `src/services/__tests__/glossaryIO.test.ts` (round-trip `.md`/`.csv`/`.json`, `formatGlossaryCreatedDate` & `parseGlossaryCreatedDate` với `05/11/2026` và `31/02/2026`, CSV formula injection, JSON whitelist, `analyzeGlossaryImportConflicts` với Phồn/Giản và xung đột chéo)
- [X] T018 [P] Bổ sung test tích hợp luồng `useGlossaryState` cho xuất theo bộ lọc và `confirmImport` (`skip` / `overwrite` / `review`) trong `src/hooks/__tests__/useGlossaryIO.test.ts`
- [X] T019 Chạy `npm run lint`, `npm test`, `npm run build` và rà soát `git diff` theo `AGENTS.md` §5 & §15

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)** → **Phase 2 (Foundational)**: Phải hoàn thành trước khi vào bất kỳ User Story nào.
- **Phase 3 (US1 - P1)** & **Phase 4 (US2 - P1)**: Có thể triển khai tuần tự hoặc song song sau Phase 2 (US1 tập trung xuất, US2 tập trung parse nhập `.md`).
- **Phase 5 (US3 - P2)**: Phụ thuộc US2 (`parseStructuredGlossaryFile`, `analyzeGlossaryImportConflicts`).
- **Phase 6 (US4 - P3)**: Phụ thuộc Phase 2 (`glossaryIO.ts`) và tích hợp vào modal của US1 & US3.
- **Phase 7 (Polish & Tests)**: Chạy sau khi hoàn tất các story mục tiêu (hoặc viết test song song trong quá trình code `glossaryIO.ts`).

### Parallel Opportunities
- `T006` (`ExportGlossaryModal.tsx`) có thể viết song song với `T005` (`useGlossaryState.ts`).
- `T014` (CSV) và `T015` (JSON) có thể viết song song hoặc nối tiếp nhanh trong `src/services/glossaryIO.ts`.
- `T017` và `T018` (unit/hook tests) có thể chạy song song.

### Suggested MVP Scope
- **MVP**: Hoàn thành **Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2)** — giải quyết ngay yêu cầu cốt lõi: xuất `.md` có cột **Ngày thêm**, xuất theo bộ lọc, và nhập lại `.md` trực tiếp ngoại tuyến giữ nguyên **Ngày thêm**.

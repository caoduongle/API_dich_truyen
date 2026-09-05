# Tasks: Chuyển Đổi Thuần Client-Side Cho 4 Tác Vụ AI Còn Lại

**Feature**: `091-client-direct-ai-tasks`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Status**: Ready / Executed  

---

## Phase 1: Setup (Shared Infrastructure & Isomorphic Modules)

**Purpose**: Thiết lập các module đẳng cấu (isomorphic) dùng chung giữa trình duyệt và máy chủ, loại bỏ sự phụ thuộc vào SDK server `@google/genai`.

- [ ] T001 [P] Tạo module prompt và schema đẳng cấu dùng chuỗi literal trong `shared/glossaryPrompts.ts`
- [ ] T002 [P] Tạo bộ trích xuất cẩm nang markdown `parseGlossaryFromMd` trong `shared/parser.ts`
- [ ] T003 [P] Bổ sung hàm tiện ích chia nhỏ văn bản `splitTextIntoChunks` vào `shared/text.ts`
- [ ] T004 Bổ sung 5 hàm payload builder cho các tác vụ AI vào `shared/prompts.ts`
- [ ] T005 [P] Cập nhật `server/utils/glossaryPrompts.ts` và `server/utils/parser.ts` thành re-export shim từ `@shared/`
- [ ] T006 [P] Tái cấu trúc `server/controllers/glossaryController.ts` để sử dụng `splitTextIntoChunks` dùng chung

---

## Phase 2: Foundational (Direct Engine Core)

**Purpose**: Xây dựng hạ tầng Client-Direct với cơ chế gọi trực tiếp Gemini REST API và xoay vòng khóa API.

- [ ] T007 Khởi tạo service `src/services/directGlossaryEngine.ts` với tích hợp xoay vòng key từ `src/services/directGeminiClient.ts`

---

## Phase 3: User Story 1 - Bảo Mật Khóa API & Gọi Trực Tiếp Phân Tích Thuật Ngữ & Cẩm Nang (Priority: P1) 🎯 MVP

**Goal**: Toàn bộ thao tác phân tích thuật ngữ và cẩm nang dịch thuật chạy 100% trên trình duyệt, không gửi khóa API lên server ứng dụng.  
**Independent Test**: Quét thuật ngữ trong `useGlossaryScan` hoặc nhập cẩm nang markdown trong `useGlossaryState`, xác minh request gửi trực tiếp tới `generativelanguage.googleapis.com` và không gọi `/api/analyze-glossary`.

### Implementation for User Story 1

- [ ] T008 [US1] Triển khai hàm `analyzeGlossaryDirect` với cơ chế chia nhỏ thích ứng (Divide & Conquer) trong `src/services/directGlossaryEngine.ts`
- [ ] T009 [US1] Triển khai hàm trích xuất thuật ngữ `extractGlossaryDirect` trong `src/services/directGlossaryEngine.ts`
- [ ] T010 [US1] Triển khai hàm `analyzeGuidelinesDirect` kết hợp bóc tách regex và suy luận AI trong `src/services/directGlossaryEngine.ts`
- [ ] T011 [P] [US1] Chuyển đổi tiến trình quét thuật ngữ hàng loạt sang `analyzeGlossaryDirect` trong `src/hooks/useGlossaryScan.ts`
- [ ] T012 [P] [US1] Chuyển đổi tính năng nhập cẩm nang markdown sang `analyzeGuidelinesDirect` trong `src/components/glossary-manager/useGlossaryState.ts`
- [ ] T013 [P] [US1] Chuyển đổi tính năng gợi ý phong cách dự án sang `analyzeGuidelinesDirect` trong `src/components/project-list/ProjectFormModal.tsx`
- [ ] T014 [US1] Chuyển đổi phân tích chữ Hán trong workspace sang `analyzeGlossaryDirect` trong `src/components/translator-workspace/useWorkspaceState.ts`

**Checkpoint**: User Story 1 hoàn tất — Quét thuật ngữ và cẩm nang hoạt động hoàn toàn độc lập phía client.

---

## Phase 4: User Story 2 - Gọi Trực Tiếp Gióng Hàng & Sửa Lỗi Kiểm Duyệt AI (Priority: P2)

**Goal**: Chức năng xuất dữ liệu gióng hàng song ngữ JSONL và kiểm duyệt chất lượng bản dịch (QA Critique) hoạt động trực tiếp từ trình duyệt, sửa triệt để lỗi HTTP 400.  
**Independent Test**: Bật tùy chọn kiểm duyệt AI trong Workspace, mài giũa bản dịch và xác nhận `qaCritiqueDirect` phản hồi kết quả đánh giá; xuất file gióng hàng từ `useExportFiles` không gọi `/api/align-chapter`.

### Implementation for User Story 2

- [ ] T015 [US2] Triển khai hàm xuất dữ liệu gióng hàng song ngữ `alignChapterDirect` trong `src/services/directGlossaryEngine.ts`
- [ ] T016 [US2] Triển khai hàm kiểm duyệt chất lượng bản dịch `qaCritiqueDirect` trong `src/services/directGlossaryEngine.ts`
- [ ] T017 [P] [US2] Chuyển đổi tiến trình xuất tệp gióng hàng sang `alignChapterDirect` trong `src/hooks/useExportFiles.ts`
- [ ] T018 [US2] Chuyển đổi kiểm duyệt AI sang `qaCritiqueDirect` và khắc phục lỗi 400 trong `src/components/translator-workspace/useWorkspaceState.ts`

**Checkpoint**: User Story 2 hoàn tất — Gióng hàng và QA Critique hoạt động ổn định và an toàn phía client.

---

## Phase 5: Polish & Quality Assurance

**Purpose**: Đảm bảo toàn bộ hệ thống đạt tiêu chuẩn kiểm thử, tương thích kiểu nghiêm ngặt và build production sạch sẽ.

- [ ] T019 [P] Chạy kiểm tra tĩnh và type safety không có lỗi qua `npm run lint` (`tsc --noEmit`)
- [ ] T020 [P] Chạy toàn bộ bộ kiểm thử tự động với `npm test` (`vitest run`), đảm bảo 803/803 tests pass
- [ ] T021 [P] Build ứng dụng cho môi trường production qua `npm run build` (`vite build && esbuild server.ts`)
- [ ] T022 Thực hiện kiểm thử xác nhận theo các kịch bản trong `specs/091-client-direct-ai-tasks/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Độc lập — có thể thực hiện trước để chuẩn bị hạ tầng dùng chung.
- **Foundational (Phase 2)**: Phụ thuộc vào Phase 1 (các builder và schema dùng chung).
- **User Story 1 (Phase 3)**: Phụ thuộc vào Phase 2. Cung cấp giá trị cốt lõi (MVP).
- **User Story 2 (Phase 4)**: Phụ thuộc vào Phase 2. Có thể triển khai song song hoặc sau US1.
- **Polish & QA (Phase 5)**: Thực hiện sau khi cả hai user stories được tích hợp.

### Parallel Opportunities

- Các task Setup: `T001`, `T002`, `T003`, `T005`, `T006` có thể thực hiện song song do tách biệt file.
- Các task Wire UI trong US1: `T011`, `T012`, `T013` có thể làm song song sau khi `T008`, `T010` hoàn thành.
- Các task kiểm định cuối: `T019`, `T020`, `T021` có thể chạy song song hoặc tuần tự độc lập.

---

## Implementation Strategy

### MVP Scope (User Story 1)
1. Hoàn thiện Phase 1 (Setup) & Phase 2 (Foundational).
2. Hoàn thiện Phase 3 (User Story 1: Glossary Scan & Guidelines).
3. Kiểm chứng quét thuật ngữ và cẩm nang hoạt động độc lập, không còn gửi API key lên máy chủ.

### Incremental Delivery
- **Bước 1 (MVP)**: Bảo vệ khóa API người dùng ở các luồng quét thuật ngữ và cẩm nang dịch (US1).
- **Bước 2**: Bảo vệ khóa API ở tính năng gióng hàng song ngữ và khôi phục hoạt động kiểm duyệt QA Critique (US2).
- **Bước 3**: Kiểm thử hồi quy toàn diện trên 803 automated tests và đóng gói production.

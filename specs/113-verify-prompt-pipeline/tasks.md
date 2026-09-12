# Tasks: Toàn Diện Rà Soát & Đồng Bộ Luồng Prompt Pipeline

**Feature Branch**: `113-verify-prompt-pipeline`  
**Date**: 2026-09-12  
**Spec**: [specs/113-verify-prompt-pipeline/spec.md](spec.md) | **Plan**: [specs/113-verify-prompt-pipeline/plan.md](plan.md)  
**Status**: Ready for Execution  

---

## Phase 1: Setup & Foundational Infrastructure

**Purpose**: Mở rộng các kiểu dữ liệu cốt lõi trong `src/types.ts` để hỗ trợ lưu trữ trạng thái prompt bền vững và kết quả kiểm định.

- [x] T001 Mở rộng interface `StoryProject` bổ sung trường tùy chọn `additionalInstructions?: string` trong `src/types.ts`
- [x] T002 [P] Mở rộng interface `Chapter` bổ sung trường tùy chọn `qaIssues?: DirectQaCritiqueIssue[]` trong `src/types.ts`

---

## Phase 2: User Story 1 - Truyền Dẫn Cấu Hình Truyện & Quy Tắc Dịch Thuật (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo Thể loại, Tông giọng và Quy tắc dịch thuật (`description`) được đưa trọn vẹn vào cả `systemInstruction` và `prompt` của Giai đoạn 1 (Dịch thô) và Giai đoạn 2 (Chuốt văn phong).

**Independent Test**: Khởi tạo payload Dịch thô và Chuốt văn với thể loại "Linh Dị / Thần Quái", tông giọng "Kịch tính ly kỳ" và quy tắc dịch chi tiết; xác nhận `systemInstruction` của cả 2 giai đoạn chứa đầy đủ chỉ thị văn phong và quy định tuân thủ quy tắc dịch bắt buộc.

- [x] T003 [US1] Cập nhật `buildPolishTranslationPayload` trong `src/services/ai/prompts.ts` đưa `description` vào `systemInstruction` như một điều khoản bắt buộc phải tuân thủ (Quy định 8)
- [x] T004 [US1] Chuẩn hóa khối hiển thị `[NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ ĐẶC THÙ TỪ CẨM NANG]` trong user prompt của `buildPolishTranslationPayload` tại `src/services/ai/prompts.ts`
- [x] T005 [US1] Đảm bảo `getGenreStyleGuide(genre)` và `tone` được phản ánh đầy đủ trong `buildRawTranslationPayload` và `buildPolishTranslationPayload` tại `src/services/ai/prompts.ts`

---

## Phase 3: User Story 2 - Điền & Ghi Nhớ "Yêu Cầu Bổ Sung Khi Biên Tập" (Priority: P1)

**Goal**: Lưu trữ bền vững "Yêu cầu bổ sung khi biên tập" (`additionalInstructions`) theo từng dự án trong IndexedDB và đồng bộ 2 chiều giữa AutoTranslator và BilingualEditor.

**Independent Test**: Nhập hướng dẫn biên tập tùy biến tại Bảng dịch tự động, chuyển tab sang Workspace hoặc F5 nạp lại trang; xác nhận nội dung hướng dẫn vẫn hiển thị nguyên vẹn và được truyền vào payload Giai đoạn 2.

- [x] T006 [US2] Cập nhật `useWorkspaceState.ts` khởi tạo và đồng bộ `additionalInstructions` từ `activeProject.additionalInstructions` trong `src/hooks/useWorkspaceState.ts`
- [x] T007 [US2] Cập nhật `TranslationConfigPanel.tsx` liên kết `additionalInstructions` trực tiếp với state dự án trong `src/components/auto-translator/TranslationConfigPanel.tsx`
- [x] T008 [US2] Cập nhật `BilingualEditor.tsx` đồng bộ ô nhập "Yêu cầu biên tập đặc biệt" với state dự án trong `src/components/translator-workspace/BilingualEditor.tsx`
- [x] T009 [US2] Bổ sung câu lệnh dự phòng chuẩn mực ("Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết") khi `additionalInstructions` để trống trong `src/services/ai/prompts.ts`

---

## Phase 4: User Story 3 - Bảo Toàn Tri Thức Từ Điển Khi Áp Dụng Bản Đã Thế Trước (Priority: P2)

**Goal**: Loại bỏ hoàn toàn lỗi gán `glossary: []` khi văn bản đã được thế sẵn `[Tên_Việt]`, bảo đảm AI luôn nhận được bảng đối chiếu từ điển đầy đủ ở cả Phase 1 và Phase 2.

**Independent Test**: Áp dụng từ điển trực tiếp vào bản gốc; bấm Dịch thô hoặc Chuốt văn; xác nhận prompt AI gửi đi chứa đầy đủ danh mục từ điển tham chiếu và không xuất hiện chuỗi "(Không có từ điển tùy chọn...)".

- [x] T010 [US3] Sửa `useWorkspaceState.ts` luôn truyền `activeProject.glossary` thay vì gán mảng rỗng khi `isGlossaryApplied === true` trong `src/hooks/useWorkspaceState.ts`
- [x] T011 [US3] Sửa `chapterTranslationService.ts` luôn truyền `glossarySnapshot` (Phase 1) và `localGlossary` (Phase 2) thay vì gán mảng rỗng khi `hasProcessedText === true` trong `src/services/chapterTranslationService.ts`
- [x] T012 [US3] Đảm bảo khối `[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY]` trong `buildPolishTranslationPayload` nhận diện chính xác các từ đã có trong `glossary` tại `src/services/ai/prompts.ts`

---

## Phase 5: User Story 4 - Đồng Bộ Bối Cảnh Kiểm Định Chất Lượng & Lưu Trữ Kết QuẢ (Priority: P2)

**Goal**: Bổ sung Thể loại, Tông giọng, Quy tắc dịch và Từ điển vào QA Critique; lưu trữ kết quả kiểm định tự động vào `Chapter.qaIssues` và cung cấp phong cách cho tính năng Viết lại câu (`rewriteSentenceDirect`).

**Independent Test**: Chạy dịch tự động một chương có bật kiểm định QA; mở chương trong Workspace; xác nhận Unified Audit Panel tự động nạp danh sách lỗi phát hiện mà không cần quét lại thủ công.

- [x] T013 [US4] Mở rộng `BuildQaCritiquePromptParams` và `buildQaCritiquePayload` tiếp nhận `genre`, `tone`, `description`, `glossary` trong `src/services/ai/prompts.ts`
- [x] T014 [US4] Cập nhật `qaCritiqueDirect` trong `src/services/directTranslationEngine.ts` nhận và chuyển tiếp các tham số bối cảnh vào payload
- [x] T015 [US4] Cập nhật `chapterTranslationService.ts` lưu `qaData.issues` vào thuộc tính `updatedFullChapter.qaIssues` và ghi vào IndexedDB trong `src/services/chapterTranslationService.ts`
- [x] T016 [US4] Cập nhật `useWorkspaceState.ts` tự động khôi phục `qaIssues` từ `chapter.qaIssues` khi nạp chương trong `src/hooks/useWorkspaceState.ts`
- [x] T017 [US4] Cập nhật `rewriteSentenceDirect` tiếp nhận `genre` và `tone` để câu văn viết lại khớp văn phong truyện trong `src/services/directTranslationEngine.ts`

---

## Phase 6: User Story 5 - Chuẩn Hóa Lọc & Trích Xuất Thuật Ngữ (Priority: P3)

**Goal**: Đảm bảo các prompt trích xuất thực thể, tra cứu nhanh, và quét từ vựng vận hành chuẩn xác theo phong cách văn học.

**Independent Test**: Bôi đen một cụm từ tiếng Trung để tra cứu nhanh; xác nhận kết quả trả về phù hợp với thể loại của truyện.

- [x] T018 [US5] Thêm tham số `genre?: string` vào `fetchQuickDefinition` trong `src/services/directGeminiClient.ts`
- [x] T019 [US5] Đồng bộ hướng dẫn trích xuất thực thể ngoại quốc và bảo tồn chữ Hán trong `buildPolishTranslationPayload` tại `src/services/ai/prompts.ts`

---

## Phase 7: Polish, Verification & Quality Gates

**Purpose**: Đảm bảo toàn bộ hệ thống vượt qua 100% các cổng kiểm thử của Hiến pháp dự án.

- [x] T020 [P] Bổ sung các bài kiểm thử đơn vị cho các prompt payloads mới trong `src/services/ai/__tests__/prompts.test.ts`
- [x] T021 [P] Bổ sung kiểm thử đơn vị cho việc bảo toàn từ điển và lưu trữ `additionalInstructions` trong `src/hooks/__tests__/useWorkspaceState.test.ts`
- [x] T022 Chạy cổng kiểm tra kiểu dữ liệu `npm run lint` (`tsc --noEmit`)
- [x] T023 Chạy toàn bộ bộ kiểm thử tự động `npm test` (`vitest run`)
- [x] T024 Chạy kiểm tra đóng gói ứng dụng `npm run build` (`tsc && vite build`)

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: Bắt đầu ngay, không có phụ thuộc.
- **Phase 2 (US1)**: Phụ thuộc vào Phase 1.
- **Phase 3 (US2)**: Phụ thuộc vào Phase 1.
- **Phase 4 (US3)**: Phụ thuộc vào Phase 2.
- **Phase 5 (US4)**: Phụ thuộc vào Phase 1.
- **Phase 6 (US5)**: Phụ thuộc vào Phase 1 & 2.
- **Phase 7 (Polish & Verification)**: Chạy sau khi hoàn thành tất cả các User Stories.

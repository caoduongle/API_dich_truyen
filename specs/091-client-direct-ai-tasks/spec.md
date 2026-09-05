# Feature Specification: Chuyển Đổi Thuần Client-Side Cho 4 Tác Vụ AI Còn Lại

**Feature Branch**: `091-client-direct-ai-tasks`  
**Created**: 2026-09-05  
**Status**: Ready for Implementation  
**Input**: Bước 1 của lộ trình "thuần client-side" — port 4 tác vụ AI còn lại (`analyze-glossary`, `analyze-guidelines`, `align-chapter`, `qa-critique` trong workspace) sang gọi thẳng Google Gemini từ trình duyệt (Client-Direct), loại bỏ hoàn toàn việc gửi API key thật của người dùng lên server ứng dụng.

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 - Bảo Mật Khóa API & Gọi Trực Tiếp Phân Tích Thuật Ngữ & Cẩm Nang (Priority: P1) 🎯 MVP

Là một người dùng dịch thuật, tôi muốn trình duyệt gọi trực tiếp API Gemini của Google khi thực hiện các tác vụ phân tích thuật ngữ (`analyzeGlossaryDirect`) và phân tích cẩm nang hướng dẫn (`analyzeGuidelinesDirect`), để khóa API cá nhân của tôi không bao giờ phải gửi lên server ứng dụng trung gian, đảm bảo mô hình Zero-Knowledge hoàn toàn.

**Why this priority**: Bảo vệ khóa API người dùng khỏi rủi ro bị rò rỉ hoặc lưu vết trên máy chủ trung gian khi quét thuật ngữ hàng loạt hoặc phân tích file cẩm nang markdown.

**Independent Test**:
- Trong `useGlossaryScan`, khởi chạy quét thuật ngữ sỉ qua `analyzeGlossaryDirect`, kiểm chứng các gợi ý thuật ngữ được trích xuất chính xác và Network tab của trình duyệt chỉ gửi request tới `generativelanguage.googleapis.com` chứ không gửi tới `/api/analyze-glossary`.
- Trong `useGlossaryState` và `ProjectFormModal`, tải lên file markdown cẩm nang dịch, kiểm chứng thể loại (`genre`), tông giọng (`tone`) và mô tả (`description`) được trích xuất thành công qua `analyzeGuidelinesDirect`.

**Acceptance Scenarios**:
1. **Given** người dùng quét thuật ngữ trong `useGlossaryScan` hoặc workspace, **When** hệ thống phân tích chương truyện chữ Hán, **Then** `analyzeGlossaryDirect` thực thi phân đoạn chia nhỏ (Divide & Conquer) trực tiếp từ client và trả về danh sách thuật ngữ đã được chuẩn hóa.
2. **Given** người dùng import cẩm nang Markdown trong Glossary Manager hoặc Project Form, **When** hàm phân tích cẩm nang được kích hoạt, **Then** `analyzeGuidelinesDirect` bóc tách thuật ngữ qua regex parser và gọi trực tiếp Gemini để suy luận thể loại/tông giọng/mô tả.

---

### User Story 2 - Gọi Trực Tiếp Gióng Hàng & Sửa Lỗi Kiểm Duyệt AI (QA Critique) (Priority: P2)

Là một biên tập viên, tôi muốn chức năng xuất dữ liệu gióng hàng (`alignChapterDirect`) và kiểm duyệt chất lượng dịch AI (`qaCritiqueDirect`) trong Workspace hoạt động trực tiếp từ trình duyệt, đồng thời giải quyết dứt điểm lỗi HTTP 400 cũ do thiếu cờ truyền API key khi kiểm duyệt chất lượng.

**Why this priority**: Cung cấp khả năng trích xuất cặp câu song ngữ JSONL cho fine-tuning mà không phụ thuộc endpoint server, đồng thời phục hồi chức năng QA Critique trong Workspace vốn bị lỗi 400 trước đó.

**Independent Test**:
- Thực hiện xuất tệp gióng hàng trong `useExportFiles`, kiểm chứng tệp JSONL được tạo ra trực tiếp.
- Bật tùy chọn kiểm duyệt AI trong Workspace (`enableAiQaCritique`), nhấn "Mài giũa", kiểm chứng `qaCritiqueDirect` chạy thành công, không còn lỗi 400 và hiển thị thông báo kết quả kiểm duyệt chính xác.

**Acceptance Scenarios**:
1. **Given** người dùng xuất bản học liệu gióng hàng `align_jsonl`, **When** tiến trình xuất chạy, **Then** `alignChapterDirect` bóc tách từng cặp câu Trung - Việt và xuất các dòng JSONL hợp lệ mà không gọi `/api/align-chapter`.
2. **Given** chế độ kiểm duyệt AI được bật trong Workspace, **When** quá trình mài giũa hoàn thành, **Then** `qaCritiqueDirect` được gọi trực tiếp với `apiKeys`, trả về danh sách lỗi (omission/addition/repetition/terminology) và hiển thị thông báo cho người dùng.

---

## 2. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: PHẢI tạo file dùng chung `shared/glossaryPrompts.ts` loại bỏ phụ thuộc SDK `@google/genai` (dùng `"OBJECT"` / `"STRING"` literal) và giữ nguyên `server/utils/glossaryPrompts.ts` làm shim re-export.
- **FR-002**: PHẢI tạo file dùng chung `shared/parser.ts` (chứa `parseGlossaryFromMd`) và giữ `server/utils/parser.ts` làm shim re-export.
- **FR-003**: PHẢI thêm hàm `splitTextIntoChunks` vào `shared/text.ts` và tái sử dụng hàm này trong `server/controllers/glossaryController.ts`.
- **FR-004**: PHẢI bổ sung các hàm builder `buildAnalyzeGlossaryPayload`, `buildAnalyzeGuidelinesPayload`, `buildExtractGlossaryPayload`, `buildAlignChapterPayload`, `buildAlignmentJsonlLines` vào `shared/prompts.ts`.
- **FR-005**: PHẢI tạo dịch vụ mới `src/services/directGlossaryEngine.ts` hiện thực đầy đủ 4 hàm Client-Direct: `analyzeGlossaryDirect`, `analyzeGuidelinesDirect`, `extractGlossaryDirect`, `alignChapterDirect`.
- **FR-006**: PHẢI rewire 4 vị trí UI gọi API server sang Client-Direct:
  - `src/hooks/useGlossaryScan.ts` -> `analyzeGlossaryDirect`
  - `src/components/glossary-manager/useGlossaryState.ts` -> `analyzeGuidelinesDirect`
  - `src/components/project-list/ProjectFormModal.tsx` -> `analyzeGuidelinesDirect`
  - `src/hooks/useExportFiles.ts` -> `alignChapterDirect`
  - `src/components/translator-workspace/useWorkspaceState.ts` -> `analyzeGlossaryDirect` và `qaCritiqueDirect`
- **FR-007**: TUYỆT ĐỐI KHÔNG sửa hoặc xóa bất kỳ route/controller nào trong `server/routes/api.ts` để đảm bảo tương thích ngược cho client bên ngoài.
- **FR-008**: 100% bộ kiểm thử (803/803 tests) PHẢI pass sạch và bản build production PHẢI thành công.

---

## 3. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Toàn bộ các tương tác AI trên Web UI (quét từ điển, phân tích cẩm nang, gióng hàng, QA critique) chạy 100% qua Client-Direct, không còn request mang API key lên server ứng dụng.
- **SC-002**: `npx tsc --noEmit` hoàn thành với mã thoát 0.
- **SC-003**: `npm run build` hoàn thành với mã thoát 0 cho cả `dist/client` và `dist/server`.
- **SC-004**: `npx vitest run` hoàn thành với 122/122 test files và 803/803 tests passed (100%).

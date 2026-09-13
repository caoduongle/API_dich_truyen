# Implementation Plan: Định Vị & Làm Nổi Bật Đoạn Lỗi Khi Mở Bàn Dịch (Jump to Issue & Highlight in Translator)

**Branch**: `131-jump-to-issue-highlight` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/131-jump-to-issue-highlight/spec.md`

---

## Summary

Nâng cấp nút "Mở trong Bàn Dịch để sửa" trên thẻ lỗi của tab Kiểm Định Hako: truyền kèm đoạn trích vi phạm (`vietnameseSnippet`), tự động chuyển sang Bàn Dịch, tự động chọn phân vùng dịch phù hợp (`polished` hoặc `raw`), cuộn mượt đến đúng vị trí dòng lỗi và bôi chọn nổi bật (native selection range) đoạn văn bản lỗi kèm phản hồi toast, giúp người dùng chỉnh sửa ngay mà không cần tìm kiếm thủ công.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19  
**Primary Dependencies**: React, Lucide-react, Tailwind CSS v4, `clsx`, `tailwind-merge`  
**Storage**: IndexedDB (`src/services/db.ts`)  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Pure Client-Side SPA (Web Browser)  
**Project Type**: Web Application (React SPA)  
**Performance Goals**: Chuyển tab, cuộn và bôi chọn hoàn tất trong < 300ms, cuộn mượt 60 fps.  
**Constraints**: Không thêm dependency mới; không thay đổi IndexedDB schema; tuân thủ nghiêm ngặt ranh giới MVC của `AGENTS.md` và `constitution.md`.  
**Scale/Scope**: Văn bản chương từ vài ngàn đến hơn 30,000 từ; hỗ trợ đa dạng cấu trúc trích dẫn AI.  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates)**: `npm run lint`, `npm test`, và `npm run build` phải sạch 100%.
- [x] **Principle II (Dependency Minimization)**: Tận dụng và nâng cấp tiện ích `scrollAndSelectInTextarea` sẵn có trong `src/utils/textareaHighlight.ts`, không cài thêm thư viện tìm kiếm hay editor bên ngoài.
- [x] **Principle III (MVC Separation)**:
  - View: `HakoIssueCard.tsx`, `HakoIssueReviewPanel.tsx`, `BilingualEditor.tsx`.
  - State/Controller: `App.tsx`, `useWorkspaceState.ts`.
  - Utility/Logic: `src/utils/textareaHighlight.ts`.
  - Giữ nguyên ranh giới phân tầng sạch sẽ.
- [x] **Principle IV (Immutable Schemas)**: Không thay đổi schema `Chapter` hay `QualityIssue`.
- [x] **Principle V (Atomic Commits)**: Gói gọn thay đổi tập trung vào luồng deep-link highlight giữa Hako Checker và Bàn Dịch.

---

## Project Structure

### Documentation (this feature)

```text
specs/131-jump-to-issue-highlight/
├── spec.md              # Feature specification
├── plan.md              # Implementation Plan
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model & state machine
├── quickstart.md        # Validation scenarios guide
├── contracts/
│   └── jump-to-issue.contract.ts
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── utils/
│   ├── textareaHighlight.ts             # [MODIFY] Nâng cấp thuật toán bôi chọn với quote/punctuation trim & normalized whitespace
│   └── __tests__/
│       └── textareaHighlight.test.ts    # [MODIFY] Bổ sung test cases cho smart snippet matching
├── components/
│   ├── hako-checker/
│   │   ├── HakoIssueCard.tsx            # [MODIFY] Truyền snippet và issueId khi bấm "Mở trong Bàn Dịch để sửa"
│   │   ├── HakoIssueReviewPanel.tsx     # [MODIFY] Cập nhật kiểu tham số callback onOpenInTranslator
│   │   └── HakoCheckerWorkspace.tsx     # [MODIFY] Chuyển tiếp options của onOpenInTranslator
│   ├── layout/
│   │   └── TabContent.tsx               # [MODIFY] Tiếp nhận pendingHighlightSnippet và chuyển xuống TranslatorWorkspace
│   ├── TranslatorWorkspace.tsx          # [MODIFY] Nhận initialHighlightSnippet và truyền vào BilingualEditor
│   └── translator-workspace/
│       └── BilingualEditor.tsx          # [MODIFY] Tự động chọn stage, cuộn, bôi chọn đoạn lỗi và gọi toast phản hồi
└── App.tsx                              # [MODIFY] Quản lý state pendingHighlightSnippet và xử lý điều hướng
```

---

## Phased Execution Strategy

### Phase 0: Research (Completed)
- Xem [research.md](./research.md) cho phân tích kiến trúc và 4 quyết định kỹ thuật cốt lõi.

### Phase 1: Design & Contracts (Completed)
- Xem [data-model.md](./data-model.md) cho mô hình thực thể và máy trạng thái.
- Xem [contracts/jump-to-issue.contract.ts](./contracts/jump-to-issue.contract.ts) cho hợp đồng tham số.
- Xem [quickstart.md](./quickstart.md) cho hướng dẫn kiểm thử.

### Phase 2: Implementation (Scheduled for `/speckit-tasks` & `/speckit-implement`)
1. **Utility Enhancement (`src/utils/textareaHighlight.ts`)**:
   - Thêm hàm `findNormalizedSnippetOffset` hỗ trợ tìm kiếm chuẩn hóa khi exact match thất bại.
   - Bổ sung unit test trong `src/utils/__tests__/textareaHighlight.test.ts`.
2. **Card & Workspace Deep-Link Wiring**:
   - Nâng cấp `onOpenInTranslator` trên `HakoIssueCard`, `HakoIssueReviewPanel`, `HakoCheckerWorkspace`.
   - Trong `HakoIssueCard.tsx`: `onOpenInTranslator(issue.chapterId, { snippet: issue.vietnameseSnippet, issueId: issue.id })`.
3. **App Shell State Management**:
   - Khai báo `pendingHighlightSnippet` tại `App.tsx`.
   - Cập nhật `handleOpenChapterFromHakoChecker` nhận `(chapterId, options)`.
   - Truyền `pendingHighlightSnippet` và `onClearHighlightSnippet` xuống `TabContent`.
4. **Editor Auto-Scroll & Highlight Execution**:
   - `BilingualEditor` tiếp nhận `initialHighlightSnippet` và `onClearHighlightSnippet`.
   - Khi có `initialHighlightSnippet`: tự động chuyển `activeStage` sang phân vùng chứa đoạn văn bản, thực hiện cuộn và bôi chọn, hiển thị toast thông báo, dọn dẹp `initialHighlightSnippet`.
5. **Verification**:
   - Chạy `npm run lint`, `npm test`, `npm run build`.

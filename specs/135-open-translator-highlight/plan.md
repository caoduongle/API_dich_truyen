# Implementation Plan: Tự Động Cuộn & Bôi Đen Đoạn Lỗi Khi Bấm "Mở Trong Bàn Dịch Để Sửa" (135-open-translator-highlight)

**Branch**: `135-open-translator-highlight` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/135-open-translator-highlight/spec.md`

---

## Summary

Khắc phục triệt để hiện tượng không cuộn và không bôi đen (highlight) đoạn văn lỗi khi người dùng bấm nút **"Mở trong Bàn Dịch để sửa"** từ thẻ lỗi của màn hình **Kiểm Định Hako**. 

Giải pháp kỹ thuật:
1. Đóng gói yêu cầu bôi đen thành cấu trúc `HighlightIntent` mang đầy đủ ngữ cảnh (`chapterId`, `snippet`, `issueId`, `timestamp`).
2. Đồng bộ hóa vòng đời nạp dữ liệu chương: Chỉ thực thi tìm kiếm và bôi chọn khi chương mục tiêu đã nạp xong vào state (`currentChapterId === intent.chapterId` và văn bản đã sẵn sàng).
3. Tự động chuyển đổi phân vùng phù hợp (`activeStage` là `polished` hoặc `raw`) và đợi DOM textarea sẵn sàng trước khi thực thi `scrollAndSelectInTextarea`.
4. Nâng cấp thuật toán so khớp trích đoạn trong `findSnippetLocationInText` để hỗ trợ chuẩn hóa khoảng trắng thừa và trích dẫn có dấu ngoặc kép bọc ngoài.
5. Giải phóng intent an toàn (one-time consumption) sau khi hoàn tất.

---

## Technical Context

**Language/Version**: TypeScript 5.x, React 19  
**Primary Dependencies**: React 19, `clsx`, `tailwind-merge`, `lucide-react` (không thêm bất kỳ thư viện mới nào)  
**Storage**: IndexedDB (client-side persistence qua `getChapterFromDB`)  
**Testing**: Vitest (`vitest run`), React Testing Library  
**Target Platform**: Pure Client-Side Web SPA (Chrome, Edge, Firefox, Safari)  
**Project Type**: Web Application (Frontend SPA)  
**Performance Goals**: Thời gian từ khi nhấp nút mở đến khi bôi đen và cuộn xong trong editor < 350ms  
**Constraints**: Tuân thủ nghiêm ngặt hiến pháp dự án (`AGENTS.md` và `.specify/memory/constitution.md`); không thay đổi schema IndexedDB; không sửa đổi logic dịch trong `src/services/`  
**Scale/Scope**: Áp dụng cho mọi chương truyện và mọi kích thước văn bản (từ vài trăm từ đến trên 10,000 từ)  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**:
  - `npm run lint` (`tsc --noEmit`) sạch lỗi: PASS.
  - `npm test` (`vitest run`) toàn bộ pass 100%: PASS.
  - `npm run build` (`tsc && vite build`) thành công sạch: PASS.
- **Principle II: Dependency Minimization & Existing Library Reuse**:
  - Tái sử dụng `scrollAndSelectInTextarea`, `findSnippetLocationInText` trong `src/utils/textareaHighlight.ts`.
  - Không cài thêm bất kỳ dependency nào: PASS.
- **Principle III: Strict Concern Separation & MVC Domain Boundary Preservation**:
  - View: `HakoIssueCard.tsx`, `BilingualEditor.tsx`, `UnifiedAuditPanel.tsx`.
  - Controller: `App.tsx`, `useWorkspaceState.ts`.
  - Service / Utility: `src/utils/textareaHighlight.ts`.
  - Không vi phạm ranh giới MVC: PASS.
- **Principle IV: Immutable Core Schemas & Storage Stability**:
  - Không thay đổi bảng hay trường dữ liệu nào trong IndexedDB hoặc `src/types.ts`: PASS.
  - Giữ nguyên tiếng Việt nhãn giao diện: PASS.
- **Principle V: Atomic Commits & Documentation Synchronization**:
  - Toàn bộ spec, plan, contracts, data-model, quickstart đồng bộ 100%: PASS.

---

## Project Structure

### Documentation (this feature)

```text
specs/135-open-translator-highlight/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Root cause analysis & design decisions
├── data-model.md        # Entities, state machine, and data flow
├── quickstart.md        # Manual & automated validation guide
├── contracts/           # TypeScript contract definitions
│   └── open-in-translator.contract.ts
└── checklists/
    └── requirements.md  # Spec quality checklist (16/16 pass)
```

### Source Code (repository root)

```text
src/
├── App.tsx                                            # [MODIFY] Quản lý state pendingHighlightIntent & handleOpenChapterFromHakoChecker
├── components/
│   ├── layout/
│   │   └── TabContent.tsx                             # [MODIFY] Chuyển tiếp highlightIntent xuống TranslatorWorkspace
│   ├── TranslatorWorkspace.tsx                        # [MODIFY] Chuyển tiếp highlightIntent xuống BilingualEditor
│   ├── translator-workspace/
│   │   └── BilingualEditor.tsx                        # [MODIFY] Đồng bộ vòng đời nạp chương, auto-switch stage, cuộn và bôi đen
│   └── hako-checker/
│       └── HakoIssueCard.tsx                          # [REUSE] Đã có onOpenInTranslator(chapterId, { snippet, issueId })
└── utils/
    ├── textareaHighlight.ts                           # [MODIFY] Tăng cường chuẩn hóa khoảng trắng và trích dẫn
    └── __tests__/
        └── textareaHighlight.test.ts                  # [MODIFY] Bổ sung test case so khớp khoảng trắng & trích dẫn
```

**Structure Decision**: Ứng dụng là Client-side Single Page App (React 19 + Vite). Mọi thay đổi đều nằm trong cấu trúc hiện có mà không tạo thêm tầng trừu tượng không cần thiết.

---

## Complexity Tracking

*Không có vi phạm hiến pháp nào cần giải trình (No constitution violations).*

# Implementation Plan: Chuyển Đổi Thuần Client-Side Cho 4 Tác Vụ AI Còn Lại

**Branch**: `091-client-direct-ai-tasks` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/091-client-direct-ai-tasks/spec.md`

---

## Summary

Port 4 tác vụ AI còn lại (`analyze-glossary`, `analyze-guidelines`, `align-chapter`, `qa-critique` trong workspace) sang gọi trực tiếp Google Gemini từ trình duyệt (Client-Direct), loại bỏ hoàn toàn việc gửi API key của người dùng lên server ứng dụng, hiện thực hóa mô hình Zero-Knowledge Session Sync. Giải pháp phân tách các prompt schema và text chunking sang thư mục `@shared/` đẳng cấu (isomorphic), loại bỏ phụ thuộc vào Node SDK `@google/genai`, xây dựng `directGlossaryEngine.ts` với cơ chế xoay vòng key tự động, và bảo toàn 100% khả năng tương thích ngược của các server endpoints.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, `@shared/` modules, native browser Fetch API  
**Storage**: Client IndexedDB (`idb`), LocalStorage (API Keys)  
**Testing**: Vitest (Unit & Integration tests)  
**Target Platform**: Hiện đại Web Browser (Chrome, Edge, Firefox, Safari) + Node.js (Express backend)  
**Project Type**: Isomorphic Web Application (SPA Client + Node.js API server)  
**Performance Goals**: Không nghẽn UI main thread khi xử lý văn bản dài; chia nhỏ văn bản tự động (Divide & Conquer) ~10.000 ký tự / chunk.  
**Constraints**: Zero-Knowledge đối với API keys cá nhân (khóa không bao giờ rời khỏi thiết bị); bảo toàn toàn bộ routes hiện hữu trên server.  
**Scale/Scope**: 4 tác vụ AI, 5 UI call-sites, 803 automated tests.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Strict Quality Gates & Verification**: Tất cả 3 lệnh kiểm thử bắt buộc (`npm run lint`, `npm test`, `npm run build`) đều hoàn thành với mã thoát 0 (803/803 tests pass).
- [x] **Principle II: Dependency Minimization**: Không thêm bất kỳ package npm mới nào. Tái sử dụng `directGeminiClient`, `splitTextIntoChunks`, `isHanEquivalent`.
- [x] **Principle III: Strict Concern Separation**: Không xóa bỏ bất kỳ endpoint server nào; server endpoints tiếp tục hoạt động thông qua shim `@shared/`.
- [x] **Principle IV: Immutable Core Schemas & Storage Stability**: Không thay đổi cấu trúc `src/types.ts` hay schema của IndexedDB.
- [x] **Principle V: Atomic Commits & Documentation**: Tài liệu hóa chi tiết qua spec-kit (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`).

---

## Project Structure

### Documentation (this feature)

```text
specs/091-client-direct-ai-tasks/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & architectural decisions (Phase 0)
├── data-model.md        # Entities, parameters, and pipelines (Phase 1)
├── quickstart.md        # Validation scenarios & execution guide (Phase 1)
├── contracts/           # Interface contracts
│   ├── direct-glossary-engine.md
│   └── gemini-rest-contract.md
└── checklists/
    └── requirements.md  # Requirements verification checklist
```

### Source Code (affected paths)

```text
shared/
├── glossaryPrompts.ts   # [NEW] Isomorphic schema & prompts (literal "OBJECT"/"STRING")
├── parser.ts            # [NEW] parseGlossaryFromMd helper
├── prompts.ts           # [MODIFIED] Added client-direct payload builders
└── text.ts              # [MODIFIED] Exported splitTextIntoChunks

server/
├── controllers/
│   └── glossaryController.ts # [MODIFIED] Reuses splitTextIntoChunks
└── utils/
    ├── glossaryPrompts.ts    # [MODIFIED] Re-export shim from @shared/glossaryPrompts
    └── parser.ts             # [MODIFIED] Re-export shim from @shared/parser

src/
├── services/
│   └── directGlossaryEngine.ts # [NEW] 4 client-direct AI tasks + key rotation
├── components/
│   ├── glossary-manager/
│   │   └── useGlossaryState.ts    # [MODIFIED] Rewired to analyzeGuidelinesDirect
│   ├── project-list/
│   │   └── ProjectFormModal.tsx   # [MODIFIED] Rewired to analyzeGuidelinesDirect
│   └── translator-workspace/
│       └── useWorkspaceState.ts   # [MODIFIED] Rewired to analyzeGlossaryDirect & qaCritiqueDirect
└── hooks/
    ├── useExportFiles.ts          # [MODIFIED] Rewired to alignChapterDirect
    └── useGlossaryScan.ts         # [MODIFIED] Rewired to analyzeGlossaryDirect
```

**Structure Decision**: Monorepo kết hợp mã nguồn dùng chung `shared/` giữa Vite client (`src/`) và Express server (`server/`).

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| *Không có vi phạm* | N/A | N/A |

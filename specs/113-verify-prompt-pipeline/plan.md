# Implementation Plan: Toàn Diện Rà Soát & Đồng Bộ Luồng Prompt Pipeline

**Branch**: `113-verify-prompt-pipeline` | **Date**: 2026-09-12 | **Spec**: [specs/113-verify-prompt-pipeline/spec.md](spec.md)

**Input**: Feature specification from `/specs/113-verify-prompt-pipeline/spec.md`

## Summary

Rà soát toàn diện và đồng bộ hóa triệt để chuỗi xử lý Prompt AI trong ứng dụng từ Dịch thô (Phase 1), Chuốt văn phong (Phase 2), Kiểm định chất lượng (Phase 3: QA Critique & Hako Audit), đến Lọc/Trích xuất thuật ngữ (Glossary Pipeline) và Viết lại câu mục tiêu (Sentence Rewriting). Khắc phục triệt để các vấn đề:
1. Đồng bộ và lưu trữ bền vững trường "Yêu cầu bổ sung khi biên tập" (`additionalInstructions`) giữa AutoTranslator và Workspace Editor.
2. Ngăn chặn việc triệt tiêu từ điển (`glossary: []`) khi văn bản gốc đã áp dụng dấu ngoặc vuông `[Tên_Việt]`.
3. Nâng cấp hiệu lực cưỡng chế của quy tắc dịch (`description`) trong `systemInstruction` của Giai đoạn 2.
4. Bổ sung bối cảnh Thể loại, Tông giọng, Quy tắc dịch và Từ điển vào QA Critique, đồng thời lưu trữ kết quả kiểm định tự động vào dữ liệu chương để hiển thị trên Unified Audit Panel.
5. Truyền bối cảnh thể loại và tông giọng vào chức năng Viết lại câu (`rewriteSentenceDirect`).

## Technical Context

**Language/Version**: TypeScript 5.8+, ECMAScript 2022+  
**Primary Dependencies**: React 19, Vite 6, Tailwind CSS v4, `@google/genai` (Google Gemini API REST client), `lucide-react`, `motion`  
**Storage**: IndexedDB (client-side persistence qua `idb`), `localStorage` (fallback key cache)  
**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)  
**Target Platform**: Hiện đại Web Browsers (Chrome, Edge, Firefox, Safari) - Pure Client-side SPA  
**Project Type**: Web Application (Single-Page Application, Zero Backend Server)  
**Performance Goals**: Tạo prompt dưới 5ms; phản hồi luồng dịch trực tiếp phụ thuộc vào tốc độ Google Gemini API; duy trì 60 FPS khi render giao diện  
**Constraints**: Pure Client-Side SPA; Không gọi backend server; Tuân thủ nghiêm ngặt Hiến pháp dự án (Constitution v2.0.0); Không phá vỡ schema lưu trữ hiện hữu  
**Scale/Scope**: Bao phủ 4 phân hệ prompt chính (Dịch thô, Chuốt văn, Kiểm định QA, Quét thuật ngữ); khoảng 6 files dịch vụ và 4 components giao diện  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, `npm run build` BẮT BUỘC pass 100%. Không xóa/skip test. -> PASS.
- **Principle II: Dependency Minimization & Existing Library Reuse**: Tái sử dụng các thư viện sẵn có (`lucide-react`, `idb`, `clsx`, `tailwind-merge`), không cài thêm thư viện mới. -> PASS.
- **Principle III: Strict Concern Separation & MVC Domain Boundary**: Presentation (`src/components/`), Controller/Hooks (`src/hooks/`), Services/Model (`src/services/`, `src/lib/`). Tách bạch rõ ràng. -> PASS.
- **Principle IV: Immutable Core Schemas & Storage Stability**: Mở rộng an toàn các trường tùy chọn (`additionalInstructions?`, `qaIssues?`), không thay đổi cấu trúc bảng IndexedDB cốt lõi. Giữ nguyên tiếng Việt nhãn giao diện. -> PASS.
- **Principle V: Atomic Commits & Documentation Synchronization**: Tài liệu hóa chi tiết `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `prompt-pipeline.contract.md`. -> PASS.

## Project Structure

### Documentation (this feature)

```text
specs/113-verify-prompt-pipeline/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical research & decisions (Phase 0)
├── data-model.md        # Entities, signatures & data flow (Phase 1)
├── quickstart.md        # Manual & automated validation guide (Phase 1)
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── contracts/
    └── prompt-pipeline.contract.md # Invariants & signatures contract (Phase 1)
```

### Source Code (repository root)

```text
src/
├── types.ts                                     # [MODIFY] Thêm additionalInstructions? vào StoryProject, qaIssues? vào Chapter
├── services/
│   ├── ai/
│   │   ├── prompts.ts                           # [MODIFY] Nâng cấp buildRawTranslationPayload, buildPolishTranslationPayload, buildQaCritiquePayload
│   │   └── glossaryPrompts.ts                   # [VERIFY] Chuẩn hóa entity extraction instructions
│   ├── directTranslationEngine.ts               # [MODIFY] Cập nhật polishTranslationDirect, qaCritiqueDirect, rewriteSentenceDirect
│   ├── chapterTranslationService.ts             # [MODIFY] Sửa glossary pass-through và lưu qaIssues sau kiểm định tự động
│   └── directGeminiClient.ts                    # [MODIFY] Bổ sung genre vào fetchQuickDefinition
├── hooks/
│   ├── useWorkspaceState.ts                     # [MODIFY] Sửa glossary pass-through và đồng bộ additionalInstructions với StoryProject
│   ├── useTranslationProcess.ts                 # [MODIFY] Đồng bộ additionalInstructions từ project
│   └── useGlossaryScan.ts                       # [VERIFY] Xác nhận multi-loop exclusion list
└── components/
    ├── auto-translator/
    │   └── TranslationConfigPanel.tsx           # [MODIFY] Đọc/ghi additionalInstructions từ project state
    └── translator-workspace/
        ├── BilingualEditor.tsx                  # [MODIFY] Đọc/ghi additionalInstructions từ project state
        └── ProjectMetadataModal.tsx             # [VERIFY] Xác nhận 12 thể loại và 8 tông giọng truyền tải đúng
```

**Structure Decision**: Duy trì kiến trúc Pure Client-Side SPA hiện hữu theo mô hình MVC, chỉnh sửa tối giản và chính xác tại tầng Model/Service và tầng Controller/Hook để luồng dữ liệu từ View đi xuyên suốt vào Prompt Payload.

## Complexity Tracking

> Không có vi phạm Hiến pháp nào cần giải trình phức tạp. Tất cả các thay đổi tuân thủ kiến trúc hiện hữu.

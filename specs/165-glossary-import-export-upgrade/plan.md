# Implementation Plan: Cải tiến Xuất & Nhập File Cẩm Nang Từ Điển

**Branch**: `165-glossary-import-export-upgrade` | **Date**: 2026-11-22 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/165-glossary-import-export-upgrade/spec.md)

**Input**: Feature specification from `/specs/165-glossary-import-export-upgrade/spec.md`

## Summary

Bổ sung cột/trường **Ngày thêm** vào toàn bộ tệp từ điển xuất ra và nâng cấp toàn diện luồng xuất/nhập cẩm nang từ điển:
1. Tách lớp xử lý dữ liệu thuần sang `src/services/glossaryIO.ts` để serialize/parse trực tiếp `.md` (bảng chuẩn), `.csv` (UTF-8 BOM), và `.json` (sao lưu trọn vẹn) mà không cần gọi AI, không bị cắt ngắn dữ liệu, và bảo toàn `createdAt` khi nhập lại.
2. Giữ nguyên fallback sang `analyzeGuidelinesDirect` (AI Gemini) cho các tệp văn xuôi tự do (`.md`, `.txt`) không có bảng chuẩn.
3. Nâng cấp `useGlossaryState.ts`, `GlossaryHeader.tsx`, `ExportGlossaryModal.tsx` (hoặc popover/modal gọn nhẹ), và `ImportGuidelinesModal.tsx` để hỗ trợ: chọn định dạng & phạm vi xuất (toàn bộ vs đang lọc), kéo-thả tệp thực tế (`onDragOver`/`onDrop`), xem trước kết quả phân tích, và chọn chiến lược xử lý trùng lặp hàng loạt (`skip` / `overwrite` / `review`).

## Technical Context

**Language/Version**: TypeScript ~5.8.2, React 19.0.1
**Primary Dependencies**: Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `opencc-js` (qua `src/lib/sinoNormalize.ts`), `@google/genai` (qua `analyzeGuidelinesDirect` hiện có). Không thêm dependency mới.
**Storage**: IndexedDB phía client (không thay đổi schema hay `src/types.ts`).
**Testing**: Vitest (`vitest run` + `jsdom`).
**Target Platform**: Pure Client-Side SPA (trình duyệt desktop & mobile).
**Project Type**: Web SPA (React + Vite).
**Performance Goals**: Parse và serialize trực tiếp cục bộ < 2 giây cho từ điển 1.000+ mục từ; không chặn UI.
**Constraints**: Tuân thủ nghiêm ngặt kiến trúc MVC (`services/` không import `components/` hay `hooks/`), Design System "Mực & Chu Sa" (`.agents/rules/design-system.md`), không sửa `src/types.ts` hay IndexedDB schema.
**Scale/Scope**: Khoảng 5–6 file thay đổi/thêm mới trong tầng `services/`, `hooks/`, `components/glossary-manager/`, và unit tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification**: Đạt — kế hoạch yêu cầu chạy đủ `npm run lint`, `npm test`, `npm run build` và bổ sung unit tests cho `glossaryIO.ts`.
- **II. Dependency Minimization & Existing Library Reuse**: Đạt — không thêm package nào vào `package.json`; tái dùng `isHanEquivalent` (`src/lib/sinoNormalize.ts`), `normalizeCharacterProfile` (`src/lib/glossaryMatch.ts`), `triggerDownload` (`src/utils/download.ts`), `analyzeGuidelinesDirect` (`src/services/directGlossaryEngine.ts`), và UI primitives (`Modal`, `Button`, `Badge`, `cn`).
- **III. Strict Concern Separation & MVC Domain Boundary Preservation**: Đạt — toàn bộ logic parse/serialize/date/conflict đặt tại `src/services/glossaryIO.ts`; orchestration đặt tại `src/hooks/useGlossaryState.ts`; UI đặt tại `src/components/glossary-manager/`.
- **IV. Immutable Core Schemas & Storage Stability**: Đạt — không thay đổi `src/types.ts` và schema IndexedDB (`GlossaryItem.createdAt?: string` đã tồn tại).
- **V. Atomic Commits & Documentation Synchronization**: Đạt — phạm vi thay đổi giới hạn đúng trong luồng xuất/nhập từ điển.

**Post-Design Re-check**: Không có vi phạm Constitution nào sau Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/165-glossary-import-export-upgrade/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── glossary-io-contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── glossaryIO.ts                  # [NEW] Pure export/import serializers, parsers, date & conflict helpers
│   └── __tests__/
│       └── glossaryIO.test.ts         # [NEW] Unit tests for MD/CSV/JSON round-trip, date parsing, conflicts
├── hooks/
│   └── useGlossaryState.ts            # [MODIFY] Export options, direct-first import, preview & conflict strategy
└── components/
    ├── GlossaryManager.tsx            # [MODIFY] Wire new export/import props to header & modals
    └── glossary-manager/
        ├── GlossaryHeader.tsx         # [MODIFY] Trigger export modal/options & import modal
        ├── ExportGlossaryModal.tsx    # [NEW] Chọn định dạng (.md/.csv/.json) & phạm vi (all/filtered)
        └── ImportGuidelinesModal.tsx  # [MODIFY] Drag & drop, preview summary, duplicate strategy selector
```

**Structure Decision**: Giữ nguyên cấu trúc Single-project Pure Client-Side SPA hiện có; tách logic thuần sang `src/services/glossaryIO.ts` và tái sử dụng `Modal.tsx`, `Button.tsx`, `Badge.tsx` trong `src/components/ui/`.

## Complexity Tracking

> Không có vi phạm Constitution nào cần giải trình.

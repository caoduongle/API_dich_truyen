# Implementation Plan: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Branch**: `[169-glossary-translation-quality]` | **Date**: 2026-11-27 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/169-glossary-translation-quality/spec.md)

**Input**: Feature specification from `/specs/169-glossary-translation-quality/spec.md`

## Summary

Nâng cấp toàn diện vòng đời từ điển dự án theo 5 trụ cột bám sát spec đã chốt:
1. **Ngữ cảnh đầy đủ & đồng nhất xuyên 3 pha (`Raw -> Polish -> QA`)**: Đồng bộ ghi chú (`note`), tên phụ (`variants`), phân loại (`type`), và hồ sơ xưng hô nhân vật ở mọi lượt dịch/chuốt/QA; nhóm từ điển theo vai trò ưu tiên; thống nhất giải quyết xung đột bao gồm cả trùng qua `variants` và Giản/Phồn thể.
2. **Khớp cụm dài nhất không chồng lấn trong kiểm tra tuân thủ**: Áp dụng span masking ưu tiên cụm dài nhất khi đối chiếu đoạn gốc trong `checkGlossaryCompliance` để triệt tiêu cảnh báo giả do cụm con lồng trong cụm cha.
3. **Làm giàu hồ sơ & lọc nhiễu khi quét/trích xuất**: Ưu tiên lọc bỏ từ đã xuất hiện trong chương khi từ điển >150–500 mục, chặn từ phổ thông vô nghĩa, tự gợi ý giới tính nhân vật mới từ ngữ cảnh rõ ràng mà không bao giờ ghi đè chỉnh sửa thủ công/ghim.
4. **Chẩn đoán Sức khỏe từ điển & Lọc 1 chạm**: Hiển thị bộ đếm xung đột nghĩa dịch, nhân vật thiếu hồ sơ giới tính/đại từ, và mục thiếu nghĩa Việt ngay trên giao diện Quản lý từ điển kèm bộ lọc 1 chạm.
5. **Thao tác hàng loạt & Nhập tệp 2 chế độ**: Thêm chọn nhiều dòng và thanh công cụ hàng loạt 4 hành động (Xóa, Ghim/Bỏ ghim, Đổi phân loại, Gán giới tính nhân vật), đồng thời bổ sung lựa chọn **Chỉ thêm thuật ngữ** vs **Thay toàn bộ thuật ngữ** (có cảnh báo xác nhận, bảo toàn hàng chờ kiểm duyệt và chặn tệp rỗng) trong luồng nhập tệp từ điển.

## Technical Context

**Language/Version**: TypeScript ~5.8.2, React 19 (`^19.0.1`), ECMAScript Modules
**Primary Dependencies**: Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `motion`, `opencc-js`, `clsx`, `tailwind-merge`, `@google/genai`
**Storage**: IndexedDB phía client (qua `src/services/db.ts` và state React trong `StoryProject`), `localStorage` cho cài đặt cục bộ; không thay đổi schema IndexedDB hay `src/types.ts`
**Testing**: Vitest `^4.1.12` + `jsdom` (`npm test` -> `vitest run`) và TypeScript type-check (`npm run lint` -> `tsc --noEmit`)
**Target Platform**: Pure Client-Side SPA trên trình duyệt Web (Desktop & Responsive Mobile)
**Project Type**: Pure Client-Side Single Page Application (MVC client-side: Components → Hooks → Services/Lib)
**Performance Goals**: Xử lý lọc, nhóm vai trò, span matching và chẩn đoán sức khỏe trên bộ từ điển >= 1.000 mục trong dưới 15ms mỗi lượt trên main thread; thao tác hàng loạt cập nhật một lượt state duy nhất
**Constraints**: Tuân thủ nghiêm `.agents/rules/design-system.md` ("Mực & Chu Sa", không dùng emoji nền tảng, tái dùng `Button`/`Badge`/`Modal`/`Seal`/`cn`); không sửa `src/types.ts` hoặc DB schema; không thêm package NPM mới
**Scale/Scope**: Khoảng 12–15 file thuộc tầng `src/lib/`, `src/services/`, `src/hooks/`, `src/components/glossary-manager/` và các unit/component tests tương ứng

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification**: PASS — Plan quy định bắt buộc chạy `npm run lint`, `npm test`, `npm run build` sau khi hoàn thiện code và bổ sung unit/UI tests cho toàn bộ hành vi mới; không xóa/skip bất kỳ assertion nào.
- **II. Dependency Minimization & Existing Library Reuse**: PASS — Không thêm dependency mới; tái dùng `canonicalizeHan`/`findCanonicalSubstring` (`src/lib/sinoNormalize.ts`), `normalizeCharacterProfile`/`resolveGlossaryConflicts` (`src/lib/glossaryMatch.ts`), `mergeImportedGlossaryForProject` pattern (`src/services/glossaryIO.ts`), và UI primitives (`Button`, `Badge`, `Modal`, `cn`).
- **III. Strict Concern Separation & MVC Domain Boundary Preservation**: PASS — Logic thuần túy (nhóm vai trò, span matching, lọc nhiễu, suy luận giới tính, tính sức khỏe từ điển, khử trùng xung đột biến thể) nằm trong `src/lib/glossaryMatch.ts` và `src/services/`; state chọn hàng loạt, bộ lọc sức khỏe, bulk handlers và điều phối import nằm trong `src/hooks/useGlossaryState.ts` & `src/hooks/useGlossaryScan.ts`; giao diện nằm thuần túy ở `src/components/glossary-manager/`. Service và hook không import component.
- **IV. Immutable Core Schemas & Storage Stability**: PASS — Không chỉnh sửa `src/types.ts` và không chỉnh sửa `src/services/db.ts`. Toàn bộ dữ liệu mới sử dụng trường có sẵn (`variants`, `isPinned`, `characterProfile`, `note`, `origin`) hoặc trạng thái dẫn xuất trên bộ nhớ. Giữ nguyên nhãn tiếng Việt sẵn có và chuẩn thiết kế Mực & Chu Sa.
- **V. Atomic Commits & Documentation Synchronization**: PASS — Thay đổi khoanh vùng chặt chẽ trong luồng từ điển & prompt/QA dịch thuật của Feature 169; tạo đầy đủ `research.md`, `data-model.md`, `contracts/`, `quickstart.md` đồng bộ với mã nguồn.

*Post-Design Re-Check (after Phase 1)*: Toàn bộ 5 nguyên tắc tiếp tục **PASS**, không phát sinh vi phạm cần ngoại lệ trong Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/169-glossary-translation-quality/
├── spec.md                                      # Đặc tả nghiệp vụ đã làm rõ (US1–US5, FR-001–FR-016)
├── plan.md                                      # Tài liệu kế hoạch triển khai này
├── research.md                                  # Phase 0: 7 quyết định thiết kế kỹ thuật
├── data-model.md                                # Phase 1: Mô hình dữ liệu tính toán & chuyển đổi trạng thái
├── quickstart.md                                # Phase 1: Hướng dẫn xác minh tự động & thủ công
├── contracts/
│   └── glossary-quality-contracts.md            # Phase 1: Hợp đồng API nội bộ giữa lib/services/hooks/UI
└── checklists/
    └── requirements.md                          # Checklist kiểm tra chất lượng spec (16/16 đạt)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── glossaryMatch.ts                         # Mở rộng: variants conflict, groupGlossaryByRole, findNonOverlappingParagraphTerms,
│   │                                            # prioritizeKnownTermsForChapter, isNoisyGlossaryTerm, inferCharacterGenderFromContext, computeGlossaryHealth
│   └── __tests__/
│       └── glossaryMatch.test.ts                # Tests mở rộng cho US1–US4 logic thuần
├── services/
│   ├── glossaryIO.ts                            # Thêm GlossaryImportMode, prepareFileDeduplicatedItems, allValidItems trên preview
│   ├── ai/
│   │   ├── prompts.ts                           # Bổ sung note/type ở Polish, groupGlossaryByRole cho Raw/Polish/QA, chapter-prioritized exclusions
│   │   └── __tests__/
│   │       └── prompts.test.ts                  # Tests xác nhận ngữ cảnh đầy đủ & phân nhóm vai trò qua 3 pha + exclusions >300 từ
│   ├── translation/
│   │   ├── translationValidation.ts             # Dùng findNonOverlappingParagraphTerms trong checkGlossaryCompliance (triệt tiêu báo lỗi giả)
│   │   └── __tests__/
│   │       └── translationValidation.test.ts    # Tests cụm lồng nhau vs cụm đứng độc lập
│   └── __tests__/
│       └── glossaryIO.test.ts                   # Tests cho prepareFileDeduplicatedItems & preview.allValidItems
├── hooks/
│   ├── useGlossaryState.ts                      # Thêm healthReport, healthFilter, selectedIds, 4 bulk handlers, confirmImport(strategy, mode), fix saveEdit
│   ├── useGlossaryScan.ts                       # Dùng prioritizeKnownTermsForChapter, isNoisyGlossaryTerm, gợi ý giới tính không ghi đè manual/pinned
│   └── __tests__/
│       ├── useGlossaryState.test.ts             # Tests mới cho bulk actions, healthFilter, saveEdit preservation và replace_all import
│       └── useGlossaryScan.test.ts              # Tests mở rộng cho chapter-prioritized exclusions (>300 từ) & lọc nhiễu/giới tính
└── components/
    ├── GlossaryManager.tsx                      # Nối props GlossaryHealthBar, GlossaryBulkActionBar, GlossaryTable selection, ImportGuidelinesModal
    ├── __tests__/
    │   └── GlossaryManager.test.ts              # Tests tương tác UI cho health bar, bulk toolbar, table selection & replace_all modal
    └── glossary-manager/
        ├── GlossaryHealthBar.tsx                # Mới: thanh tóm tắt & lọc 1 chạm Sức khỏe từ điển (Mực & Chu Sa)
        ├── GlossaryBulkActionBar.tsx            # Mới: thanh thao tác hàng loạt 4 nhóm hành động (Xóa, Ghim/Bỏ ghim, Đổi loại, Gán giới tính)
        ├── GlossaryTable.tsx                    # Bổ sung checkbox từng dòng & chọn trang hiện tại (giữ virtual list mượt & click mở sidebar)
        └── ImportGuidelinesModal.tsx            # Bổ sung lựa chọn 2 chế độ: Chỉ thêm thuật ngữ vs Thay toàn bộ thuật ngữ + cảnh báo xác nhận
```

**Structure Decision**: Giữ nguyên kiến trúc Pure Client-Side SPA theo MVC tại `src/`. Chỉ thêm đúng 2 sub-component chuyên trách trong `src/components/glossary-manager/` (`GlossaryHealthBar.tsx` và `GlossaryBulkActionBar.tsx`) để tránh phình to `GlossaryManager.tsx` và `GlossaryTable.tsx`; toàn bộ nghiệp vụ và tính toán sức khỏe/khớp từ điển nằm ở `src/lib/glossaryMatch.ts` và `src/services/glossaryIO.ts`.

## Complexity Tracking

Không có vi phạm Hiến pháp (Constitution Principles) nào cần ngoại lệ.

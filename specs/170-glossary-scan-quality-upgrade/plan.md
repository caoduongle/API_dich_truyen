# Implementation Plan: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Branch**: `[170-glossary-scan-quality-upgrade]` | **Date**: 2026-11-27 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/170-glossary-scan-quality-upgrade/spec.md)

**Input**: Feature specification from `/specs/170-glossary-scan-quality-upgrade/spec.md`

## Summary

Nâng cấp chất lượng quét thuật ngữ đặc biệt dành cho các mô hình AI tốc độ cao (`flash-lite`) mà không tốn thêm bất kỳ lời gọi API hay quota RPM nào:
1. **Hardened Prompt & Neo ngữ cảnh từ Vòng 1**: Sửa typo trong `glossaryPrompts.ts`, siết chặt quy tắc cấm Bính âm ở `pinyin`/`vietnamese`, cấm chữ Hán trong `note`, cấm từ phổ thông/mã ngắn/mảnh cắt; truyền `genre`, `tone`, `description` và tối đa 150 thuật ngữ liên quan chương (kèm nghĩa Việt chuẩn) **ngay từ Vòng 1** trên cả luồng quét sỉ (`useGlossaryScan`) lẫn quét đơn chương (`useWorkspaceState`).
2. **Cổng hậu kiểm 3 luồng tất định (`src/lib/glossaryScanQuality.ts`)**: Phân loại mọi ứng viên quét thành **Chấp nhận** (sạch chuẩn + tự gợi ý giới tính an toàn), **Chờ duyệt** (Bính âm/chữ Hán trong `pinyin`/`vietnamese`, từ đơn 1 chữ Hán, mảnh cắt trùng/chồng lấn với mục đã có), hoặc **Loại bỏ** (đại từ, từ phổ thông sinh hoạt, câu hoàn chỉnh, mã ngắn `A1/A2`, dấu câu hỏng), kèm tự động làm sạch chữ Hán rò rỉ trong `note`.
3. **Telemetry phiên quét & Sức khỏe từ điển cho mục lỗi cũ**: Log tóm tắt 3 chỉ số sau phiên quét và bổ sung bộ đếm + bộ lọc 1 chạm `'format_issues'` (`"Lỗi phiên âm / ghi chú"`) trên `GlossaryHealthBar`.

## Technical Context

**Language/Version**: TypeScript ~5.8.2, React 19 (`^19.0.1`), ECMAScript Modules
**Primary Dependencies**: Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `opencc-js`, `clsx`, `tailwind-merge`, `@google/genai`
**Storage**: IndexedDB phía client (`src/services/db.ts`), `localStorage`; không thay đổi schema IndexedDB hay `src/types.ts`
**Testing**: Vitest `^4.1.12` + `jsdom` (`npm test`) và TypeScript (`npm run lint`)
**Target Platform**: Pure Client-Side SPA trên trình duyệt Web
**Project Type**: Pure Client-Side Single Page Application (MVC: `Components` → `Hooks` → `Services / Lib`)
**Performance Goals**: Cổng hậu kiểm đánh giá một chương < 10ms, phát sinh 0 API call bổ sung, tương thích bộ từ điển > 500–1.000 mục
**Constraints**: Tuân thủ `.agents/rules/design-system.md` (Mực & Chu Sa, không platform emoji); không sửa `src/types.ts` hoặc `src/services/db.ts`; không thêm package NPM mới; không tăng RPM pressure
**Scale/Scope**: 1 module pure lib mới (`src/lib/glossaryScanQuality.ts`) + ~10 file cập nhật thuộc `src/lib/`, `src/services/ai/`, `src/services/directGlossaryEngine.ts`, `src/hooks/`, `src/components/glossary-manager/` và bộ unit/UI tests tương ứng

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification**: PASS — Tuân thủ chạy đầy đủ `npm run lint`, `npm test`, `npm run build` và bổ sung test cho toàn bộ logic mới tái hiện các mẫu lỗi thực tế từ bộ 592 thuật ngữ.
- **II. Dependency Minimization & Existing Library Reuse**: PASS — 0 package mới; tái dùng `countHanChars`, `isNoisyGlossaryTerm`, `findNonOverlappingParagraphTerms`, `inferCharacterGenderFromContext`, `classifyDiscoveredEntitiesForGlossary` (`src/lib/glossaryMatch.ts`) và `canonicalizeHan` (`src/lib/sinoNormalize.ts`).
- **III. Strict Concern Separation & MVC Domain Boundary Preservation**: PASS — Logic lọc/chẩn đoán nằm thuần trong `src/lib/glossaryScanQuality.ts` & `src/lib/glossaryMatch.ts`; điều phối prompt nằm trong `src/services/ai/` & `src/services/directGlossaryEngine.ts`; hook trạng thái nằm trong `src/hooks/`; UI nằm thuần trong `GlossaryHealthBar.tsx`.
- **IV. Immutable Core Schemas & Storage Stability**: PASS — Không chỉnh sửa `src/types.ts` và `src/services/db.ts`. Không xóa dữ liệu cũ đã lưu của người dùng.
- **V. Atomic Commits & Documentation Synchronization**: PASS — Thay đổi khoanh vùng chặt trong Feature 170; cập nhật đồng bộ tài liệu thiết kế trong `specs/170-glossary-scan-quality-upgrade/`.

*Post-Design Re-Check (after Phase 1)*: Toàn bộ 5 nguyên tắc tiếp tục **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/170-glossary-scan-quality-upgrade/
├── spec.md                                      # Đặc tả nghiệp vụ Feature 170 (US1–US4, FR-001–FR-013)
├── plan.md                                      # Tài liệu kế hoạch triển khai này
├── research.md                                  # Phase 0: 6 quyết định kỹ thuật giải quyết 5 lỗi quét thực tế
├── data-model.md                                # Phase 1: ScanQualityEvaluation, Telemetry, Health formatIssueIds
├── quickstart.md                                # Phase 1: Hướng dẫn kiểm chứng tự động & kịch bản 592 mục
├── contracts/
│   └── glossary-scan-quality-contracts.md       # Phase 1: Hợp đồng API nội bộ giữa lib/prompts/hooks/UI
└── checklists/
    └── requirements.md                          # Checklist kiểm tra chất lượng spec (16/16 đạt)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── glossaryScanQuality.ts                   # Mới: detectMandarinPinyin, containsHanChars, sanitizeScannedNote,
│   │                                            # findSubTermOrCompositeOverlap, evaluateScannedTermCandidate,
│   │                                            # classifyScannedGlossaryBatch, prioritizeKnownAnchorEntriesForChapter
│   ├── glossaryMatch.ts                         # Mở rộng computeGlossaryHealth với formatIssueIds & 'format_issues' filter
│   └── __tests__/
│       ├── glossaryScanQuality.test.ts          # Mới: Unit tests cho toàn bộ 5 nhóm lỗi từ mẫu 592 mục
│       └── glossaryMatch.test.ts                # Test cho formatIssueIds trong computeGlossaryHealth
├── services/
│   ├── ai/
│   │   ├── glossaryPrompts.ts                   # Sửa typo '萬劍歸宗' và siết chỉ dẫn Hán-Việt/anti-Bính âm/anti-nhiễu
│   │   ├── prompts.ts                           # Mở rộng buildAnalyzeGlossaryPayload hỗ trợ genre/tone/description & Vòng 1 anchors
│   │   └── __tests__/
│   │       └── prompts.test.ts                  # Tests xác nhận Vòng 1 anchor & chỉ dẫn siết chuẩn
│   └── directGlossaryEngine.ts                  # Mở rộng DirectGlossaryCommonParams truyền context dự án & anchors
├── hooks/
│   ├── useGlossaryScan.ts                       # Truyền context từ Vòng 1, chạy classifyScannedGlossaryBatch, log telemetry 3 chỉ số
│   ├── useWorkspaceState.ts                     # Truyền context dự án + kiểm duyệt đầu ra cho quét đơn chương
│   ├── useGlossaryState.ts                      # Hỗ trợ healthFilter === 'format_issues'
│   └── __tests__/
│       └── useGlossaryScan.test.ts              # Tests Vòng 1 context + 3-luồng hậu kiểm & telemetry
└── components/
    ├── glossary-manager/
    │   └── GlossaryHealthBar.tsx                # Thêm pill lọc "Lỗi phiên âm / ghi chú" (format_issues)
    └── __tests__/
        └── GlossaryManagerUI.test.tsx           # Test pill format_issues trong GlossaryHealthBar
```

**Structure Decision**: Bổ sung duy nhất 1 module thuần chuyên trách `src/lib/glossaryScanQuality.ts` để tách rạch ròi logic hậu kiểm quét khỏi `glossaryMatch.ts`, giữ MVC sạch sẽ và dễ unit-test 100% độc lập không cần gọi Gemini API.

## Complexity Tracking

Không có vi phạm Hiến pháp (Constitution Principles) nào cần ngoại lệ.

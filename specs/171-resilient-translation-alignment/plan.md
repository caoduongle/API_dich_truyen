# Implementation Plan: Ổn Định Dịch Thuật, Bảo Toàn Cấu Trúc Đoạn & Chống Hoàn Tác Toàn Chương Cho Mô Hình Tốc Độ Cao

**Branch**: `[171-resilient-translation-alignment]` | **Date**: 2026-11-28 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/171-resilient-translation-alignment/spec.md)

**Input**: Feature specification from `/specs/171-resilient-translation-alignment/spec.md`

## Summary

Giải quyết triệt để vòng lặp chia nhỏ đa tầng, rớt phiên âm dự phòng, hoàn tác toàn chương ở bước chuốt văn và giữ oan chương lỗi sau QA trên mô hình tốc độ cao (`gemini-3.5-flash-lite`), thông qua 5 trụ cột thiết kế:
1. **Neo đoạn tường minh `<<P1>>`..`<<PN>>` & Sửa phẫu thuật GĐ1 (`paragraphAnchor.ts`, `rawTranslation.ts`, `polishTranslation.ts`, `prompts.ts`)**: Giữ nguyên schema JSON hiện có để tương thích ngược tuyệt đối, khóa ánh xạ 1-1 số lượng/thứ tự đoạn văn ngay cả trên model nhẹ; khi chỉ 1–4 đoạn sót chữ Hán hoặc thiếu 1–3 đoạn neo thì sửa phẫu thuật cục bộ thay vì chia đôi lặp 3 cấp.
2. **Hợp nhất chuốt văn ở cấp từng đoạn (`evaluateAndMergePolishRound` trong `translationValidation.ts`, `chapterTranslationService.ts`, `useWorkspaceState.ts`)**: Khi 1–3 đoạn trong bản chuốt suy giảm từ điển, mất ngoặc thoại hoặc lệch dấu câu, chỉ hoàn tác riêng các đoạn đó về lượt `K-1` và tiếp tục chuốt các đoạn còn lại bình thường; chỉ rollback toàn chương khi sụp đổ cấu trúc diện rộng (> 40% đoạn suy giảm hoặc cắt cụt).
3. **Đồng bộ từ điển trên văn bản tiền xử lý & bàn giao lỗi GĐ1 → GĐ2 (`prompts.ts`, `chapterTranslationService.ts`)**: Khớp từ điển trên `rawSourceText` để không đánh mất quy tắc/hồ sơ nhân vật khi dùng `processedSourceText`, đồng thời truyền thẳng `rawComplianceIssues` sang chỉ dẫn GĐ2 Lượt 1.
4. **Tự động sửa đoạn QA có phản hồi & phục hồi đoạn thiếu (`targetedRepair.ts`)**: Thêm tối đa 1 lượt thử sửa bổ sung kèm chỉ rõ lỗi an toàn vừa vướng, hỗ trợ khôi phục đoạn bị bỏ sót và ghi nhận `rejectionReasons` tiếng Việt chi tiết.
5. **Đối soát đúng danh sách chương lỗi cuối phiên (`chapterTranslationService.ts`, `useTranslationProcess.ts`)**: Chỉ giữ các chương còn lỗi nghiêm trọng chưa khắc phục hoặc rơi vào bản dự phòng trong `failedIds`, gỡ bỏ các chương đã sửa sạch.

## Technical Context

**Language/Version**: TypeScript ~5.8.2, React 19 (`^19.0.1`), ECMAScript Modules
**Primary Dependencies**: Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `opencc-js`, `clsx`, `tailwind-merge`, `@google/genai` (0 package mới)
**Storage**: IndexedDB phía client (`src/services/db.ts`), không thay đổi schema IndexedDB hay `src/types.ts`
**Testing**: Vitest `^4.1.12` + `jsdom` (`npm test`) và TypeScript (`npm run lint`)
**Target Platform**: Pure Client-Side SPA trên trình duyệt Web
**Project Type**: Pure Client-Side Single Page Application (MVC: `Components` → `Hooks` → `Services / Lib`)
**Performance Goals**: Xử lý phân tích neo đoạn và hợp nhất cấp đoạn hoàn toàn tất định phía client (< 15ms/chương), không làm tăng tổng số API call trung bình trên mô hình nhẹ
**Constraints**: Không sửa `src/types.ts` và `src/services/db.ts`; bảo toàn 100% các test hiện tại (gồm Feature 163–170); giữ MVC tách biệt (`services/` không import từ `hooks/` hoặc `components/`)
**Scale/Scope**: 1 module pure mới (`src/services/translation/paragraphAnchor.ts`), ~8 tệp dịch vụ/hook cập nhật thuộc `src/services/` & `src/hooks/`, cùng unit/integration tests tương ứng

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification**: PASS — Sau khi triển khai sẽ chạy đầy đủ `npm run lint`, `npm test`, `npm run build` và bổ sung test cho toàn bộ 5 User Stories (`US1`–`US5`).
- **II. Dependency Minimization & Existing Library Reuse**: PASS — Không thêm package NPM mới; tái dùng `selectRelevantGlossary`, `splitParagraphsPreservingOrder`, `realignParagraphStructure`, `validateStrictStructureParity`, `checkGlossaryCompliance`, `detectUngroundedProperNouns`, `fallbackSinoVietnameseLine` và `analyzeStructureParity`.
- **III. Strict Concern Separation & MVC Domain Boundary Preservation**: PASS — Logic neo đoạn, hợp nhất độ trung thành, bàn giao prompt và sửa lỗi QA nằm thuần trong `src/services/translation/` và `src/services/ai/`; điều phối tiến trình nằm trong `src/services/chapterTranslationService.ts` & `src/hooks/`; không kéo logic nghiệp vụ lên component.
- **IV. Immutable Core Schemas & Storage Stability**: PASS — Tuyệt đối không thay đổi `src/types.ts` hay `src/services/db.ts`; mọi trường mới đều đặt trên kiểu nội bộ trong `src/services/translation/types.ts` hoặc `ProcessChapterResult`.
- **V. Atomic Commits & Documentation Synchronization**: PASS — Thay đổi khoanh vùng chặt trong Feature 171 và đồng bộ đầy đủ tài liệu trong `specs/171-resilient-translation-alignment/`.

*Post-Design Re-Check (after Phase 1)*: Toàn bộ 5 nguyên tắc tiếp tục **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/171-resilient-translation-alignment/
├── spec.md                                        # Đặc tả nghiệp vụ Feature 171 (US1–US5, FR-001–FR-013)
├── plan.md                                        # Tài liệu kế hoạch triển khai này
├── research.md                                    # Phase 0: 6 quyết định kỹ thuật giải quyết lỗi nhật ký thực tế
├── data-model.md                                  # Phase 1: AnchoredParagraph, PolishParagraphMergeResult, Queue state
├── quickstart.md                                  # Phase 1: Kịch bản kiểm chứng cho 5 nhóm lỗi Chương 68–71
├── contracts/
│   └── resilient-translation-contracts.md         # Phase 1: Hợp đồng API giữa prompts, translation, service & hooks
└── checklists/
    └── requirements.md                            # Checklist chất lượng spec (16/16 đạt)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── ai/
│   │   ├── prompts.ts                             # Hỗ trợ rawSourceText, neo đoạn <<Pk>>, complianceIssuesToFix
│   │   └── __tests__/
│   │       └── prompts.test.ts                    # Tests neo đoạn, rawSourceText trên processedSourceText & handoff GĐ1→GĐ2
│   ├── translation/
│   │   ├── types.ts                               # PolishParagraphMergeResult, rawSourceText, complianceIssuesToFix, rejectionReasons
│   │   ├── paragraphAnchor.ts                     # Mới: encodeAnchoredParagraphs, parseAnchoredParagraphs, stripParagraphAnchors
│   │   ├── rawTranslation.ts                      # Tích hợp neo <<Pk>>, sửa phẫu thuật cục bộ, kiểm tra parity cả nhánh retry
│   │   ├── polishTranslation.ts                   # Tích hợp neo <<Pk>> & bàn giao complianceIssuesToFix
│   │   ├── translationValidation.ts               # Mới: evaluateAndMergePolishRound (hợp nhất từng đoạn + giữ tương thích cũ)
│   │   ├── targetedRepair.ts                      # 1 lượt thử sửa bổ sung có phản hồi, phục hồi đoạn thiếu & rejectionReasons
│   │   └── __tests__/
│   │       ├── paragraphAnchor.test.ts            # Mới: Unit tests neo/tách/gỡ sạch nhãn <<Pk>>
│   │       ├── translationValidation.test.ts      # Tests cho evaluateAndMergePolishRound (chấp nhận cục bộ vs rollback)
│   │       └── targetedRepair.test.ts             # Tests 1-retry có phản hồi, phục hồi đoạn thiếu & lý do từ chối
│   ├── chapterTranslationService.ts               # Truyền rawSourceText & lỗi GĐ1→GĐ2, dùng merge cấp đoạn & đếm unresolvedCritical
│   └── __tests__/
│       └── chapterTranslationService.test.ts      # Integration test kịch bản 68–71 (không hoàn tác oan toàn chương, truyền lỗi GĐ1→GĐ2)
└── hooks/
    ├── useTranslationProcess.ts                   # Gỡ chapter đã sửa sạch khỏi failedIds & log tóm tắt lỗi còn tồn đọng
    ├── useWorkspaceState.ts                       # Dùng evaluateAndMergePolishRound cho thao tác chuốt đơn chương
    └── __tests__/
        └── useTranslationProcess.test.ts          # Test dọn failedIds chính xác khi chương được sửa sạch sau QA
```

**Structure Decision**: Tách logic mã hóa/giải mã nhãn neo `<<Pk>>` vào 1 module thuần `src/services/translation/paragraphAnchor.ts` để cả GĐ1 (`rawTranslation.ts`) và GĐ2 (`polishTranslation.ts`) cùng `prompts.ts` dùng chung nhất quán, giữ nguyên MVC và khả năng unit-test độc lập 100% không cần gọi mạng.

## Complexity Tracking

Không có vi phạm Hiến pháp (Constitution Principles) nào cần ngoại lệ.

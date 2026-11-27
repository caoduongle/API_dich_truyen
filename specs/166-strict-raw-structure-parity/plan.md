# Implementation Plan: Cải thiện chất lượng dịch — Bảo toàn cấu trúc 1-1 với bản raw

**Branch**: `166-strict-raw-structure-parity` | **Date**: 2026-11-27 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/166-strict-raw-structure-parity/spec.md)

**Input**: Feature specification from `/specs/166-strict-raw-structure-parity/spec.md`

## Summary

Nâng cấp pipeline dịch thuật 3 giai đoạn (Dịch thô → Chuốt văn → Kiểm duyệt & Sửa cục bộ) để đảm bảo cấu trúc bản dịch khớp 1-1 với bản raw tiếng Trung về **xuống dòng/phân đoạn, dấu câu và cách ngắt câu**:
1. Xây dựng module thuần `src/services/translation/structureParity.ts` thực hiện: chuẩn hóa tất định 1-1 dấu câu toàn giác CJK sang chuẩn tiếng Việt (0 sót dấu câu Trung), khôi phục dòng an toàn không tốn quota, trích xuất chữ ký cấu trúc từng đoạn (`ParagraphStructuralSignature`), kiểm định khớp 1-1 số đoạn thân bài (kể cả chương < 5 đoạn) và phát hiện sai lệch dấu thoại / dấu ngữ khí / số câu.
2. Gia cố hệ thống chỉ dẫn (`prompts.ts`, `text.ts`, `chapterTranslationService.ts`, `targetedRepair.ts`) để đặt đối xứng 1-1 (xuống dòng, ngắt câu, dấu câu, thoại trực tiếp) ở mức ưu tiên #1 và loại bỏ chỉ dẫn mặc định khuyến khích viết lại tự do làm vỡ nhịp câu.
3. Tích hợp kiểm định nghiêm ngặt và tự phục hồi vào GĐ1 (`rawTranslation.ts`), GĐ2 (`polishTranslation.ts`, `evaluatePolishRoundFidelity` cho mọi lượt), GĐ3 (`translationValidation.ts`, `targetedRepair.ts`) và bộ đánh giá (`qualityEvaluator.ts`).

## Technical Context

**Language/Version**: TypeScript ~5.8.2, React 19.0.1
**Primary Dependencies**: `@google/genai` (qua `directGeminiClient.ts` hiện có), `opencc-js` (qua `sinoNormalize.ts`). Không thêm bất kỳ dependency mới nào.
**Storage**: IndexedDB phía client — không thay đổi schema hay `src/types.ts`.
**Testing**: Vitest (`vitest run`).
**Target Platform**: Pure Client-Side SPA (trình duyệt web).
**Project Type**: Web SPA (React + Vite) với tầng dịch vụ dịch thuật thuần TypeScript.
**Performance Goals**: Chuẩn hóa dấu câu & phân tích chữ ký cấu trúc tất định < 5ms trên một chương 5.000 chữ; 0 lượt gọi AI phát sinh thêm khi kết quả đã đạt chuẩn cấu trúc ngay từ lượt đầu.
**Constraints**: Tuân thủ nghiêm ngặt ranh giới MVC (`src/services/` không import hooks/components), bất biến `src/types.ts` & IndexedDB schema, và tương thích ngược toàn bộ 111 file test hiện có.
**Scale/Scope**: 1 module mới (`structureParity.ts`), 1 file test mới (`structureParity.test.ts`), và cập nhật có mục tiêu ~9 file trong `src/services/` & `src/lib/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification**: Đạt — yêu cầu chạy sạch `npm run lint`, `npm test`, `npm run build` và bổ sung test toàn diện cho mọi kịch bản cấu trúc 1-1.
- **II. Dependency Minimization & Existing Library Reuse**: Đạt — 0 package mới; tái sử dụng các hàm xử lý văn bản và điều phối chia nhỏ hiện có trong `src/lib/text.ts` và `src/services/translation/`.
- **III. Strict Concern Separation & MVC Domain Boundary Preservation**: Đạt — toàn bộ thay đổi nằm gọn trong tầng Model/Service (`src/services/translation/`, `src/services/ai/`, `src/lib/`, `src/services/chapterTranslationService.ts`), không chạm vào UI components.
- **IV. Immutable Core Schemas & Storage Stability**: Đạt — không sửa đổi `src/types.ts` hay IndexedDB schema; các cảnh báo cấu trúc ánh xạ vào `QaIssueType` hiện có.
- **V. Atomic Commits & Documentation Synchronization**: Đạt — phạm vi khu trú đúng trong pipeline dịch thuật của feature `166-strict-raw-structure-parity`.

**Post-Design Re-check**: Đạt toàn bộ 5 nguyên tắc cốt lõi của Constitution v2.0.0, không phát sinh vi phạm.

## Project Structure

### Documentation (this feature)

```text
specs/166-strict-raw-structure-parity/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── structure-parity-contract.md
└── tasks.md             # Sinh ở bước tiếp theo bởi /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── text.ts                                        # [MODIFY] Cập nhật LITERARY_TRANSLATION_FRAMING & getPolishStrategyForRound khóa ranh giới câu/dấu câu/dòng 1-1 (giữ nguyên chữ ký validateParagraphParity cũ)
└── services/
    ├── chapterTranslationService.ts                   # [MODIFY] Đồng bộ chỉ dẫn chuốt văn mặc định ưu tiên trung thành & cấu trúc 1-1
    ├── ai/
    │   ├── prompts.ts                                 # [MODIFY] Gia cố quy tắc dấu câu/ngắt câu/xuống dòng 1-1 + bản đồ số đoạn cho GĐ1, GĐ2, GĐ3
    │   └── __tests__/
    │       └── prompts.test.ts                        # [MODIFY] Đồng bộ kiểm thử chỉ dẫn mặc định & quy tắc cấu trúc 1-1
    └── translation/
        ├── index.ts                                   # [MODIFY] Re-export public API của structureParity.ts qua facade
        ├── bilingualSplit.ts                          # [MODIFY] Đồng bộ tách dòng đơn/kép nhất quán với bộ đếm đoạn
        ├── structureParity.ts                         # [NEW] Chuẩn hóa dấu câu CJK->Việt, khôi phục dòng an toàn, chữ ký đoạn & kiểm định 1-1
        ├── types.ts                                   # [MODIFY] Bổ sung trường tùy chọn cấu trúc cho PolishFidelityReport
        ├── rawTranslation.ts                          # [MODIFY] Tích hợp chuẩn hóa dấu câu, khôi phục dòng & validateStrictStructureParity cho GĐ1
        ├── polishTranslation.ts                       # [MODIFY] Tích hợp chuẩn hóa dấu câu, khôi phục dòng & validateStrictStructureParity cho GĐ2
        ├── targetedRepair.ts                          # [MODIFY] Bảo toàn cấu trúc 1 đoạn, dấu câu & ngắt câu khi sửa đoạn lỗi
        ├── translationValidation.ts                   # [MODIFY] Nâng cấp evaluatePolishRoundFidelity (mọi lượt) & checkStructureParityIssues
        ├── qualityEvaluator.ts                        # [MODIFY] Cập nhật kiểm tra parity đoạn 1-1 trong bộ đánh giá tất định
        └── __tests__/
            └── structureParity.test.ts                # [NEW] Unit tests cho chuẩn hóa dấu câu, ngắt câu, xuống dòng 1-1, split-retry & polish fidelity guard
```

**Structure Decision**: Giữ nguyên kiến trúc Pure Client-Side SPA hiện tại; cô lập thuật toán chuẩn hóa & đối chiếu cấu trúc 1-1 vào `src/services/translation/structureParity.ts` và kết nối qua các điểm mở rộng sẵn có của pipeline 3 giai đoạn.

## Complexity Tracking

> Không có vi phạm Constitution nào cần giải trình.

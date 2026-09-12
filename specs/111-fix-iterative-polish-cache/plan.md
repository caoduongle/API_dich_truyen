# Implementation Plan: Fix Iterative Polish Cache Bypass

**Branch**: `111-fix-iterative-polish-cache` | **Date**: 2026-09-12 | **Spec**: [specs/111-fix-iterative-polish-cache/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/111-fix-iterative-polish-cache/spec.md)

**Input**: Feature specification from `specs/111-fix-iterative-polish-cache/spec.md`

## Summary

Khắc phục triệt để hiện tượng "cache giả" khi người dùng kích hoạt nhiều vòng chuốt văn học (polishCycles 1→5) hoặc nhiều vòng rà soát thuật ngữ (extractionLoops 1→3). Do codebase thuần Client-Side không hề có server cache dịch thuật, nguyên nhân gốc rễ là do prompt bất biến và temperature cố định ở mức thấp khiến Google Gemini trả về kết quả tương tự qua các vòng lặp, đồng thời thiếu cơ chế loại trừ thuật ngữ đã biết trong quét từ điển và thiếu thuật toán phát hiện hội tụ (convergence detection). Giải pháp bao gồm:
1. Thiết kế chiến lược chuốt văn phân tầng 5 cấp độ (Tiered Polish Strategy) với chỉ thị biên tập chuyên sâu riêng biệt và dynamic temperature (0.40 → 0.65) theo từng vòng lặp.
2. Triển khai thuật toán đo độ tương đồng văn bản nhanh (Bigram Dice coefficient trên từ vựng tiếng Việt) để phát hiện hội tụ sớm, tự động dừng chu trình khi bản dịch đã đạt độ mượt tối ưu ($\ge 96\%$).
3. Cơ chế quét thuật ngữ lũy tiến (Progressive Glossary Scan) truyền danh sách thực thể đã phát hiện vào prompt để ép AI tìm kiếm các thuật ngữ mới bị sót ở các vòng tiếp theo.
4. Cho phép chuốt tiếp trên bản dịch đã chuốt trong trình soạn thảo đơn chương (`useWorkspaceState.ts`).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite  
**Primary Dependencies**: `@google/genai`, `lucide-react`, `clsx`, `tailwind-merge`, `motion` (Không thêm bất kỳ thư viện NPM mới nào).  
**Storage**: IndexedDB (`ai-story-translator-db` v4) - Giữ nguyên 100% schema và cấu trúc dữ liệu `Chapter`, `StoryProject`.  
**Testing**: Vitest (`npm test`), TypeScript checking (`npm run lint`), Vite build (`npm run build`).  
**Target Platform**: Hiện đại (Chrome, Edge, Firefox, Safari) SPA chạy hoàn toàn phía client.  
**Project Type**: Pure Client-Side Single Page Application (React 19).  
**Performance Goals**:
- Tính toán độ tương đồng Dice bigram giữa 2 bản dịch chương (< 2ms).
- Quyết định hội tụ và format prompt vòng lặp tức thì (< 5ms).
- Tiết kiệm 20-40% số request API không cần thiết khi bản dịch hội tụ sớm.  
**Constraints**:
- Tuân thủ nghiêm ngặt ranh giới MVC (Principle III).
- Giữ nguyên cấu trúc phân đoạn (`\n\n`) và dòng tiêu đề chương độc lập.
- Giữ nguyên nhãn giao diện tiếng Việt hiện có (Principle IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú tuân thủ |
|---|---|---|
| **I. Strict Quality Gates** | ✅ PASS | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` vượt qua 100%. |
| **II. Dependency Minimization** | ✅ PASS | Không cài đặt thêm bất kỳ package nào; thuật toán so sánh chuỗi và chiến lược chuốt được tự xây dựng bằng TypeScript chuẩn trong `src/lib/text.ts`. |
| **III. Strict Concern Separation (MVC)** | ✅ PASS | Thuật toán và prompts nằm trong `src/lib/` và `src/services/ai/`; logic điều phối dịch thuật nằm trong `src/services/`; state orchestration nằm trong `src/hooks/`; không chạm giao diện nếu không cần thiết. |
| **IV. Immutable Core Schemas & Storage** | ✅ PASS | Không thay đổi schema `Chapter`, `StoryProject`, `GlossaryItem` trong `src/types.ts` và IndexedDB. Chỉ mở rộng tham số hàm nội bộ với tính tương thích ngược hoàn toàn. |
| **V. Atomic Commits & Docs Sync** | ✅ PASS | Tất cả tài liệu spec, plan, research, contracts được tạo đầy đủ và đồng bộ 1:1 với kế hoạch mã nguồn. |

## Project Structure

### Documentation (this feature)

```text
specs/111-fix-iterative-polish-cache/
├── spec.md              # Feature specification
├── plan.md              # This file (Implementation Plan)
├── research.md          # Phase 0: Nguyên nhân gốc rễ & Quyết định kỹ thuật
├── data-model.md        # Phase 1: Entities, Strategy, Convergence models
├── quickstart.md        # Phase 1: Hướng dẫn kiểm thử & Xác thực end-to-end
├── contracts/           # Phase 1: TypeScript interfaces/contracts
│   ├── polish-strategy.contract.ts
│   └── glossary-scan-loop.contract.ts
└── checklists/
    └── requirements.md  # Quality checklist (12/12 passed)
```

### Source Code Layout (repository root)

```text
src/
├── lib/
│   ├── text.ts                         # [MODIFY] Thêm getPolishStrategyForRound, calculateTextSimilarity
│   └── __tests__/
│       └── text.test.ts                # [MODIFY] Bổ sung unit test cho Dice similarity và tiered strategies
├── services/
│   ├── ai/
│   │   ├── prompts.ts                  # [MODIFY] buildPolishTranslationPayload, buildAnalyzeGlossaryPayload
│   │   └── glossaryPrompts.ts          # [MODIFY] Thêm hỗ trợ chỉ thị loại trừ thuật ngữ đã có
│   ├── directTranslationEngine.ts      # [MODIFY] polishTranslationDirect nhận roundIndex, dynamic temperature
│   ├── directGlossaryEngine.ts         # [MODIFY] analyzeGlossaryDirect nhận knownChineseTerms, loopIndex
│   ├── chapterTranslationService.ts    # [MODIFY] Vòng lặp chuốt kiểm tra hội tụ, ghi log diff % và giai đoạn
│   └── __tests__/
│       ├── directTranslationEngine.test.ts # [MODIFY] Test roundIndex & dynamic temperature
│       ├── chapterTranslationService.test.ts# [MODIFY] Test convergence detection & early termination
│       └── directGlossaryEngine.test.ts    # [MODIFY] Test knownTerms exclusion
└── hooks/
    ├── useGlossaryScan.ts              # [MODIFY] Truyền updatedGlossary vào các loop sau
    ├── useWorkspaceState.ts            # [MODIFY] Cho phép chuốt tiếp từ polishedTranslation hiện tại
    └── __tests__/
        └── useGlossaryScan.test.ts     # [MODIFY] Kiểm tra loop truyền excludedTerms
```

## Complexity Tracking

> Không có vi phạm Hiến pháp (Constitution) nào cần giải trình. Mọi thay đổi đều tuân thủ kiến trúc Pure Client-Side SPA và ranh giới MVC.

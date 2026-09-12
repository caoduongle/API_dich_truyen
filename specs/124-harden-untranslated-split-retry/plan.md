# Implementation Plan: Gia cố cơ chế phân đoạn cứu nguy và chống sót chữ Hán cho mô hình Flash-Lite

**Branch**: `124-harden-untranslated-split-retry` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/124-harden-untranslated-split-retry/spec.md`

## Summary

Bản kế hoạch khắc phục triệt để sự cố chương truyện bị bỏ qua khi dịch bằng mô hình gọn nhẹ (Flash-Lite) phát sinh lỗi sót chữ Hán `UNTRANSLATED_CHINESE_LEFTOVER`. Kế hoạch bao gồm 4 cải tiến then chốt:
1. Tách biệt bộ đếm phân đoạn độ dài văn bản (> 2000 token) khỏi cấp độ thử lại lỗi (`retryDepth`).
2. Gia cố chỉ thị chống sao chép chữ Hán (Reinforced Prompt Directive) tự động khi kích hoạt cứu nguy.
3. Cơ chế cứu nguy phân cấp đa tầng (Multi-tier Graceful Fallback): Khi phân đoạn con chạm trần đệ quy (cấp 2), tự động chuyển sang dịch phân rã từng dòng (`line-by-line fallback`), và phiên âm Hán-Việt cho các chữ Hán còn sót thay vì đánh sập toàn bộ chương.
4. Tối ưu hóa prompt loại bỏ việc chèn trùng lặp văn bản nguồn khi đã sử dụng văn bản quét từ điển.

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Vite  
**Primary Dependencies**: `@google/genai`, `clsx`, `tailwind-merge`, `motion`, `lucide-react`  
**Storage**: Client-side IndexedDB (`src/services/db.ts`) (không thay đổi cấu trúc bảng hoặc schema)  
**Testing**: Vitest (`vitest run`), React Testing Library  
**Target Platform**: Modern Web Browsers (Pure Client-Side SPA, zero backend dependencies)  
**Project Type**: Single Page Web Application (SPA)  
**Performance Goals**:
- Cứu nguy phân đoạn và xử lý fallback dưới 2 giây/phân đoạn.
- Đạt tỉ lệ dịch thành công >= 95% trên các chương dài với mô hình Flash-Lite.  
**Constraints**:
- Tuân thủ MVC: `src/services/` là business logic thuần túy, không import hook hay component.
- Không thêm dependency NPM mới.
- Không sửa schema IndexedDB hay các interface cốt lõi trong `src/types.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc Hiến pháp | Đánh giá | Ghi chú tuân thủ |
|---|:---:|---|
| **I. Strict Quality Gates & Verification** | **PASS** | Bắt buộc chạy và pass 100% `npm run lint`, `npm test` (toàn bộ 67+ test files), và `npm run build` trước khi hoàn tất. |
| **II. Dependency Minimization & Existing Library Reuse** | **PASS** | Tái sử dụng các công cụ sẵn có: `splitTextAdaptively`, `validateTranslationOutput`, `separateChapterTitleAndBody`. Không thêm thư viện ngoài. |
| **III. Strict Concern Separation & MVC Domain Boundary** | **PASS** | Toàn bộ logic thử lại đa tầng nằm trong `src/services/directTranslationEngine.ts` và `src/services/ai/prompts.ts`, cập nhật log qua callback `onSplitRetry`. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | Không sửa đổi `src/types.ts` hoặc IndexedDB schema. Dữ liệu chương truyện lưu giữ nguyên vẹn cấu trúc. |
| **V. Atomic Commits & Documentation Synchronization** | **PASS** | Cập nhật đồng bộ các tài liệu spec, plan, research, data-model, quickstart. |

## Project Structure

### Documentation (this feature)

```text
specs/124-harden-untranslated-split-retry/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Technical research & root cause analysis
├── data-model.md        # Data models & multi-tier state machine
├── quickstart.md        # Test scenarios and validation guide
├── contracts/           # Interfaces and contracts
│   └── translation-resilience.ts
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── ai/
│   │   └── prompts.ts                    # [MODIFY] Chống lặp kép văn bản nguồn khi có từ điển, bổ sung chỉ thị tăng cường chống chữ Hán khi retry
│   ├── directTranslationEngine.ts        # [MODIFY] Tách retryDepth khỏi pre-split token; triển khai Tier 2 (line-by-line fallback) khi chạm trần đệ quy
│   ├── chapterTranslationService.ts      # [VERIFY] Cập nhật thông điệp log chẩn đoán theo từng tier cứu nguy
│   └── __tests__/
│       └── directTranslationEngine.test.ts # [MODIFY] Thêm test case cho văn bản dài chia đôi + thử lại nhiều cấp + fallback từng dòng
```

## Complexity Tracking

| Hạng mục | Lý do cần thiết | Giải pháp đơn giản hơn bị từ chối vì sao |
|---|---|---|
| Tách biệt `retryDepth` | Đảm bảo mỗi phân đoạn con luôn có 2 cấp thử lại độc lập | Gộp chung `depth` làm cạn kiệt số lần thử lại của các chương dài > 2000 token. |
| Tier 2 Line-by-Line Fallback | Cứu nguy phân đoạn khó mà không đánh sập toàn bộ chương | Ném lỗi làm bỏ qua cả chương truyện 4000 từ chỉ vì một đoạn văn lỗi. |

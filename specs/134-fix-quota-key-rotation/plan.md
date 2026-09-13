# Implementation Plan: Sửa Cơ Chế Xoay Vòng API Key Khi Chạm Quota & Tránh Kẹt Khóa Lỗi (134-fix-quota-key-rotation)

**Branch**: `134-fix-quota-key-rotation` | **Date**: 2026-09-13 | **Spec**: [`specs/134-fix-quota-key-rotation/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/134-fix-quota-key-rotation/spec.md)

**Input**: Feature specification from [`specs/134-fix-quota-key-rotation/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/134-fix-quota-key-rotation/spec.md)

## Summary

Khắc phục triệt để sự cố con trỏ API key bị kẹt cứng ở khóa bị lỗi (#7) và sự cố nuốt mã lỗi `ALL_KEYS_EXHAUSTED` thành lỗi quá tải tạm thời:
1. Tự động tịnh tiến chỉ số khóa xoay vòng (`currentApiKeyIndexRef.current`) sau mỗi chương/lô (cả trường hợp thành công lẫn thất bại), đảm bảo phân bổ tải đều cho các khóa còn lại và không bao giờ lặp lại khóa vừa kiệt sức.
2. Tự động tìm và gán khóa khả dụng khỏe mạnh đầu tiên khi bắt đầu hoặc bấm "Dịch lại các chương lỗi" (`handleRetryFailedChapters`).
3. Bảo toàn mã `code === 'ALL_KEYS_EXHAUSTED'` qua lớp `chapterTranslationService.ts`.
4. Trong `useTranslationProcess.ts`, phát hiện chính xác lỗi `ALL_KEYS_EXHAUSTED` để kích hoạt dừng khẩn cấp toàn bộ tiến trình thay vì lặp qua bỏ qua hàng chục chương trong hàng đợi.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19  
**Primary Dependencies**: `@google/genai` client SDK, `localQuotaTracker`  
**Storage**: IndexedDB (client-side single source of truth), `sessionStorage` (cache quota tracker), `localStorage` (`gemini_quota_custom_limits`)  
**Testing**: Vitest (`npx vitest run`)  
**Target Platform**: Pure Client-Side SPA (Web Browser, Zero-Backend)  
**Project Type**: Web Application  
**Performance Goals**: Không thêm độ trễ mạng; bỏ qua khóa kiệt sức trong 0ms; dừng khẩn cấp ngay lập tức tại chương đầu tiên khi hết sạch quota toàn bộ khóa  
**Constraints**: Tuân thủ tuyệt đối [`.specify/memory/constitution.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/.specify/memory/constitution.md) (Không sửa schema `types.ts`, không sửa logic dịch trong `src/services/` ngoài luồng quota/error code, giữ nguyên nhãn tiếng Việt, 100% test pass)  
**Scale/Scope**: Tác động trực tiếp đến 3 tệp cốt lõi: `src/hooks/useTranslationProcess.ts`, `src/services/chapterTranslationService.ts`, `src/services/directGeminiClient.ts` và các tệp unit test tương ứng.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên Tắc | Đánh Giá Tuân Thủ | Trạng Thái |
|---|---|---|
| **I. Strict Quality Gates** | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` trước khi hoàn tất. Không được skip hay xóa test. | **PASS** |
| **II. Dependency Minimization** | Không cài đặt thêm bất kỳ thư viện NPM nào. Tận dụng `localQuotaTracker` và các tiện ích có sẵn. | **PASS** |
| **III. MVC Domain Boundary** | Phân định rạch ròi: `localQuotaTracker.ts` và `directGeminiClient.ts` (Model) tính toán sức khỏe và gọi API; `useTranslationProcess.ts` (Controller) điều phối chỉ số con trỏ và vòng lặp; UI View chỉ hiển thị trạng thái. | **PASS** |
| **IV. Immutable Core Schemas** | Giữ nguyên schema IndexedDB và các interface trong `src/types.ts`. Giữ nguyên văn phong tiếng Việt của giao diện. | **PASS** |
| **V. Atomic Commits & Sync** | Tạo các tệp đặc tả, kế hoạch, kiểm thử độc lập trong `specs/134-fix-quota-key-rotation/`. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/134-fix-quota-key-rotation/
├── plan.md              # Kế hoạch triển khai (tệp này)
├── research.md          # Phân tích nguyên nhân gốc rễ và quyết định kỹ thuật
├── data-model.md        # Vòng đời con trỏ khóa và máy trạng thái sức khỏe
├── quickstart.md        # Hướng dẫn kịch bản kiểm thử độc lập
├── contracts/           # Hợp đồng giao tiếp giữa các tầng
│   └── key-rotation-quota.contract.md
└── checklists/
    └── requirements.md  # Bảng kiểm tra chất lượng đặc tả
```

### Source Code (affected files)

```text
src/
├── hooks/
│   ├── useTranslationProcess.ts            # [SỬA] Tịnh tiến con trỏ khóa, nhận diện ALL_KEYS_EXHAUSTED dừng khẩn cấp, smart retry init
│   └── __tests__/
│       └── useTranslationProcess.test.ts  # [BỔ SUNG] Unit tests cho luân chuyển khóa, retry init, dừng khẩn cấp
├── services/
│   ├── chapterTranslationService.ts        # [SỬA] Bảo toàn thuộc tính code: 'ALL_KEYS_EXHAUSTED' khi rethrow
│   ├── directGeminiClient.ts               # [KIỂM TRA/SỬA] Đảm bảo ném đúng mã ALL_KEYS_EXHAUSTED khi hết key
│   └── __tests__/
│       └── chapterTranslationService.test.ts # [BỔ SUNG] Test bảo toàn error code
```

## Phase 0: Outline & Research

- [x] Đã nghiên cứu cơ chế xoay tua khóa và xác định nguyên nhân con trỏ `currentApiKeyIndexRef.current` bị kẹt cứng ở Khóa #7.
- [x] Đã tìm ra lỗi nuốt mã ngoại lệ `code === 'ALL_KEYS_EXHAUSTED'` tại `chapterTranslationService.ts`.
- [x] Đã tìm ra phép so sánh sai chuỗi `errMsg.startsWith("ALL_KEYS_EXHAUSTED")` tại `useTranslationProcess.ts`.
- [x] Đã xuất bản [`specs/134-fix-quota-key-rotation/research.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/134-fix-quota-key-rotation/research.md).

## Phase 1: Design & Contracts

- [x] Đã lập mô hình dữ liệu và biểu đồ vòng đời con trỏ khóa trong [`specs/134-fix-quota-key-rotation/data-model.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/134-fix-quota-key-rotation/data-model.md).
- [x] Đã định nghĩa hợp đồng ném ngoại lệ và giao diện con trỏ trong [`specs/134-fix-quota-key-rotation/contracts/key-rotation-quota.contract.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/134-fix-quota-key-rotation/contracts/key-rotation-quota.contract.md).
- [x] Đã hoàn thành hướng dẫn kiểm thử độc lập trong [`specs/134-fix-quota-key-rotation/quickstart.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/134-fix-quota-key-rotation/quickstart.md).
- [x] Tái đánh giá Hiến Pháp sau thiết kế: Toàn bộ tiêu chí tuân thủ MVC và kiểm soát chất lượng đạt chuẩn (PASS).

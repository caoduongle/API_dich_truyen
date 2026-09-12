# Implementation Plan: Tự động kích hoạt Adaptive Content Split Retry khi gặp lỗi UNTRANSLATED_CHINESE_LEFTOVER

**Branch**: `123-adaptive-split-untranslated-retry` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/123-adaptive-split-untranslated-retry/spec.md`

## Summary

Tính năng tự động kích hoạt cơ chế chia nhỏ thích ứng (Adaptive Content Split Retry / Divide & Conquer) khi gặp lỗi vi phạm tỉ lệ chữ Hán chưa dịch (`UNTRANSLATED_CHINESE_LEFTOVER`) trong cả Giai đoạn 1 (Dịch thô) và Giai đoạn 2 (Chuốt văn phong). Thay vì coi đây là lỗi chí mạng khiến chương truyện bị bỏ qua (`skipFailedChapters`) hoặc làm gián đoạn tiến trình dịch, hệ thống tự động nhận diện lỗi, chia nhỏ văn bản theo ranh giới đoạn văn tự nhiên, thực thi dịch/chuốt lại từng phân đoạn con với xoay vòng API key, ghép nối kết quả hoàn chỉnh bảo toàn tiêu đề chương và thông báo trực quan trên nhật ký tiến trình thời gian thực.

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Vite  
**Primary Dependencies**: `@google/genai` (SDK gọi trực tiếp Gemini API), `clsx`, `tailwind-merge`, `motion`, `lucide-react`  
**Storage**: Client-side IndexedDB (`src/services/db.ts`) (không thay đổi cấu trúc bảng hoặc schema)  
**Testing**: Vitest (`vitest run`), React Testing Library  
**Target Platform**: Modern Web Browsers (Pure Client-Side SPA, zero backend dependencies)  
**Project Type**: Single Page Web Application (SPA)  
**Performance Goals**:
- Kích hoạt phân đoạn cứu nguy và phát nhật ký phản hồi trong vòng dưới 1 giây.
- Giới hạn độ sâu phân đoạn đệ quy tối đa `depth <= 2` để đảm bảo thời gian xử lý và tránh nghẽn hạn mức API.  
**Constraints**:
- Tuân thủ nghiêm ngặt mô hình MVC: `src/services/` là business logic thuần túy, không import hook hoặc component.
- Không thêm bất kỳ dependency NPM mới nào.
- Giữ nguyên vẹn các interface cốt lõi trong `src/types.ts` và cơ sở dữ liệu IndexedDB.  
**Scale/Scope**:
- Cập nhật hàm phân loại lỗi và cơ chế thử lại đệ quy trong `src/services/directTranslationEngine.ts`.
- Gắn kết callback chẩn đoán `onSplitRetry` vào hàm điều phối `src/services/chapterTranslationService.ts`.
- Bổ sung unit test toàn diện trong `src/services/__tests__/directTranslationEngine.test.ts` và `src/services/__tests__/chapterTranslationService.test.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc Hiến pháp | Đánh giá | Ghi chú tuân thủ |
|---|:---:|---|
| **I. Strict Quality Gates & Verification** | **PASS** | Bắt buộc chạy và pass 100% `npm run lint`, `npm test` (toàn bộ 67+ test suite), và `npm run build` trước khi báo cáo hoàn thành. Tuyệt đối không xóa/skip test. |
| **II. Dependency Minimization & Existing Library Reuse** | **PASS** | Không cài đặt thêm bất kỳ thư viện NPM nào. Tái sử dụng tối đa các tiện ích có sẵn: `splitTextAdaptively`, `validateTranslationOutput`, `separateChapterTitleAndBody`, `ensureChapterTitlePreserved`. |
| **III. Strict Concern Separation & MVC Domain Boundary** | **PASS** | Logic chia nhỏ và kiểm tra lỗi đặt gọn trong tầng Service (`src/services/directTranslationEngine.ts`). Thông tin giao diện được truyền qua callback tùy chọn `onSplitRetry`, không vi phạm ranh giới tầng giữa Service và View/Hooks. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | Không thay đổi schema của IndexedDB (`src/services/db.ts`) hay các kiểu dữ liệu cốt lõi trong `src/types.ts`. Các nhãn UI tiếng Việt được bảo lưu nhất quán. |
| **V. Atomic Commits & Documentation Synchronization** | **PASS** | Kế hoạch được chia nhỏ, tài liệu đặc tả, research, data model và quickstart được đồng bộ chuẩn hóa 1:1 theo Spec Kit. |

## Project Structure

### Documentation (this feature)

```text
specs/123-adaptive-split-untranslated-retry/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Technical research & decisions (/speckit-plan Phase 0)
├── data-model.md        # Data models & state transitions (/speckit-plan Phase 1)
├── quickstart.md        # Validation & test execution guide (/speckit-plan Phase 1)
├── contracts/           # API and engine contracts (/speckit-plan Phase 1)
│   └── translation-engine.ts
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── text.ts                           # Tiện ích tính tỷ lệ chữ Hán & phân chia thích ứng (đã có sẵn)
├── services/
│   ├── directTranslationEngine.ts        # [MODIFY] Hợp nhất isAdaptiveSplitRetryableError, triển khai recursive split retry cho GĐ1 và tích hợp vào GĐ2
│   ├── chapterTranslationService.ts      # [MODIFY] Truyền callback onSplitRetry để ghi nhận nhật ký cứu nguy [Cứu nguy GĐ1] và [Cứu nguy GĐ2]
│   └── __tests__/
│       ├── directTranslationEngine.test.ts   # [MODIFY] Bổ sung ca kiểm thử tự động chia nhỏ khi gặp UNTRANSLATED_CHINESE_LEFTOVER ở cả GĐ1 và GĐ2
│       └── chapterTranslationService.test.ts # [VERIFY] Xác minh luồng cứu nguy trong dịch chương đơn & hàng loạt
```

**Structure Decision**: Cấu trúc ứng dụng Single Client SPA. Tất cả thay đổi chỉ tác động lên tầng xử lý dịch thuật trực tiếp trong `src/services/` và các file kiểm thử liên quan, đảm bảo an toàn tuyệt đối cho tầng giao diện và dữ liệu lưu trữ.

## Complexity Tracking

> Không có vi phạm Hiến pháp nào cần giải trình. Thiết kế tái sử dụng tối đa cấu trúc có sẵn của `polishWithContentSplitDirect` và `splitTextAdaptively`.

| Hạng mục | Lý do cần thiết | Giải pháp đơn giản hơn bị từ chối vì sao |
|---|---|---|
| Đệ quy chia nhỏ GĐ1 (`rawWithContentSplitDirect`) | Cứu nguy khi bản dịch thô bị nhại tiếng Trung trên đoạn văn dài | Bỏ qua chương làm mất dữ liệu; bỏ qua đoạn văn vi phạm chất lượng bản dịch. |
| Callback `onSplitRetry` | Hiển thị log chẩn đoán thời gian thực cho người dùng | Console.log không hiển thị trên UI; gọi trực tiếp hook vi phạm kiến trúc MVC. |

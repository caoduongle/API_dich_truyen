# Implementation Plan: Cải Tiến Cẩm Nang Dịch Thuật, Quy Tắc Dịch, Tông Giọng Biên Tập & Thể Loại Chính

**Branch**: `167-translation-guidelines-style-upgrade` | **Date**: 2026-11-27 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/spec.md)

**Input**: Feature specification from `/specs/167-translation-guidelines-style-upgrade/spec.md`

## Summary

Nâng cấp toàn diện hệ thống định hướng văn phong dịch thuật Trung → Việt (Thể loại chính, Tông giọng biên tập, Quy tắc dịch và Cẩm nang dịch thuật `.md`) để tăng chất lượng và tính nhất quán của bản dịch qua tất cả các pha:
1. Tập trung hóa danh mục mở rộng gồm **17 Thể loại chính** (kèm chỉ dẫn văn phong chuyên sâu, con dấu chữ Hán, gợi ý tông giọng và mẫu cẩm nang khởi tạo) và **11 Tông giọng biên tập** (kèm quy chuẩn hành vi cụ thể về tỷ lệ Hán-Việt, nhịp văn, hội thoại/tự sự) cùng hỗ trợ giá trị tùy chỉnh vào một module thuần `src/config/translationStyles.ts`.
2. Chuẩn hóa chuỗi dịch qua cả 4 công đoạn (Dịch thô, Chuốt văn nhiều lượt, Kiểm duyệt QA, Sửa cục bộ) theo thứ tự ưu tiên tất định: **Nguyên tác & Từ điển & Cấu trúc 1-1 > Quy tắc dịch riêng của dự án > Tông giọng biên tập > Thể loại chính**.
3. Khắc phục việc cắt cụt âm thầm tại 4.000 ký tự khi phân tích cẩm nang `.md` bằng cách nâng ngưỡng phân tích lên 24.000 ký tự, lọc bỏ bảng thuật ngữ dài khỏi lát cắt văn xuôi (`extractGuidelinesProseSection`), bổ sung bộ trích xuất cục bộ dự phòng khi ngoại tuyến/thiếu API key, và cung cấp giao diện chỉnh sửa thống nhất (`StyleGuidelineEditor`) hỗ trợ chế độ có cấu trúc / thô, cảnh báo mâu thuẫn không chặn lưu, xem trước hợp nhất/ghi đè và xuất Markdown tại cả màn hình tạo mới lẫn chỉnh sửa dự án.
4. Bảo toàn 100% tương thích ngược với `StoryProject` (`src/types.ts`) và IndexedDB hiện hành — không đổi schema dữ liệu lõi.

## Technical Context

**Language/Version**: TypeScript `~5.8.2`, React `^19.0.1`  
**Primary Dependencies**: Vite `^6.4.6`, Tailwind CSS `^4.1.14`, `@google/genai` `^2.4.0`, `lucide-react` `^0.546.0`, `clsx` `^2.1.1`, `tailwind-merge` `^3.6.0` (không thêm dependency mới)  
**Storage**: IndexedDB phía client (giữ nguyên schema hiện có; lưu cấu trúc cẩm nang dưới dạng Markdown chuẩn trong `StoryProject.description` và tùy chỉnh trong `StoryProject.genre` / `StoryProject.tone`)  
**Testing**: Vitest `^4.1.12` + `jsdom` `29.1.1` (`npm test` -> `vitest run`)  
**Target Platform**: Trình duyệt web (Pure Client-Side SPA)  
**Project Type**: Single Page Web Application (Client-side MVC)  
**Performance Goals**: Render và kiểm tra mâu thuẫn cẩm nang đồng bộ < 16ms trên mỗi thao tác nhập; lọc & phân tích cẩm nang `.md` > 24.000 ký tự không chặn luồng chính  
**Constraints**: Tuân thủ nghiêm ngặt MVC boundaries (`AGENTS.md` §4 & Constitution Principle III), không thay đổi `src/types.ts` và IndexedDB schema (Constitution Principle IV), không làm phá vỡ bất biến cấu trúc đoạn/dòng 1-1 của Feature 166, tuân thủ Design System "Mực & Chu Sa" (`.agents/rules/design-system.md`)  
**Scale/Scope**: ~10–12 tệp nguồn và test liên quan trực tiếp (1 module config mới, 1 component UI dùng chung mới, cập nhật 2 modal dự án, cập nhật `prompts.ts`, `targetedRepair.ts`, `directGlossaryEngine.ts`, `text.ts`, `constants.ts`, `GenreMark.tsx`, `TranslatorWorkspace.tsx`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification (PASS)**: Kế hoạch bao gồm đầy đủ unit test mới/cập nhật cho config, service phân tích cẩm nang, prompt builder, targeted repair và kiểm tra UI; mọi thay đổi sẽ được xác minh qua `npm run lint`, `npm test`, `npm run build` mà không xóa hay làm yếu assertion.
- **II. Dependency Minimization & Existing Library Reuse (PASS)**: Không cài thêm bất kỳ package NPM nào; tái sử dụng `cn()`, `Button`, `Badge`, `GenreMark`, `lucide-react`, `parseGlossaryFromMd`, `sanitizePromptInput`.
- **III. Strict Concern Separation & MVC Domain Boundary Preservation (PASS)**:
  - Model/Config (`src/config/translationStyles.ts`, `src/config/constants.ts`, `src/lib/text.ts`, `src/services/**`) hoàn toàn thuần TypeScript, không import từ `src/components/` hay `src/hooks/`.
  - View (`src/components/common/StyleGuidelineEditor.tsx`, `ProjectFormModal.tsx`, `ProjectMetadataModal.tsx`, `GenreMark.tsx`) chỉ làm nhiệm vụ hiển thị và gọi hàm thuần / service có sẵn, không nhúng prompt Gemini.
- **IV. Immutable Core Schemas & Storage Stability (PASS)**: Không sửa `src/types.ts` (trừ trường hợp đọc lại kiểm chứng không đụng vào interface lõi `StoryProject`), không thay đổi schema/version IndexedDB. Mọi dự án cũ tiếp tục nạp và chạy bình thường.
- **V. Atomic Commits & Documentation Synchronization (PASS)**: Phạm vi diff khu trú chặt trong tính năng nâng cấp thể loại, tông giọng, quy tắc dịch và cẩm nang dịch thuật; giữ nguyên các thay đổi uncommitted từ Feature 165 & 166.

*Post-Design Re-Check*: Toàn bộ thiết kế trong `research.md`, `data-model.md`, `contracts/translation-style-contracts.md` đều giữ nguyên 5 cổng PASS, không phát sinh ngoại lệ cần giải trình ở Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/167-translation-guidelines-style-upgrade/
├── plan.md                                      # Kế hoạch triển khai này
├── research.md                                  # Quyết định kỹ thuật & lý do lựa chọn
├── data-model.md                                # Mô hình dữ liệu domain & quy tắc validate
├── quickstart.md                                # Hướng dẫn kiểm chứng chất lượng
├── contracts/
│   └── translation-style-contracts.md           # Hợp đồng API nội bộ & định dạng Markdown
└── checklists/
    └── requirements.md                          # Checklist chất lượng đặc tả (16/16 pass)
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── constants.ts                             # Nâng MAX_CHARS_FOR_GUIDELINES_ANALYSIS (4000 -> 24000)
│   ├── translationStyles.ts                     # [NEW] Danh mục 17 Genre, 11 Tone, starter template, parser/serializer, conflict detector
│   └── __tests__/
│       └── translationStyles.test.ts            # [NEW] Unit test toàn bộ hồ sơ thể loại/tông giọng, round-trip & conflict detection
├── lib/
│   ├── text.ts                                  # Re-export getGenreStyleGuide từ translationStyles.ts
│   └── __tests__/
│       └── text.test.ts                         # Kiểm tra tương thích getGenreStyleGuide hiện hữu
├── services/
│   ├── directGlossaryEngine.ts                  # Phân tích cẩm nang không cắt cụt bảng từ vựng, ngưỡng mới & local fallback
│   ├── ai/
│   │   ├── prompts.ts                           # Dùng getGenreStyleGuide + getToneStyleGuide, chuẩn hóa ưu tiên #1..#4, mở khóa enum analyzeGuidelines
│   │   └── __tests__/
│   │       └── prompts.test.ts                  # Test prompt 3 giai đoạn & thứ tự ưu tiên
│   ├── translation/
│   │   ├── targetedRepair.ts                    # Bổ sung getToneStyleGuide & thứ tự ưu tiên vào buildTargetedRepairPayload
│   │   └── __tests__/
│   │       └── targetedRepair.test.ts           # Test prompt sửa cục bộ chứa quy chuẩn thể loại & tông giọng
│   └── __tests__/
│       └── directGlossaryEngine.test.ts         # Test cẩm nang > 15k chars có bảng từ vựng & fallback cục bộ
└── components/
    ├── ui/
    │   └── GenreMark.tsx                        # Dùng sealChar từ translationStyles.ts
    ├── common/
    │   └── StyleGuidelineEditor.tsx             # [NEW] Trình soạn thảo thể loại, tông giọng, quy tắc cấu trúc/thô, mẫu, xung đột, nhập/xuất & xem trước
    ├── project-list/
    │   └── ProjectFormModal.tsx                 # Tích hợp StyleGuidelineEditor + validate tùy chỉnh + apply/merge từ import preview
    ├── translator-workspace/
    │   └── ProjectMetadataModal.tsx             # Tích hợp StyleGuidelineEditor + hỗ trợ nhập/xuất .md trong workspace
    └── TranslatorWorkspace.tsx                  # Truyền apiKeys, selectedModel, callback apply/merge glossary và showToast xuống ProjectMetadataModal
```

**Structure Decision**: Duy trì cấu trúc MVC Client-Side hiện có của repository (`src/config/` -> `src/lib/` & `src/services/` -> `src/components/`). Tất cả tri thức nghiệp vụ về thể loại, tông giọng, mẫu cẩm nang, phân tích Markdown và phát hiện mâu thuẫn nằm trong `src/config/translationStyles.ts` để tái sử dụng đồng bộ ở cả tầng service AI lẫn tầng component UI.

## Complexity Tracking

Không có vi phạm Constitution nào cần giải trình.

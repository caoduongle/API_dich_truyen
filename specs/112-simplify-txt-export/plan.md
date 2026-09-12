# Implementation Plan: Tối Giản Xuất Tệp .TXT và Chuẩn Hóa Tên File Dễ Hiểu

**Branch**: `112-simplify-txt-export` | **Date**: 2026-09-12 | **Spec**: [specs/112-simplify-txt-export/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/112-simplify-txt-export/spec.md)

**Input**: Feature specification from `specs/112-simplify-txt-export/spec.md`

## Summary

Loại bỏ hoàn toàn tùy chọn xuất file gióng hàng FT (JSONL) khỏi module xuất tập tin kết quả sau dịch, thu gọn giao diện bảng điều khiển về 2 chế độ cốt lõi ("Web Truyện" và "Làm Audio"). Đồng thời, thay thế cơ chế đặt tên file .TXT dựa trên tiêu đề gốc tiếng Trung bằng công thức chuẩn hóa số thứ tự tiếng Việt 3 chữ số với từ nối `_den_` (ví dụ: `{Tên_truyện}_Chuong_001_den_Chuong_020_WEB.txt` cho đa chương, `{Tên_truyện}_Chuong_001_WEB.txt` cho đơn chương), lấy số thứ tự tuyệt đối theo danh sách chương của dự án để đảm bảo người dùng Việt Nam luôn quản lý và sắp xếp tập tin một cách dễ dàng và chuẩn xác.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite  
**Primary Dependencies**: `jszip`, `lucide-react`, `clsx`, `tailwind-merge` (Không thêm bất kỳ thư viện NPM mới nào).  
**Storage**: IndexedDB (`ai-story-translator-db` v4) - Giữ nguyên 100% schema và cấu trúc dữ liệu `Chapter`, `StoryProject`.  
**Testing**: Vitest (`npm test`), TypeScript checking (`npm run lint`), Vite build (`npm run build`).  
**Target Platform**: Hiện đại (Chrome, Edge, Firefox, Safari) SPA chạy hoàn toàn phía client.  
**Project Type**: Pure Client-Side Single Page Application (React 19).  
**Performance Goals**:
- Đóng gói file zip và tính toán tên file hoàn toàn tức thì (< 1ms per file).
- Không tăng kích thước bộ nhớ, giảm dung lượng bundle do loại bỏ dead code gióng hàng trong module export.
**Constraints**:
- Tuân thủ nghiêm ngặt ranh giới MVC (Principle III): logic định dạng tên file nằm trong `src/utils/`, logic điều phối nằm trong `src/hooks/`, giao diện nằm trong `src/components/`.
- Không thay đổi logic định dạng thân nội dung chương (giữ nguyên quy tắc tiền tố `*** ` cho Web và làm sạch nội dung cho Audio).
- Giữ nguyên các nhãn tiếng Việt trên giao diện hiện có (Principle IV).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú tuân thủ |
|---|---|---|
| **I. Strict Quality Gates** | ✅ PASS | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` vượt qua 100%. |
| **II. Dependency Minimization** | ✅ PASS | Không cài đặt thêm bất kỳ package nào; tái sử dụng các tiện ích sẵn có. |
| **III. Strict Concern Separation (MVC)** | ✅ PASS | Tách hàm helper `formatExportTxtFileName` ra `src/utils/exportFormatter.ts` để kiểm thử độc lập; Hook điều phối `useExportFiles.ts` chỉ gọi helper; View `ExportFilesPanel.tsx` chỉ hiển thị giao diện 2 nút. |
| **IV. Immutable Core Schemas & Storage** | ✅ PASS | Không thay đổi schema `Chapter`, `StoryProject`, `GlossaryItem` trong `src/types.ts` và IndexedDB. |
| **V. Atomic Commits & Docs Sync** | ✅ PASS | Tất cả tài liệu spec, plan, research, contracts, quickstart được tạo đầy đủ và đồng bộ 1:1 với kế hoạch mã nguồn. |

## Project Structure

### Documentation (this feature)

```text
specs/112-simplify-txt-export/
├── spec.md              # Feature specification (Approved)
├── plan.md              # This file (Implementation Plan)
├── research.md          # Phase 0: Nguyên nhân gốc rễ & Quyết định kỹ thuật
├── data-model.md        # Phase 1: Models, signatures, UI props
├── quickstart.md        # Phase 1: Hướng dẫn kiểm thử tự động & thủ công
├── contracts/           # Phase 1: TypeScript interfaces/contracts
│   └── export-files.contract.ts
└── checklists/
    └── requirements.md  # Quality checklist (16/16 passed)
```

### Source Code Layout (repository root)

```text
src/
├── utils/
│   ├── exportFormatter.ts              # [MODIFY] Rút gọn ExportMode, thêm formatExportTxtFileName
│   └── __tests__/
│       └── exportFormatter.test.ts     # [MODIFY] Thêm test cases cho formatExportTxtFileName
├── hooks/
│   ├── useExportFiles.ts               # [MODIFY] Xóa handleExportAlignJsonl, cập nhật tạo tên file chuẩn STT
│   ├── useAutoTranslationQueue.ts      # [MODIFY] Cập nhật exportMode: 'web' | 'audio'
│   └── __tests__/
│       └── useExportFiles.test.ts      # [MODIFY] Cập nhật mock props và test suite
└── components/
    ├── AutoTranslator.tsx              # [MODIFY] Cập nhật exportMode state và gỡ bỏ handleExportAlignJsonl
    └── auto-translator/
        └── ExportFilesPanel.tsx        # [MODIFY] Thu gọn 2 cột, xóa nút Gióng hàng FT & mô tả JSONL
```

## Complexity Tracking

> Không có vi phạm Hiến pháp (Constitution) nào cần giải trình. Mọi thay đổi đều tuân thủ kiến trúc Pure Client-Side SPA và ranh giới MVC.

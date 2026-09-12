# Implementation Plan: Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Drop (116-fix-vite-esbuild-drop)

**Branch**: `116-fix-vite-esbuild-drop` | **Date**: 2026-09-12 | **Spec**: [`specs/116-fix-vite-esbuild-drop/spec.md`](./spec.md)

---

## 1. Summary

Kế hoạch giải quyết dứt điểm lỗi TypeScript `TS2769: No overload matches this call` khi chạy lệnh `npm run lint` (`tsc --noEmit`) do thuộc tính `esbuild.drop` trong `vite.config.ts` bị suy luận thành kiểu nới lỏng `string[]` từ biểu thức tam nguyên:
- **Tiếp cận kỹ thuật**: Áp dụng ép kiểu tường minh `(['console', 'debugger'] as ('console' | 'debugger')[])` cho mảng `drop` trong `vite.config.ts`.
- **Đảm bảo chất lượng**: Giữ nguyên cơ chế loại bỏ log/debugger khi `NODE_ENV === 'production'`, vượt qua toàn bộ các cổng kiểm định bắt buộc (`npm run lint`, `npm test`, `npm run build`).

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+
- **Primary Dependencies**: Vite 6.2+ / 8.x, esbuild 0.25+ / 0.28+, React 19, Tailwind CSS v4
- **Storage**: N/A (không tác động đến cơ sở dữ liệu IndexedDB hay lưu trữ)
- **Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint` -> `tsc --noEmit`), Production Build (`npm run build`)
- **Target Platform**: Node.js 20+, GitHub Actions CI Runner (`ubuntu-latest`), Windows Dev Environment
- **Project Type**: Client-Side Single Page Application (SPA)
- **Performance Goals**: `npm run lint` hoàn thành với mã thoát 0, không có độ trễ hay ảnh hưởng đến hiệu năng build
- **Constraints**:
  - Tuân thủ Hiến pháp AI Dịch Truyện Trung-Việt v2.0.0 (100% test pass, không đổi core schema `src/types.ts` hoặc IndexedDB schema).
  - Không thêm thư viện ngoài mới.
  - Không can thiệp logic dịch thuật trong `src/services/` hay giao diện người dùng tiếng Việt.

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá Tuân thủ | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | `tsc --noEmit`, `vitest run`, và `npm run build` PHẢI pass sạch 100% không có lỗi. Không xóa hay skip test. | ✅ PASS |
| **II. Dependency Minimization & Existing Library Reuse** | Sử dụng type assertion native của TypeScript, không thêm bất kỳ package bên ngoài nào mới. | ✅ PASS |
| **III. Strict Concern Separation & Domain Boundary Preservation** | Chỉ tinh chỉnh tệp cấu hình công cụ đóng gói `vite.config.ts`. Không chạm vào View (`src/components/`), Controller (`src/hooks/`) hay Model (`src/services/`). | ✅ PASS |
| **IV. Immutable Core Schemas & Storage Stability** | Giữ nguyên các interface trong `src/types.ts` và IndexedDB `src/services/db.ts`. Không sửa đổi nhãn giao diện tiếng Việt. | ✅ PASS |
| **V. Atomic Commits & Documentation Sync** | Thay đổi tối giản đúng 1 tệp tin mã nguồn và đồng bộ đầy đủ tài liệu đặc tả trong `specs/116-fix-vite-esbuild-drop/`. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/116-fix-vite-esbuild-drop/
├── spec.md              # Đặc tả yêu cầu sửa lỗi kiểu dữ liệu
├── plan.md              # Kế hoạch triển khai chi tiết (file này)
├── research.md          # Nghiên cứu nguyên nhân gốc và quyết định kỹ thuật
├── data-model.md        # Mô hình kiểu dữ liệu cấu hình Vite & esbuild
├── quickstart.md        # Hướng dẫn kiểm chứng độc lập và toàn trình
├── contracts/
│   └── vite-build-config.contract.md # Hợp đồng cấu hình bản dựng
├── checklists/
│   └── requirements.md  # Danh mục kiểm định chất lượng đặc tả
└── tasks.md             # Danh sách công việc triển khai (/speckit-tasks)
```

### Source Code Impact

```text
vite.config.ts           # Ép kiểu an toàn cho esbuild.drop: (['console', 'debugger'] as ('console' | 'debugger')[])
```

**Structure Decision**: Thay đổi tối giản, khoanh vùng chính xác 1 tệp tin cấu hình gốc `vite.config.ts`.

---

## 5. Complexity Tracking

> Không có vi phạm kiến trúc hay ngoại lệ cần biện minh. Toàn bộ giải pháp tuân thủ chặt chẽ Hiến pháp dự án.

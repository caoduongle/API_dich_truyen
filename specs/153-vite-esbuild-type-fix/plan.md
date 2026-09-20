# Implementation Plan: Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Option Trong Quy Trình Kiểm Tra Mã Nguồn (npm run lint)

**Branch**: `153-vite-esbuild-type-fix` | **Date**: 2026-09-21 | **Spec**: [`specs/153-vite-esbuild-type-fix/spec.md`](./spec.md)

**Input**: Feature specification from `/specs/153-vite-esbuild-type-fix/spec.md`

---

## 1. Summary

Kế hoạch giải quyết dứt điểm lỗi TypeScript `TS2769: No overload matches this call` trên CI/CD GitHub Actions khi thực hiện lệnh kiểm tra kiểu tĩnh `npm run lint` (`tsc --noEmit`) tại tệp `vite.config.ts`:
- **Tiếp cận kỹ thuật**: 
  1. Nhập các kiểu dữ liệu `type UserConfig` và `type ESBuildOptions` trực tiếp từ gói `vite`.
  2. Định kiểu trả về tường minh `: UserConfig` cho hàm callback cấu hình trong `defineConfig(({ mode }): UserConfig => { ... })`.
  3. Định kiểu khối tùy chọn `esbuild` thành `as ESBuildOptions` nhằm bảo đảm tuyệt đối tính tương thích với kiểu `false | ESBuildOptions | undefined` trên mọi môi trường biên dịch (Linux CI và Windows dev).
  4. Giữ nguyên logic loại bỏ `console` và `debugger` ở chế độ production (`process.env.NODE_ENV === 'production'`), đồng thời bảo đảm các chuỗi bất biến mà các bài test hiện tại đang kiểm tra (`base: publicConfig.basePath`, `outDir: 'dist'`, CSP header).

---

## 2. Technical Context

- **Language/Version**: TypeScript ~5.8.2, Node.js 20 LTS baseline
- **Primary Dependencies**: Vite ^6.2.3 (resolving to 6.4.3), esbuild ^0.25.12, React 19, Tailwind CSS v4
- **Storage**: IndexedDB (`src/services/db.ts` - hoàn toàn không tác động)
- **Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint` -> `tsc --noEmit`), Vite Production Build (`npm run build`)
- **Target Platform**: Node.js 20 LTS (GitHub Actions `ubuntu-latest` CI runner & Windows dev workstations)
- **Project Type**: Client-Side Single Page Application (SPA)
- **Performance Goals**: `npm run lint` kết thúc với mã thoát 0 và 0 lỗi kiểu; không làm ảnh hưởng đến thời gian build hay dung lượng bundle
- **Constraints**: 
  - Tuân thủ nghiêm ngặt Hiến pháp v2.0.0 (100% test pass, không đổi core schema `src/types.ts` hay IndexedDB schema).
  - Không thêm thư viện ngoài mới.
  - Không can thiệp logic dịch thuật trong `src/services/` hay nhãn giao diện tiếng Việt.

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá Tuân thủ | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | `tsc --noEmit`, `vitest run`, và `npm run build` PHẢI pass sạch 100% không có lỗi. Tuyệt đối không xóa hay bỏ qua test. | ✅ PASS |
| **II. Dependency Minimization & Existing Library Reuse** | Sử dụng kiểu dữ liệu có sẵn từ `vite` (`UserConfig`, `ESBuildOptions`), không thêm bất kỳ package nào mới. | ✅ PASS |
| **III. Strict Concern Separation & Domain Boundary Preservation** | Chỉ chỉnh sửa cấu hình công cụ build `vite.config.ts`. Không chạm vào View (`src/components/`), Controller (`src/hooks/`) hay Model (`src/services/`). | ✅ PASS |
| **IV. Immutable Core Schemas & Storage Stability** | Giữ nguyên các interface trong `src/types.ts` và IndexedDB `src/services/db.ts`. Không thay đổi nhãn giao diện tiếng Việt. | ✅ PASS |
| **V. Atomic Commits & Documentation Sync** | Thay đổi tối giản đúng 1 tệp tin mã nguồn `vite.config.ts` và đồng bộ tài liệu đặc tả trong `specs/153-vite-esbuild-type-fix/`. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/153-vite-esbuild-type-fix/
├── spec.md              # Đặc tả yêu cầu sửa lỗi kiểu dữ liệu
├── plan.md              # Kế hoạch triển khai chi tiết (file này)
├── research.md          # Phân tích nguyên nhân gốc và quyết định kỹ thuật
├── data-model.md        # Mô hình kiểu dữ liệu cấu hình Vite & esbuild
├── quickstart.md        # Hướng dẫn kiểm chứng độc lập và toàn trình
├── contracts/
│   └── vite-build-config.contract.md # Hợp đồng giao diện cấu hình build
├── checklists/
│   └── requirements.md  # Danh mục kiểm định chất lượng đặc tả
└── tasks.md             # Danh sách công việc triển khai (/speckit-tasks)
```

### Source Code (repository root)

```text
vite.config.ts           # Tệp cấu hình Vite cần chuẩn hóa kiểu dữ liệu
src/
├── config/
│   └── publicOrigin.ts  # Tiện ích resolve origin & basePath (giữ nguyên)
└── utils/
    └── __tests__/
        └── customDomainAssets.test.ts # Test kiểm tra chuỗi cấu hình (giữ nguyên pass)
```

**Structure Decision**: Cấu trúc đơn dự án (Single SPA project), thay đổi chỉ tập trung tại `vite.config.ts` ở thư mục gốc của kho mã nguồn.

---

## 5. Complexity Tracking

*Không có vi phạm Hiến pháp. Mọi nguyên tắc đều đạt chuẩn tuân thủ tối đa.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Không có | N/A | N/A |

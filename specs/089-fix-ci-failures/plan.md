# Implementation Plan: Sửa Lỗi CI/CD (Windows Path Handling & Build-Before-Test Ordering)

**Branch**: `089-fix-ci-failures` | **Date**: 2026-09-05 | **Spec**: [`specs/089-fix-ci-failures/spec.md`](./spec.md)

---

## 1. Summary

Kế hoạch giải quyết dứt điểm 2 nguyên nhân khiến quy trình CI/CD (GitHub Actions) thất bại trên runner Ubuntu/Linux:
1. **Chuẩn hóa đường dẫn Windows trong `sanitizeFilename`**: Bổ sung bước chuyển đổi dấu gạch chéo ngược `\` thành gạch chéo xuôi `/` (`rawFilename.replace(/\\/g, "/")`) trước khi gọi `path.basename()`, giúp hàm xử lý chính xác đường dẫn tệp tin trên cả Linux runner và máy trạm Windows.
2. **Điều chỉnh thứ tự thực thi trong `.github/workflows/ci.yml`**: Đặt bước `Build` (`npm run build`) lên trước bước `Run tests` (`npm test`) để các tệp build tĩnh trong `dist/client` (`robots.txt`, `sitemap.xml`, `llms.txt`) và thư mục `dist/` sẵn sàng phục vụ cho bài test `server/__tests__/quickstartVerification.test.ts`.

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+
- **Primary Dependencies**: Express 4.21+, Vitest 4.1+, Vite 6.2+, esbuild 0.25+
- **Storage**: N/A (không tác động đến cơ sở dữ liệu hay lưu trữ)
- **Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint` -> `tsc --noEmit`), Production Build (`npm run build`)
- **Target Platform**: GitHub Actions CI Runner (`ubuntu-latest`), Linux Server, Windows Dev Environment
- **Project Type**: Web Application & Express API Backend
- **Performance Goals**: CI workflow thực thi trơn tru, không có bottleneck, test suite hoàn tất dưới 30s
- **Constraints**:
  - Tuân thủ Hiến pháp AI Dịch Truyện Trung-Việt v1.0.0 (100% test pass, không đổi core schema `src/types.ts` hoặc IndexedDB schema).
  - Không thêm thư viện ngoài mới.
  - Không can thiệp logic sourcemap do `vite.config.ts` đã cấu hình tắt sẵn.

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá Tuân thủ | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | `tsc --noEmit`, `vitest run`, và `npm run build` PHẢI pass sạch 100% không có lỗi. Không xóa hay skip test. | ✅ PASS |
| **II. Dependency Minimization & Existing Library Reuse** | Sử dụng RegExp native của JavaScript và mô-đun chuẩn `path` của Node.js, không thêm package mới. | ✅ PASS |
| **III. Strict Concern Separation & Domain Boundary Preservation** | Chỉ tinh chỉnh hàm validate file upload và tệp cấu hình CI workflow. Tuyệt đối không chạm vào prompt dịch thuật Gemini hay logic backend nghiệp vụ. | ✅ PASS |
| **IV. Immutable Core Schemas & Storage Stability** | Giữ nguyên các interface trong `src/types.ts` và IndexedDB. Không thay đổi giao diện người dùng. | ✅ PASS |
| **V. Atomic Commits & Documentation Sync** | Triển khai cô đọng, đúng trọng tâm 2 tệp cần sửa và bộ tài liệu đặc tả tương ứng. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/089-fix-ci-failures/
├── spec.md              # Đặc tả yêu cầu sửa lỗi CI/CD
├── plan.md              # Kế hoạch thực hiện chi tiết (file này)
├── research.md          # Nghiên cứu nguyên nhân gốc và quyết định kỹ thuật
├── data-model.md        # Cấu trúc dữ liệu và cấu hình pipeline
├── quickstart.md        # Hướng dẫn xác minh độc lập và toàn trình
├── contracts/
│   └── ci-workflow.contract.md # Hợp đồng hàm và thứ tự pipeline
├── checklists/
│   └── requirements.md  # Danh mục kiểm định chất lượng đặc tả
└── tasks.md             # Danh sách công việc triển khai (/speckit-tasks)
```

### Source Code Impact

```text
.github/
└── workflows/
    └── ci.yml                     # Đổi thứ tự: Build trước Run tests

server/
└── utils/
    ├── fileValidation.ts          # Chuẩn hóa \ thành / trước khi gọi path.basename
    └── __tests__/
        └── fileValidation.test.ts # Kiểm thử xác minh sanitizeFilename
```

**Structure Decision**: Thay đổi tối giản, khoanh vùng chính xác 2 tệp tin nguồn: `.github/workflows/ci.yml` và `server/utils/fileValidation.ts`.

---

## 5. Complexity Tracking

> Không có vi phạm kiến trúc hay ngoại lệ cần biện minh. Toàn bộ giải pháp tuân thủ chặt chẽ Hiến pháp dự án.

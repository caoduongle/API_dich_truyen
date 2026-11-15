# Implementation Plan: Khắc Phục Lỗ Hổng Bảo Mật Dependency & Đảm Bảo Cổng Kiểm Duyệt CI (`npm audit`)

**Branch**: `164-npm-audit-remediation` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/164-npm-audit-remediation/spec.md`

## Summary

Khắc phục triệt để 4 lỗ hổng bảo mật (`2 high` ở `vite <=6.4.3` và `undici 7.0.0 - 7.30.0`, cùng `2 moderate` ở `@vitest/mocker <=4.1.11` và `vitest 2.1.0-beta.1 - 4.1.11`) đang làm bước `npm audit --audit-level=high` trong CI thất bại với mã thoát `1`. Cách tiếp cận kỹ thuật là áp dụng nâng cấp bản vá tương thích ngược trong cùng dải semver (`vite >=6.4.6`, `undici >=7.30.1`, `vitest >=4.1.12`, `@vitest/mocker >=4.1.12`), đồng bộ `package.json` và `package-lock.json` mà không dùng `--force` hay thêm gói phụ thuộc mới, sau đó xác minh đầy đủ `npm audit --audit-level=high`, `npm audit`, `npm run lint`, `npm test` và `npm run build`.

## Technical Context

**Language/Version**: TypeScript `~5.8.2`, Node.js `24` (CI target in `.github/workflows/ci.yml`), ES Modules (`"type": "module"`)  
**Primary Dependencies**: React `^19.0.1`, Vite `^6.2.3` -> `^6.4.6` (`@vitejs/plugin-react` `^5.0.4`, `@tailwindcss/vite` `^4.1.14`), Vitest `^4.1.11` -> `^4.1.12`, `jsdom` `29.1.1` (transitive `undici` `>=7.30.1`)  
**Storage**: IndexedDB & Yjs (`y-indexeddb`) — completely untouched by this remediation  
**Testing**: Vitest (`vitest run`) with `jsdom` environment across existing unit/integration suites (`109` test files)  
**Target Platform**: Pure Client-Side SPA (browser runtime) built on Windows/Linux developer machines and `ubuntu-latest` CI  
**Project Type**: Single-project Vite + React + TypeScript SPA  
**Performance Goals**: Preserve build speed and zero runtime overhead (dev/build/test tooling patch updates only)  
**Constraints**: Zero new direct dependencies (`FR-005`), no breaking major upgrades, no application code or IndexedDB schema changes, strict parity between `package.json` and `package-lock.json` for `npm ci`  
**Scale/Scope**: Dependency manifest (`package.json`) and lockfile (`package-lock.json`) synchronization resolving 4 reported audit advisories (`vite`, `undici`, `vitest`, `@vitest/mocker`)

## Constitution Check

*GATE: Evaluated before Phase 0 research and re-checked post-design.*

| Principle | Pre-Research Status | Post-Design Status | Notes |
|---|---|---|---|
| **I. Strict Quality Gates & Verification** | PASS | PASS | Kế hoạch bắt buộc chạy và xác nhận pass toàn bộ `npm audit --audit-level=high`, `npm audit`, `npm run lint`, `npm test` và `npm run build`, không xóa hay skip bất kỳ test nào. |
| **II. Dependency Minimization & Existing Library Reuse** | PASS | PASS | Không thêm bất kỳ dependency chức năng mới nào; chỉ cập nhật bản vá tương thích trong cùng nhánh phiên bản chính của `vite`, `vitest` và `undici`. |
| **III. Strict Concern Separation & MVC Domain Boundary Preservation** | PASS | PASS | Không sửa đổi tầng View (`src/components/`), Controller (`src/hooks/`), hay Model/Service (`src/services/`, `src/lib/`). |
| **IV. Immutable Core Schemas & Storage Stability** | PASS | PASS | `src/types.ts`, schema IndexedDB và toàn bộ text tiếng Việt trên UI được giữ nguyên 100%. |
| **V. Atomic Commits & Documentation Synchronization** | PASS | PASS | Thay đổi cô lập gọn trong `package.json` và `package-lock.json`, tách biệt rõ ràng với các tính năng nghiệp vụ khác. |

## Project Structure

### Documentation (this feature)

```text
specs/164-npm-audit-remediation/
├── plan.md                                      # File kế hoạch triển khai này
├── research.md                                  # Phase 0: Phân tích phiên bản vá & phương án xử lý 4 gói
├── data-model.md                                # Phase 1: Mô hình thay đổi manifest & lockfile
├── quickstart.md                                # Phase 1: Hướng dẫn xác minh cổng bảo mật & chất lượng
├── contracts/
│   └── dependency-security-contract.md          # Phase 1: Hợp đồng phiên bản & cổng CI
└── tasks.md                                     # Phase 2 output (/speckit-tasks - chưa tạo ở bước /speckit-plan)
```

### Source Code (repository root)

```text
package.json                                     # Cập nhật sàn phiên bản vá tương thích (vite, vitest, overrides nếu cần)
package-lock.json                                # Đồng bộ cây phụ thuộc đã vá (vite, undici, vitest, @vitest/mocker)
.github/workflows/ci.yml                         # Tham chiếu cổng CI: npm ci + npm audit --audit-level=high + lint/build/test (không sửa trừ khi cần)
```

**Structure Decision**: Dự án theo mô hình Single-project Frontend SPA tại thư mục gốc. Feature `164-npm-audit-remediation` chỉ tác động tới lớp quản lý phụ thuộc ở thư mục gốc (`package.json` và `package-lock.json`) mà không can thiệp vào cấu trúc `src/`.

## Complexity Tracking

> Không có vi phạm Hiến pháp (Constitution Check) nào cần giải trình.

## Implementation Phases Preview

1. **Phase 1 — Dependency Patch Resolution**: Chạy `npm audit fix` (không dùng `--force`) để nâng cấp đồng bộ `vite` (`6.4.6`), `undici` (`7.30.2`), `vitest` (`4.1.12`) và toàn bộ nhóm `@vitest/*` (`4.1.12`); cập nhật sàn phiên bản trong `package.json` (`"vite": "^6.4.6"`, `"vitest": "^4.1.12"`) và đồng bộ `packages[""]` trong `package-lock.json` qua `npm install --package-lock-only`.
2. **Phase 2 — Security Audit & Clean Lockfile Verification**: Chạy `npm ci --dry-run`, `npm ls vite vitest @vitest/mocker undici --all`, `npm audit --audit-level=high` và `npm audit` để xác nhận `0 vulnerabilities` và đảm bảo không lệch lockfile trên CI.
3. **Phase 3 — Quality Gates & CI Parity Verification**: Chạy `npm run lint`, `npm test` và `npm run build` để bảo đảm toàn bộ 109 bộ test và quy trình đóng gói không phát sinh lỗi hồi quy.

# Research: Audit and Refine Project .gitignore

**Feature**: [spec.md](./spec.md) | **Date**: 2026-08-19 | **Status**: Complete

## Overview & Technical Choices

### 1. Phân loại & Cấu trúc Quy tắc `.gitignore`

- **Decision**: Nhóm các quy tắc loại trừ theo từng danh mục chức năng rõ ràng với tiêu đề chú thích tiếng Việt & Anh:
  1. `Logs & Debug` (Logs, debug trace)
  2. `Dependencies & Package Managers` (node_modules, .npm, .pnpm, .yarn)
  3. `Build & Distribution Outputs` (dist, dist-ssr, build, *.tsbuildinfo)
  4. `Testing & Coverage` (coverage, .nyc_output, .vitest, test-results)
  5. `Environment & Secrets` (.env*, !.env.example)
  6. `Patches & Diffs` (*.patch, *.diff, *.orig, *.rej)
  7. `Cache & Temporary Files` (.vite, .cache, *.tmp, *.temp)
  8. `Python Runtime & Cache` (__pycache__, *.pyc, *.pyo, *.pyd)
  9. `Databases & Local Dumps` (dump.rdb, *.sqlite, *.db)
  10. `Editor & IDE Settings` (.idea, .vscode/*, !.vscode/extensions.json)
  11. `Operating System Artifacts` (Windows, macOS, Linux)
  12. `Translation & Export Outputs` (Result/, result/, exports/)
- **Rationale**:
  - Giúp các nhà phát triển dễ dàng tra cứu, bổ sung hoặc bảo trì cấu hình trong tương lai mà không bị lộn xộn.

---

### 2. Whitelist Exceptions (Xử lý các ngoại lệ quan trọng)

- **Decision**:
  - `!.env.example`: Giữ lại file mẫu để cấu hình môi trường phát triển mới.
  - `!.vscode/extensions.json`: Giữ lại gợi ý tiện ích mở rộng cho VSCode.
- **Rationale**:
  - Không làm mất khả năng onboarding của thành viên mới hoặc làm mất cấu hình workspace khuyến nghị.

---

### 3. Phương thức Xác thực (Validation Strategy)

- **Decision**: Sử dụng lệnh `git check-ignore -v <path>` để kiểm tra chính xác quy tắc nào đang áp dụng cho từng tệp/thư mục.
- **Rationale**:
  - `git check-ignore` là công cụ chuẩn của Git, phản ánh chính xác 100% cách Git engine xử lý glob patterns trên hệ thống thực tế.

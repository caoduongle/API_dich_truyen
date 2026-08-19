# Feature Specification: Audit and Refine Project .gitignore

**Feature Branch**: `005-audit-fix-gitignore`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "rà soát dự án và sửa lại gitignore"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ngăn chặn rò rỉ tệp nhạy cảm và tệp rác hệ thống (Priority: P1) 🎯 MVP

Là lập trình viên và người đóng góp cho dự án, tôi muốn file `.gitignore` được cấu hình đầy đủ và chuẩn xác để khi làm việc, phát triển hoặc chạy các công cụ phụ trợ (Node.js, Vite, Vitest, Python scripts, Redis local, hệ điều hành Windows/macOS/Linux), các tệp rác, tệp tạm (patch/diff), tệp bộ nhớ đệm và tệp nhạy cảm (biến môi trường, database dump) không bao giờ bị vô tình đưa vào chỉ mục quản lý phiên bản của Git.

**Why this priority**: Tránh rò rỉ bí mật bảo mật và ngăn ngừa làm ô nhiễm lịch sử git bởi các tệp sinh tự động hay tệp rác đặc thù theo hệ điều hành.

**Independent Test**:
1. Tạo một loạt tệp mẫu giả định thuộc các nhóm tệp rác: `.env.local`, `quota.patch`, `test.diff`, `dump.rdb`, `__pycache__/temp.pyc`, `desktop.ini`, `.DS_Store`, `coverage/lcov.info`, `.vitest/cache`.
2. Chạy lệnh `git status` và `git check-ignore`, xác nhận toàn bộ các tệp trên được Git nhận diện là tệp bị bỏ qua (ignored) và không xuất hiện trong danh sách untracked files.

**Acceptance Scenarios**:

1. **Given** một tệp chứa biến môi trường cục bộ (ví dụ `.env.local`, `.env.production`) hoặc tệp cấu hình chứa secret, **When** kiểm tra trạng thái Git, **Then** tệp này bị bỏ qua hoàn toàn, ngoại trừ tệp mẫu `.env.example`.
2. **Given** các tệp vá lỗi tạm thời (`*.patch`, `*.diff`, `*.orig`, `*.rej`), **When** người dùng lưu hoặc áp dụng patch trong workspace, **Then** Git không theo dõi các tệp này.
3. **Given** các tiến trình chạy ngầm hoặc tệp rác phát sinh (Python `__pycache__`, Redis `dump.rdb`, Vitest/Vite cache, coverage, Windows `desktop.ini`), **When** các tệp này xuất hiện, **Then** Git tự động lọc bỏ khỏi luồng commit.

---

### User Story 2 - Bảo toàn các tệp tài nguyên và cấu hình cần thiết của dự án (Priority: P1) 🎯 MVP

Là lập trình viên và người điều phối hệ thống Agent/Spec-Kit, tôi muốn các thư mục đặc tả (`specs/`), thư mục quy tắc/công cụ (`.agents/`, `.specify/`), tệp cấu hình mở rộng editor khuyến nghị (`.vscode/extensions.json`), và các tài nguyên dùng chung trong `shared/`, `assets/` được bảo vệ an toàn, không bị vô tình chặn bởi các quy tắc gitignore quá rộng.

**Why this priority**: Đảm bảo quy trình làm việc phối hợp giữa người dùng và trợ lý lập trình trí tuệ nhân tạo (Antigravity/Spec-Kit) hoạt động liên tục và đồng bộ qua git.

**Independent Test**:
1. Kiểm tra các tệp trong `.agents/`, `.specify/`, `specs/`, `.vscode/extensions.json`.
2. Chạy `git check-ignore -v` đối với các đường dẫn này, xác minh Git không bỏ qua các tệp cốt lõi này.

**Acceptance Scenarios**:

1. **Given** các thư mục tài nguyên đặc tả (`specs/`, `.agents/`, `.specify/`), **When** có thay đổi hoặc tệp mới, **Then** Git theo dõi và cho phép commit bình thường.
2. **Given** tệp khuyến nghị extension `.vscode/extensions.json` và tệp biến môi trường mẫu `.env.example`, **When** kiểm tra trạng thái Git, **Then** các tệp này luôn được theo dõi (whitelisted) bất kể quy tắc chung của `.vscode` hay `.env`.

---

### Edge Cases

- **Tệp `.env.example`**: Bắt buộc phải được giữ lại (whitelist qua `!.env.example`) để các nhà phát triển mới có mẫu thiết lập môi trường.
- **Tệp `.vscode/extensions.json`**: Bắt buộc phải được giữ lại (whitelist qua `!.vscode/extensions.json`) để gợi ý extension hữu ích cho VSCode/IDE.
- **Tệp patch tồn tại sẵn trong thư mục làm việc (như `quota-feature.patch`)**: Khi thêm quy tắc `*.patch`, tệp này sẽ tự động chuyển sang trạng thái ignored nếu chưa được tracked.
- **Các hệ điều hành đa dạng**: Bao phủ đầy đủ cả Windows (`desktop.ini`, `Thumbs.db`, `$RECYCLE.BIN/`), macOS (`.DS_Store`, `._*`), và Linux (`*~`, `.directory`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Tệp `.gitignore` PHẢI bao gồm các mẫu loại trừ toàn diện cho môi trường Node.js / JavaScript / TypeScript: `node_modules/`, `.npm`, `dist/`, `dist-ssr/`, `build/`, `coverage/`, `.nyc_output/`, `*.tsbuildinfo`, `.vite/`, `.vitest/`, `test-results/`.
- **FR-002**: Tệp `.gitignore` PHẢI loại trừ toàn bộ các biến môi trường thực tế (`.env*`, `.env.local`, `.env.*.local`) nhưng PHẢI tạo ngoại lệ giữ lại tệp mẫu `!.env.example`.
- **FR-003**: Tệp `.gitignore` PHẢI loại trừ các tệp nhật ký (logs): `logs/`, `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`.
- **FR-004**: Tệp `.gitignore` PHẢI loại trừ các tệp tạm / diff / patch: `*.patch`, `*.diff`, `*.orig`, `*.rej`, `*.tmp`, `*.temp`.
- **FR-005**: Tệp `.gitignore` PHẢI loại trừ các tệp phát sinh từ script Python phụ trợ (ví dụ `merge.py`): `__pycache__/`, `*.py[cod]`, `*$py.class`, `.pytest_cache/`.
- **FR-006**: Tệp `.gitignore` PHẢI loại trừ tệp dump cơ sở dữ liệu tạm thời cục bộ (ví dụ Redis `dump.rdb`, SQLite `*.db`, `*.sqlite`, `*.sqlite3`).
- **FR-007**: Tệp `.gitignore` PHẢI loại trừ toàn bộ tệp rác hệ điều hành đa nền tảng (Windows: `Thumbs.db`, `ehthumbs.db`, `desktop.ini`, `$RECYCLE.BIN/`; macOS: `.DS_Store`, `.DS_Store?`, `._*`, `.Spotlight-V100`, `.Trashes`; Linux: `*~`, `.directory`).
- **FR-008**: Tệp `.gitignore` PHẢI loại trừ cấu hình IDE cá nhân (`.idea/`, `.vscode/*`, `*.suo`, `*.sln`, `*.sw?`) nhưng PHẢI duy trì ngoại lệ cho `!.vscode/extensions.json`.
- **FR-009**: Tệp `.gitignore` PHẢI duy trì loại trừ thư mục kết quả dịch/export: `Result/`, `result/`, `exports/`.
- **FR-010**: Cấu hình `.gitignore` PHẢI được sắp xếp khoa học, có chú thích rõ ràng theo từng nhóm chức năng.

### Key Entities

- **Git Exclusion Rule Set**: Danh mục mẫu lọc (glob patterns) xác định tệp/thư mục không đưa vào chỉ mục Git.
- **Whitelist Exceptions**: Các mẫu có tiền tố `!` chỉ định rõ các tệp cần được Git theo dõi kể cả khi thư mục cha bị bỏ qua.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các tệp nhạy cảm (.env, keys) và tệp patch (`*.patch`, `*.diff`) trong workspace không xuất hiện trong danh sách untracked files khi chạy `git status`.
- **SC-002**: 100% các tệp tài nguyên, spec (`specs/**`), cấu hình agent (`.agents/**`, `.specify/**`), và tệp mẫu `!.env.example` được Git theo dõi bình thường.
- **SC-003**: Kiểm tra `git check-ignore` xác thực chính xác toàn bộ danh mục quy tắc loại trừ mà không gây xung đột.
- **SC-004**: Toàn bộ các bộ kiểm tra tự động của dự án (`npx tsc --noEmit`, `npx vitest run`, `npm run build`) tiếp tục hoàn thành 100% không bị ảnh hưởng.

## Assumptions

- Việc loại trừ `*.patch` và `dump.rdb` phù hợp với quy trình phát triển vì các bản vá lỗi và bản lưu đệm bộ nhớ cục bộ không nên được commit vào nhánh mã nguồn chính.
- Tệp `merge.py` vẫn được giữ lại để theo dõi trong Git, nhưng các tệp bộ nhớ đệm Python phát sinh (`__pycache__`) khi chạy script sẽ bị loại trừ.

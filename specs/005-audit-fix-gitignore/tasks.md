# Tasks: Audit and Refine Project .gitignore

**Feature**: `005-audit-fix-gitignore`
**Spec**: [specs/005-audit-fix-gitignore/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/005-audit-fix-gitignore/spec.md)
**Plan**: [specs/005-audit-fix-gitignore/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/005-audit-fix-gitignore/plan.md)

---

## Phase 1: Setup (Cấu trúc & Phân nhóm)

**Purpose**: Thiết lập bộ khung cấu trúc các nhóm quy tắc rõ ràng trong tệp `.gitignore`

- [x] T001 Setup categorized section headers and layout in `.gitignore`

---

## Phase 2: User Story 1 - Ngăn chặn rò rỉ tệp nhạy cảm và tệp rác hệ thống (Priority: P1) 🎯 MVP

**Goal**: Bổ sung toàn diện các mẫu loại trừ tệp tạm, patch/diff, cache Python, test cache, database dumps và rác hệ điều hành.
**Independent Test**: Chạy `git check-ignore -v` với các tệp `.env.local`, `quota-feature.patch`, `dump.rdb`, `__pycache__/test.pyc`, `desktop.ini`, xác nhận toàn bộ đều bị bỏ qua.

### Implementation for User Story 1
- [x] T002 [US1] Add patch, diff, and temporary file patterns (`*.patch`, `*.diff`, `*.orig`, `*.rej`, `*.tmp`, `*.temp`) in `.gitignore`
- [x] T003 [P] [US1] Add Python runtime & cache ignore patterns (`__pycache__/`, `*.py[cod]`, `.pytest_cache/`) in `.gitignore`
- [x] T004 [P] [US1] Add test cache & database dump patterns (`dump.rdb`, `*.sqlite`, `*.db`, `.vitest/`, `.nyc_output/`, `test-results/`) in `.gitignore`
- [x] T005 [P] [US1] Add multi-OS artifacts (Windows `desktop.ini`, `$RECYCLE.BIN/`, macOS `._*`, Linux `*~`) in `.gitignore`

**Checkpoint**: User Story 1 hoàn thành, toàn bộ tệp tạm và tệp rác phát sinh được Git loại trừ an toàn.

---

## Phase 3: User Story 2 - Bảo toàn các tệp tài nguyên và cấu hình cần thiết của dự án (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo các tệp cấu hình mẫu và tài nguyên đặc tả không bị chặn nhầm bởi `.gitignore`.
**Independent Test**: Chạy `git check-ignore` với `!.env.example`, `!.vscode/extensions.json`, và các thư mục `specs/**`, `.agents/**`, `.specify/**`, xác nhận không bị ignore.

### Implementation for User Story 2
- [x] T006 [US2] Verify and ensure whitelist exceptions (`!.env.example`, `!.vscode/extensions.json`) and core project resource paths in `.gitignore`
- [x] T007 [P] [US2] Run `git check-ignore` validation across all whitelist and ignored file scenarios per `specs/005-audit-fix-gitignore/quickstart.md`

**Checkpoint**: User Story 2 hoàn thành, bảo toàn toàn bộ tài nguyên dự án và cấu hình onboarding.

---

## Phase 4: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T008 Run `npm run lint` (`npx tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T009 Run `npm test` (`npx vitest run`) to verify 100% pass across all unit and integration tests
- [x] T010 Run `npm run build` to verify clean production build for frontend and backend

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **User Story 1 (Phase 2 - P1)**: Depends on Phase 1.
- **User Story 2 (Phase 3 - P1)**: Depends on Phase 2.
- **Polish (Phase 4)**: Depends on Phase 3 complete.

---

## Implementation Strategy

### MVP Scope (Complete in single pass)
1. Complete Phase 1 (Layout Structure).
2. Complete Phase 2 (US1 - Ignore Rules).
3. Complete Phase 3 (US2 - Whitelist Verification).
4. Complete Phase 4 (Quality Gates Verification).

---
description: "Task list for feature 164-npm-audit-remediation implementation"
---

# Tasks: Khắc Phục Lỗ Hổng Bảo Mật Dependency & Đảm Bảo Cổng Kiểm Duyệt CI (`npm audit`)

**Input**: Design documents from `/specs/164-npm-audit-remediation/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/dependency-security-contract.md](./contracts/dependency-security-contract.md), [quickstart.md](./quickstart.md)

**Tests**: Verification is performed directly against the project's existing 109 Vitest suites (`npm test`), TypeScript typechecker (`npm run lint`), production bundler (`npm run build`), and `npm audit` / `npm ci --dry-run` security gates per `spec.md` and `contracts/dependency-security-contract.md`.

**Organization**: Tasks are grouped by user story (`US1`, `US2`, `US3`) to enable independent verification of each increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or read-only checks, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Exact file paths (`package.json`, `package-lock.json`, `.github/workflows/ci.yml`) are included in every task description.

---

## Phase 1: Setup (Baseline Snapshot & Pre-Flight Inspection)

**Purpose**: Capture baseline direct dependency names and current vulnerable lockfile versions before mutating `package.json` or `package-lock.json`.

- [X] T001 Record baseline direct `dependencies`, `devDependencies`, and `overrides` keys in `package.json` to enforce the Zero New Feature Dependencies Contract (`FR-005`)
- [X] T002 [P] Inspect current resolved versions of `node_modules/vite`, `node_modules/undici`, `node_modules/vitest`, and `node_modules/@vitest/mocker` in `package-lock.json`

---

## Phase 2: Foundational (Non-Breaking Security Patch Resolution)

**Purpose**: Execute non-breaking lockfile remediation (`npm audit fix`) and synchronize manifest floors in `package.json` and `package-lock.json` (`packages[""]`).

**⚠️ CRITICAL**: Must complete before User Story verification phases.

- [X] T003 Run non-breaking `npm audit fix` to update `package-lock.json` and `node_modules` with patched releases for `vite`, `undici`, `vitest`, and `@vitest/*`

**Checkpoint**: Lockfile nodes resolved to patched versions — User Story specific manifest floors and verifications can now proceed.

---

## Phase 3: User Story 1 - Vượt Qua Cổng Kiểm Duyệt Bảo Mật Tự Động Trên CI (Priority: P1) 🎯 MVP

**Goal**: Remediate all `high` and `critical` vulnerabilities (`vite <=6.4.3`, `undici 7.0.0 - 7.30.0`) so the CI gate `npm audit --audit-level=high` in `.github/workflows/ci.yml` exits with code `0`.

**Independent Test**: Run `npm audit --audit-level=high` against `package-lock.json` and verify `0` high/critical vulnerabilities and exit code `0`.

### Implementation & Verification for User Story 1

- [X] T004 [US1] Update minimum safe semver floor for `"vite"` from `"^6.2.3"` to `"^6.4.6"` in `package.json` (`FR-001`)
- [X] T005 [US1] Verify `node_modules/vite` resolves to `>=6.4.6 <7.0.0` (`6.4.6`) and `node_modules/undici` resolves to `>=7.30.1 <8.0.0` (`7.30.2`) in `package-lock.json` (`FR-001`)
- [X] T006 [US1] Execute `npm audit --audit-level=high` against `package-lock.json` (matching `.github/workflows/ci.yml`) and confirm exit code `0` with `0` high/critical vulnerabilities (`FR-004`, `SC-001`)

**Checkpoint**: User Story 1 (`npm audit --audit-level=high` CI gate) is functional and passes with exit code `0`.

---

## Phase 4: User Story 2 - Làm Sạch Toàn Bộ Cảnh Báo Bảo Mật Trung Bình Của Bộ Công Cụ Kiểm Thử (Priority: P2)

**Goal**: Remediate all `moderate` vulnerabilities in `vitest` (`2.1.0-beta.1 - 4.1.11`) and `@vitest/mocker` (`<=4.1.11`) so full `npm audit` reports `0 vulnerabilities`.

**Independent Test**: Run `npm audit` (all severity levels) against `package-lock.json` and verify `0 vulnerabilities` (`0 low`, `0 moderate`, `0 high`, `0 critical`) and exit code `0`.

### Implementation & Verification for User Story 2

- [X] T007 [US2] Update minimum safe semver floor for `"vitest"` from `"^4.1.11"` to `"^4.1.12"` in `package.json` (`FR-002`)
- [X] T008 [US2] Verify lockstep version resolution (`>=4.1.12 <5.0.0`) across `node_modules/vitest` and all 7 `@vitest/*` cohort packages (`expect`, `mocker`, `pretty-format`, `runner`, `snapshot`, `spy`, `utils`) in `package-lock.json` (`FR-002`)
- [X] T009 [US2] Execute full `npm audit` against `package-lock.json` and confirm `0 vulnerabilities` across all severity tiers (`FR-004`, `SC-002`)

**Checkpoint**: User Stories 1 AND 2 pass — both `npm audit --audit-level=high` and full `npm audit` report `0 vulnerabilities`.

---

## Phase 5: User Story 3 - Bảo Toàn Tính Tương Thích & Độ Ổn Định Của Ứng Dụng Sau Khi Vá Bảo Mật (Priority: P1)

**Goal**: Ensure `package.json` and `package-lock.json` (`packages[""]`) are 100% synchronized for `npm ci`, zero new dependencies were added, and `npm run lint`, `npm test`, and `npm run build` pass without regressions.

**Independent Test**: Run `npm ci --dry-run`, `npm run lint`, `npm test`, and `npm run build` sequentially and verify all four commands exit with code `0`.

### Implementation & Verification for User Story 3

- [X] T010 [US3] Run `npm install --package-lock-only` to synchronize the root manifest snapshot (`packages[""]`) in `package-lock.json` with the updated floors in `package.json` (`FR-003`)
- [X] T011 [US3] Verify clean install reproducibility by running `npm ci --dry-run` against `package.json` and `package-lock.json` and confirming exit code `0` (`FR-003`, `SC-004`)
- [X] T012 [P] [US3] Verify that direct `dependencies` and `devDependencies` package names in `package.json` match the baseline snapshot with zero new packages added (`FR-005`)
- [X] T013 [US3] Run `npm run lint` (`tsc --noEmit`) via `package.json` scripts and verify `0` TypeScript errors (`FR-006`, `SC-004`)
- [X] T014 [US3] Run `npm test` (`vitest run`) via `package.json` scripts and verify all `109` test files pass with `0` skipped or weakened assertions (`FR-006`, `SC-003`)
- [X] T015 [US3] Run `npm run build` (`tsc && vite build`) via `package.json` scripts and verify clean production bundle output in `dist/` (`FR-006`, `SC-004`)

**Checkpoint**: All three User Stories (`US1`, `US2`, `US3`) are complete and independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final diff hygiene and CI secret-scan parity check.

- [X] T016 [P] Verify `git diff` on `package.json` and `package-lock.json` contains only the scoped security remediation changes and leaves unrelated working-tree files untouched
- [X] T017 Run the end-to-end validation sequence from `specs/164-npm-audit-remediation/quickstart.md` (`npm ls vite vitest @vitest/mocker undici --all`, `npm audit --audit-level=high`, `npm audit`, `npm ci --dry-run`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: `T001`–`T002` start immediately.
- **Phase 2 (Foundational)**: `T003` (`npm audit fix`) depends on Phase 1 and updates the lockfile resolution graph.
- **Phase 3 (User Story 1 - P1 MVP)**: `T004`–`T006` depend on `T003`.
- **Phase 4 (User Story 2 - P2)**: `T007`–`T009` depend on `T003` (can run in parallel with or immediately after US1).
- **Phase 5 (User Story 3 - P1)**: `T010`–`T015` depend on `T004` and `T007` so `packages[""]` in `package-lock.json` is synchronized once after both `package.json` floor updates.
- **Phase 6 (Polish)**: `T016`–`T017` depend on Phase 5 completion.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational `T003`. Independently verifiable via `npm audit --audit-level=high`.
- **User Story 2 (P2)**: Depends on Foundational `T003`. Independently verifiable via `npm audit`.
- **User Story 3 (P1)**: Synchronizes `package-lock.json` (`T010`) after `US1`/`US2` floor updates (`T004`, `T007`) and runs full regression gates (`T011`–`T015`).

### Parallel Opportunities

- `T001` and `T002` in Phase 1 can run in parallel (`[P]`).
- `T011` and `T012` in Phase 5 can run in parallel (`[P]`).
- `T016` and `T017` in Phase 6 can run in parallel (`[P]`).

---

## Parallel Example: User Story 3 Verification

```bash
# Verify lockfile clean-install parity and zero new direct dependencies in parallel:
Task T011: "npm ci --dry-run against package.json and package-lock.json"
Task T012: "Compare package.json dependencies/devDependencies keys against baseline"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (`T001`–`T002`) and Phase 2 (`T003`: `npm audit fix`).
2. Complete Phase 3 (`T004`–`T006`: raise `vite` floor to `^6.4.6`, verify `vite` & `undici`, pass `npm audit --audit-level=high`).
3. **VALIDATE**: Confirm CI security gate passes with exit code `0`.

### Incremental Delivery

1. Apply Phase 4 (`T007`–`T009`: raise `vitest` floor to `^4.1.12`, verify `@vitest/*` lockstep cohort, pass full `npm audit`).
2. Apply Phase 5 (`T010`–`T015`: sync `packages[""]` via `npm install --package-lock-only`, pass `npm ci --dry-run`, `npm run lint`, `npm test`, `npm run build`).
3. Apply Phase 6 (`T016`–`T017`: final diff & quickstart verification).

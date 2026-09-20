# Tasks: Sửa Lỗi Kiểu Dữ Liệu Vite Esbuild Option Trong Quy Trình Kiểm Tra Mã Nguồn (npm run lint)

**Branch**: `153-vite-esbuild-type-fix` | **Date**: 2026-09-21 | **Spec**: [`specs/153-vite-esbuild-type-fix/spec.md`](./spec.md) | **Plan**: [`specs/153-vite-esbuild-type-fix/plan.md`](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure & Inspection)

**Purpose**: Baseline inspection of current build configuration and package interfaces

- [X] T001 Verify baseline static type checking and configuration state in `vite.config.ts`
- [X] T002 [P] Inspect interface requirements and exported types from `vite` in `node_modules/vite/dist/node/index.d.ts`

---

## Phase 2: Foundational (Type Imports & Contract Boundaries)

**Purpose**: Establish type import prerequisites required by all configuration updates

**⚠️ CRITICAL**: Must complete before user story updates begin

- [X] T003 Import `type UserConfig` and `type ESBuildOptions` from `vite` in `vite.config.ts`

**Checkpoint**: Type definitions imported cleanly from `vite` module.

---

## Phase 3: User Story 1 - Type Check Success Without Build Config Overload Failures (Priority: P1) 🎯 MVP

**Goal**: Ensure `npm run lint` (`tsc --noEmit`) passes cleanly with exit code 0 and 0 type errors on both Windows dev and Linux CI runners, resolving TS2769.

**Independent Test**: Execute `npm run lint` (`tsc --noEmit`) and verify that TypeScript completes with exit code 0 and no overload resolution errors on `vite.config.ts`.

### Implementation for User Story 1

- [X] T004 [US1] Annotate explicit return type `: UserConfig` on the configuration callback function in `vite.config.ts`
- [X] T005 [US1] Explicitly cast the `esbuild` configuration block `as ESBuildOptions` in `vite.config.ts`
- [X] T006 [US1] Execute static type check `npm run lint` (`tsc --noEmit`) to verify 0 errors in `vite.config.ts`

**Checkpoint**: User Story 1 complete. `npm run lint` passes with 0 errors and no `TS2769` overload failure.

---

## Phase 4: User Story 2 - Production Optimization Retention (Priority: P2)

**Goal**: Ensure production builds strip `console` and `debugger` statements while preserving them in non-production, and ensure all existing automated tests pass without regressions.

**Independent Test**: Execute `npm test` (all 92 test files, 845 tests pass) and `npm run build` (`dist/` directory created with complete bundle).

### Implementation for User Story 2

- [X] T007 [US2] Verify retention of conditional `drop` array evaluation and invariant strings (`base: publicConfig.basePath`, `outDir: 'dist'`, CSP header) in `vite.config.ts`
- [X] T008 [US2] Execute automated unit and integration tests via `npm test` to verify test integrity in `src/utils/__tests__/customDomainAssets.test.ts`
- [X] T009 [US2] Execute production build via `npm run build` to verify bundle generation in `dist/`

**Checkpoint**: User Stories 1 and 2 complete. All tests pass and production build generates cleanly.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, documentation sync, and Constitution compliance verification.

- [X] T010 Execute end-to-end quickstart validation scenarios in `specs/153-vite-esbuild-type-fix/quickstart.md`
- [X] T011 [P] Verify documentation synchronization across `specs/153-vite-esbuild-type-fix/spec.md` and `specs/153-vite-esbuild-type-fix/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS User Stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion - delivers MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion - verifies optimizations & test suites.
- **Polish (Phase 5)**: Depends on User Stories 1 and 2 being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent of US2. Directly resolves TS2769 type error.
- **User Story 2 (P2)**: Builds upon the typed configuration from US1, validating production build and test suites.

### Parallel Opportunities

- T001 and T002 in Phase 1 can execute in parallel.
- T010 and T011 in Phase 5 can execute in parallel.

---

## Parallel Example: Phase 1 Setup

```bash
# Parallel inspection of config and package types:
Task: "Verify baseline static type checking and configuration state in vite.config.ts"
Task: "Inspect interface requirements and exported types from vite in node_modules/vite/dist/node/index.d.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002).
2. Complete Phase 2: Foundational (T003).
3. Complete Phase 3: User Story 1 (T004–T006).
4. **STOP and VALIDATE**: Run `npm run lint` to verify that `TS2769` is completely resolved.

### Incremental Delivery

1. Setup + Foundational -> Type imports ready.
2. User Story 1 -> Configuration typed, type checker passes cleanly (MVP achieved).
3. User Story 2 -> Build optimization and test suites verified.
4. Polish -> Quickstart scenarios verified, documentation synchronized.

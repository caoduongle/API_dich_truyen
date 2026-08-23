# Tasks: Fix Google Picker CSP & COOP

**Feature**: 067-fix-google-picker-csp-coop
**Branch**: `067-fix-google-picker-csp-coop`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Pre-Flight Verification

**Purpose**: Xác định hiện trạng cấu hình CSP trong `server.ts` và `googlePickerService.ts`.

- [X] T001 Inspect existing Helmet CSP in `server.ts` and PickerBuilder initialization in `src/services/googlePickerService.ts`

**Checkpoint**: Đã xác nhận các directive cần mở rộng và vị trí cần thêm `setOrigin`.

---

## Phase 2: Core Server & Client Service Updates (US1 — Cấu hình CSP & Google Picker Origin)

**Goal**: Mở rộng CSP trong `server.ts` cho Google Picker & Google Drive API và thêm `setOrigin` trong `src/services/googlePickerService.ts`.

**Independent Test**: Iframe Google Picker tải thành công không bị CSP chặn; `setOrigin` được truyền chính xác.

### Implementation

- [X] T002 [P] [US1] In `server.ts`, expand Helmet CSP directives in production mode (`frameSrc`, `scriptSrc`, `connectSrc`, `styleSrc`, `fontSrc`, `imgSrc`) to support Google Picker and Drive API
- [X] T003 [P] [US1] In `src/services/googlePickerService.ts`, add `.setOrigin(window.location.origin)` to `PickerBuilder` inside `openFolderPicker()` method

**Checkpoint**: Server và Client Service đã sẵn sàng cho Google Picker.

---

## Phase 3: Unit Tests Synchronization (US2 — Cập nhật Unit Tests)

**Goal**: Đồng bộ test app và cập nhật assertions cho CSP mở rộng trong `server/__tests__/securityHeaders.test.ts`.

**Independent Test**: `npx vitest run server/__tests__/securityHeaders.test.ts` pass 100%.

### Implementation

- [X] T004 [US2] Update `createTestApp` in `server/__tests__/securityHeaders.test.ts` to match the expanded CSP directives
- [X] T005 [US2] Update test assertions in `server/__tests__/securityHeaders.test.ts` to verify the new CSP directives

**Checkpoint**: Unit test cho security headers phản ánh chính xác cấu hình mới và pass hoàn toàn.

---

## Phase 4: Polish & Quality Gates Verification

**Purpose**: Chạy toàn bộ bộ kiểm thử chất lượng bắt buộc của dự án.

- [X] T006 Run `npm run lint` (`tsc --noEmit`) to verify type safety
- [X] T007 Run `npm test` (`vitest run`) to verify all 88+ test suites pass without regression
- [X] T008 Run `npm run build` (`vite build` + `esbuild server`) to verify production bundle builds cleanly

**Checkpoint**: Toàn bộ quality gates pass, sẵn sàng release.

---

## Dependencies & Execution Order

- **Phase 1 (Pre-Flight)**: Không phụ thuộc
- **Phase 2 (Implementation)**: Phụ thuộc Phase 1; T002 và T003 có thể chạy song song [P]
- **Phase 3 (Unit Tests)**: Phụ thuộc Phase 2
- **Phase 4 (Quality Gates)**: Phụ thuộc Phase 2 & Phase 3

---

## Implementation Strategy

### MVP Delivery (Phases 1-3)
1. Cập nhật CSP trong `server.ts` và `setOrigin` trong `src/services/googlePickerService.ts`.
2. Đồng bộ `server/__tests__/securityHeaders.test.ts`.
3. Chạy `npm test server/__tests__/securityHeaders.test.ts` để kiểm chứng.

### Full Verification (Phase 4)
Chạy toàn bộ `npm run lint`, `npm test`, `npm run build`.

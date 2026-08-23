# Tasks: Fix COOP and CSP for Google OAuth Popup

**Feature**: 066-fix-coop-google-popup
**Branch**: `066-fix-coop-google-popup`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Pre-Flight Verification

**Purpose**: Xác định hiện trạng cấu hình header trong `server.ts` và test file.

- [X] T001 Inspect existing Helmet configuration in `server.ts` and `server/__tests__/securityHeaders.test.ts`

**Checkpoint**: Đã nắm rõ vị trí cần sửa đổi trong `server.ts` và test file.

---

## Phase 2: Core Server Security Headers (US1 — Cấu hình COOP & CSP)

**Goal**: Cấu hình header `Cross-Origin-Opener-Policy: same-origin-allow-popups` và hoàn thiện `connectSrc` trong `server.ts`.

**Independent Test**: Khởi động server test và kiểm tra response headers có `Cross-Origin-Opener-Policy: same-origin-allow-popups`.

### Implementation

- [X] T002 [US1] In `server.ts`, configure `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }` inside the `helmet({ ... })` middleware
- [X] T003 [US1] In `server.ts`, ensure `connectSrc` includes `'self'`, `ws:`, `wss:`, `https://accounts.google.com`, `https://oauth2.googleapis.com`, `https://www.googleapis.com`, and `https://apis.google.com`

**Checkpoint**: `server.ts` đã cấu hình đúng COOP và CSP.

---

## Phase 3: Unit Tests Synchronization (US2 — Cập nhật Unit Tests)

**Goal**: Đồng bộ test app và thêm assertions cho COOP và CSP trong `server/__tests__/securityHeaders.test.ts`.

**Independent Test**: `npx vitest run server/__tests__/securityHeaders.test.ts` pass 100%.

### Implementation

- [X] T004 [US2] Update `createTestApp` in `server/__tests__/securityHeaders.test.ts` to include `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }` and match the updated CSP directives
- [X] T005 [US2] Update test assertions in `server/__tests__/securityHeaders.test.ts` to verify `cross-origin-opener-policy` header equals `same-origin-allow-popups` and verify the updated CSP string

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
- **Phase 2 (Server Implementation)**: Phụ thuộc Phase 1
- **Phase 3 (Unit Tests)**: Phụ thuộc Phase 2
- **Phase 4 (Quality Gates)**: Phụ thuộc Phase 2 & Phase 3

---

## Implementation Strategy

### MVP Delivery (Phases 1-3)
1. Cấu hình `crossOriginOpenerPolicy` & `connectSrc` trong `server.ts`.
2. Đồng bộ `server/__tests__/securityHeaders.test.ts`.
3. Chạy `npm test server/__tests__/securityHeaders.test.ts` để kiểm chứng.

### Full Verification (Phase 4)
Chạy toàn bộ `npm run lint`, `npm test`, `npm run build`.

# Implementation Plan: Fix COOP and CSP for Google OAuth Popup

**Branch**: `066-fix-coop-google-popup` | **Date**: 2026-08-23 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/066-fix-coop-google-popup/spec.md)

**Input**: Feature specification from `specs/066-fix-coop-google-popup/spec.md`

## Summary

Cấu hình header `Cross-Origin-Opener-Policy: same-origin-allow-popups` trong middleware Helmet (`server.ts`) để bảo đảm cửa sổ popup Google OAuth (GIS) duy trì kết nối với `window.opener` và gửi token response về callback thành công. Bổ sung các endpoint Google cần thiết vào `connectSrc` của CSP và cập nhật unit tests trong `server/__tests__/securityHeaders.test.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js
**Primary Dependencies**: Express 4.x, Helmet 8.x
**Storage**: N/A (Header configuration)
**Testing**: Vitest (`npm test`), TypeScript checking (`npm run lint`), Build verification (`npm run build`)
**Target Platform**: Web SPA (React + Express server)
**Project Type**: Web Application
**Performance Goals**: Không ảnh hưởng đến latency của server (chỉ là header modification)
**Constraints**: Tuân thủ quy tắc bảo mật theo AGENTS.md và Constitution, không thêm dependencies mới

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| I. Strict Quality Gates | ✅ PASS | Đảm bảo chạy và vượt qua `npm run lint`, `npm test`, `npm run build` |
| II. Dependency Minimization | ✅ PASS | Sử dụng tính năng có sẵn của Helmet, không cài package mới |
| III. Concern Separation | ✅ PASS | Chỉ can thiệp cấu hình middleware headers trong `server.ts` và test file tương ứng |
| IV. Immutable Core Schemas | ✅ PASS | Không thay đổi types hay database schema |
| V. Atomic Commits & Docs | ✅ PASS | Thay đổi tập trung vào COOP và CSP |

**Gate Result**: ✅ ALL PASS — proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/066-fix-coop-google-popup/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
server.ts                                  # [MODIFY] Thêm crossOriginOpenerPolicy và hoàn thiện connectSrc trong helmet config
server/
└── __tests__/
    └── securityHeaders.test.ts            # [MODIFY] Cập nhật test helper và assertions cho COOP & CSP
```

**Structure Decision**: Thay đổi trực tiếp tại Express server entrypoint (`server.ts`) và test suite (`server/__tests__/securityHeaders.test.ts`).

## Complexity Tracking

> No constitution violations — table not applicable.

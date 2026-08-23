# Implementation Plan: Fix Google Picker CSP & COOP

**Branch**: `067-fix-google-picker-csp-coop` | **Date**: 2026-08-23 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/067-fix-google-picker-csp-coop/spec.md)

**Input**: Feature specification from `specs/067-fix-google-picker-csp-coop/spec.md`

## Summary

Khắc phục triệt để lỗi giao diện iframe Google Picker bị chặn bởi CSP bằng cách mở rộng các chỉ thị CSP trong `server.ts` cho các domain Google Drive, Docs và APIs (`drive.google.com`, `docs.google.com`, `content.googleapis.com`, `*.googleusercontent.com`), duy trì `Cross-Origin-Opener-Policy: same-origin-allow-popups`, và bổ sung `.setOrigin(window.location.origin)` vào `PickerBuilder` trong `src/services/googlePickerService.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js
**Primary Dependencies**: Express 4.x, Helmet 8.x, Google Picker API (`apis.google.com/js/api.js`)
**Storage**: N/A (Header & Client Service configuration)
**Testing**: Vitest (`npm test`), TypeScript checking (`npm run lint`), Build verification (`npm run build`)
**Target Platform**: Web SPA (React + Express server)
**Project Type**: Web Application
**Performance Goals**: Không ảnh hưởng đến latency
**Constraints**: Tuân thủ quy tắc bảo mật theo AGENTS.md và Constitution, không thêm dependencies mới

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| I. Strict Quality Gates | ✅ PASS | Đảm bảo chạy và vượt qua `npm run lint`, `npm test`, `npm run build` |
| II. Dependency Minimization | ✅ PASS | Sử dụng các tiện ích có sẵn, không cài thêm package |
| III. Concern Separation | ✅ PASS | Chỉ can thiệp cấu hình headers trong `server.ts`, `googlePickerService.ts`, và test file |
| IV. Immutable Core Schemas | ✅ PASS | Không thay đổi types hay database schema |
| V. Atomic Commits & Docs | ✅ PASS | Thay đổi tập trung giải quyết triệt để lỗi Google Picker CSP & COOP |

**Gate Result**: ✅ ALL PASS — proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/067-fix-google-picker-csp-coop/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
server.ts                                  # [MODIFY] Mở rộng CSP directives (frameSrc, scriptSrc, connectSrc, styleSrc, imgSrc)
src/
└── services/
    └── googlePickerService.ts             # [MODIFY] Bổ sung .setOrigin(window.location.origin) trong openFolderPicker
server/
└── __tests__/
    └── securityHeaders.test.ts            # [MODIFY] Cập nhật test helper và assertions cho CSP mở rộng
```

**Structure Decision**: Cập nhật trực tiếp `server.ts`, `src/services/googlePickerService.ts`, và `server/__tests__/securityHeaders.test.ts`.

## Complexity Tracking

> No constitution violations — table not applicable.

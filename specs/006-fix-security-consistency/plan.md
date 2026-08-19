# Implementation Plan: Fix Security Consistency (Redaction & Exact Path Auth)

**Branch**: `006-fix-security-consistency` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-fix-security-consistency/spec.md`

## Summary

Vá 2 lỗ hổng nhất quán bảo mật phát hiện qua audit thủ công:
1. **Lỗ hổng A**: Đảm bảo lỗi tổng hợp `ALL_KEYS_EXHAUSTED` tại `server/services/geminiService.ts` thực hiện khử khóa bí mật qua `redactApiKey()`, đồng thời di chuyển toàn bộ ~30 lệnh `console.log/warn/error` rải rác trong `server/controllers/**` sang `Logger` từ `server/utils/logger.ts`, bảo toàn 100% nội dung thông báo tiếng Việt và không thay đổi luồng dịch/rotation/circuit breaker.
2. **Lỗ hổng B**: Bỏ các điều kiện so khớp hậu tố `endsWith()` trong `server/middleware/authMiddleware.ts`, chỉ giữ so khớp chính xác với `PUBLIC_API_PATHS` để ngăn chặn bypass xác thực qua các route giả mạo; bổ sung test case giải thích rõ lý do an toàn theo Nguyên tắc #9.

## Technical Context

**Language/Version**: TypeScript 5.8+ / Node.js 20+  
**Primary Dependencies**: Express.js, ioredis, @google/genai, vitest  
**Storage**: In-memory Map / Redis for sessions and rate limiting  
**Testing**: Vitest (`npx vitest run`)  
**Target Platform**: Node.js backend server  
**Project Type**: Web service (Express backend + React frontend)  
**Performance Goals**: Không suy giảm hiệu năng xử lý request (<1ms overhead cho logging và path lookup)  
**Constraints**: Zero modifications to UI components, IndexedDB schemas, translation core prompt/flow, or Vietnamese copy text  
**Scale/Scope**: 1 service file (`geminiService.ts`), 1 middleware file (`authMiddleware.ts`), 8 controller files (`server/controllers/**`), 2 test files  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates & Verification)**: `npm run lint`, `npm test`, `npm run build` are mandatory verification steps. No tests skipped.
- [x] **Principle II (Dependency Minimization & Library Reuse)**: Reuses existing `Logger` (`server/utils/logger.ts`) and `redactApiKey` (`server/utils/text.ts`). No new NPM packages added.
- [x] **Principle III (Strict Concern Separation & Domain Boundary Preservation)**: Does not modify UI components or Gemini translation prompt/pipeline logic. Confined strictly to logging sanitization and authentication routing.
- [x] **Principle IV (Immutable Core Schemas & Storage Stability)**: Zero changes to `src/types.ts` or IndexedDB schema.
- [x] **Principle V (Atomic Commits & Documentation Synchronization)**: Modular, small changes strictly targeting the 2 reported security consistency issues.

## Project Structure

### Documentation (this feature)

```text
specs/006-fix-security-consistency/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── security-redaction-auth.contract.md
├── checklists/
│   └── requirements.md  # Quality checklist
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
server/
├── controllers/
│   ├── alignmentController.ts          # Replace console.* with Logger('Alignment')
│   ├── authController.ts               # Replace console.* with Logger('AuthController')
│   ├── glossaryController.ts           # Replace console.* with Logger('Glossary')
│   ├── quotaController.ts              # Replace console.* with Logger('QuotaController')
│   ├── sessionController.ts            # Replace console.* with Logger('SessionController')
│   ├── translation/
│   │   ├── polishController.ts         # Replace console.* with Logger('PolishTranslation')
│   │   ├── qaController.ts             # Replace console.* with Logger('QACritique')
│   │   └── rawController.ts            # Replace console.* with Logger('RawTranslation')
│   └── __tests__/
│       └── authController.test.ts      # Add suffix bypass rejection & purpose-driven test cases
├── middleware/
│   └── authMiddleware.ts               # Remove endsWith(), use exact Set match on PUBLIC_API_PATHS
├── services/
│   ├── geminiService.ts                # Redact keys in ALL_KEYS_EXHAUSTED exception throw
│   └── __tests__/
│       └── geminiService.test.ts       # Add test case verifying key redaction in ALL_KEYS_EXHAUSTED
└── utils/
    ├── logger.ts                       # Shared structured Logger
    └── text.ts                         # redactApiKey utility
```

**Structure Decision**: Standard web service backend layout in `server/`. Changes are purely within backend controllers, services, middleware, and tests.

## Complexity Tracking

> **No violations of the Constitution. Standard minimal implementation.**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|:---|:---|:---|
| None | N/A | N/A |

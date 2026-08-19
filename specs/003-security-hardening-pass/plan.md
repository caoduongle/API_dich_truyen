# Implementation Plan: Security Hardening Pass

**Branch**: `003-security-hardening-pass` | **Date**: 2026-08-19 | **Spec**: [specs/003-security-hardening-pass/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/003-security-hardening-pass/spec.md)

**Input**: Feature specification from `specs/003-security-hardening-pass/spec.md`

## Summary

Thực hiện đợt rà soát và củng cố bảo mật toàn diện cho ứng dụng AI Dịch Truyện Trung-Việt bao gồm 4 trụ cột chính:
1. **Bảo vệ Secret & Quản lý Truy cập (US1 / P1)**: Che giấu toàn diện các secret (API key, token, password) trong URL query, message và metadata log; cấu hình rate limit riêng biệt chống brute-force cho endpoint `/api/auth/login` (10 req/15 phút/IP); sửa lỗi đếm session hoạt động trong Redis dùng cơ chế non-blocking scan.
2. **Phòng thủ AI & Chống Prompt Injection (US2 / P1)**: Tiền xử lý loại bỏ ký tự zero-width và dải Unicode tag; bổ sung chỉ thị phòng thủ chống injection tường minh cho toàn bộ prompt AI (Gemini & Gemma).
3. **Kiểm soát Request & CSP Production (US3 / P2)**: Xác thực nghiêm ngặt body cho toàn bộ POST endpoints; củng cố CSP production (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`) và xác minh thực tế 0 lỗi CSP trên trình duyệt thật.
4. **Bảo mật CI/CD & Chính sách Dự án (US4 / P3)**: Bổ sung `npm audit`, quét secret, ghim commit SHA cho third-party actions, quyền hạn tối thiểu `contents: read`, cấu hình Dependabot và ban hành `SECURITY.md`.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 20+
**Primary Dependencies**: Express 4.21, Helmet 8.3, ioredis 5.5, @google/genai 2.4, Vite 6.2
**Storage**: Redis (phiên bản 6+) hoặc In-Memory Map cho session & rate limit; IndexedDB (client-side)
**Testing**: Vitest 4.1, TypeScript compiler (`tsc --noEmit`)
**Target Platform**: Node.js Backend Server (Linux/Docker/Windows) & Modern Web Browsers
**Project Type**: Fullstack Web Application (Express API Server + React SPA Frontend)
**Performance Goals**: Middleware overhead cho logging, rate limiting và sanitization < 2ms mỗi request
**Constraints**: Tuân thủ tuyệt đối [`.specify/memory/constitution.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/.specify/memory/constitution.md) (Không sửa UI React, không sửa schema IndexedDB/types.ts, không cài thư viện ngoài thừa thãi, toàn bộ test suite phải pass)
**Scale/Scope**: Server middleware (`server/middleware/`), Utilities (`server/utils/`), Services (`server/services/`), Controllers (`server/controllers/`), CI Workflow (`.github/`), Root Documentation (`SECURITY.md`)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Tình trạng | Đánh giá & Tuân thủ |
|---|---|---|
| **I. Strict Quality Gates & Verification** | **PASS** | Bắt buộc chạy `npx tsc --noEmit`, `npx vitest run`, `npm run build` không lỗi, không skip test. |
| **II. Dependency Minimization** | **PASS** | Tận dụng 100% các tiện ích có sẵn (RegExp, Express, Helmet, ioredis), không thêm package npm mới. |
| **III. Strict Concern Separation** | **PASS** | Chỉ sửa đổi trong `server/`, `shared/`, `.github/`, `SECURITY.md`; không đụng vào `src/components/` hay UI. |
| **IV. Immutable Core Schemas & Storage** | **PASS** | Không thay đổi `src/types.ts` hay schema IndexedDB; không sửa đổi nhãn giao diện tiếng Việt. |
| **V. Atomic Commits & Docs Sync** | **PASS** | Các module được tách biệt rõ ràng theo từng PR/Task; cập nhật đồng bộ tài liệu kiến trúc. |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-security-hardening-pass/
├── plan.md              # Kế hoạch kiến trúc và thiết kế tổng thể
├── research.md          # Kết quả nghiên cứu Phase 0 cho 9 yêu cầu chức năng
├── data-model.md        # Mô hình dữ liệu, schema validation và cấu hình bảo mật
├── quickstart.md        # Hướng dẫn kiểm thử tự động và xác minh thực tế trên trình duyệt
├── contracts/           # Hợp đồng giao tiếp và đặc tả API
│   ├── security-logging-auth.contract.md
│   ├── api-validation-csp.contract.md
│   └── ai-defense-pipeline.contract.md
└── checklists/
    └── requirements.md  # Danh mục kiểm tra chất lượng đặc tả
```

### Source Code Impact Areas

```text
server/
├── constants/
│   └── models.ts             # Whitelist models & limits
├── controllers/
│   ├── authController.ts     # Validation cho login/logout
│   ├── sessionController.ts  # Token handling & validation
│   ├── translationController.ts / translation/*.ts # Body validation & prompt defense
│   ├── glossaryController.ts # Body validation & prompt defense
│   └── alignmentController.ts# Body validation & prompt defense
├── middleware/
│   ├── metricsMiddleware.ts  # URL secret redaction
│   ├── rateLimiter.ts        # Dedicated auth rate limiter & prefixing
│   └── authMiddleware.ts     # Auth token verification
├── routes/
│   └── api.ts                # Route binding with dedicated auth rate limiter
├── services/
│   ├── geminiService.ts      # Gemma safety prompt wrapping & retry logic
│   ├── sessionStore.ts       # Non-blocking scan for active sessions with correct prefix
│   └── authStore.ts          # Server access password validation
└── utils/
    ├── logger.ts             # String secret sanitizer & structured JSON output
    ├── text.ts               # Input sanitization (zero-width/tag removal) & anti-injection directive
    └── validation.ts         # Centralized POST request body validation helpers

shared/
└── constants.ts              # AUTH_RATE_LIMIT constants in SERVER_CONFIG

.github/
├── workflows/
│   └── ci.yml                # Pinned SHAs, permissions, npm audit, secret scanning
└── dependabot.yml            # Dependabot updates for npm & github-actions

SECURITY.md                   # Project security disclosure & deployment hardening checklist
server.ts                     # Production CSP hardening directives (Helmet)
```

---

## Complexity Tracking

*No violations. All changes adhere strictly to the project constitution.*

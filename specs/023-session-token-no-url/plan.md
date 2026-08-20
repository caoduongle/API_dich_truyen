# Implementation Plan: Secure Session Tokens (Zero URL Query Credentials)

**Branch**: `023-session-token-no-url` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-session-token-no-url/spec.md`

## Summary

Eliminate legacy `req.query.token` from `server/controllers/sessionController.ts`. Enforce `X-Session-Token` headers as the sole official mechanism for session queries and deletions, explicitly rejecting URL query tokens with HTTP 400 `DISALLOWED_URL_CREDENTIALS` to prevent credential exposure in access logs and referrer headers.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: Express.js  
**Target Platform**: Node.js Server  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: 0 overhead token resolution  
**Constraints**: 0 new external dependencies; adhere strictly to OWASP credential handling rules.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | 0 new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Session authentication encapsulated in `sessionController.ts` and `sessionStore.ts`. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Complete spec, data model, contract, and test suite. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/023-session-token-no-url/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── session-auth.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
└── controllers/
    ├── sessionController.ts           # Remove req.query.token, reject ?token= with 400
    └── __tests__/
        └── sessionController.test.ts   # Tests for header success, query rejection, missing token
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

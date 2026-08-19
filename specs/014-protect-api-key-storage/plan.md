# Implementation Plan: Protect API Key Storage and Secure Credential Lifecycle

**Branch**: `014-protect-api-key-storage` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-protect-api-key-storage/spec.md`

## Summary

Eliminate permanent plaintext API key storage in browser `localStorage` by transitioning to an ephemeral client credential lifecycle (`sessionStorage` + in-memory state) backed by server-side `SessionStore` (`SessionToken` delegation). Implement a robust startup migration that imports and clears legacy `localStorage` keys without crashing on corrupted data, while enforcing zero key leakage across API responses, error traces, structured logs, and URLs.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: React 19, Express.js, `ioredis` (optional Redis backend for sessions), `crypto` (Node.js built-in)  
**Storage**: `sessionStorage` (client active tab), `localStorage` (opaque tokens only: `gemini_session_token`, `gemini_auth_token`), in-memory Map / Redis (server `SessionStore`)  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Target Platform**: Modern Web Browsers (Chrome, Firefox, Safari, Edge) + Node.js Server  
**Project Type**: Full-stack web application (React frontend + Express backend)  
**Performance Goals**: Session synchronization and transparent recovery within <100ms; zero impact on translation throughput  
**Constraints**: Zero plaintext API keys in `localStorage`, zero plaintext keys in response payloads, zero keys in URLs, zero keys in logs  
**Scale/Scope**: Support 1-50 API keys per session, concurrent translations, dynamic rotation  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | All changes will be verified with `npm run lint`, `npm test` (all 274+ tests passing), and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing web APIs (`sessionStorage`, `localStorage`) and Node.js `crypto`. No new NPM packages added. | **PASS** |
| **III. Strict Concern Separation** | Storage and session lifecycle improvements do not alter core translation prompts or two-stage translation pipeline logic. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas (`src/services/db.ts`) and `src/types.ts` remain intact. UI labels in Vietnamese remain preserved. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Focused exclusively on credential storage security and session lifecycle; documentation synchronized across contracts and spec artifacts. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/014-protect-api-key-storage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── session-credential.contract.md
│   ├── client-credential-storage.contract.md
│   └── security-redaction-logging.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
src/
├── hooks/
│   └── useAIConfig.ts                 # Update to load from sessionStorage / migrate legacy localStorage keys safely
├── utils/
│   ├── apiClient.ts                   # Session token management & automatic 401 re-sync
│   └── __tests__/
│       ├── apiClient.test.ts          # Unit tests for session sync & token delegation
│       └── credentialStorage.test.ts  # [NEW] Tests for legacy migration, corruption resilience, and zero leakage
server/
├── services/
│   ├── sessionStore.ts                # Session storage TTL & key isolation
│   ├── authStore.ts                   # Auth token management
│   ├── quotaService.ts                # Masked key projection
│   └── modelInfoService.ts            # Error redaction for Google APIs
├── controllers/
│   ├── sessionController.ts           # Session endpoints
│   └── quotaController.ts             # Quota & model endpoints (zero key exposure)
└── utils/
    └── logger.ts                      # Universal secret redaction in structured logs
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

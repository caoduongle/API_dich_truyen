# Implementation Plan: Real Health, Liveness & Readiness Endpoints

**Branch**: `024-health-readiness-endpoints` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/024-health-readiness-endpoints/spec.md`

## Summary

Implement dedicated `/api/live` (Liveness) and `/api/ready` (Readiness) probe endpoints and update `/api/health` diagnostics in `server/routes/api.ts`. Connect readiness evaluation directly to real `redisManager.getStatus()` telemetry and ensure 0 upstream Gemini API calls during health checks. Whitelist all health routes in `server/middleware/authMiddleware.ts`.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: Express.js, ioredis  
**Target Platform**: Node.js Server  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: <1ms response latency for `/live` and `/ready`  
**Constraints**: 0 new external dependencies; 0 calls to Gemini API during probes.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | 0 new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Health endpoints organized in `api.ts` consuming `redisService` and `metricsService`. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Complete spec, data model, contract, and test suite. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/024-health-readiness-endpoints/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── health-endpoints.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── routes/
│   ├── api.ts                         # Add /live, /ready and update /health diagnostics
│   └── __tests__/
│       └── healthEndpoints.test.ts    # [NEW] Tests for /live, /ready, /health under various Redis states
└── middleware/
    └── authMiddleware.ts              # Whitelist /live, /ready, /health routes
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

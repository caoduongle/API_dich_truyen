# Implementation Plan: Shared Redis Connection Manager & Lifecycle Engine

**Branch**: `022-shared-redis-connection` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-shared-redis-connection/spec.md`

## Summary

Create a centralized `RedisManager` service (`server/services/redisService.ts`) to manage a single shared `ioredis` connection instance across `rateLimiter.ts`, `authStore.ts`, and `sessionStore.ts`. Implement status broadcast, graceful shutdown (`SIGINT`/`SIGTERM`), connection health monitoring, and test isolation helpers.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: ioredis, Express.js  
**Target Platform**: Node.js Server  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: Zero redundant socket connections; <0.1ms shared client resolution latency  
**Constraints**: 0 new external dependencies; preserve test isolation.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing `ioredis`; 0 new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Redis socket and lifecycle management centralized in `redisService.ts`. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Complete spec, data model, contract, and test suite. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/022-shared-redis-connection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── redis-manager.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── services/
│   ├── redisService.ts                # [NEW] Centralized shared Redis manager & lifecycle
│   ├── authStore.ts                   # Refactor to use redisManager.getClient()
│   ├── sessionStore.ts                # Refactor to use redisManager.getClient()
│   └── __tests__/
│       └── redisService.test.ts       # [NEW] Tests for singleton reuse, shutdown, and mock isolation
├── middleware/
│   └── rateLimiter.ts                 # Refactor to use redisManager.getClient()
└── server.ts                          # Hook redisManager.close() into process shutdown
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

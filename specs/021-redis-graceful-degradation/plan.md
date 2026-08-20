# Implementation Plan: Redis Graceful Degradation & Differentiated Local Fallback

**Branch**: `021-redis-graceful-degradation` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/021-redis-graceful-degradation/spec.md`

## Summary

Enhance the Express HTTP rate limiter (`server/middleware/rateLimiter.ts`) to handle Redis failures gracefully without fail-open security bypass or fail-dead server crashes. Implement differentiated endpoint failure policies (`auth`, `translation`, `non-critical`), bounded in-memory fallback (10,000 max entries with TTL cleanup and eviction), auto-recovery on Redis reconnection, throttled log warnings, and runtime health telemetry.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: Express.js, ioredis  
**Target Platform**: Node.js Server  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: <0.5ms fallback evaluation latency  
**Constraints**: Preserve existing 60 req/min API rate limit and 5 req/15min Auth limit; 0 new external dependencies.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing `ioredis` driver; 0 new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Rate limiting encapsulated in `rateLimiter.ts`. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Complete spec, data model, contract, and test suite. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/021-redis-graceful-degradation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── rate-limiter.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── middleware/
│   ├── rateLimiter.ts                 # Differentiated policies, bounded fallback, recovery, telemetry
│   └── __tests__/
│       └── rateLimiterDegradation.test.ts # Tests for healthy, outage, recovery, auth vs translation
└── routes/
    └── api.ts                         # Apply endpointType options to auth, translation, and non-critical routes
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

# Implementation Plan: HTTP Rate Limiter Upgrade (Sliding Window Counter)

**Branch**: `028-task-15-http` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/028-task-15-http/spec.md`

---

## Summary

This plan upgrades the Express HTTP rate limiter (`server/middleware/rateLimiter.ts`) from a naive fixed-window counter to an atomic **Sliding Window Counter** algorithm with Lua scripting in Redis and a bounded in-memory sliding fallback. It eliminates 2x boundary burst vulnerabilities, enforces standard HTTP rate limit headers (`X-RateLimit-*`, `Retry-After`), and guarantees high concurrency safety while preserving existing baseline limits (`60 requests / 60s / IP`).

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+, Express 4.x  
**Primary Dependencies**: Express, ioredis  
**Target Storage**: Redis (Lua Scripting) + Local Bounded Map fallback  
**Testing**: Vitest (`npm test`), TypeScript typecheck (`npm run lint`), Vite build + esbuild (`npm run build`)  
**Performance Goals**:
- Atomic Lua evaluation latency < 2ms
- In-memory sliding calculation latency < 0.1ms
- 0% 2x burst vulnerability across window boundaries  
**Constraints**:
- Keep default limits at 60 RPM/IP (translation) and 5 reqs/15m/IP (auth)
- Zero memory leakage in Redis and in-memory Map
- Maintain seamless graceful degradation under Redis failure  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Strict Quality Gates**: `npm run lint`, `npm test`, `npm run build` must be clean before completion.
- [x] **Deny-List Compliance**: No translation prompt changes; no unauthorized schema breaks; no unnecessary dependencies.
- [x] **Zero Plain Key Invariant**: Rate limiting identifies by IP / endpoint prefix only; no plain credentials logged.
- [x] **Graceful Degradation**: Dual-mode execution (Redis Lua + In-memory bounded Map) ensures high availability.

---

## Project Structure

### Documentation (this feature)

```text
specs/028-task-15-http/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan
├── research.md          # Phase 0: Sliding window counter & Lua research
├── data-model.md        # Phase 1: Models, schemas, and state machine
├── quickstart.md        # Phase 1: Validation scenarios and test suite
├── contracts/           # Phase 1: Interface contracts
│   └── http-rate-limiter.contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Impact Areas

```text
server/
├── middleware/
│   ├── rateLimiter.ts                    # Sliding window counter implementation + Lua + in-memory
│   └── __tests__/
│       ├── rateLimiter.test.ts           # Standard limiter tests
│       ├── rateLimiterDegradation.test.ts# Degradation & failover tests
│       └── rateLimiterSlidingWindow.test.ts # Boundary, burst & concurrency test suite
```

---

## Phases & Deliverables

### Phase 0: Research & Algorithm Selection (Completed)
- Formulated Sliding Window Counter mathematical model and evaluated against Token Bucket / GCRA.
- Authored Redis Lua script and in-memory algorithm.
- Documented in `research.md`.

### Phase 1: Design, Contracts & Validation (Completed)
- Designed entity models, Redis key schemas, and state machine in `data-model.md`.
- Authored interface contract in `contracts/http-rate-limiter.contract.md`.
- Formulated test scenarios in `quickstart.md`.

### Phase 2: Tasks Generation (Next: `/speckit-tasks`)
- Generate dependency-ordered actionable task list for implementing Sliding Window Counter Lua script, memory fallback, standard HTTP headers, boundary test suites, and regression testing.

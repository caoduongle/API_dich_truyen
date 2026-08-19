# Implementation Plan: Quota-Aware Per-Key RPM Scheduler

**Branch**: `017-per-key-rpm-scheduler` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-per-key-rpm-scheduler/spec.md`

## Summary

Bridge the gap between quota tracking and request scheduling by implementing a quota-aware per-key RPM scheduler. Each API key manages its own independent pacing interval and sliding window limits (`Key A -> RPM A -> Interval A`, `Key B -> RPM B -> Interval B`). The scheduler filters candidate keys across health states, cooldowns, model support, and capacity (RPM/TPM/RPD), ranks eligible candidates via predictive composite scoring, and balances traffic across available keys with transparent fallback, leaving the HTTP gateway IP rate limiter intact.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: Express.js, `@google/genai`  
**Target Platform**: Node.js Server Runtime  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: Candidate filtering & scoring in <0.5ms per request; zero memory leaks  
**Constraints**: Do NOT modify HTTP 60 req/min/IP abuse protection rate limiter; do NOT modify translation prompt logic or IndexedDB schemas.  

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses built-in `Map`, mathematical intervals, and existing quotaService. No new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Key scheduling and pacing separated from translation prompt templates and business logic. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` remain unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Architecture documented across `specs/017-per-key-rpm-scheduler/` and test suites. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/017-per-key-rpm-scheduler/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── key-scheduler.contract.md
│   └── quota-pacing.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── services/
│   ├── quotaService.ts                # Update calculateKeyScore with RPM, RPD, model support & composite score
│   ├── geminiService.ts               # Implement per-key pacing scheduling and multi-stage candidate filter
│   └── __tests__/
│       ├── quotaService.test.ts       # Unit tests for per-key scoring and capacity checks
│       └── keyScheduler.test.ts       # New unit tests for multi-key scheduling & variable RPM
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

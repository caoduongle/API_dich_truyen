# Implementation Plan: Observability and Explainable Telemetry for Gemini Scheduler

**Branch**: `025-scheduler-observability` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/025-scheduler-observability/spec.md`

## Summary

Expand the Gemini scheduler and quota tracking architecture with comprehensive, explainable observability telemetry. This upgrade answers the four critical operational questions:
1. **Why is this request slow?** (Decomposing total duration into queue wait / pacing delay vs upstream API latency vs retry backoff delay).
2. **Why was this key not chosen?** (Recording explicit rejection counts and categorized reasons during candidate scoring and rotation).
3. **Why did a retry happen?** (Recording normalized error codes, attempt counts, and latency per provider attempt with persistent `requestId` correlation).
4. **Why did a model fail?** (Tracking per-model request volume, failure rates, and latency distributions).

All operational logs and telemetry strictly enforce zero-leakage invariants: masking raw API keys, excluding session tokens, and omitting prompt contents.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Node.js 18+  
**Primary Dependencies**: Express.js, ioredis, React, Tailwind CSS v4, Lucide React  
**Target Platform**: Node.js Server Runtime & Browser Client  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: Sub-millisecond telemetry recording overhead (<0.1ms per attempt); bounded memory footprint for recent attempt traces.  
**Constraints**: Do NOT modify translation prompt engineering or 2-phase pipeline logic; do NOT leak raw API keys, session tokens, or sensitive user text in logs; maintain 100% backward compatibility for `/api/quota-status` and `/api/metrics`.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Will be verified via `tsc --noEmit`, `vitest run`, and `vite build`. All tests must pass with 0 errors. | **PASS** |
| **II. Dependency Minimization** | Uses existing in-memory structures and built-in Node.js `crypto` / logging utilities. No new external dependencies added. | **PASS** |
| **III. Strict Concern Separation** | Telemetry and logging instrumentation resides in `quotaService.ts`, `geminiService.ts`, and `metricsService.ts` without modifying translation semantics. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` remain unchanged. UI labels and design system tokens preserved. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Architecture documented across `specs/025-scheduler-observability/` with comprehensive contract and quickstart specifications. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/025-scheduler-observability/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── scheduler-observability-api.contract.md
│   └── telemetry-logger.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── services/
│   ├── quotaService.ts                     # Add scheduler telemetry, per-model latency, per-key events, and attempt logging
│   ├── geminiService.ts                    # Propagate requestId, record queueWait and attempt latencies/errors
│   ├── metricsService.ts                   # Expose integrated scheduler and model diagnostics
│   └── __tests__/
│       ├── schedulerObservability.test.ts  # Test suite for explainability, request ID correlation, and sanitization
│       └── geminiService.test.ts           # Validate rotation and attempt telemetry hooks
src/
├── components/
│   └── QuotaPanel.tsx                      # Display scheduler diagnostics and model latency if appropriate
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

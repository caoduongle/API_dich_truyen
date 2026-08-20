# Implementation Plan: Model Discovery Cache (Resilient & SWR Lifecycle)

**Branch**: `027-task-14-model` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/027-task-14-model/spec.md`

---

## Summary

This feature implements a resilient Stale-While-Revalidate (SWR) caching mechanism for Google Gemini model discovery. It guarantees instant UI rendering (< 10ms), eliminates duplicate in-flight network requests, enforces a 1-hour client TTL with non-blocking background revalidation, and ensures zero registry wipes when transient Google API errors (429/503/network disconnect) occur.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+, React 19  
**Primary Dependencies**: React, lucide-react, clsx, tailwind-merge  
**Target Storage**: Browser LocalStorage (`gemini_discovered_models`), Server In-Memory Cache (`modelInfoService.ts`), React hook state  
**Testing**: Vitest (`npm test`), TypeScript typecheck (`npm run lint`), Vite build + esbuild (`npm run build`)  
**Performance Goals**:
- Instant model list availability from cache < 10ms
- Over 80% reduction in `ListModels` API roundtrips
- Zero concurrent duplicate requests across components  
**Constraints**:
- Zero plain API keys stored in `localStorage`
- Zero registry wipe when API fails
- Maintain preset models as fallback at all times  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Strict Quality Gates**: `npm run lint`, `npm test`, `npm run build` must be clean before completion.
- [x] **Deny-List Compliance**: No translation prompt changes; no unauthorized schema breaks; no unnecessary dependencies.
- [x] **Zero Plain Key Invariant**: API keys are masked or hashed across logs, and stored exclusively in ephemeral server sessions or user-explicit `sessionStorage`.
- [x] **Graceful Degradation**: Stale cache & default preset models are preserved under network or API failure.

---

## Project Structure

### Documentation (this feature)

```text
specs/027-task-14-model/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan
├── research.md          # Phase 0: SWR & deduplication research
├── data-model.md        # Phase 1: Storage schemas & state machines
├── quickstart.md        # Phase 1: Validation scenarios and test suite
├── contracts/           # Phase 1: Interface contracts
│   └── model-discovery-cache.contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Impact Areas

```text
src/
├── utils/
│   ├── modelRegistry.ts         # SWR cache management, TTL, in-flight deduplication, error resilience
│   └── storageAudit.ts          # Storage invariant assertions
├── hooks/
│   ├── useModelDiscovery.ts     # Custom hook for SWR lifecycle & background refresh
│   └── useModelObservability.ts # Integration with telemetry & model selector
└── components/
    └── ApiSettings.tsx          # Manual refresh button & visual sync indicator

server/
└── services/
    └── modelInfoService.ts      # Server-side 15m registry cache & pending fetch deduplication
```

---

## Phases & Deliverables

### Phase 0: Research & Architecture (Completed)
- Designed SWR lifecycle with client 1-hour TTL and server 15-minute memory cache.
- Designed in-flight Promise singleton for duplicate request prevention.
- Documented in `research.md`.

### Phase 1: Design, Contracts & Validation (Completed)
- Defined data schemas and lifecycle state transitions in `data-model.md`.
- Authored contract in `contracts/model-discovery-cache.contract.md`.
- Formulated test scenarios in `quickstart.md`.

### Phase 2: Tasks Generation (Next: `/speckit-tasks`)
- Generate dependency-ordered actionable task list for implementing SWR cache helpers, `useModelDiscovery` hook, UI manual refresh controls, resilience error handling, and unit test suites.

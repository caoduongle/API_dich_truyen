# Implementation Plan: Project & Quota Group Scheduler Architecture

**Branch**: `032-quota-group-scheduler` | **Date**: 2026-08-20 | **Spec**: [specs/032-quota-group-scheduler/spec.md](spec.md)

**Input**: Feature specification from `specs/032-quota-group-scheduler/spec.md`

## Summary

Migrate the Gemini API key dispatch and quota accounting system from a flawed per-key quota model to a hierarchical **Project / Quota Group** architecture ($\text{Project/Quota Group} \to \text{API Keys} \to \text{Scheduler}$). Introduce strict 4-tier data classification (`providerQuota`, `configuredQuota`, `observedUsage`, `schedulingHint`), multi-project independent scaling, and key-level health isolation.

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20+  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, Express.js, ioredis, Google GenAI SDK (`@google/genai`), Vitest  
**Storage**: Redis (shared caching & sliding window counters) with robust in-memory fallback, Client-side IndexedDB for settings  
**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite Build (`npm run build`)  
**Target Platform**: Node.js Backend Server + Modern Web Browser (React Frontend)  
**Project Type**: Fullstack Web Application (Express Backend + React Frontend)  
**Performance Goals**: Sub-millisecond candidate scoring and group filtering; zero unnecessary queuing latency across independent projects  
**Constraints**: Minimum safety floor of 400ms on backend (500ms on frontend); strict decoupling of Express HTTP rate limiting (60 req/min/IP) from Gemini API scheduling  
**Scale/Scope**: Multi-key pools (up to 20 keys across multiple projects), high-throughput translation batches  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- [x] **I. Strict Quality Gates**: `tsc --noEmit`, `vitest run`, and `npm run build` must pass cleanly without skipping or muting tests.
- [x] **II. Dependency Minimization**: No new NPM dependencies; reuse existing modules (`ioredis`, `clsx`, `tailwind-merge`, `motion`, `lucide-react`).
- [x] **III. Domain Boundary Preservation**: Gemini dispatching and quota logic remain strictly contained in `server/services/quotaService.ts`, `server/services/geminiService.ts`, and shared model definitions.
- [x] **IV. Storage & Schema Stability**: Core IndexedDB schemas remain stable; configuration extensions preserve backward compatibility for unassigned single-key configurations.
- [x] **V. Documentation Synchronization**: All updated interfaces and behavior documented in `specs/032-quota-group-scheduler/`.

## Project Structure

### Documentation (this feature)

```text
specs/032-quota-group-scheduler/
├── spec.md                  # Feature specification
├── plan.md                  # Implementation plan (this file)
├── research.md              # Phase 0 research & architectural decisions
├── data-model.md            # Phase 1 data models & state machines
├── quickstart.md            # Phase 1 validation guide
├── contracts/               # Phase 1 interface & API contracts
│   ├── quota-group-api.contract.md
│   ├── scheduler-pipeline.contract.md
│   └── quota-ui-components.contract.md
└── checklists/
    └── requirements.md      # Requirements quality checklist
```

### Source Code Impact Areas

```text
shared/
└── models.ts                # Shared types for QuotaGroup, QuotaDataClassification, ModelLimits

server/
└── services/
    ├── quotaService.ts      # QuotaGroup registry, sliding windows, scoring, health management
    ├── geminiService.ts     # Hierarchical scheduler dispatch flow, error rotation
    ├── modelRegistry.ts     # Model limits & verification metadata
    └── __tests__/
        ├── keyScheduler.test.ts
        └── quotaGroup.test.ts  # [NEW] Multi-project, shared quota, and isolation test suite

src/
├── components/
│   ├── QuotaPanel.tsx       # QuotaGroup visual gauges and nested key health display
│   └── ApiSettings.tsx      # QuotaGroup configuration UI
└── utils/
    ├── apiClient.ts         # Quota group API client endpoints
    └── modelRegistry.ts     # Frontend model registry and pacing formatters
```

## Implementation Phases

### Phase 0: Research & Architectural Definition (Completed)
- Completed `research.md` analyzing Google Cloud Project rate limiting vs. key credential pooling.
- Established 4-tier data classification and 5-stage hierarchical dispatch lifecycle.

### Phase 1: Data Model, Contracts & Verification Guide (Completed)
- Defined `data-model.md` with `QuotaGroup`, `ApiKeyEntity`, `QuotaDataClassification`, and state machine transitions.
- Defined REST API contracts and Scheduler pipeline contracts in `contracts/`.
- Created executable verification scenarios in `quickstart.md`.

### Phase 2: Tasks Generation (`/speckit-tasks`)
- Generate ordered, dependency-tracked tasks in `tasks.md` covering model refactoring, quota service upgrade, gemini service scheduling, test suites, and UI updates.

# Implementation Plan: State Ownership & Storage Cleanup

**Branch**: `026-state-ownership-cleanup` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/026-state-ownership-cleanup/spec.md`

---

## Summary

This plan audits and formalizes the state ownership boundaries across all 5 storage tiers in the application:
1. **Client IndexedDB**: Sole authoritative source of truth for projects, chapters, split paragraphs, and custom glossaries.
2. **Server Session Store**: Sole authoritative source of truth for runtime API keys and active session tokens.
3. **Server Quota Service**: Sole authoritative source of truth for RPM/TPM/RPD rate-limiting counters, sliding windows, circuit breakers, and key health states.
4. **Client LocalStorage**: Strictly confined to user UI preferences (`gemini_selected_model`, custom limits, UI flags) and short-lived client caches with TTL.
5. **Server In-Memory / Redis Caches**: Dedicated 2-hour chunk translation deduplication, 15-minute model verification cache, and 10-minute idempotency locks.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+, React 19  
**Primary Dependencies**: Express, ioredis, @google/genai, lucide-react, motion, clsx, tailwind-merge  
**Storage Tiers**:
- Client: Browser IndexedDB (`src/services/db.ts`), Browser LocalStorage, Browser SessionStorage, React State
- Server: Ephemeral SessionStore (`server/services/sessionStore.ts`), QuotaService (`server/services/quotaService.ts`), Redis Manager (`server/services/redisService.ts`), TranslationChunkCache (`server/services/translationChunkCache.ts`)  
**Testing**: Vitest (`npm test`), TypeScript typecheck (`npm run lint`), Vite build + esbuild (`npm run build`)  
**Target Platform**: Modern desktop/mobile web browsers (Chromium, Firefox, Safari, Edge) + Node.js backend  
**Performance Goals**:
- IndexedDB chapter save latency < 150ms
- LocalStorage read/write operations synchronous < 2ms
- Zero memory leaks in server LRU caches  
**Constraints**:
- Zero plain API keys stored permanently in `localStorage`
- Zero novel manuscript chapter texts stored in `localStorage`
- Zero dual-write ambiguity across storage tiers  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Strict Quality Gates**: `npm run lint`, `npm test`, `npm run build` must be clean before completion.
- [x] **Deny-List Compliance**: No translation prompt changes; no unauthorized schema breaks; no unnecessary dependencies.
- [x] **Zero Plain Key Invariant**: API keys are masked or hashed across logs, and stored exclusively in ephemeral server sessions or user-explicit `sessionStorage`.
- [x] **Graceful Degradation**: Offline / in-memory fallback maintained when Redis or external connections are unavailable.

---

## Project Structure

### Documentation (this feature)

```text
specs/026-state-ownership-cleanup/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan
├── research.md          # Phase 0: Storage audit and ownership research
├── data-model.md        # Phase 1: Storage tiers, schemas, and invariants
├── quickstart.md        # Phase 1: Validation scenarios and test suite
├── contracts/           # Phase 1: State ownership contract
│   └── state-ownership-matrix.contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Impact Areas

```text
src/
├── services/
│   ├── db.ts                    # Authoritative IndexedDB client database
│   └── dbMigration.ts           # Sequential IndexedDB schema migrations
├── utils/
│   ├── apiClient.ts             # Session token & auth header storage helpers
│   ├── modelRegistry.ts         # Cached discovered models with TTL
│   └── credentialStorage.ts     # Safe credential migration (localStorage -> sessionStorage)
├── hooks/
│   ├── useAIConfig.ts           # UI preferences & session key synchronization
│   ├── useProjectStorage.ts     # In-memory project cache & IndexedDB sync
│   └── useModelObservability.ts # Model selection & server quota read projections
└── components/
    ├── ApiSettings.tsx          # Key entry & session token mode
    └── QuotaPanel.tsx           # Read-only server quota & key health projections

server/
├── services/
│   ├── sessionStore.ts          # Authoritative session store (Redis / memory)
│   ├── quotaService.ts          # Authoritative quota & key health state machine
│   ├── translationChunkCache.ts # 2h LRU translation chunk deduplication
│   └── modelInfoService.ts      # 15m server model verification cache
└── middleware/
    ├── authMiddleware.ts        # Server access token validation
    ├── idempotencyMiddleware.ts # 10m request deduplication
    └── tracingMiddleware.ts     # Request ID propagation
```

---

## Phases & Deliverables

### Phase 0: Research & Audit (Completed)
- Audited all 5 storage tiers (`localStorage`, `IndexedDB`, React State, Server Sessions, Redis).
- Resolved authoritative ownership for projects, keys, quota, model registry, and UI preferences.
- Documented findings in `research.md`.

### Phase 1: Design, Contracts & Validation (Completed)
- Formulated `data-model.md` defining storage entities, schemas, and deny-lists.
- Created `contracts/state-ownership-matrix.contract.md` defining storage invariants.
- Generated `quickstart.md` with concrete validation scenarios.

### Phase 2: Tasks Generation (Next: `/speckit-tasks`)
- Generate dependency-ordered actionable task list for implementing storage consistency audits, automated invariant verification tests, and documentation synchronization.

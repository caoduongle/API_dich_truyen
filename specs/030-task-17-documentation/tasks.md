# Tasks: Documentation & Architecture Map

**Feature**: Comprehensive Documentation & Architecture Map  
**Directory**: `specs/030-task-17-documentation/`  
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

---

## Phase 1: Setup & Subsystem Docs Creation

**Purpose**: Create dedicated technical reference documents in `docs/`

- [X] T001 Create `docs/architecture.md` with system flow diagram, storage tier matrix, and failover design
- [X] T002 Create `docs/model-system.md` detailing SWR discovery cache, custom models, and shutdown migration
- [X] T003 Create `docs/quota-and-scheduling.md` detailing PST midnight reset, sliding RPM/TPM, pacing, and key health
- [X] T004 Create `docs/api.md` detailing all HTTP endpoints, standard headers, and error contracts

---

## Phase 2: Main README.md Overhaul

**Purpose**: Modernize `README.md` to reflect actual production code and architecture

- [X] T005 Rewrite `README.md` with modern structure, embedded Mermaid architecture diagrams, clear separation of HTTP Rate Limiter vs Gemini Quota Scheduler, API overview, setup guide, and quality gate commands

---

## Phase 3: Verification & Quality Gate Check

**Purpose**: Ensure repository documentation integrity and passing quality gates

- [X] T006 Run `npm run lint` (`tsc --noEmit`) to verify 0 type errors
- [X] T007 Run `npm test` to verify all 431 tests pass
- [X] T008 Run `npm run build` to verify production bundle builds cleanly

# Implementation Plan: Direct Client Translation for Personal API Keys

**Branch**: `049-direct-client-translation` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/049-direct-client-translation/spec.md`

## Summary

Decouple translation execution when users provide personal Gemini API keys by running direct browser-to-Gemini HTTP requests, completely bypassing server concurrency bottlenecks (`MAX_CONCURRENT_REQUESTS = 50`), shared queues, and caches. Platform-agnostic translation logic (prompts, schemas, chunking, parsing) is extracted to `@shared/` for 100% parity across client-direct and server-fallback runtimes.

## Technical Context

**Language/Version**: TypeScript ~5.8.2 / Node.js 22+ / React 19

**Primary Dependencies**: React 19, Vite 6, Express 4, ioredis 5, opencc-js 1.3

**Storage**: Client IndexedDB (`src/services/db.ts`) for local chapters/projects, ephemeral `sessionStorage` for personal keys; Server Redis for fallback rate limiting/cache

**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`)

**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari) + Node.js Express server

**Project Type**: Full-stack web application (React frontend + Express backend in single repository)

**Performance Goals**: Support hundreds of concurrent translations for personal key users with 0 server queue delays and 0 server CPU overhead

**Constraints**: Zero cross-tenant data sharing/caching for personal keys; strict 100% backward compatibility for server-fallback translation

**Scale/Scope**: Direct client calls to Google Gemini REST endpoints; shared prompt & text utilities in `shared/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Gate I (Strict Quality Gates & Verification)**: All tests (`npm test`), types (`npm run lint`), and builds (`npm run build`) must pass cleanly. (PASS)
- **Gate II (Dependency Minimization & Reuse)**: Zero new npm packages added; uses native browser `fetch` and existing `@shared` utilities. (PASS)
- **Gate III (Strict Concern Separation & Domain Boundary Preservation)**: Core translation logic unified in `shared/`; UI presentation unchanged; client translation orchestrator updated. (PASS)
- **Gate IV (Immutable Core Schemas & Storage Stability)**: Zero changes to `src/types.ts` core entity schemas or IndexedDB schema. (PASS)
- **Gate V (Atomic Commits & Documentation Synchronization)**: Documentation and contracts kept in 1:1 synchronization. (PASS)

## Project Structure

### Documentation (this feature)

```text
specs/049-direct-client-translation/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical research & architectural decisions
├── data-model.md        # Data models, interfaces, and state diagrams
├── quickstart.md        # End-to-end verification and testing guide
├── contracts/           # API and module interface contracts
│   ├── direct-client-api.contract.md
│   └── shared-translation-pipeline.contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code Layout

```text
shared/
├── constants.ts                    # Shared constants
├── models.ts                       # Shared model catalog & capabilities
├── sinoNormalize.ts                # Chinese character normalization & entity snapback
├── text.ts                         # [NEW/EXTRACT] Text chunking, token estimation, parsing, formatting
└── prompts.ts                      # [NEW/EXTRACT] Raw, Polish, and QA prompt generators & schemas

src/
├── services/
│   ├── directGeminiClient.ts       # [NEW] Direct browser-to-Gemini HTTP transport & key rotation
│   ├── directTranslationEngine.ts  # [NEW] Client-side 2-phase translation orchestrator
│   ├── chapterTranslationService.ts# [MODIFY] Route to direct engine if personal keys exist, else server fallback
│   └── db.ts                       # IndexedDB persistence (unchanged)
└── hooks/
    └── useAIConfig.ts              # Key session management (unchanged)

server/
├── controllers/
│   └── translation/
│       ├── rawController.ts        # [MODIFY] Consume @shared/text and @shared/prompts
│       ├── polishController.ts     # [MODIFY] Consume @shared/text and @shared/prompts
│       └── qaController.ts         # [MODIFY] Consume @shared/text and @shared/prompts
└── utils/
    └── text.ts                     # [MODIFY] Re-export or forward to @shared/text
```

**Structure Decision**: Single shared codebase layout. Extract platform-agnostic text and prompt utilities into `shared/` so both client and server import from `@shared/*`. Direct client AI service resides in `src/services/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*(No constitution violations. Design fully adheres to all principles.)*

# Implementation Plan: Error Taxonomy & Smart Retry Engine

**Branch**: `019-error-taxonomy-smart-retry` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-error-taxonomy-smart-retry/spec.md`

## Summary

Centralize error normalization across the entire backend into a structured normalize-first pipeline based on provider response structures (HTTP status, error reasons, finishReasons, gRPC codes) rather than brittle scattered string matching (`message.includes(...)`). Map all 12 taxonomy categories to explicit smart retry policies (`retry`, `rotate_key`, `cooldown_key`, `disable_key`, `fail_immediately`) for optimal resilience and clean error serialization.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: Express.js, `@google/genai`  
**Target Platform**: Node.js Server Runtime  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: Error normalization in <0.02ms with zero allocations  
**Constraints**: Do NOT modify translation prompt logic or IndexedDB schemas; eliminate all scattered `message.includes(...)` checks for errors in favor of centralized helpers.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing TypeScript enums and standard error structures. No new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Error normalization and retry policies decoupled from prompt generation and controller logic. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Architecture documented across `specs/019-error-taxonomy-smart-retry/` and test suites. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/019-error-taxonomy-smart-retry/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── error-classifier.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── constants/
│   └── errors.ts                      # Complete 12-category AIErrorCode enum
├── utils/
│   └── errorClassifier.ts             # Enhanced structural normalization with all 12 categories
├── services/
│   ├── geminiService.ts               # Replace scattered string checks with normalizeUpstreamError
│   └── quotaService.ts                # Update error category handlers
├── controllers/
│   └── translation/                   # Standardize controller catch blocks
└── utils/__tests__/
    └── errorClassifier.test.ts        # Comprehensive unit tests for all 12 error categories
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

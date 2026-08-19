# Implementation Plan: Model Lifecycle Management & Shutdown Model Deactivation

**Branch**: `015-model-lifecycle-management` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-model-lifecycle-management/spec.md`

## Summary

Audit all preset and hardcoded model definitions across the codebase, classify retired Google Gemini models (`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash`, `gemini-1.5-pro`) as `shutdown` with designated active successors (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite`), exclude shutdown models from the selectable UI dropdown, and enforce automatic, crash-free startup migration for persisted shutdown or invalid models.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: React 19, Express.js  
**Storage**: `localStorage` (`gemini_selected_model`)  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Target Platform**: Modern Web Browsers + Node.js Server  
**Project Type**: Full-stack web application  
**Performance Goals**: Model migration evaluation in <1ms on startup; zero runtime overhead  
**Constraints**: Zero shutdown models in selectable dropdowns; automatic fallback without application crash  
**Scale/Scope**: 4 active presets, 4 cataloged shutdown models, support for discovered and custom models  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Verified via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing model registry and storage utilities. No new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Model metadata and lifecycle management separated from translation prompt logic. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` remain unmodified. Vietnamese labels preserved. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Models documented across `shared/models.ts`, `README.md`, and test suites in 1:1 sync. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/015-model-lifecycle-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── model-lifecycle.contract.md
│   └── model-migration.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
shared/
└── models.ts                          # Update AVAILABLE_MODELS statuses, add shutdown models with replacements
src/
├── utils/
│   ├── modelRegistry.ts               # Verify migrateModelSelection, getPresetModels filtering
│   └── __tests__/
│       └── modelRegistry.test.ts      # Unit tests for lifecycle statuses and migrations
├── components/
│   └── ApiSettings.tsx                # Filter shutdown models from preset dropdown options
└── hooks/
    └── useAIConfig.ts                 # Startup migration on persisted selected model
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

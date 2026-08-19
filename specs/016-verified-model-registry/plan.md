# Implementation Plan: Verified Model Registry & Translation Compatibility Gate

**Branch**: `016-verified-model-registry` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-verified-model-registry/spec.md`

## Summary

Transition the application's model selection and backend validation from simple syntax checking to an authoritative, cached **Verified Model Registry**. Ensure only models verified as translation-compatible (`generateContent: true`) can be registered and used in translation workflows without reverting to a static `ALLOWED_MODEL_IDS` whitelist. Provide verified metadata (`id`, `source`, `verified`, `lastVerifiedAt`, `status`, `capabilities`, `limits`), cached verification checks, and strict backend gatekeeping against unverified or arbitrary models.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: React 19, Express.js, `ioredis`  
**Storage**: `localStorage` (`gemini_custom_models`, `gemini_discovered_models`), Server In-Memory Cache (with SWR)  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Target Platform**: Modern Web Browsers + Node.js Server  
**Project Type**: Full-stack web application  
**Performance Goals**: Instant UI rendering from cached registry; <200ms verification lookup; zero duplicate API calls during UI rendering  
**Constraints**: Do NOT revert to `ALLOWED_MODEL_IDS`; reject unverified models at backend; enforce translation compatibility; preserve existing Vietnamese copy  
**Scale/Scope**: Presets, Discovered models from API keys, Custom user models  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Plan validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing Express routes, `modelInfoService`, `modelRegistry.ts`. No new dependencies. | **PASS** |
| **III. Strict Concern Separation** | Model verification logic encapsulated in dedicated services; translation prompt pipelines untouched. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unchanged; `shared/models.ts` extended backward-compatibly. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Contracts, specs, research, and data models fully articulated and synchronized. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/016-verified-model-registry/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── model-verification.contract.md
│   └── translation-gate.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
shared/
└── models.ts                          # Extend ModelDefinition with verified & lastVerifiedAt fields
server/
├── routes/
│   └── api.ts                         # Update validateModelMiddleware to enforce verification gate; add /verify-model endpoint
├── controllers/
│   └── quotaController.ts             # Add verifyModelHandler controller
├── services/
│   └── modelInfoService.ts            # Add verifySingleModel method with SWR and verification caching
src/
├── utils/
│   ├── modelRegistry.ts               # Update addCustomModel, saveDiscoveredModels, and registry retrieval with verified metadata
│   └── apiClient.ts                   # Add verifyModel API client method
├── components/
│   └── ApiSettings.tsx                # Verification UI for custom models & Verified status badges
└── hooks/
    └── useAIConfig.ts                 # Support verified model state in settings flow
```

## Complexity Tracking

> **No violations of constitutional rules identified.**

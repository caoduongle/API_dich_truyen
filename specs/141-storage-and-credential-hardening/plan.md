# Implementation Plan: Storage Security and Consistency Hardening

**Branch**: `141-storage-and-credential-hardening` | **Date**: 2026-09-17 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/141-storage-and-credential-hardening/spec.md`

## Summary

This plan addresses audit findings across storage serialization, credential persistence, sync atomicity, error handling, and documentation:
1. **P1 Project Deletion Queueing**: Enqueue `deleteProjectFromDB(id)` into `projectWriteChains.get(id)` to prevent race conditions that resurrect deleted projects, and clean up map entries upon settlement to prevent memory leaks.
2. **P1 Credential Persistence & Storage Audit**: Preserve the `rememberKeys` toggle (default: ON) in settings. Persist keys in `app_ui_prefs.savedKeys` when enabled; instantly purge `savedKeys` when disabled; update `storageAudit.ts` to recognize this policy and validate violations only when `rememberKeys === false`.
3. **P2 Atomic Legacy Drive Pull**: Download project and chapter files first, then save them atomically via `atomicSaveProjectBundle()` in `pullAllFromDrive()`.
4. **P2 Canonical CRDT Store**: Standardize on `crdt_states` as the canonical store across code and documentation, keeping `crdt_docs` strictly as an obsolete fallback.
5. **P2 Gemini 404 Rotation Filter**: Classify HTTP 404 as non-retryable `RESOURCE_NOT_FOUND` to fail fast without rotating remaining keys or skewing quota stats.
6. **P3 Bilingual Splitter Semantics**: Clarify `maxTokensPerChunk` as an accumulative target packing heuristic preserving paragraph boundaries.
7. **P3 Storage Audit Architecture Alignment**: Update `storageAudit.ts` comments and types to reflect the pure client-side SPA architecture.

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20+  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, `clsx`, `tailwind-merge`, `lucide-react`, `motion`, `@google/genai`  
**Storage**: Client-side IndexedDB (`novel_translator_db` with stores `projects`, `chapters`, `crdt_states`), `sessionStorage`, `localStorage`  
**Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Modern evergreen desktop/mobile web browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Pure Client-side SPA  
**Performance Goals**: <10ms queue serialization overhead; 0% project resurrection rate; fail-fast <1ms on HTTP 404; single IDBTransaction for drive pulls  
**Constraints**: Pure client-side (no backend server); strict adherence to Constitution v2.0.0; zero unauthorized schema changes; no plain API keys in localStorage when `rememberKeys === false`  
**Scale/Scope**: Local projects, up to thousands of chapters, ephemeral session quota tracking  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evaluation |
| :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | **PASS** | `npm run lint`, `npm test`, `npm run build` will be executed and must pass with 100% success. No tests will be removed or skipped. |
| **II. Dependency Minimization** | **PASS** | No new NPM dependencies added. All logic uses native Web APIs and existing utilities. |
| **III. Strict Concern Separation (MVC)** | **PASS** | Services (`db.ts`, `driveProjectSync.ts`, `geminiClient.ts`, `storageAudit.ts`) do not import from components or hooks. Hooks orchestrate state; presentation remains isolated. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | `src/types.ts` remains intact. Production IndexedDB schema stores (`projects`, `chapters`, `crdt_states`) are unchanged. Vietnamese UI strings are preserved. |
| **V. Atomic Commits & Documentation Sync** | **PASS** | Technical specifications (`spec.md`, `research.md`, `data-model.md`, `contracts`, `quickstart.md`) are maintained in strict 1:1 sync with the active codebase. |

## Project Structure

### Documentation (this feature)

```text
specs/141-storage-and-credential-hardening/
├── spec.md              # Feature specification
├── plan.md              # This file (Architectural blueprint)
├── research.md          # Phase 0 research & architectural decisions
├── data-model.md        # Phase 1 storage schema & state machines
├── quickstart.md        # Phase 1 validation guide
├── contracts/           # Phase 1 interface contracts
│   ├── storage-queue.contract.ts
│   ├── credential-policy.contract.ts
│   └── error-classification.contract.ts
├── checklists/
│   └── requirements.md  # Quality verification checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── api-settings/
│       └── KeyListSection.tsx       # Existing rememberKeys toggle
├── hooks/
│   ├── useAIConfig.ts               # rememberKeys persistence & initialization
│   └── useProjects.ts               # Delete and save synchronization
├── services/
│   ├── db.ts                        # projectWriteChains serialization & cleanup
│   ├── projectStorageQueue.ts       # Storage write queue helpers
│   ├── gemini/
│   │   ├── geminiErrorClassifier.ts # HTTP 404 RESOURCE_NOT_FOUND classification
│   │   ├── geminiClient.ts          # Fail-fast without rotation on 404
│   │   └── types.ts                 # Hardened error categories
│   ├── google-drive/
│   │   └── driveProjectSync.ts      # Atomic monolithic pull via atomicSaveProjectBundle
│   └── translation/
│       ├── bilingualSplit.ts        # Packing heuristic doc comments
│       └── types.ts                 # Target packing budget JSDoc
└── utils/
    └── storageAudit.ts              # Client-side architecture types & audit enforcement
```

## Proposed Changes by Component

### 1. Storage & Queue Serialization (`src/services/db.ts`)
- Wrap `deleteProjectFromDB(id: string)` in `projectWriteChains.get(id)`.
- In `saveProjectToDB`, `atomicSaveProjectBundle`, and `deleteProjectFromDB`:
  Attach a `.finally()` callback to remove the `projectId` entry from `projectWriteChains` if no subsequent write has been chained onto it.
- Ensure `deleteProjectFromDB` deletes metadata from `projects`, records from `chapters`, and CRDT state from `crdt_states` (with `crdt_docs` fallback).

### 2. Credential Storage & Audit Integrity (`src/hooks/useAIConfig.ts`, `src/utils/storageAudit.ts`)
- In `useAIConfig.ts`:
  - `rememberKeys` initialized to `prefs?.rememberKeys !== false` (default: true).
  - When `rememberKeys` is toggled to `false`: immediately update `app_ui_prefs` with `savedKeys: []`.
  - When reading on load: if `rememberKeys === false` and `savedKeys` exists, scrub them immediately.
- In `src/utils/storageAudit.ts`:
  - Update `STORAGE_TIER_REGISTRY` types to client-side entities (`IndexedDB`, `SessionStorage`, `LocalStorage`, `ReactMemory`).
  - In `verifyStorageIntegrity`: inspect `app_ui_prefs`. If `rememberKeys === false` and `savedKeys` contains non-empty elements, flag a security violation. If `rememberKeys !== false`, allow `savedKeys`.
  - In `sanitizeLocalStorage`: if `app_ui_prefs` has `rememberKeys === false` with leftover `savedKeys`, cleanse `savedKeys: []`.
  - Maintain root `localStorage.getItem('gemini_api_keys')` as strictly forbidden.

### 3. Google Drive Atomic Restore (`src/services/google-drive/driveProjectSync.ts`)
- In `pullAllFromDrive()`:
  - For monolithic format (`action === 'pull' && remote`):
    - Download `projectData` and `chaptersData` first.
    - Call `atomicSaveProjectBundle(projectData, chaptersData)` in a single transaction.
    - If any download fails, no partial write occurs.

### 4. Gemini API Error Handling (`src/services/gemini/`)
- In `geminiErrorClassifier.ts`:
  - Check `httpStatus === 404`: return category `RESOURCE_NOT_FOUND`, `isRetryable: false`.
- In `geminiClient.ts`:
  - If `response.status === 404` or `classified.category === 'RESOURCE_NOT_FOUND'`, throw `lastError` immediately without rotating keys.

### 5. Bilingual Token Splitter (`src/services/translation/`)
- In `bilingualSplit.ts` and `types.ts`:
  - Clarify documentation: `maxTokensPerChunk` is an accumulative packing heuristic designed to keep chunk sizes reasonable while strictly preserving paragraph boundaries.

## Verification Plan

### Automated Tests
```bash
# 1. Type checking (must be 100% error-free)
npm run lint

# 2. Vitest unit and integration suites (must pass 100%)
npm test

# Specifically targeted tests:
npx vitest run src/services/__tests__/projectWriteQueue.test.ts
npx vitest run src/utils/__tests__/credentialStorage.test.ts
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts
npx vitest run src/services/gemini/__tests__/geminiErrorClassifier.test.ts
npx vitest run src/services/google-drive/__tests__/
npx vitest run src/services/translation/__tests__/bilingualSplit.test.ts

# 3. Production build
npm run build
```

### Manual Verification
- In the browser UI, add multiple API keys, toggle "Ghi nhớ API Key trên trình duyệt này" off and on, verifying `localStorage.app_ui_prefs` updates instantly.
- Test deleting a project while edits are being saved, confirming it does not reappear.

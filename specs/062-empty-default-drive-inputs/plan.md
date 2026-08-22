# Implementation Plan: Empty Default Google Drive Inputs in Advanced Settings

**Branch**: `062-empty-default-drive-inputs` | **Date**: 2026-08-23 | **Spec**: [`specs/062-empty-default-drive-inputs/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/062-empty-default-drive-inputs/spec.md)

**Input**: Feature specification from `/specs/062-empty-default-drive-inputs/spec.md`

## Summary

Prevent the default build-time Google OAuth Client ID and Google Picker API Key strings from populating into the Advanced Settings input fields in `GoogleSyncModal.tsx`. Add `getCustomClientId()` to `googleAuthService` and `getCustomPickerApiKey()` to `googlePickerService` (both reading solely from `localStorage` without `.env` fallback). Initialize modal input states with these methods, update reset handlers to clear inputs to `""`, and provide clear placeholders instructing users that blank inputs default to system credentials.

---

## Technical Context

**Language/Version**: TypeScript 5.8.2 / React 19.0.1  
**Primary Dependencies**: React 19, Lucide React, Tailwind CSS v4, `clsx`, `tailwind-merge`  
**Storage**: `localStorage` (`ai_dich_truyen_google_client_id`, `ai_dich_truyen_google_picker_key`)  
**Testing**: Vitest 4.1.9 (`npm test`), TypeScript `tsc --noEmit` (`npm run lint`), `npm run build`  
**Target Platform**: Web Single Page Application  
**Project Type**: React Frontend Service  
**Performance Goals**: Instant UI state transitions (< 16ms)  
**Constraints**:
- DO NOT alter backend routes or Gemini pipeline.
- Preserve existing `getClientId()` and `getPickerApiKey()` methods and their runtime fallback to `.env`.
- Adhere strictly to `.agents/rules/design-system.md`.  
**Scale/Scope**: 3 files modified (`src/services/googleAuthService.ts`, `src/services/googlePickerService.ts`, `src/components/google-sync/GoogleSyncModal.tsx`) + 1 test file (`src/components/google-sync/__tests__/GoogleSyncModal.test.ts`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: `tsc --noEmit`, `vitest run`, and `vite build` will pass cleanly.
- [x] **II. Dependency Minimization & Existing Library Reuse**: No new dependencies.
- [x] **III. Strict Concern Separation & Domain Boundary Preservation**: Purely client-side service and modal UI update.
- [x] **IV. Immutable Core Schemas & Storage Stability**: Core schemas and storage keys preserved.
- [x] **V. Atomic Commits & Documentation Synchronization**: Single, modular bugfix diff.

---

## Project Structure

### Documentation (this feature)

```text
specs/062-empty-default-drive-inputs/
├── plan.md              # Implementation plan (this document)
├── research.md          # Phase 0: UX decisions & separation of concerns
├── data-model.md        # Phase 1: Dual resolution model & state flow
├── quickstart.md        # Phase 1: Verification scenarios
├── contracts/           # Phase 1: Interface contracts
│   └── google-sync-service.contract.md
├── checklists/
│   └── requirements.md  # Quality checklist
└── spec.md              # Feature specification
```

### Source Code Layout

```text
src/
├── services/
│   ├── googleAuthService.ts                     # [MODIFY] Add getCustomClientId()
│   └── googlePickerService.ts                   # [MODIFY] Add getCustomPickerApiKey()
└── components/
    └── google-sync/
        ├── GoogleSyncModal.tsx                  # [MODIFY] Initialize inputs with custom methods, reset to '', update placeholders
        └── __tests__/
            └── GoogleSyncModal.test.ts          # [MODIFY] Add test cases for custom getters & empty defaults
```

---

## Proposed Changes

### 1. Service Layer (`googleAuthService.ts` & `googlePickerService.ts`)
- Add `getCustomClientId(): string` in `googleAuthService.ts`: reads only `localStorage.getItem(CUSTOM_CLIENT_ID_KEY)`.
- Add `getCustomPickerApiKey(): string` in `googlePickerService.ts`: reads only `localStorage.getItem(CUSTOM_PICKER_KEY)`.

### 2. Component Layer (`GoogleSyncModal.tsx`)
- Change state initialization to use `getCustomClientId()` and `getCustomPickerApiKey()`.
- Update `handleResetClientId` and `handleResetPickerKey` to set inputs to `''`.
- Update input placeholders to `"Để trống để dùng Client ID mặc định của hệ thống..."` and `"Để trống để dùng Picker API Key mặc định của hệ thống..."`.

### 3. Unit Tests (`GoogleSyncModal.test.ts`)
- Verify `getCustomClientId()` and `getCustomPickerApiKey()` return `''` when no custom key exists in `localStorage`.
- Verify input default states are `''`.
- Verify reset handlers clear custom keys and restore `''` input value.

---

## Verification Plan

### Automated Tests
```bash
npm run lint    # tsc --noEmit: Must pass with 0 errors
npm test        # vitest run: All tests must pass
npm run build   # vite build + esbuild: Must build successfully
```

### Targeted Tests
```bash
npx vitest run src/components/google-sync/__tests__/GoogleSyncModal.test.ts
```

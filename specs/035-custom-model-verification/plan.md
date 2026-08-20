# Implementation Plan: Mandatory Custom Model Verification & State Governance

**Branch**: `035-custom-model-verification` | **Date**: 2026-08-20 | **Spec**: [specs/035-custom-model-verification/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/035-custom-model-verification/spec.md)

---

## Summary

Khắc phục triệt để lỗi không nhất quán trong quản lý Custom Model: custom model chưa qua xác minh hoặc không có metadata xác minh nhưng lại bị mặc định gán `verified: true` và `status: 'active'`. Xây dựng máy trạng thái 5 mức (`unverified`, `verified`, `invalid`, `deprecated`, `shutdown`), chuẩn hóa luồng kiểm tra cú pháp $\to$ xác minh provider $\to$ trích xuất capabilities (`generateContent`) $\to$ lưu registry, và tối ưu hóa không bao giờ gửi request xác minh lặp lại trong chu kỳ render của React.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+, React 19  
**Primary Dependencies**: React 19, Express, Vitest, `@google/genai`  
**Storage**: Client `localStorage` (`CUSTOM_MODELS_STORAGE_KEY`) + Server SWR in-memory cache (`verifiedModelsCache`)  
**Testing**: Vitest (`vitest run`), React Testing Library  
**Target Platform**: Web Browser (Client) + Node.js (Backend)  
**Project Type**: Full-stack web application (React frontend + Express backend)  
**Performance Goals**: Instant synchronous UI reads (< 2ms) from client cache, 0 extra network calls on React component re-render  
**Constraints**: Zero new dependencies, no schema breaking changes, strict 15s timeout on Google API checks  
**Scale/Scope**: Custom model management across UI settings, model registry, and translation admission  

---

## Constitution Check

| Principle | Assessment | Status |
| :--- | :--- | :--- |
| **I. Quality Gates** | Mandatory `tsc --noEmit`, `vitest run`, `vite build` must pass cleanly with 0 skipped tests. | **COMPLIANT** |
| **II. Dependency Minimization** | Uses existing fetch / SWR caching patterns. No new packages added. | **COMPLIANT** |
| **III. Concern Separation** | Preserves clear boundaries between frontend model registry and backend provider probing. | **COMPLIANT** |
| **IV. Immutable Schemas** | Backward-compatible extensions to `ModelDefinition` in `shared/models.ts`. | **COMPLIANT** |
| **V. Atomic Commits** | Modular changes with targeted unit and integration test suites. | **COMPLIANT** |

---

## Project Structure

### Documentation (this feature)

```text
specs/035-custom-model-verification/
├── spec.md                  # Feature Specification
├── plan.md                  # Implementation Plan
├── research.md              # Phase 0 Research Findings
├── data-model.md            # Phase 1 Data Model & State Machine
├── quickstart.md            # Phase 1 Validation Guide
├── contracts/
│   └── verify-model.contract.md # API Contract for /api/verify-model
├── checklists/
│   └── requirements.md      # Requirements Checklist
└── tasks.md                 # Phase 2 Tasks (via /speckit-tasks)
```

### Source Code Layout

```text
shared/
└── models.ts                # [MODIFY] ModelVerificationState & ModelDefinition extensions

src/
├── utils/
│   ├── modelRegistry.ts     # [MODIFY] Strict verified=false default, 5-state lifecycle
│   └── __tests__/
│       └── modelRegistry.test.ts # [MODIFY] Tests for unverified custom models and lifecycle
├── components/
│   ├── ApiSettings.tsx      # [MODIFY] Visual verification states, zero re-render calls, re-verify button
│   └── __tests__/
│       └── ApiSettingsModelFlow.test.ts # [MODIFY] Component flow tests

server/
├── services/
│   ├── modelInfoService.ts  # [MODIFY] Capability enforcement (generateContent), timeout handling
│   └── __tests__/
│       └── modelInfoService.test.ts # [MODIFY] Backend verification tests
└── controllers/
    └── quotaController.ts   # [MODIFY] Status code and error mapping for /api/verify-model
```

---

## Implementation Strategy

### Phase 1: Shared Models & Registry Governance
1. Update `shared/models.ts` with `ModelVerificationState` and update `ModelDefinition`.
2. Update `src/utils/modelRegistry.ts`:
   - `getCustomModels()`: Stop defaulting `verified` to `true`.
   - `addCustomModel()`: Enforce `verified: false` and `verificationState: 'unverified'` unless valid `verifiedDef` with `verified: true` is passed.
   - `getRegisteredModels()`: Respect explicit verification states.
   - `getVerifiedModels()`: Filter for `verified === true && status !== 'shutdown'`.

### Phase 2: Backend Provider Probing & Capability Validation
1. Update `server/services/modelInfoService.ts`:
   - `verifySingleModel()`: Require `generateContent` in `supportedGenerationMethods`.
   - Enforce 15-second timeout with specific error code `TIMEOUT`.
   - Map 404 / permission errors to `MODEL_NOT_FOUND`.
2. Update `server/controllers/quotaController.ts`:
   - Return structured error codes (`UNSUPPORTED_METHODS`, `MODEL_NOT_FOUND`, `TIMEOUT`).

### Phase 3: Frontend UI Experience & Zero-Render Call Optimization
1. Update `src/components/ApiSettings.tsx`:
   - Ensure loading state during verification ("Đang kiểm tra mô hình...").
   - Display verified badge / error feedback accurately.
   - Prevent any network calls on render; read from `getCustomModels()` synchronously.
   - Add "Xác minh lại" action for unverified/stale models.

### Phase 4: Comprehensive Test Suite & Quality Gates
1. Unit tests in `src/utils/__tests__/modelRegistry.test.ts`.
2. Backend tests in `server/services/__tests__/modelInfoService.test.ts`.
3. Flow tests in `src/components/__tests__/ApiSettingsModelFlow.test.ts`.
4. Full quality gates (`npm run lint`, `npm test`, `npm run build`).

# Technical Research: Custom Model Verification & State Governance

**Feature**: `specs/035-custom-model-verification/spec.md`  
**Created**: 2026-08-20  

---

## 1. Context & Research Goals

Prior implementation had an inconsistency in `src/utils/modelRegistry.ts`:
```typescript
// Line 263:
verified: m.verified !== undefined ? Boolean(m.verified) : true,
// Line 500:
verified: verifiedDef?.verified !== undefined ? verifiedDef.verified : true,
```
When a custom model was stored or added without explicit verification metadata, it defaulted to `verified: true` and `status: 'active'`. This allowed users or tests to register nonexistent or unsupported models (e.g. `text-embedding-004` or `fake-model`) as active and verified.

The research objectives are:
1. Standardize the state machine across `@shared/models`, `src/utils/modelRegistry.ts`, and `server/services/modelInfoService.ts`.
2. Ensure strict pre-activation provider verification without breaking existing valid presets.
3. Prevent duplicate/unnecessary API requests during React rendering cycles.
4. Establish robust error classification for Google AI Studio model inspection (e.g., model not found vs. unsupported generation methods vs. timeout).

---

## 2. Technical Decisions & Findings

### Decision 1: Explicit 5-State Verification & Lifecycle Model

- **Decision**: Define `ModelVerificationState`:
  ```typescript
  export type ModelVerificationState = 'unverified' | 'verifying' | 'verified' | 'invalid' | 'deprecated' | 'shutdown';
  ```
  And in `ModelDefinition`:
  ```typescript
  export interface ModelDefinition {
    id: string;
    label: string;
    source: ModelSource; // 'preset' | 'discovered' | 'custom'
    status: ModelStatus; // 'active' | 'deprecated' | 'shutdown'
    verified: boolean; // MUST be explicitly true, default false
    verificationState?: ModelVerificationState;
    verificationError?: string;
    lastVerifiedAt?: string;
    capabilities: ModelCapabilities; // generateContent, vision, thinking
    limits?: ModelLimits;
    // ...
  }
  ```
- **Rationale**: Keeps backward compatibility with `status` and `verified: boolean` while providing unambiguous lifecycle governance.
- **Alternatives Considered**: Modifying `ModelStatus` union to include `unverified` and `invalid`. Kept `verified: boolean` and `verificationState` distinct to preserve existing telemetry and status indicators.

---

### Decision 2: Strict Pre-Activation Flow for Custom Models

- **Decision**:
  1. **Syntax Check**: Ensure ID matches `MODEL_ID_REGEX` and does not collide with built-in presets.
  2. **Provider Probe**: Call `POST /api/verify-model` with client API key. Server calls Google `GET /v1beta/models/{id}`.
  3. **Capability Validation**: Require `supportedGenerationMethods` to include `'generateContent'`. If missing, reject as `UNSUPPORTED_METHODS`.
  4. **Registry Storage**: Only persist to `gemini_custom_models` in `localStorage` upon successful verification with `verified: true` and extracted capabilities. If verification fails, do NOT activate the model for translation.
- **Rationale**: Guarantees that only valid, capable models reach the translation scheduler.
- **Alternatives Considered**: Storing unverified models in a disabled state in `localStorage`. Adding unverified models with a prominent "Xác minh ngay" button is supported, but they remain strictly unselectable for translation until verified.

---

### Decision 3: Zero-Render Leakage via Registry & SWR Caching

- **Decision**:
  - `ApiSettings.tsx` and other components MUST ONLY read models synchronously from `getRegisteredModels()` / `getCustomModels()`.
  - Verification is ONLY triggered on:
    1. Form submission (Add Custom Model).
    2. User explicitly clicking "Xác minh lại" (Re-verify).
  - Server maintains `verifiedModelsCache` (15-minute TTL) to deduplicate multi-key or repeated verification checks.
- **Rationale**: Eliminates network spam and prevents race conditions during React component re-renders.

---

### Decision 4: Provider Timeout & Outage Handling

- **Decision**:
  - `fetchSingleModelFromGoogle` in `modelInfoService.ts` enforces a 15-second `AbortController` timeout.
  - Timeout errors return `errorCode: 'TIMEOUT'` with clear Vietnamese guidance: `"Quá thời gian phản hồi từ Google AI Studio (15 giây). Vui lòng thử lại sau."`
  - 404 responses return `errorCode: 'MODEL_NOT_FOUND'`: `"Mô hình không tồn tại hoặc API Key không có quyền truy cập."`
  - Missing `generateContent` returns `errorCode: 'UNSUPPORTED_METHODS'`: `"Mô hình không hỗ trợ tạo nội dung (generateContent). Không thể dùng để dịch thuật."`

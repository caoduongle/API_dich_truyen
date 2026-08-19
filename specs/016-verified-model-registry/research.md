# Research: Verified Model Registry & Translation Compatibility Gate

**Branch**: `016-verified-model-registry` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

## Summary of Decisions

This document details the architectural decisions for transitioning the model management system from pure syntax validation to an authoritative, cached **Verified Model Registry** without reverting to a restrictive static whitelist (`ALLOWED_MODEL_IDS`).

---

## Decision 1: Authoritative Model Verification Architecture

### Context
A model ID can have valid syntax (e.g. `gemini-nonexistent-v99` or `text-embedding-004`), yet not exist on Google AI Studio or fail to support the `generateContent` method required by our 2-phase translation pipeline.

### Evaluated Alternatives
1. **Client-Side Verification**: Frontend fetches `https://generativelanguage.googleapis.com/...` directly with client keys.
   - *Rejected*: Inconsistent with backend-controlled sessions, bypasses backend verification authority, and allows a malicious frontend to falsely claim a model is verified (violating FR-011).
2. **Static Whitelist (`ALLOWED_MODEL_IDS`)**: Hardcode all permissible model IDs in backend code.
   - *Rejected*: Explicitly prohibited by requirements; breaks newly released Gemini models, custom fine-tuned endpoints, and dynamic model discovery.
3. **Backend-Authoritative Verification (`POST /api/models/verify` & Verified Cache)**:
   - *Selected*: Backend verifies model existence, inspects `supportedGenerationMethods` for `generateContent`, caches the verified record, and returns a normalized `VerifiedModelDef`.

### Rationale
- Authoritative backend verification prevents frontend forging of trusted model states.
- Reuses existing `modelInfoService` cache and SWR (Stale-While-Revalidate) mechanisms.
- Supports both session-based keys and direct API keys.

---

## Decision 2: Backend Translation Compatibility Gate

### Context
When a user submits a translation job (`/translate-raw`, `/polish-translation`, `/qa-critique`), the backend must ensure the requested model is valid and verified without relying on a static whitelist.

### Design Pattern
The backend translation gate (`validateModelMiddleware` / `ensureModelVerified`):
1. **Syntax Check**: Validates `isValidModelIdFormat(model)` (rejects control characters, traversal, malformed strings).
2. **Preset Fast-Path**: Known preset models in `AVAILABLE_MODELS` are trusted by definition.
3. **Verified Cache Check**: Checks backend in-memory verified cache for previously verified custom/discovered models.
4. **On-Demand Fast Verification**: If the model is not in cache, attempts an on-demand verification against Google Generative Language API using the request's active API keys.
5. **Rejection**: If the model cannot be verified or lacks `generateContent`, rejects with HTTP 400/422 and a structured, localized error message:
   `Mô hình AI "{model}" chưa được xác minh hoặc không hỗ trợ quy trình dịch thuật. Vui lòng xác minh mô hình trong Cấu hình AI.`

---

## Decision 3: Zero-Overhead UI Rendering & Dual-Tier Caching

### Context
Rendering the AI Configuration modal or model selector must not trigger outbound Gemini API calls on every render.

### Caching Strategy
- **Tier 1 (Client Storage)**: `localStorage` (`gemini_custom_models`, `gemini_discovered_models`) persists verified models with `verified: true` and `lastVerifiedAt` timestamps. UI renders instantly from synchronous client storage.
- **Tier 2 (Server Cache)**: `modelInfoService` maintains an in-memory TTL cache (10–60 minutes) keyed by API key hash and verified model ID to ensure instant validation of repeat translation requests without network latency.
- **Trigger Points for Network Calls**:
  1. User adds a custom model or clicks "Xác minh lại".
  2. User runs API key model discovery ("Quét mô hình").
  3. First translation request for an uncached custom model.

---

## Decision 4: Registry Metadata Standard

### Schema Alignment
Unified across `shared/models.ts`, `server/`, and `src/utils/modelRegistry.ts`:
```typescript
export interface ModelDefinition {
  id: string;
  label: string;
  source: 'preset' | 'discovered' | 'custom';
  status: 'active' | 'deprecated' | 'shutdown';
  verified: boolean;
  lastVerifiedAt?: string;
  capabilities: {
    generateContent: boolean;
    structuredOutput?: boolean;
    vision?: boolean;
    thinking?: boolean;
  };
  limits?: {
    defaultRpm: number;
    defaultTpm: number;
    defaultRpd?: number;
  };
  replacementId?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  addedAt?: string;
  deprecatedAt?: string;
  shutdownAt?: string;
}
```

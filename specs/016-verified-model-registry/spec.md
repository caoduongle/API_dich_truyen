# Feature Specification: Verified Model Registry & Translation Compatibility Gate

**Feature Branch**: `016-verified-model-registry`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "TASK 03 — VERIFIED MODEL REGISTRY. Hiện backend đã bỏ whitelist model và dùng syntax validation. Giữ nguyên cải tiến này nhưng nâng lên thành verified model registry. Không quay lại ALLOWED_MODEL_IDS. Problem: model ID hợp lệ về syntax ≠ model thực sự tồn tại ≠ model hỗ trợ workflow translation. Desired flow: Preset → registry, Discovered → verify → registry, Custom → verify → registry. Chỉ model đã được xác minh mới được coi là translation-compatible. Registry metadata: { id, source, verified, lastVerifiedAt, status, capabilities, limits }. Verification: Dùng model discovery/API hiện có nếu phù hợp, không gọi Gemini thêm một lần cho mỗi render UI, phải có cache. Behavior: Custom model (Add → verify → success → add registry / failure → reject + reason), Discovered model (discover → verify/normalize → registry), Unknown model (translation request → backend rejects). Security: Frontend không được tự biến arbitrary model thành trusted model, backend vẫn phải validate."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Custom Model Verification & Controlled Registration (Priority: P1) 🎯 MVP

As a translator who wants to use a newly released Gemini model or a fine-tuned endpoint not present in presets, I want to submit a custom model ID and have the system verify its actual existence and `generateContent` capability against the AI provider API before registering it, so that I only use working models and immediately receive clear error feedback if the model ID is invalid or incompatible.

**Why this priority**: Without verification, entering a non-existent or unsupported model ID fails mid-translation, causing batch translation failures, lost progress, and wasted user time.

**Independent Test**: Can be tested by adding a valid custom model (e.g. `gemini-2.5-flash`) which successfully verifies and registers with `verified: true`, and attempting to add an invalid or unsupported model ID (e.g. `gemini-nonexistent-99` or `text-embedding-004`) which is rejected with an explanatory failure reason.

**Acceptance Scenarios**:

1. **Given** a user inputs a valid model ID that exists and supports `generateContent`, **When** the user clicks "Thêm mô hình", **Then** the backend verifies the model against the AI provider, returns verified metadata (`verified: true`, `capabilities`, `limits`, `lastVerifiedAt`), and adds the model to the active registry.
2. **Given** a user inputs a model ID that does not exist (404) or does not support text generation (e.g. embedding-only model), **When** verification is performed, **Then** the system rejects the addition, does not register the model, and displays a precise, localized error message explaining why verification failed.

---

### User Story 2 - Translation Pipeline Security & Compatibility Gate (Priority: P1)

As a system operator, I want backend translation endpoints (`/translate-raw`, `/polish-translation`, `/qa-critique`, etc.) to strictly verify that requested model IDs are authenticated as verified and translation-compatible before dispatching translation workloads, without reverting to a restrictive static whitelist (`ALLOWED_MODEL_IDS`), so that arbitrary unverified model IDs are rejected early while valid dynamically registered models execute smoothly.

**Why this priority**: Preserves server stability, prevents backend abuse, and ensures that translation prompts are only sent to models confirmed capable of handling multi-turn or JSON structured translation tasks.

**Independent Test**: Can be tested by sending translation requests with a verified preset/custom model ID (succeeds) versus an unverified/arbitrary model ID (rejected with HTTP 400/422 and a structured error payload stating the model is unverified).

**Acceptance Scenarios**:

1. **Given** an incoming translation request with a verified model ID (preset, verified discovered, or verified custom), **When** the backend validation middleware executes, **Then** the request is permitted and routes to the translation pipeline.
2. **Given** an incoming translation request with an unknown, unverified, or arbitrary model ID, **When** the backend validation middleware executes, **Then** the request is rejected with HTTP 400/422 and a clear error indicating the model is not verified for translation workflows.

---

### User Story 3 - Discovered Models Ingestion & Verification Normalization (Priority: P2)

As a user inspecting my configured API keys, I want models discovered from my API keys to be automatically checked for `generateContent` compatibility, normalized, and registered as verified models with capability flags and token limits, so that all available models under my account can be selected for translation without manual verification steps.

**Why this priority**: Streamlines the user onboarding workflow by automatically making account-accessible models ready for immediate, safe translation use.

**Independent Test**: Can be tested by running model discovery on an API key, verifying that returned models populate the registry with `source: 'discovered'`, `verified: true`, and complete capability metadata.

**Acceptance Scenarios**:

1. **Given** an API key discovery response containing supported models, **When** the registry processes the discovered list, **Then** models with `generateContent` capability are ingested into the verified registry with `verified: true`, `status: 'active'`, and current `lastVerifiedAt` timestamps.
2. **Given** discovered models that only support embeddings or non-generative tasks, **When** ingestion runs, **Then** non-generative models are filtered out from the translation registry.

---

### User Story 4 - Cached Registry & Low-Overhead UI Rendering (Priority: P3)

As a user navigating the application interface, I want model registry metadata, verification status, and rate limits to be cached efficiently both in backend memory and client storage, so that UI rendering never triggers redundant Gemini API calls or delays dialog interactions.

**Why this priority**: Prevents excessive API quota consumption and UI stutter caused by repeated verification checks during re-renders or page switches.

**Independent Test**: Can be tested by rendering the AI Configuration modal multiple times and verifying through network logs that 0 additional Gemini verification requests are fired for already-verified registry items.

**Acceptance Scenarios**:

1. **Given** a previously verified model in the registry cache, **When** the user opens or interacts with AI Configuration or model selectors, **Then** the model information is rendered instantly from local/backend cache without triggering external provider API calls.
2. **Given** a cached model entry within its Time-To-Live (TTL) window, **When** a translation or quota check occurs, **Then** the system uses cached verification metadata without re-verifying upstream.

---

### Edge Cases

- **Custom Model Verification with No Configured API Key**: If a user attempts to verify a custom model before entering or syncing any API key, the system MUST prompt the user to provide an active API key first.
- **Provider API Rate Limit / Network Outage during Verification**: If the upstream verification request fails due to temporary network timeouts or provider 429, the system MUST return a retryable error message rather than permanently marking the model as invalid.
- **Model Decommissioned After Initial Verification**: If a previously verified model is later marked as `shutdown` or returns 404 upstream during translation, the backend MUST gracefully report the failure, trigger cache invalidation for that model, and advise fallback migration.
- **Preset Built-in Models**: Built-in preset models (e.g. `gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemma-4-31b-it`) are pre-verified by definition and MUST NOT require runtime network verification calls to be accepted.
- **Forged Frontend Verification State**: If a client sends a translation request claiming a model is verified without backend confirmation or cache record, the backend MUST independently validate the model before processing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define a unified `VerifiedModelDef` / `ModelDefinition` registry schema containing at least:
  - `id`: string (normalized model identifier)
  - `label`: string (user-facing display name)
  - `source`: `'preset' | 'discovered' | 'custom'`
  - `verified`: boolean (true if verified translation-compatible)
  - `lastVerifiedAt`: string (ISO 8601 timestamp of last successful verification)
  - `status`: `'active' | 'deprecated' | 'shutdown'`
  - `capabilities`: `{ generateContent: boolean; structuredOutput?: boolean; vision?: boolean; thinking?: boolean }`
  - `limits`: `{ defaultRpm: number; defaultTpm: number; defaultRpd?: number }`
  - `inputTokenLimit` & `outputTokenLimit`: optional numbers
- **FR-002**: The backend and frontend MUST NOT revert to a hardcoded `ALLOWED_MODEL_IDS` whitelist for translation authorization; model validation MUST be based on valid syntax AND verified status in the model registry / verification cache.
- **FR-003**: Built-in preset models (`AVAILABLE_MODELS`) MUST be initialized in the registry as pre-verified (`verified: true`, `source: 'preset'`).
- **FR-004**: When adding a custom model, the system MUST execute a verification check against the AI provider API using an active API key to confirm:
  1. The model exists on the provider platform.
  2. The model supports the `generateContent` method.
- **FR-005**: If custom model verification succeeds, the system MUST record the model in the verified registry with `verified: true`, populated capabilities, limits, and timestamp.
- **FR-006**: If custom model verification fails, the system MUST reject the model addition and return a specific, user-friendly Vietnamese error reason (e.g., model not found, unsupported generation methods, or quota failure).
- **FR-007**: When API key model discovery is performed, discovered models that support `generateContent` MUST be ingested into the verified registry with `source: 'discovered'`, `verified: true`, and normalized model metadata.
- **FR-008**: Translation middleware on the backend (`validateModelMiddleware` / translation route handler) MUST verify that any requested `model` parameter corresponds to a verified model (`verified === true`) in the server-side registry or active verification cache.
- **FR-009**: If an unverified, non-existent, or arbitrary model ID is provided in a translation request, the backend MUST reject the request with HTTP 400 or 422 and a structured error message indicating the model is not verified for translation.
- **FR-010**: Model verification results MUST be cached with a configurable Time-To-Live (minimum 10 minutes) to eliminate redundant provider calls during UI rendering and repeated translation requests.
- **FR-011**: The frontend MUST NOT have the authority to bypass backend verification; the backend MUST remain the authoritative enforcement point for translation model eligibility.
- **FR-012**: The UI in `ApiSettings.tsx` and related components MUST reflect the verification state of custom and discovered models (e.g., Verified badge, verification timestamp, or retry verification button if unverified).

### Key Entities *(include if feature involves data)*

- **VerifiedModelRegistryEntry**: Represents a fully qualified model in the registry, tracking identification, source origin, verification state (`verified`, `lastVerifiedAt`), operational lifecycle status (`active`, `deprecated`, `shutdown`), capabilities, and rate/token limits.
- **ModelVerificationRequest**: Data payload containing model ID and candidate API key (or session token) submitted to verify a model's operational status and capabilities.
- **ModelVerificationResult**: Response payload indicating verification outcome (`success: boolean`, `verifiedModel?: VerifiedModelRegistryEntry`, `error?: string`, `errorCode?: string`).
- **ModelCapabilities**: Boolean map defining specific functional features supported by the model (`generateContent`, `structuredOutput`, `vision`, `thinking`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of translation requests targeting unverified or non-existent model IDs are rejected before reaching Gemini execution pipelines.
- **SC-002**: 100% of valid custom models that support `generateContent` can be verified, added to the registry, and successfully used for translations without code changes or server restarts.
- **SC-003**: 0 additional Gemini API calls are made for model verification during regular UI navigation and re-renders when models are already cached.
- **SC-004**: 100% of automated tests (linting, unit tests, integration tests) pass cleanly without type errors or skipped assertions.
- **SC-005**: 0 regressions in existing preset model selection, dynamic pacing, or quota monitoring workflows.

## Assumptions

- Google Generative Language API provides model metadata via the `models` endpoint or `models.get` / `models.list` methods when queried with a valid API key.
- Preset models defined in `shared/models.ts` have known fixed capabilities and are trusted by default without runtime pinging.
- Verification cache utilizes in-memory storage (with optional Redis support) on the backend and localStorage on the client for fast access.
- Non-Gemini local models (such as `gemma-4-31b-it`) are categorized as verified presets with local execution capabilities.

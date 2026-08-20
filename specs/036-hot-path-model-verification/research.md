# Research & Architectural Audit: Zero Model Verification in Translation Hot Path

## 1. Audit Findings & Root Cause Analysis

### 1.1 Hot Path Network Leakage
- **Problem**: `server/routes/api.ts:validateModelMiddleware` sits directly on the translation hot path (`POST /translate-raw`, `/polish-translation`, `/qa-critique`, `/align-chapter`, `/analyze-glossary`, etc.).
- **Call Stack**:
  ```text
  Client Translation Request (e.g. POST /translate-raw)
     │
     ▼
  validateModelMiddleware (server/routes/api.ts)
     │
     ▼
  modelInfoService.isModelVerified(model, validKeys)
     │
     ▼
  modelInfoService.verifySingleModel(cleanId, apiKeys[0])   <-- NETWORK LEAKAGE!
     │
     ▼
  fetchSingleModelFromGoogle(cleanId, trimmedKey)            <-- HTTP GET to Google API
  ```
- **Consequence**: When an uncached or custom model is sent in a translation payload, `validateModelMiddleware` triggers an outbound Google API call before even queueing the translation. This adds 1-15s latency, risks quota exhaustion, and leaks side-effects into a fast validation middleware.

### 1.2 Lack of Single-Flight Concurrency Deduplication
- **Problem**: If 20 translation requests or verification requests for the same unverified model arrive simultaneously, `modelInfoService.verifySingleModel` is called 20 times in parallel.
- **Consequence**: 20 distinct HTTP requests are made to Google AI Studio for the exact same model ID (`GET /v1beta/models/...`). This is a classic **Thundering Herd / Cache Stampede** pattern.

---

## 2. Technical Decisions & Solution Design

### 2.1 Pure In-Memory Hot Path Validation (`isModelVerifiedCached`)
- **Design**:
  - Introduce `modelInfoService.isModelVerifiedCached(modelId: string): boolean`.
  - Checks **only**:
    1. Active/deprecated presets in `AVAILABLE_MODELS`.
    2. Valid entries in `this.verifiedModelsCache` (within 15m TTL).
  - Performs **0 network calls**. Execution time is $< 0.05$ms.
  - `validateModelMiddleware` uses `isModelVerifiedCached(model)`. If false, it immediately rejects with HTTP 400 `code: 'MODEL_UNVERIFIED'`.

### 2.2 Single-Flight In-Flight Promise Map (`inFlightVerifications`)
- **Design**:
  - In `modelInfoService`:
    ```typescript
    private inFlightVerifications = new Map<string, Promise<ModelDefinition>>();
    ```
  - When `verifySingleModel(modelId, apiKey, customLabel)` is called:
    1. Normalize `normId = modelId.replace(/^models\//i, '').trim().toLowerCase()`.
    2. Check `this.verifiedModelsCache.get(normId)`. If hit, return cached model.
    3. Check `this.inFlightVerifications.get(normId)`. If hit, return existing Promise!
    4. If not in flight, create new Promise `doVerify()` and store in `this.inFlightVerifications.set(normId, promise)`.
    5. In `finally` block of the promise: `this.inFlightVerifications.delete(normId)`.
- **Concurrency Guarantee**: $N$ concurrent calls to `verifySingleModel` for the same model ID will result in exactly 1 network call, and all $N$ callers await and receive the same `ModelDefinition` or reject with the same error.

### 2.3 Explicit Path vs Hot Path Separation
- **Explicit Verification Endpoint (`POST /api/verify-model`)**:
  - The designated entry point for verifying custom models.
  - Calls `modelInfoService.verifySingleModel(modelId, apiKey, label)` (leveraging the single-flight deduplicator).
  - Caches successful models in `verifiedModelsCache`.
- **Hot Path (`POST /api/translate-raw`, etc.)**:
  - Strictly consumers of the cache.
  - Never initiates background or on-demand verification network calls.

---

## 3. Test Strategy & Acceptance Matrix

| Scenario | Expected Behavior | Network Calls |
| :--- | :--- | :--- |
| **1. Cache Hit (Preset)** | `validateModelMiddleware` passes | 0 |
| **2. Cache Hit (Verified Custom)** | `validateModelMiddleware` passes | 0 |
| **3. Cache Miss (Hot Path)** | `validateModelMiddleware` rejects 400 `MODEL_UNVERIFIED` in $<5$ms | 0 |
| **4. Concurrent Verification (20 calls)** | 20 requests to `/api/verify-model` resolve simultaneously | **1** |
| **5. Verification Failure (404/Missing cap)** | All concurrent callers reject with error, in-flight map cleaned up | 1 |
| **6. Re-verification / Refresh** | Cache updated with new metadata | 1 |

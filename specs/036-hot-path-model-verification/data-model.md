# Data Model: Hot Path Model Verification & Concurrency Deduplication

## 1. Entity Architecture

```mermaid
graph TD
    Client[Client Translation / UI]
    
    subgraph Hot Path [Hot Path (0 Network Calls)]
        VMM[validateModelMiddleware]
        VMC[isModelVerifiedCached]
        Cache[(verifiedModelsCache 15m TTL)]
        Presets[(AVAILABLE_MODELS)]
    end
    
    subgraph Explicit Verification Path [Explicit Path (Single-Flight Deduplication)]
        EVP[POST /api/verify-model]
        VSM[verifySingleModel]
        IFM[inFlightVerifications Map]
        Fetch[Google AI Studio API]
    end

    Client -->|POST /translate-raw| VMM
    VMM -->|Model check| VMC
    VMC -->|1. Lookup| Presets
    VMC -->|2. Lookup| Cache
    VMC -.->|Hit| Next[next Controller]
    VMC -.->|Miss| Err400[HTTP 400 MODEL_UNVERIFIED]

    Client -->|POST /api/verify-model| EVP
    EVP --> VSM
    VSM -->|Check in-flight| IFM
    IFM -->|First caller| Fetch
    IFM -->|Subsequent callers| AwaitPromise[Await existing Promise]
    Fetch -->|Populate| Cache
```

---

## 2. In-Memory Data Structures

### `verifiedModelsCache`
- **Type**: `Map<string, { timestamp: number; model: ModelDefinition }>`
- **TTL**: 15 minutes (`CACHE_TTL_MS = 15 * 60 * 1000`).
- **Key**: Normalized Model ID (lowercase, without `models/` prefix).

### `inFlightVerifications`
- **Type**: `Map<string, Promise<ModelDefinition>>`
- **Key**: Normalized Model ID.
- **Lifecycle**:
  - Inserted when a verification request starts.
  - Awaited by any subsequent concurrent requests for the same key.
  - Deleted in `finally` block upon completion (success or error).

---

## 3. State Lifecycle Transitions

```text
[Unverified / Uncached]
       │
       │ (User triggers Explicit Verification: POST /api/verify-model)
       ▼
[In-Flight Verification]  <--- Concurrent requests coalesce here (1 network call)
       │
       ├─ [Success] ──► [Cached & Verified (15m TTL)] ──► Allowed in Translation Hot Path
       │
       └─ [Failure] ──► [Evicted / Invalid] ──► Rejected in Translation Hot Path (400)
```

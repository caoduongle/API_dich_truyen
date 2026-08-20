# Research & Architectural Analysis: Infrastructure, Security & Resiliency Hardening

## 1. Security & Encryption Architecture (Phase 1)

### 1.1 AES-256-GCM Session Key Encryption
- **Algorithm**: `aes-256-gcm` (Authenticated Encryption with Associated Data).
- **Key Derivation**: Derive a 32-byte key from `process.env.ENCRYPTION_MASTER_KEY` using `crypto.scryptSync(masterKey, 'salt_api_dich_truyen', 32)`. If `ENCRYPTION_MASTER_KEY` is not provided in development, a deterministic fallback with a security warning is generated.
- **Payload Format**: `iv:authTag:encryptedHex`
  - `iv`: 12-byte random initialization vector (hex).
  - `authTag`: 16-byte GCM authentication tag (hex).
  - `encryptedHex`: Encrypted JSON string of the API keys array.
- **Decryption & Tamper Protection**: If `authTag` verification fails, decryption throws an authentication error and the session is rejected.

### 1.2 Scoped Idempotency & Conflict Detection
- **Composite Key**: `idemp:{identityScope}:{endpointPath}:{clientKey}`
  - `identityScope`: `session:{hash}` (if `X-Session-Token` present), `auth:{hash}`, or `ip:{hash}`.
  - `endpointPath`: `${method}:${path}`.
  - `clientKey`: Client-provided `Idempotency-Key` header or `req.body.idempotencyKey`.
- **Payload Fingerprint**: SHA-256 hash of canonical JSON request body.
- **Conflict Behavior**: If an active or completed idempotency entry exists for the same key but with a different body fingerprint, the server immediately returns `HTTP 409 Conflict` with:
  ```json
  {
    "error": "Idempotency key mismatch: The provided idempotency key was already used with a different request payload.",
    "code": "IDEMPOTENCY_PAYLOAD_MISMATCH"
  }
  ```

### 1.3 Telemetry & Log Redaction
- Regex patterns for Google API keys: `/AIzaSy[A-Za-z0-9_-]{33}/g`.
- Regex patterns for Session tokens: `/session_[a-f0-9-]{36}/gi` and UUIDs.
- Applied automatically across Express error handlers, morgan/winston loggers, and telemetry collectors.

---

## 2. Quota Group Authority & Key Health Decoupling (Phase 2)

### 2.1 Quota Group Authority vs False Capacity Summing
- Google Cloud Project quotas apply to the entire project billing bucket, not per API key.
- **Law 1**: Having 5 API keys under the same Google Cloud Project still gives only 15 RPM, NOT 75 RPM.
- `quotaService` organizes keys into `QuotaGroup` entities:
  ```typescript
  export interface QuotaGroup {
    id: string;
    name: string;
    keyHashes: string[];
    configuredQuota: ConfiguredQuota; // Project-level RPM, TPM, RPD
    observedUsage: GroupObservedUsage;
    schedulingHint: GroupSchedulingHint;
    healthState: GroupHealthState;
  }
  ```
- Pacing is computed at the **Group level** (`group.schedulingHint.effectiveIntervalMs`).

### 2.2 Key Health State Machine
- States: `HEALTHY`, `COOLDOWN`, `DEGRADED`, `AUTH_FAILED`, `DISABLED`.
- Transition rule: When an upstream call fails with HTTP 401 Unauthorized or 403 Forbidden (`AUTH_FAILED`), ONLY the specific API key is marked `AUTH_FAILED` and removed from scheduler rotation.
- The remaining healthy keys in the `QuotaGroup` continue serving requests normally.

---

## 3. Model Verification & Singleflight Architecture (Phase 3)

### 3.1 5-State Model Lifecycle
- `UNVERIFIED`: Custom model not yet tested with Google API.
- `VERIFIED`: Model confirmed by Google API with `generateContent` capability.
- `INVALID`: Model does not exist (404) or lacks `generateContent` (e.g. `text-embedding-004`).
- `DEPRECATED`: Model functional but scheduled for sunset.
- `SHUTDOWN`: Model permanently retired (e.g. `gemini-2.0-flash` on 2026-06-01).

### 3.2 Singleflight Deduplication & Non-Blocking Hot Path
- `inFlightVerifications: Map<string, Promise<ModelDefinition>>` prevents Thundering Herd during explicit verification (`POST /api/verify-model`).
- `validateModelMiddleware` on translation hot paths calls `isModelVerifiedCached(model)` with **0 network calls**.

---

## 4. Error Taxonomy, Scoped Circuit Breaker & Concurrency Gate (Phase 4)

### 4.1 Normalized Error Taxonomy
- `RATE_LIMITED`: HTTP 429 / ResourceExhausted (temporary RPM/TPM spike).
- `QUOTA_EXCEEDED`: Daily RPD quota depleted.
- `AUTH_FAILED`: HTTP 401/403 API key invalid or leaked.
- `OVERLOADED`: HTTP 503 / ServiceUnavailable from Google AI.
- `SAFETY_BLOCKED`: Prompt/response blocked by safety filters.
- `NETWORK_ERROR`: DNS / Socket reset / Aborted connection.
- `TIMEOUT`: Request exceeded deadline (e.g. 15s/30s).

### 4.2 Scoped Circuit Breaker
- Cooldown scope is composite: `[QuotaGroupId + ModelId]`.
- When `gemini-2.5-pro` in Group 1 receives 503 Overloaded, only `Group1:gemini-2.5-pro` enters cooldown. Requests to `gemini-2.5-flash` in Group 1 or Group 2 proceed unaffected.

### 4.3 Concurrency Gate
- `MAX_CONCURRENT_REQUESTS = 50`.
- In-flight counter tracks active requests across translation endpoints.
- If threshold is exceeded, server returns `HTTP 503 Service Unavailable` with `Retry-After: 5`.

---

## 5. Redis Graceful Degradation & Telemetry Semantics (Phase 5)

### 5.1 Redis In-Memory Fallback
- `redisManager` monitors connection status (`connected`, `reconnecting`, `offline`).
- When offline, `SessionStore` and `idempotencyMiddleware` seamlessly fall back to local `Map` storage.
- Health endpoint `GET /ready` returns HTTP 200 `{ "status": "ready", "degraded": true, "redis": "offline" }`.

### 5.2 Metrics Disambiguation
- **Logical Request**: A single end-user intent (e.g. 1 translation request from web client).
- **Provider Attempt**: An outbound HTTP call to Google Gemini API (including retries, rotations, and fallbacks).
- Metrics tracked separately:
  - `logicalRequestsTotal`
  - `providerAttemptsTotal`
  - `successfulRequestsTotal`
  - `failedRequestsTotal`
  - `retriesTotal`

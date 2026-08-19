# Technical Research & Architecture Decisions: Model Quota & System Resilience

**Feature**: `013-model-quota-resilience`  
**Date**: 2026-08-19  
**Status**: Completed  

---

## 1. Unified Canonical Model Registry & Lifecycle Representation

### Context & Problem
Frontend (`src/utils/modelRegistry.ts`) uses dynamic registration for preset, discovered, and custom models, while `shared/models.ts` and `server/constants/models.ts` originally exported a static array `ALLOWED_MODEL_IDS`. In addition, backend validation needed to securely verify models without hardcoded lists while preventing arbitrary malicious strings from reaching Google API.

### Decisions
1. **Canonical Interface**: Standardize `ModelDefinition` across `@shared/models` and `src/utils/modelRegistry.ts`:
   ```ts
   export type ModelSource = 'preset' | 'discovered' | 'custom';
   export type ModelStatus = 'active' | 'deprecated' | 'shutdown';

   export interface ModelCapabilities {
     generateContent: boolean;
     structuredOutput?: boolean;
     vision?: boolean;
     thinking?: boolean;
   }

   export interface ModelDefinition {
     id: string;
     label: string;
     source: ModelSource;
     status: ModelStatus;
     capabilities: ModelCapabilities;
     replacementId?: string;
     description?: string;
     inputTokenLimit?: number;
     outputTokenLimit?: number;
     addedAt?: string;
   }
   ```
2. **Server-Side Validation**: Backend maintains a canonical registry of known presets and provides a verification cache for discovered and custom models. Incoming translation requests must pass format validation (`MODEL_ID_REGEX`) and capability check (`capabilities.generateContent === true`).
3. **Lifecycle Migration**: If a persisted model is marked `shutdown`, client-side selection migration automatically routes to `replacementId` or `DEFAULT_MODEL_ID` with a non-blocking toast/notice, avoiding crashes.

### Alternatives Considered
- *Hardcoded whitelist on backend*: Rejected because it breaks user-discovered models from Google API and custom fine-tuned models.
- *Blindly allowing any string from browser*: Rejected due to SSRF / untrusted input risks and potential upstream 500 crashes on invalid endpoint formats.

---

## 2. Rate Limiting vs. Gemini Quota Scheduling Architectural Separation

### Context & Problem
Confusion in rate-limiting architecture could lead to treating HTTP protection (60 req/min/IP) as Gemini API key quota, or mistaking fallback pacing (~13 RPM for Flash models) as a global limit.

### Decisions
1. **HTTP Anti-Abuse Layer (Per-IP)**:
   - Fixed at `60 requests / minute / IP` (via Redis Lua sliding counter or in-memory fallback).
   - Dedicated login limiter at `5 requests / 15 minutes / IP`.
2. **Gemini Key Scheduling Layer (Per-Key)**:
   - Dynamic Pacing Interval: `Math.max(400, Math.ceil(60000 / (customRpm * 0.9)))` on server, `500ms` floor on client.
   - Sliding Window Token Tracking: Tracking tokens consumed in the last 60 seconds (TPM) and daily usage (RPD).
   - Candidate Key Scoring: Scored based on remaining capacity, error count, and last used timestamp.

### Rationale
Completely decouples denial-of-service HTTP protection from upstream AI quota governance.

---

## 3. Admission Control & Predictive TPM

### Context & Problem
Sending translation requests without prior token estimation causes 429 quota exhaustion mid-batch when long chapters (>5,000 tokens) are processed simultaneously.

### Decisions
1. **Pre-Flight Estimation**: Reuse existing lightweight token estimator `estimateTokenCount(text)` (approx. 1.3 - 2 tokens per Chinese character / English word) before dispatching.
2. **Feasibility Check**: If estimated tokens + `currentTpm` >= `maxTpm * 0.85`, the scheduler switches candidate key or triggers cooperative pacing/queueing instead of immediately failing or creating a retry storm.

---

## 4. Error Taxonomy & Smart Retry Mapping

### Context & Problem
Error detection previously relied on substring matching scattered in `geminiService.ts`, `rawController.ts`, and `polishController.ts`.

### Decisions
1. **Standardized Error Taxonomy**:
   ```ts
   export enum AIErrorCode {
     RATE_LIMITED = "RATE_LIMITED",
     QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
     AUTH_FAILED = "AUTH_FAILED",
     MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
     MODEL_UNSUPPORTED = "MODEL_UNSUPPORTED",
     INVALID_REQUEST = "INVALID_REQUEST",
     SAFETY_BLOCKED = "SAFETY_BLOCKED",
     SERVER_ERROR = "SERVER_ERROR",
     NETWORK_ERROR = "NETWORK_ERROR",
     TIMEOUT = "TIMEOUT",
   }
   ```
2. **Action Matrix**:
   - `RATE_LIMITED` / `QUOTA_EXCEEDED`: Cooldown key, rotate to next candidate.
   - `AUTH_FAILED`: Disable key immediately, notify user, do NOT retry on that key.
   - `MODEL_NOT_FOUND` / `MODEL_UNSUPPORTED`: Mark model `shutdown` or invalid, abort without key rotation.
   - `SAFETY_BLOCKED`: Return clear safety explanation, do NOT retry upstream.
   - `SERVER_ERROR` (503 Overload): Exponential backoff with jitter on key, up to `MAX_OVERLOAD_RETRIES`.
   - `NETWORK_ERROR` / `TIMEOUT`: Retry with backoff.

---

## 5. Circuit Breaker Strategy

### Context & Problem
Repeated calls to failing keys or broken model endpoints waste execution time and quota.

### Decisions
- **Per-Key Breaker**: Trips to `Open` state after 3 consecutive auth/quota errors or 5 consecutive network errors within 60s. Cooldown duration: 5 minutes (`BLACKLIST_COOLDOWN_MS`).
- **Half-Open Transition**: After cooldown expires, the key is permitted a single test probe request. If successful, transitions to `Closed` (Healthy); if failed, returns to `Open`.

---

## 6. Redis Graceful Degradation Strategy

### Context & Problem
Redis outage should neither completely crash the server nor disable all security/rate-limiting controls.

### Decisions
1. **Bounded In-Memory Fallback**: When Redis commands fail or Redis client emits `error`/`end`, the rate limiter falls back to a bounded `Map` with periodic TTL cleanup (maximum 10,000 active IP entries to prevent memory leaks).
2. **Automatic Reconnection**: Upon Redis connection recovery (`connect` / `ready` events), the middleware seamlessly resumes Redis Lua script evaluation.

---

## 7. Translation Idempotency & In-Flight Request Deduplication

### Context & Problem
Network dropouts or user double-clicks could trigger duplicate Gemini generation calls, consuming double quota and tokens.

### Decisions
- **Header**: `Idempotency-Key: <uuid / hash>`.
- **In-Memory / Cache Store**: Tracks state (`pending`, `completed`, `failed`).
  - If `pending`: Joins the existing in-flight Promise.
  - If `completed`: Immediately returns cached JSON response with header `X-Cache: HIT`.
  - If `failed`: Allows fresh retry.
  - TTL: 5 minutes for completed results.

---

## 8. Translation Job Architecture Evaluation

### Analysis
- Average chapter translation duration: 3 - 12 seconds per stage.
- Current architecture: Client-orchestrated pipeline with server-side rate pacing, chunk caching (`translationChunkCache`), and adaptive divide-and-conquer splitting.
- **Evaluation Outcome**: Synchronous HTTP with streaming / chunking + Idempotency is optimal for interactive novel translation. Introducing a persistent asynchronous job database (e.g. BullMQ + PostgreSQL) would introduce excessive operational complexity without UX gain for single-user/small-batch translation.
- **Decision**: Retain synchronous/streaming pipeline reinforced by Idempotency keys and robust request admission control.

# Data Model: Infrastructure, Security & Resiliency Hardening

## 1. Entity Relationship Diagram

```mermaid
classDiagram
    class SessionStore {
        +createSession(apiKeys: string[], ttlMs: number)
        +getSessionKeys(sessionToken: string)
        -encryptKeys(keys: string[]) string
        -decryptKeys(encrypted: string) string[]
    }

    class IdempotencyStore {
        +get(key: string) IdempotencyEntry
        +set(key: string, entry: IdempotencyEntry)
        +checkConflict(key: string, fingerprint: string) boolean
    }

    class QuotaGroup {
        +string id
        +string name
        +string[] keyHashes
        +ConfiguredQuota configuredQuota
        +GroupObservedUsage observedUsage
        +GroupSchedulingHint schedulingHint
        +GroupHealthState healthState
    }

    class ApiKeyEntity {
        +string keyHash
        +string maskedKey
        +KeyHealthState healthState
        +number cooldownUntil
        +number failureCount
    }

    class ModelInfoService {
        +verifySingleModel(modelId, apiKey) Promise~ModelDefinition~
        +isModelVerifiedCached(modelId) boolean
        -Map inFlightVerifications
        -Map verifiedModelsCache
    }

    class MetricsService {
        +recordLogicalRequest(status, latency)
        +recordProviderAttempt(modelId, status, latency)
        +recordRetry()
        +getMetricsSnapshot()
    }

    SessionStore --> ApiKeyEntity : manages
    QuotaGroup "1" o-- "*" ApiKeyEntity : contains
```

---

## 2. Encrypted Session Data Structure

### `EncryptedSessionPayload` (Stored in Redis / Memory)
```typescript
export interface EncryptedSessionData {
  encryptedKeys: string;     // Format: "iv_hex:authTag_hex:ciphertext_hex"
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
}
```

---

## 3. Scoped Idempotency Entry

```typescript
export interface IdempotencyEntry {
  key: string;               // "idemp:session:hash123:POST:/api/translate-raw:user-client-key"
  fingerprint: string;       // sha256(canonicalJson(body))
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  statusCode?: number;
  responseBody?: any;
  listeners: Array<(result: IdempotencyListenerResult) => void>;
}
```

---

## 4. Key Health State Machine Transitions

```text
[HEALTHY] ─── (HTTP 429 / 503 Overload) ───► [COOLDOWN] (auto-recovers after cooldownExpiry)
   │
   ├────────── (HTTP 401 / 403) ────────────► [AUTH_FAILED] (permanently isolated from rotation)
   │
   ├────────── (Repeated Transient Errors) ─► [DEGRADED] (deprioritized in scheduling)
   │
   └────────── (User action) ───────────────► [DISABLED]
```

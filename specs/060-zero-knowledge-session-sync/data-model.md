# Data Model & Schema: Zero-Knowledge Session Sync

**Feature Directory**: `specs/060-zero-knowledge-session-sync`  
**Feature Branch**: `060-zero-knowledge-session-sync`  

---

## 1. Entities & Data Models

### A. Client-Side Cryptographic Session Entities
```typescript
/**
 * Raw API key held only in browser memory and sessionStorage
 */
type RawApiKey = string;

/**
 * SHA-256 lowercase hex string (64 characters)
 * Computed via crypto.subtle.digest('SHA-256', textEncoder.encode(key.trim()))
 */
type KeyHash = string; // /^[0-9a-f]{64}$/

/**
 * Session creation payload dispatched from client to server
 */
interface SessionSyncPayload {
  keyHashes: KeyHash[];
}

/**
 * Server session response received by client
 */
interface SessionSyncResponse {
  sessionToken: string; // "session_<uuid>"
  keyCount: number;
  expiresAt: string; // ISO 8601 string
  message: string;
}
```

### B. Server Session Store Entities (`server/services/sessionStore.ts`)
```typescript
interface SessionData {
  keyHashes: string[];      // Array of 64-character SHA-256 hex hashes
  createdAt: number;        // Epoch millisecond timestamp
  lastAccessedAt: number;   // Epoch millisecond timestamp
  expiresAt: number;        // Epoch millisecond timestamp
}

interface SessionInfo {
  valid: boolean;
  keyCount: number;
  expiresAt?: string;
}
```

### C. Quota Status Entities (`server/services/quotaService.ts`)
```typescript
interface QuotaStatusRequest {
  keyHashes?: string[];
  apiKeys?: string[]; // Legacy fallback for transitional client support
}

interface KeyQuotaFullSnapshot {
  keyHash: string;
  maskedKey: string;
  requestsTotal: number;
  requestsToday: number;
  requestsThisMinute: number;
  errorsTotal: number;
  tokensTotal?: number;
  tokensToday?: number;
  tokensThisMinute?: number;
  byModel: Record<string, ModelUsageStats>;
  runtime: KeyRuntimeStatus;
  healthState?: string;
  cooldownRemainingMs?: number;
}
```

---

## 2. Sequence Diagram: Zero-Knowledge Session Sync & AI Execution

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant ClientStore as Client Memory / SessionStorage
    participant WebCrypto as Web Crypto API
    participant ServerApp as Application Server (/api/*)
    participant SessionStore as Session Store (Redis / Memory)
    participant Gemini as Google Gemini API

    Note over User,ClientStore: 1. User Enters API Key
    User->>ClientStore: Save apiKey ("AIzaSy...")
    ClientStore->>WebCrypto: crypto.subtle.digest('SHA-256', rawKey)
    WebCrypto-->>ClientStore: return keyHash (64 hex chars)
    
    Note over ClientStore,ServerApp: 2. Zero-Knowledge Session Sync
    ClientStore->>ServerApp: POST /api/session-keys { keyHashes: ["e3b0c442..."] }
    ServerApp->>ServerApp: Validate regex /^[0-9a-f]{64}$/
    ServerApp->>SessionStore: Store { keyHashes, createdAt, expiresAt }
    ServerApp-->>ClientStore: 200 OK { sessionToken: "session_123...", expiresAt }

    Note over ClientStore,Gemini: 3. Direct AI Operation (Translation, Discovery, Verify)
    ClientStore->>Gemini: POST /models/gemini-2.5-flash:generateContent (Header: x-goog-api-key)
    Gemini-->>ClientStore: Direct Translation Response (Zero server intermediary)

    Note over ClientStore,ServerApp: 4. Quota Metric Check
    ClientStore->>ServerApp: POST /api/quota-status { keyHashes: ["e3b0c442..."] } (Header: X-Session-Token)
    ServerApp-->>ClientStore: 200 OK { keys: [{ keyHash: "e3b0c442...", requestsToday: 15 }] }
    ClientStore->>ClientStore: Locally compute maskApiKey(rawKey) and display in UI
```

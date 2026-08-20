# Contract: State Ownership & Storage Invariants

**Feature**: State Ownership & Storage Cleanup  
**Directory**: `specs/026-state-ownership-cleanup/contracts/`  
**Contract Name**: `state-ownership-matrix.contract.md`  

---

## 1. Storage Domain Contract

```typescript
export type StorageDomain =
  | 'PROJECTS_CONTENT'
  | 'API_CREDENTIALS'
  | 'AUTH_CREDENTIALS'
  | 'SELECTED_MODEL'
  | 'DISCOVERED_MODELS'
  | 'QUOTA_USAGE'
  | 'KEY_HEALTH'
  | 'CHUNK_CACHE'
  | 'IDEMPOTENCY'
  | 'UI_PREFERENCES';

export interface StorageTierContract {
  domain: StorageDomain;
  sourceOfTruth: 'IndexedDB' | 'ServerSession' | 'ServerAuth' | 'ServerQuota' | 'ServerModelRegistry' | 'ServerCache' | 'LocalStorage';
  cacheLayer: 'None' | 'ReactMemory' | 'LocalStorage' | 'ServerMemory';
  ttlMs?: number;
  evictionStrategy: 'None' | 'LRU' | 'FixedTTL' | 'DailyPSTMidnight' | 'ManualUserWipe';
  migrationStrategy: 'None' | 'IndexedDBVersionMigration' | 'SessionReSync' | 'DefaultFallbackOnDeprecation';
  allowedKeys: string[];
}
```

---

## 2. Invariant Assertions Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "StateOwnershipInvariants",
  "type": "object",
  "required": [
    "zeroDualWriteAmbiguity",
    "zeroManuscriptInLocalStorage",
    "zeroPlainKeysInLocalStorage",
    "authoritativeQuotaServerOnly"
  ],
  "properties": {
    "zeroDualWriteAmbiguity": {
      "type": "boolean",
      "description": "True if all storage keys map to exactly one authoritative source of truth"
    },
    "zeroManuscriptInLocalStorage": {
      "type": "boolean",
      "description": "True if no chapter text, paragraphs, or book manuscripts are stored in localStorage"
    },
    "zeroPlainKeysInLocalStorage": {
      "type": "boolean",
      "description": "True if plain API keys are forbidden in localStorage and migrated immediately to sessionStorage"
    },
    "authoritativeQuotaServerOnly": {
      "type": "boolean",
      "description": "True if RPM/TPM/RPD and circuit breaker states are strictly calculated by QuotaService"
    }
  }
}
```
